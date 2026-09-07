"""Acquire or verify the exact research downloads; never execute upstream code."""

import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import urllib.request


HERE = Path(__file__).resolve().parent


def digest_file(path):
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


def verify(path, entry):
    if path.is_symlink() or not path.is_file():
        raise ValueError("Missing regular source file: " + str(path))
    if digest_file(path) != (entry["byteLength"], entry["sha256"]):
        raise ValueError("Source bytes differ from lock: " + entry["file"])


def acquire(cache, entry, opener=urllib.request.urlopen):
    """Bound bytes, verify before atomic replacement and remove failed downloads."""
    target = cache / entry["file"]
    if target.is_symlink():
        raise ValueError("Source target must not be a symlink: " + str(target))
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=cache, delete=False) as output:
            temporary = Path(output.name)
            size = 0
            with opener(entry["url"], timeout=60) as response:
                if not response.geturl().startswith("https://"):
                    raise ValueError("Source download redirected outside HTTPS")
                while True:
                    chunk = response.read(min(1024 * 1024, entry["byteLength"] - size + 1))
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > entry["byteLength"]:
                        raise ValueError("Source download exceeds locked byte length")
                    output.write(chunk)
        verify(temporary, entry)
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def load_lock(path):
    lock = json.loads(path.read_text())
    if lock.get("format") != "onto2d-research-source-lock-v1":
        raise ValueError("Unknown research source lock")
    entries = lock["files"]
    names = set()
    for entry in entries:
        name = entry["file"]
        if (not name or name in (".", "..") or "/" in name or "\\" in name
                or name in names):
            raise ValueError("Invalid or duplicate source filename")
        names.add(name)
        if (type(entry["byteLength"]) is not int or entry["byteLength"] <= 0
                or len(entry["sha256"]) != 64
                or any(c not in "0123456789abcdef" for c in entry["sha256"])
                or not entry["url"].startswith("https://")):
            raise ValueError("Invalid source byte/hash/URL contract")
    if not entries:
        raise ValueError("Empty research source lock")
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Download absent or invalid locked files")
    args = parser.parse_args()
    entries = load_lock(HERE / "source-lock.json")
    cache = HERE / "cache"
    if cache.is_symlink():
        raise ValueError("Source cache must not be a symlink")
    if args.fetch:
        cache.mkdir(exist_ok=True)
    for entry in entries:
        try:
            verify(cache / entry["file"], entry)
        except ValueError:
            if not args.fetch:
                raise
            acquire(cache, entry)
        print("Verified " + entry["file"])
    print("Verified %d locked downloads; no extraction, analysis or scoring performed." % len(entries))


if __name__ == "__main__":
    main()
