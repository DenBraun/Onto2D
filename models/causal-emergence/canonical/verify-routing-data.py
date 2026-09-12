"""Replay exact publisher summary cells; do not infer sample-level uncertainty."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[3]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
with zipfile.ZipFile(ROOT / "references/canonical/data/elife-38281-fig6-data1-v2.xlsx") as archive:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.findall("m:sheets/m:sheet", NS)
    assert len(sheets) == 1 and sheets[0].get("name") == "Sheet1"
    strings = ["".join(s.itertext()) for s in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    cells = {}
    for cell in ET.fromstring(archive.read("xl/worksheets/sheet1.xml")).findall(".//m:c", NS):
        assert cell.find("m:f", NS) is None, "Do not substitute cached formula results"
        value = cell.findtext("m:v", namespaces=NS)
        cells[cell.get("r")] = strings[int(value)] if cell.get("t") == "s" else float(value)
assert {key: cells[key] for key in ("C14", "C16", "D16", "E16", "F16")} == {
    "C14": "Fig 6F", "C16": "mouse intensity", "D16": "mouse amp",
    "E16": "primate intensity", "F16": "primate amp",
}
policy = json.loads((ROOT / "references/canonical/routing-policy.json").read_text())
review = json.loads((ROOT / "references/canonical/routing-review.json").read_text())
rows = []
for case in policy["cases"]:
    if case["dataCells"] is None:
        continue
    entry = next(m for m in review["measurements"] if m["contextId"] == case["id"])
    intensity_cell = case["dataCells"]["intensity"]
    ratio_cell = case["dataCells"]["ratio"]
    assert entry["intensity"] == cells[intensity_cell] == case["lightValue"], "Changed light quantity"
    assert entry["responseRatio"] == cells[ratio_cell], "Changed published response ratio"
    rows.append({"contextId": case["id"], "intensity": cells[intensity_cell], "responseRatio": cells[ratio_cell], "cells": [intensity_cell, ratio_cell]})
print(json.dumps({"sourceId": "grimes2018-fig6-data", "sheet": "Sheet1", "rows": rows,
                  "limit": "Exact six-row summary replay; no raw-trace reanalysis, uncertainty reconstruction, causal weight estimation or independent prediction."}))
