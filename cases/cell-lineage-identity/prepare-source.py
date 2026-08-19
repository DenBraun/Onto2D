#!/usr/bin/env python3
"""Build the bounded ZF1 scGESTALT observation projection.

The generator uses only the Python standard library. It verifies the exact
compressed GEO file, preserves every one of the 750 cell-level observations,
and derives only transparent group keys from the reported ten-target HMID.
It does not reconstruct unobserved cell divisions or assign confidence values.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


FORMAT = "onto2d-gse105010-zf1-scgestalt-projection"
PROFILE = "gse105010-zf1-all-observations-v2"
SOURCE_SHA256 = "18268e01f510638986a746968d6fae1d3a86622653e7a76388358c90bcd848fe"
SOURCE_BYTES = 32706
EXPECTED_CELLS = 750

# Only labels stated in Raj et al. (2018) are promoted beyond the source's
# numeric t-SNE cluster membership. All other clusters remain numeric.
PAPER_LABELS = {
    0: ("likely nascent neurons", "qualified", "Results: clusters 0, 24 and 31; cluster 0 is described as likely nascent neurons"),
    2: ("GABAergic and minor glutamatergic ventral-forebrain neurons", "published", "Results: cluster 2 in the ZF1 lineage discussion"),
    6: ("pax6b+ granule neurons", "published", "Results: cerebellar granule-cell trajectory"),
    19: ("atoh1c+ upper-rhombic-lip progenitors", "published", "Results: cerebellar granule-cell trajectory"),
    20: ("fezf1+ neurons", "published", "Results: ventral-forebrain lineage discussion"),
    25: ("radial glia", "published", "Results: radial-glia marker discussion"),
    27: ("sst3+ neurons", "published", "Results: ventral-forebrain lineage discussion"),
    28: ("hmx3a+ neurons", "published", "Results: ventral-forebrain lineage discussion"),
    30: ("penkb+ neurons", "published", "Results: ventral-forebrain lineage discussion"),
    33: ("radial glia", "published", "Results: radial-glia marker discussion"),
    43: ("aldoca+ Purkinje neurons", "published", "Results: rare-cell-type examples"),
    48: ("radial glia", "published", "Results: radial-glia marker discussion"),
    53: ("sst1.1+ and npy+ ventral-forebrain neurons", "published", "Results: rare-cell-type examples"),
    54: ("fluorescent granular perithelial cells", "published", "Results: rare-cell-type examples"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_key(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def checked_source(path: Path) -> None:
    if path.stat().st_size != SOURCE_BYTES:
        raise ValueError(f"{path.name} has {path.stat().st_size} bytes; expected {SOURCE_BYTES}")
    actual = sha256(path)
    if actual != SOURCE_SHA256:
        raise ValueError(f"{path.name} hash {actual} does not match the pinned GEO file")


def parse(path: Path) -> list[dict[str, object]]:
    checked_source(path)
    records: list[dict[str, object]] = []
    with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
        reader = csv.reader(stream, delimiter="\t")
        header = next(reader)
        if header != ["", "CellNum", "CellBarcode", "CellUMI", "BarcodeKey", "ClusterIdent", "HMID", "Readname"]:
            raise ValueError(f"unexpected GestMaster header: {header}")
        for source_row, row in enumerate(reader, start=2):
            if len(row) != 8:
                raise ValueError(f"source row {source_row} has {len(row)} columns")
            target_states = row[6].split("-")
            if len(target_states) != 10:
                raise ValueError(f"source row {source_row} has {len(target_states)} target states")
            cluster_id = int(row[5])
            records.append({
                "cellId": row[4],
                "sourceRow": source_row,
                "sourceCellNumber": int(row[1]),
                "sourceCellBarcode": row[2],
                "cellUmi": row[3],
                "clusterId": cluster_id,
                "observedBarcode": row[6],
                "observedBarcodeKey": stable_key(row[6]),
                "firstFourTargetSignature": "-".join(target_states[:4]),
                "firstFourTargetSignatureKey": stable_key("-".join(target_states[:4])),
                "targetStates": target_states,
                "targetCoverage": "partial" if "OUT" in target_states else "reported-at-all-targets",
            })
    if len(records) != EXPECTED_CELLS:
        raise ValueError(f"source contains {len(records)} cells; expected {EXPECTED_CELLS}")
    cell_ids = [str(record["cellId"]) for record in records]
    if len(set(cell_ids)) != len(cell_ids):
        raise ValueError("source cell identifiers are not unique")
    return records


def clusters(records: list[dict[str, object]]) -> list[dict[str, object]]:
    counts = Counter(int(record["clusterId"]) for record in records)
    result = []
    for cluster_id in sorted(counts):
        label, status, locator = PAPER_LABELS.get(
            cluster_id,
            (f"Transcriptomic cluster {cluster_id}", "numeric-source-membership-only", None),
        )
        result.append({
            "clusterId": cluster_id,
            "cellCount": counts[cluster_id],
            "label": label,
            "labelStatus": status,
            "articleLocator": locator,
        })
    return result


def group_inventory(records: list[dict[str, object]], field: str, key_field: str) -> list[dict[str, object]]:
    groups: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in records:
        groups[str(record[field])].append(record)
    result = []
    for value, members in sorted(groups.items(), key=lambda item: (item[0])):
        result.append({
            "key": members[0][key_field],
            "value": value,
            "cellCount": len(members),
            "clusterIds": sorted({int(member["clusterId"]) for member in members}),
            "cellIds": sorted(str(member["cellId"]) for member in members),
        })
    return result


def pair_counts(records: list[dict[str, object]]) -> dict[str, int]:
    by_cluster: dict[int, Counter[str]] = defaultdict(Counter)
    by_barcode: dict[str, Counter[int]] = defaultdict(Counter)
    by_first_four_target: dict[str, Counter[int]] = defaultdict(Counter)
    for record in records:
        cluster_id = int(record["clusterId"])
        barcode = str(record["observedBarcode"])
        first_four_target = str(record["firstFourTargetSignature"])
        by_cluster[cluster_id][barcode] += 1
        by_barcode[barcode][cluster_id] += 1
        by_first_four_target[first_four_target][cluster_id] += 1

    same_cluster_different_barcode = 0
    for barcode_counts in by_cluster.values():
        total = sum(barcode_counts.values())
        same_cluster_different_barcode += total * (total - 1) // 2
        same_cluster_different_barcode -= sum(count * (count - 1) // 2 for count in barcode_counts.values())

    same_barcode_different_cluster = 0
    for cluster_counts in by_barcode.values():
        total = sum(cluster_counts.values())
        same_barcode_different_cluster += total * (total - 1) // 2
        same_barcode_different_cluster -= sum(count * (count - 1) // 2 for count in cluster_counts.values())

    same_first_four_target_different_cluster = 0
    for cluster_counts in by_first_four_target.values():
        total = sum(cluster_counts.values())
        same_first_four_target_different_cluster += total * (total - 1) // 2
        same_first_four_target_different_cluster -= sum(count * (count - 1) // 2 for count in cluster_counts.values())

    return {
        "sameClusterDifferentObservedBarcodePairs": same_cluster_different_barcode,
        "sameObservedBarcodeDifferentClusterPairs": same_barcode_different_cluster,
        "sameFirstFourTargetSignatureDifferentClusterPairs": same_first_four_target_different_cluster,
    }


def build(path: Path) -> dict[str, object]:
    records = parse(path)
    barcode_groups = group_inventory(records, "observedBarcode", "observedBarcodeKey")
    first_four_target_groups = group_inventory(records, "firstFourTargetSignature", "firstFourTargetSignatureKey")
    cluster_inventory = clusters(records)
    return {
        "format": FORMAT,
        "formatVersion": "1",
        "profileVersion": PROFILE,
        "source": {
            "geoSeries": "GSE105010",
            "geoSample": "GSM2813984",
            "sampleName": "ZF1_scGSTLT",
            "organism": "Danio rerio",
            "articleDoi": "10.1038/nbt.4103",
            "protocolDoi": "10.1038/s41596-018-0058-x",
        },
        "inputFile": {
            "name": path.name,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        },
        "cells": records,
        "clusters": cluster_inventory,
        "observedBarcodeGroups": barcode_groups,
        "firstFourTargetSignatureGroups": first_four_target_groups,
        "boundedComparisons": pair_counts(records),
        "audit": {
            "cellsRetained": len(records),
            "sourceRowsDropped": 0,
            "clusterCount": len(cluster_inventory),
            "observedBarcodeClassCount": len(barcode_groups),
            "firstFourTargetSignatureClassCount": len(first_four_target_groups),
            "partialTargetCoverageCellCount": sum(record["targetCoverage"] == "partial" for record in records),
            "unobservedDivisionsInvented": 0,
            "confidenceValuesInvented": 0,
            "biologicalLabelsInvented": 0,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gest-master", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    result = build(arguments.gest_master)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    audit = result["audit"]
    print(
        f"Wrote {arguments.output}: {audit['cellsRetained']} cells, "
        f"{audit['clusterCount']} clusters, {audit['observedBarcodeClassCount']} barcodes, "
        f"{audit['firstFourTargetSignatureClassCount']} first-four-target signatures"
    )


if __name__ == "__main__":
    main()
