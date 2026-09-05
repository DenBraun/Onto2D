"""Capture only FD001 observations from the already pinned NASA archive."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import zipfile

CASE = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def capture(archive_path):
    lock = json.loads((CASE / "upstream.json").read_text())
    data = archive_path.read_bytes()
    if len(data) != lock["archive"]["bytes"] or digest(data) != lock["archive"]["sha256"]:
        raise ValueError("NASA archive differs from the existing exact source lock")
    files = {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if len(archive.infolist()) != lock["archive"]["memberCount"]:
            raise ValueError("Archive member census differs")
        for name in ["train_FD001.txt", "test_FD001.txt"]:
            expected = next(row for row in lock["consumedMembers"] if row["name"] == name)
            raw = archive.read(name)
            if len(raw) != expected["bytes"] or digest(raw) != expected["sha256"]:
                raise ValueError(f"Exact observation member differs: {name}")
            output = io.BytesIO()
            with gzip.GzipFile(fileobj=output, filename="", mode="wb", mtime=0, compresslevel=9) as compressed:
                compressed.write(raw)
            files[f"source/{name}.gz"] = output.getvalue()
    # RUL is neither extracted nor exposed to source-view preparation.
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    for relative, data in capture(args.archive).items():
        target = ROOT / relative
        if args.verify:
            if target.read_bytes() != data:
                raise ValueError(f"Compressed source drift: {relative}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print("FD001 observation capture verified; no held-out targets extracted.")


if __name__ == "__main__":
    main()
