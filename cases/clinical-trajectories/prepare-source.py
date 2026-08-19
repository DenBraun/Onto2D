#!/usr/bin/env python3
"""Build the bounded Clinical Trajectories source projection from MIMIC-IV Demo 2.2."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


RELEASE = "2.2"
COHORT_SIZE = 5
LAB_ITEM_IDS = ("50912", "50971", "50983", "51222")
EXPECTED_HASHES = {
    "hosp/admissions.csv.gz": "910b9f160ffdf1e08ea673585393f347c773ccc87d66875c627584a903ae8493",
    "hosp/d_icd_procedures.csv.gz": "a921a20fbf3220e2a7fe874d6392d671c1cc769a001ef0a7841b80eb01030bb6",
    "hosp/d_labitems.csv.gz": "72ea5f020469fd24543bd98ab3bd0a4f645a5a4b7802d9d52af20d736f9d76db",
    "hosp/labevents.csv.gz": "d51a4cf1ea63245abe7d544b0d50a928e9ee2ec5eb9a5ce85500aed0bd6c6dfc",
    "hosp/prescriptions.csv.gz": "33c392ba5b9299b08eca0a61911ba106f0aebdba26ed31b856bb9ffd49fe3654",
    "hosp/procedures_icd.csv.gz": "68f21dcba9ae0c4b7faa3ef38aa950a8ebeb6d167bc74416314dccdcf28674e0",
    "hosp/transfers.csv.gz": "41151539886d12d57159b65ffe4d7df5a7ef8ceb7cd113ea9a56fbfbfd78a87c",
    "icu/icustays.csv.gz": "e05e81aa52a3022e522b6832a898101a69b84e64c17bb344d819e458d5bc21b3",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rows(source_root: Path, relative: str) -> list[dict[str, str | int]]:
    source = source_root / relative
    actual = sha256(source)
    if actual != EXPECTED_HASHES[relative]:
        raise ValueError(f"{relative} hash {actual} does not match MIMIC-IV Demo 2.2")
    with gzip.open(source, "rt", encoding="utf-8", newline="") as stream:
        return [{**row, "source_row": line} for line, row in enumerate(csv.DictReader(stream), start=2)]


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def optional(value: str) -> str | None:
    return value or None


def optional_number(value: str) -> float | None:
    return float(value) if value else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    admissions = rows(args.source_root, "hosp/admissions.csv.gz")
    transfers = rows(args.source_root, "hosp/transfers.csv.gz")
    lab_events = rows(args.source_root, "hosp/labevents.csv.gz")
    lab_items = rows(args.source_root, "hosp/d_labitems.csv.gz")
    prescriptions = rows(args.source_root, "hosp/prescriptions.csv.gz")
    procedures = rows(args.source_root, "hosp/procedures_icd.csv.gz")
    procedure_items = rows(args.source_root, "hosp/d_icd_procedures.csv.gz")
    icu_stays = rows(args.source_root, "icu/icustays.csv.gz")

    admission_counts = Counter(str(row["subject_id"]) for row in admissions)
    procedure_counts = Counter(str(row["subject_id"]) for row in procedures)
    prescription_counts = Counter(str(row["subject_id"]) for row in prescriptions)
    stays_by_subject: dict[str, list[dict[str, str | int]]] = defaultdict(list)
    labs_by_encounter: dict[tuple[str, str], list[dict[str, str | int]]] = defaultdict(list)
    for row in icu_stays:
        stays_by_subject[str(row["subject_id"])].append(row)
    for row in lab_events:
        if str(row["itemid"]) in LAB_ITEM_IDS and row["valuenum"]:
            labs_by_encounter[(str(row["subject_id"]), str(row["hadm_id"]))].append(row)

    candidates: list[tuple[str, dict[str, str | int]]] = []
    for subject_id, stays in stays_by_subject.items():
        latest_stay = max(stays, key=lambda row: str(row["outtime"]))
        cutoff = parse_time(str(latest_stay["outtime"]))
        frame_start = cutoff - timedelta(hours=24)
        present_items = {
            str(row["itemid"])
            for row in labs_by_encounter[(subject_id, str(latest_stay["hadm_id"]))]
            if frame_start <= parse_time(str(row["charttime"])) <= cutoff
        }
        if (
            admission_counts[subject_id] >= 2
            and procedure_counts[subject_id] >= 1
            and prescription_counts[subject_id] >= 1
            and present_items == set(LAB_ITEM_IDS)
        ):
            candidates.append((subject_id, latest_stay))

    selected = sorted(candidates, key=lambda item: item[0])[:COHORT_SIZE]
    if len(selected) != COHORT_SIZE:
        raise ValueError(f"selection produced {len(selected)} subjects, expected {COHORT_SIZE}")
    subject_ids = [subject_id for subject_id, _ in selected]
    subject_set = set(subject_ids)
    focus = {
        subject_id: {
            "subject_id": subject_id,
            "alias": f"P{index:02d}",
            "hadm_id": str(stay["hadm_id"]),
            "stay_id": str(stay["stay_id"]),
            "cutoff": str(stay["outtime"]),
        }
        for index, (subject_id, stay) in enumerate(selected, start=1)
    }

    selected_lab_items = [
        {
            "itemid": str(row["itemid"]),
            "label": str(row["label"]),
            "fluid": str(row["fluid"]),
            "category": str(row["category"]),
            "source_row": int(row["source_row"]),
        }
        for row in lab_items
        if str(row["itemid"]) in LAB_ITEM_IDS
    ]
    selected_lab_items.sort(key=lambda row: LAB_ITEM_IDS.index(row["itemid"]))
    if [row["itemid"] for row in selected_lab_items] != list(LAB_ITEM_IDS):
        raise ValueError("the declared lab item dictionary is incomplete")

    procedure_titles = {
        (str(row["icd_code"]), str(row["icd_version"])): str(row["long_title"])
        for row in procedure_items
    }

    projection = {
        "format": "onto2d-mimic-iv-demo-cohort",
        "formatVersion": "1",
        "source": {
            "name": "MIMIC-IV Clinical Database Demo",
            "version": RELEASE,
            "doi": "10.13026/dp1f-ex47",
            "landingPage": "https://physionet.org/content/mimic-iv-demo/2.2/",
            "license": "Open Data Commons Open Database License v1.0",
            "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
            "deidentification": "Identifiers are ciphered and dates are consistently shifted per subject; displayed dates are not real calendar dates.",
        },
        "selection": {
            "profile": "mimic-iv-demo-clinical-trajectories-v1",
            "rule": "First five ascending subject_id values with at least two admissions, one ICU stay, one procedure record, one prescription record, and all four declared numeric labs in the 24 hours ending at the latest ICU outtime.",
            "cohortSize": COHORT_SIZE,
            "labItemIds": list(LAB_ITEM_IDS),
            "frameHours": 24,
            "subjects": [focus[subject_id] for subject_id in subject_ids],
        },
        "inputFiles": [
            {
                "path": relative,
                "sha256": digest,
                "bytes": (args.source_root / relative).stat().st_size,
            }
            for relative, digest in EXPECTED_HASHES.items()
        ],
        "labItems": selected_lab_items,
        "admissions": sorted(
            [
                {
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": str(row["hadm_id"]),
                    "admittime": str(row["admittime"]),
                    "dischtime": str(row["dischtime"]),
                    "admission_type": str(row["admission_type"]),
                    "source_row": int(row["source_row"]),
                }
                for row in admissions
                if str(row["subject_id"]) in subject_set
            ],
            key=lambda row: (row["subject_id"], row["admittime"], row["hadm_id"]),
        ),
        "transfers": sorted(
            [
                {
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": optional(str(row["hadm_id"])),
                    "transfer_id": str(row["transfer_id"]),
                    "eventtype": str(row["eventtype"]),
                    "careunit": optional(str(row["careunit"])),
                    "intime": str(row["intime"]),
                    "outtime": optional(str(row["outtime"])),
                    "source_row": int(row["source_row"]),
                }
                for row in transfers
                if str(row["subject_id"]) in subject_set
            ],
            key=lambda row: (row["subject_id"], row["intime"], row["transfer_id"]),
        ),
        "icuStays": sorted(
            [
                {
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": str(row["hadm_id"]),
                    "stay_id": str(row["stay_id"]),
                    "first_careunit": str(row["first_careunit"]),
                    "last_careunit": str(row["last_careunit"]),
                    "intime": str(row["intime"]),
                    "outtime": str(row["outtime"]),
                    "los": float(str(row["los"])),
                    "source_row": int(row["source_row"]),
                }
                for row in icu_stays
                if str(row["subject_id"]) in subject_set
            ],
            key=lambda row: (row["subject_id"], row["intime"], row["stay_id"]),
        ),
        "labEvents": sorted(
            [
                {
                    "labevent_id": str(row["labevent_id"]),
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": optional(str(row["hadm_id"])),
                    "itemid": str(row["itemid"]),
                    "charttime": str(row["charttime"]),
                    "storetime": str(row["storetime"]),
                    "value": str(row["value"]),
                    "valuenum": float(str(row["valuenum"])),
                    "valueuom": str(row["valueuom"]),
                    "ref_range_lower": optional_number(str(row["ref_range_lower"])),
                    "ref_range_upper": optional_number(str(row["ref_range_upper"])),
                    "flag": optional(str(row["flag"])),
                    "source_row": int(row["source_row"]),
                }
                for row in lab_events
                if str(row["subject_id"]) in subject_set
                and str(row["itemid"]) in LAB_ITEM_IDS
                and row["valuenum"]
            ],
            key=lambda row: (row["subject_id"], row["charttime"], row["labevent_id"]),
        ),
        "prescriptions": sorted(
            [
                {
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": str(row["hadm_id"]),
                    "pharmacy_id": str(row["pharmacy_id"]),
                    "poe_id": optional(str(row["poe_id"])),
                    "poe_seq": optional(str(row["poe_seq"])),
                    "starttime": str(row["starttime"]),
                    "stoptime": optional(str(row["stoptime"])),
                    "drug_type": str(row["drug_type"]),
                    "drug": str(row["drug"]),
                    "route": optional(str(row["route"])),
                    "source_row": int(row["source_row"]),
                }
                for row in prescriptions
                if str(row["subject_id"]) in subject_set
            ],
            key=lambda row: (row["subject_id"], row["starttime"], row["pharmacy_id"], row["source_row"]),
        ),
        "procedures": sorted(
            [
                {
                    "subject_id": str(row["subject_id"]),
                    "hadm_id": str(row["hadm_id"]),
                    "seq_num": int(str(row["seq_num"])),
                    "chartdate": str(row["chartdate"]),
                    "icd_code": str(row["icd_code"]),
                    "icd_version": int(str(row["icd_version"])),
                    "long_title": procedure_titles[(str(row["icd_code"]), str(row["icd_version"]))],
                    "source_row": int(row["source_row"]),
                }
                for row in procedures
                if str(row["subject_id"]) in subject_set
            ],
            key=lambda row: (row["subject_id"], row["chartdate"], row["hadm_id"], row["seq_num"]),
        ),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(projection, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} for {', '.join(subject_ids)}")


if __name__ == "__main__":
    main()
