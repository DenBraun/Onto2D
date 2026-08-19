#!/usr/bin/env python3
"""Build the bounded Gregory et al. (2019) pyrite-nodule projection.

The generator deliberately uses only the Python standard library.  It reads the
two pinned XLSX supplements as ZIP/XML containers, checks their byte hashes,
and preserves every populated LA-ICP-MS value without inventing labels for the
three duplicate Pb_Py columns in the workbook.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


FORMAT = "onto2d-gregory-2019-pyrite-nodule-projection"
PROFILE = "gregory-2019-pyrite-nodule-projection-v1"
TABLE_HASH = "e1e7cee4f5a400b0b3a4edb44ea3e8736f0f3620823b0b750aa44022608af58a"
ANALYSES_HASH = "dfd1fecb72ab8dc75e29dc0ca55a3ca32c3407b88962171594e629d377dcbf6c"
EXPECTED_SAMPLE_IDS = (
    "79990",
    "HP8-319.8",
    "RI08-24-477.67",
    "CD13829",
    "DD86WRL1-681",
    "DD86WRL1-729.91",
    "176898",
    "V3-651",
    "PETR14",
    "DLR7_146.5m",
)
EXPECTED_COUNTS = {
    "79990": 10,
    "HP8-319.8": 13,
    "RI08-24-477.67": 10,
    "CD13829": 10,
    "DD86WRL1-681": 5,
    "DD86WRL1-729.91": 8,
    "176898": 9,
    "V3-651": 11,
    "PETR14": 9,
    "DLR7_146.5m": 10,
}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL_NS = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}
CELL = re.compile(r"([A-Z]+)([0-9]+)")
VALUE_COLUMNS = tuple([chr(code) for code in range(ord("G"), ord("Z") + 1)] + ["AA"])
UNCERTAINTY_COLUMNS = tuple(["AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS"])
DISPLAY_COLUMNS = {"Co": "J", "Ni": "K", "Cu": "L", "As": "N", "Se": "O", "Ag": "Q", "Sb": "S"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked(path: Path, expected: str) -> Path:
    actual = sha256(path)
    if actual != expected:
        raise ValueError(f"{path.name} hash {actual} does not match the pinned source")
    return path


def column(reference: str) -> str:
    match = CELL.fullmatch(reference)
    if not match:
        raise ValueError(f"invalid XLSX cell reference {reference}")
    return match.group(1)


def workbook_rows(path: Path, sheet_name: str) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in item.iter(f"{{{NS['m']}}}t")) for item in root.findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships.findall("p:Relationship", REL_NS)}
        sheet = next((item for item in workbook.find("m:sheets", NS) or [] if item.attrib.get("name") == sheet_name), None)
        if sheet is None:
            raise ValueError(f"{path.name} has no worksheet {sheet_name}")
        target = targets[sheet.attrib[f"{{{NS['r']}}}id"]]
        target = target.lstrip("/") if target.startswith("/xl/") else f"xl/{target.lstrip('/')}"
        root = ET.fromstring(archive.read(target))
        result: list[dict[str, str]] = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            values: dict[str, str] = {"_row": row.attrib["r"]}
            for cell in row.findall("m:c", NS):
                key = column(cell.attrib["r"])
                kind = cell.attrib.get("t")
                raw = cell.find("m:v", NS)
                if kind == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(f"{{{NS['m']}}}t"))
                elif raw is None:
                    value = ""
                elif kind == "s":
                    value = shared[int(raw.text or "0")]
                else:
                    value = raw.text or ""
                values[key] = value.strip()
            result.append(values)
        return result


def text(row: dict[str, str], key: str) -> str | None:
    value = row.get(key, "").strip()
    return value or None


def number(row: dict[str, str], key: str) -> float | None:
    value = text(row, key)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def measured_value(row: dict[str, str], key: str) -> float | str | None:
    value = text(row, key)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return value


def clean_number(value: float) -> int | float:
    return int(value) if value.is_integer() else value


def parse_samples(path: Path) -> list[dict[str, object]]:
    rows = workbook_rows(path, "Sheet1")
    samples = []
    for row in rows:
        sample_id = text(row, "A")
        if sample_id not in EXPECTED_SAMPLE_IDS:
            continue
        age = number(row, "B")
        if age is None:
            raise ValueError(f"sample {sample_id} has no age")
        samples.append({
            "sampleId": sample_id,
            "sourceRow": int(row["_row"]),
            "ageMa": clean_number(age),
            "period": text(row, "C"),
            "geochronology": text(row, "E"),
            "sourceComments": [value for key in ("F", "G") if (value := text(row, key))],
            "archiveArea": text(row, "H"),
            "archiveBoxId": text(row, "I"),
            "location": text(row, "J"),
            "country": text(row, "K"),
            "supergroupOrGroup": text(row, "L"),
            "formation": text(row, "M"),
            "memberOrUnit": text(row, "N"),
            "description": text(row, "O"),
        })
    if tuple(item["sampleId"] for item in samples) != EXPECTED_SAMPLE_IDS:
        raise ValueError("Table 1 sample inventory or order differs")
    return samples


def parse_analyses(path: Path) -> tuple[list[dict[str, object]], dict[str, str]]:
    rows = workbook_rows(path, "Data")
    if not rows:
        raise ValueError("analysis workbook is empty")
    headings = {key: value for key, value in rows[0].items() if key != "_row" and value}
    analyses = []
    for row in rows[1:]:
        sample_id = text(row, "D")
        if sample_id is None:
            continue
        if sample_id not in EXPECTED_SAMPLE_IDS:
            raise ValueError(f"analysis row refers to unselected sample {sample_id}")
        values = {key: value for key in VALUE_COLUMNS if (value := measured_value(row, key)) is not None}
        uncertainties = {key: value for key in UNCERTAINTY_COLUMNS if (value := measured_value(row, key)) is not None}
        analyses.append({
            "analysisId": text(row, "C"),
            "sampleId": sample_id,
            "sourceRow": int(row["_row"]),
            "sequence": clean_number(number(row, "F")) if number(row, "F") is not None else None,
            "spotSize": text(row, "A"),
            "reportedDepth": text(row, "B"),
            "reportedMedianNi": number(row, "E"),
            "valuesBySourceColumn": values,
            "uncertaintiesBySourceColumn": uncertainties,
        })
    if len(analyses) != 95 or Counter(item["sampleId"] for item in analyses) != Counter(EXPECTED_COUNTS):
        raise ValueError("LA-ICP-MS analysis inventory differs")
    return analyses, headings


def summarize(samples: list[dict[str, object]], analyses: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for analysis in analyses:
        grouped[str(analysis["sampleId"])].append(analysis)
    result = []
    for sample in samples:
        sample_id = str(sample["sampleId"])
        records = grouped[sample_id]
        ranges = {}
        for label, source_column in DISPLAY_COLUMNS.items():
            values = [
                float(record["valuesBySourceColumn"][source_column])
                for record in records
                if source_column in record["valuesBySourceColumn"] and isinstance(record["valuesBySourceColumn"][source_column], (int, float))
            ]
            ranges[label] = {
                "count": len(values),
                "minimum": min(values),
                "median": statistics.median(values),
                "maximum": max(values),
            }
        result.append({"sampleId": sample_id, "analysisCount": len(records), "reportedTraceElementUnit": "ppm", "selectedTraceElementRanges": ranges})
    return result


def build(table_path: Path, analyses_path: Path) -> dict[str, object]:
    checked(table_path, TABLE_HASH)
    checked(analyses_path, ANALYSES_HASH)
    samples = parse_samples(table_path)
    analyses, headings = parse_analyses(analyses_path)
    return {
        "format": FORMAT,
        "formatVersion": "1",
        "profileVersion": PROFILE,
        "source": {
            "datasetDoi": "10.17632/h2n4b8cczy.1",
            "articleDoi": "10.1016/j.gca.2019.05.035",
            "speciesName": "pyrite",
            "formula": "FeS2",
        },
        "inputFiles": [
            {"name": "Table 1 sample information.xlsx", "sha256": TABLE_HASH, "bytes": table_path.stat().st_size},
            {"name": "Appendix 3 LA-icpms data.xlsx", "sha256": ANALYSES_HASH, "bytes": analyses_path.stat().st_size},
        ],
        "measurementColumns": {key: headings[key] for key in (*VALUE_COLUMNS, *UNCERTAINTY_COLUMNS)},
        "measurementColumnPolicy": "Source column letters are retained because X, Y, and Z share the heading Pb_Py; no isotope labels are inferred.",
        "samples": samples,
        "analyses": analyses,
        "sampleSummaries": summarize(samples, analyses),
        "audit": {
            "sampleRowsRetained": len(samples),
            "analysisRowsRetained": len(analyses),
            "populatedMeasurementValuesRetained": sum(len(item["valuesBySourceColumn"]) for item in analyses),
            "populatedUncertaintyValuesRetained": sum(len(item["uncertaintiesBySourceColumn"]) for item in analyses),
            "duplicateLeadHeadingsRenamed": 0,
            "formationMechanismsInferred": 0,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", required=True, type=Path)
    parser.add_argument("--analyses", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    result = build(arguments.table, arguments.analyses)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {arguments.output}: {len(result['samples'])} samples, {len(result['analyses'])} analyses")


if __name__ == "__main__":
    main()
