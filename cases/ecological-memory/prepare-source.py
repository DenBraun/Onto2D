#!/usr/bin/env python3
"""Build the bounded SOAP LiDAR state projection used by Ecological Memory.

The source LAZ and GeoTIFF files remain external because they total roughly
143 MiB.  This script consumes their exact bytes and writes a compact,
reviewable projection.  It intentionally does not download data, infer a fire
perimeter, or assign causation.

Optional, pinned preparation environment:

    numpy==2.0.2
    laspy==2.6.1
    lazrs==0.6.3
    rasterio==1.4.3
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import laspy
import numpy as np
import rasterio


FORMAT = "onto2d-neon-soap-lidar-projection"
FORMAT_VERSION = "1"
PROFILE_VERSION = "soap-classified-vegetation-height-v1"
YEARS = (2019, 2021)
CLASSIFICATION = 5
MINIMUM_RETURNS_PER_CELL = 50
MINIMUM_HEIGHT_METERS = 0.0
MAXIMUM_HEIGHT_METERS = 80.0
QUANTILES = (0.2, 0.5, 0.75, 0.9)
CHUNK_SIZE = 1_000_000
EXPECTED_GRID = (1000, 1000)
CELL_SIZE_METERS = 10


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def round_number(value: float, places: int = 6) -> float:
    return round(float(value), places)


def file_lock(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "name": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def project_year(path: Path, year: int, terrain: np.ndarray, transform: Any) -> dict[str, Any]:
    cell_ids: list[np.ndarray] = []
    heights: list[np.ndarray] = []
    classification_counts: dict[str, int] = {}
    counters = {
        "outsideTerrain": 0,
        "terrainNoData": 0,
        "selectedClassification": 0,
        "belowHeightRange": 0,
        "aboveHeightRange": 0,
        "retained": 0,
    }

    with laspy.open(path) as reader:
        point_count = int(reader.header.point_count)
        for points in reader.chunk_iterator(CHUNK_SIZE):
            x = np.asarray(points.x)
            y = np.asarray(points.y)
            z = np.asarray(points.z)
            classifications = np.asarray(points.classification)

            values, counts = np.unique(classifications, return_counts=True)
            for value, count in zip(values, counts):
                key = str(int(value))
                classification_counts[key] = classification_counts.get(key, 0) + int(count)

            columns = np.floor((x - transform.c) / transform.a).astype(np.int64)
            rows = np.floor((y - transform.f) / transform.e).astype(np.int64)
            inside = (
                (columns >= 0)
                & (columns < terrain.shape[1])
                & (rows >= 0)
                & (rows < terrain.shape[0])
            )
            counters["outsideTerrain"] += int((~inside).sum())

            selected = inside & (classifications == CLASSIFICATION)
            counters["selectedClassification"] += int(selected.sum())
            if not selected.any():
                continue

            selected_rows = rows[selected]
            selected_columns = columns[selected]
            selected_ground = terrain[selected_rows, selected_columns]
            ground_valid = np.isfinite(selected_ground) & (selected_ground != -9999.0)
            counters["terrainNoData"] += int((~ground_valid).sum())

            selected_rows = selected_rows[ground_valid]
            selected_columns = selected_columns[ground_valid]
            selected_heights = z[selected][ground_valid] - selected_ground[ground_valid]
            below = selected_heights < MINIMUM_HEIGHT_METERS
            above = selected_heights > MAXIMUM_HEIGHT_METERS
            counters["belowHeightRange"] += int(below.sum())
            counters["aboveHeightRange"] += int(above.sum())
            retained = ~(below | above)
            if not retained.any():
                continue

            selected_rows = selected_rows[retained]
            selected_columns = selected_columns[retained]
            selected_heights = selected_heights[retained]
            ids = (selected_rows // CELL_SIZE_METERS) * 100 + (selected_columns // CELL_SIZE_METERS)
            cell_ids.append(ids.astype(np.uint16, copy=False))
            heights.append(selected_heights.astype(np.float64, copy=False))
            counters["retained"] += int(retained.sum())

    all_ids = np.concatenate(cell_ids)
    all_heights = np.concatenate(heights)
    order = np.argsort(all_ids, kind="stable")
    all_ids = all_ids[order]
    all_heights = all_heights[order]
    ids, starts, counts = np.unique(all_ids, return_index=True, return_counts=True)

    cells = []
    excluded_for_coverage = 0
    for cell_id, start, count in zip(ids, starts, counts):
        if int(count) < MINIMUM_RETURNS_PER_CELL:
            excluded_for_coverage += 1
            continue
        values = all_heights[start : start + count]
        quantiles = np.quantile(values, QUANTILES, method="linear")
        row = int(cell_id) // 100
        column = int(cell_id) % 100
        cells.append(
            {
                "cellId": int(cell_id),
                "row": row,
                "column": column,
                "easting": int(transform.c + column * CELL_SIZE_METERS),
                "northing": int(transform.f - row * CELL_SIZE_METERS),
                "returnCount": int(count),
                "heightP20": round_number(quantiles[0]),
                "heightP50": round_number(quantiles[1]),
                "heightP75": round_number(quantiles[2]),
                "heightP90": round_number(quantiles[3]),
            }
        )

    return {
        "year": year,
        "pointCount": point_count,
        "classificationCounts": dict(sorted(classification_counts.items(), key=lambda item: int(item[0]))),
        "filterCounts": {**counters, "cellsBelowMinimumReturns": excluded_for_coverage},
        "qualifiedCellCount": len(cells),
        "cells": cells,
    }


def build_projection(lidar_2019: Path, lidar_2021: Path, dtm_2021: Path) -> dict[str, Any]:
    with rasterio.open(dtm_2021) as source:
        if (source.width, source.height) != EXPECTED_GRID or source.count != 1:
            raise ValueError("The DTM must be one 1000 x 1000 band")
        if str(source.crs) != "EPSG:32611":
            raise ValueError("The DTM CRS must remain EPSG:32611")
        if tuple(source.transform) != (1.0, 0.0, 293000.0, 0.0, -1.0, 4101000.0, 0.0, 0.0, 1.0):
            raise ValueError("The DTM transform differs from the approved SOAP tile")
        terrain = source.read(1)
        transform = source.transform
        terrain_metadata = {
            "width": source.width,
            "height": source.height,
            "crs": str(source.crs),
            "transform": list(source.transform),
            "noData": source.nodata,
            "imageDescription": source.tags().get("TIFFTAG_IMAGEDESCRIPTION"),
            "flightTime": source.tags().get("TIFFTAG_DATETIME"),
        }

    files = {
        2019: lidar_2019,
        2021: lidar_2021,
    }
    surveys = [project_year(files[year], year, terrain, transform) for year in YEARS]
    return {
        "format": FORMAT,
        "formatVersion": FORMAT_VERSION,
        "profileVersion": PROFILE_VERSION,
        "sourceFiles": [
            file_lock(lidar_2019, "pre-fire-lidar"),
            file_lock(lidar_2021, "post-fire-lidar"),
            file_lock(dtm_2021, "shared-terrain-reference"),
        ],
        "site": {
            "siteCode": "SOAP",
            "siteName": "Soaproot Saddle",
            "domainId": "D17",
            "tile": "293000_4100000",
        },
        "terrainReference": terrain_metadata,
        "projection": {
            "classificationCode": CLASSIFICATION,
            "classificationLabel": "high vegetation",
            "heightReference": "2021 DTM",
            "heightRangeMeters": [MINIMUM_HEIGHT_METERS, MAXIMUM_HEIGHT_METERS],
            "cellSizeMeters": CELL_SIZE_METERS,
            "minimumReturnsPerCell": MINIMUM_RETURNS_PER_CELL,
            "quantiles": list(QUANTILES),
            "quantileMethod": "numpy-linear",
            "nativeRecordsRetainedExternally": True,
            "projectionIsFullEcosystemState": False,
        },
        "surveys": surveys,
        "evidenceBoundary": {
            "sameSpatialExtent": True,
            "sameTerrainReference": True,
            "sameLidarInstrument": False,
            "instrumentChange": "2019 Optech Gemini; 2021 Teledyne Optech Galaxy Prime",
            "firePerimeterInferredFromPoints": False,
            "causalEffectEstimated": False,
            "futureStatePredicted": False,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lidar-2019", type=Path, required=True)
    parser.add_argument("--lidar-2021", type=Path, required=True)
    parser.add_argument("--dtm-2021", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    projection = build_projection(args.lidar_2019, args.lidar_2021, args.dtm_2021)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(projection, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {args.output}: "
        f"{projection['surveys'][0]['qualifiedCellCount']} / "
        f"{projection['surveys'][1]['qualifiedCellCount']} qualified cells"
    )


if __name__ == "__main__":
    main()
