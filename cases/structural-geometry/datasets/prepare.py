"""Verify locked sources and atomically prepare local native data, without scoring."""

import json
from pathlib import Path
import tempfile

from dream4 import adapt_dream4
from randi import adapt_randi
from sources import HERE, digest_file, load_lock, verify
from witvliet import adapt_witvliet


def write_json_atomic(target, value):
    target = Path(target)
    if target.is_symlink() or target.parent.is_symlink():
        raise ValueError("Prepared artifact must not use a symlink")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=target.parent,
                                         delete=False) as output:
            temporary = Path(output.name)
            json.dump(value, output, sort_keys=True, separators=(",", ":"), allow_nan=False)
            output.write("\n")
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def prepare():
    cache = HERE / "cache"
    if cache.is_symlink():
        raise ValueError("Source cache must not be a symlink")
    lock_hash = digest_file(HERE / "source-lock.json")[1]
    entries = load_lock(HERE / "source-lock.json")
    if digest_file(HERE / "source-lock.json")[1] != lock_hash:
        raise ValueError("Source lock changed while being read")
    for entry in entries:
        verify(cache / entry["file"], entry)
    print("Verified %d locked files; reading native sources." % len(entries), flush=True)
    dream = adapt_dream4(cache / "DREAM4_1.22.0.tar.gz")
    anatomy = adapt_witvliet(cache)
    print("Read five DREAM4 networks and eight anatomical graphs; scanning all recordings.", flush=True)
    functional = adapt_randi(cache / "randi2023-exported_data-v1.tar.gz")
    expected = {entry["dataset"]: entry for entry in entries
                if entry["dataset"] != "celegans-witvliet-2021"}
    for dataset, parsed in (("dream4-size10", dream), ("celegans-randi-2023", functional)):
        if parsed["source"]["sha256"] != expected[dataset]["sha256"]:
            raise ValueError("Parsed source identity differs from the verified lock")
    if digest_file(HERE / "source-lock.json")[1] != lock_hash:
        raise ValueError("Source lock changed during native preparation")
    result = {"format": "onto2d-biological-native-preparation-v1",
              "sourceLockSha256": lock_hash,
              "sourceFiles": [{key: entry[key] for key in ("dataset", "file", "byteLength", "sha256")}
                              for entry in entries],
              "dream4": dream, "witvliet": anatomy, "randi": functional}
    target = cache / "prepared"
    if target.is_symlink():
        raise ValueError("Preparation directory must not be a symlink")
    target.mkdir(exist_ok=True)
    write_json_atomic(target / "native.json", result)
    print("Prepared all native units in ignored cache/prepared/native.json; no scoring.", flush=True)


if __name__ == "__main__":
    prepare()
