#!/usr/bin/env python3
"""Read-only verification of the pre-regime working-tree inventory.

Default: check every pinned implementation, test and scientific input/output.
--compatibility: check only legacy geometry inputs, schemas and goldens during
an intentional code migration. Semantic replay remains a separate required check.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compatibility", action="store_true")
    args = parser.parse_args()
    value = json.loads((HERE / "pre-regime-v1.json").read_text(encoding="utf-8"))
    expected = value.pop("inventorySha256")
    encoded = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("ascii")
    if digest(encoded) != expected:
        raise ValueError("Baseline inventory digest differs")
    entries = value["files"]
    paths = [entry["path"] for entry in entries]
    if paths != sorted(set(paths)):
        raise ValueError("Baseline paths must be unique and sorted")
    failures = []; checked = 0
    for entry in entries:
        relative = PurePosixPath(entry["path"])
        if relative.is_absolute() or ".." in relative.parts or str(relative) != entry["path"]:
            raise ValueError("Invalid baseline path")
        if args.compatibility and entry["category"] != "compatibility":
            continue
        target = ROOT / relative
        if not target.resolve().is_relative_to(ROOT):
            raise ValueError("Baseline path escapes repository")
        checked += 1
        if not target.is_file():
            failures.append(f"missing: {relative}")
        elif digest(target.read_bytes()) != entry["sha256"]:
            failures.append(f"changed: {relative}")
    if failures:
        raise ValueError("Pinned baseline differs:\n" + "\n".join(failures))
    print(f"Pre-regime baseline verified: {checked} pinned files ({'compatibility' if args.compatibility else 'full inventory'}).")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
