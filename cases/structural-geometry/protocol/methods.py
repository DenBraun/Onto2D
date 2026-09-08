"""Fetch or verify pinned method documentation; never execute upstream files."""
import argparse
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "datasets"))
from sources import acquire, load_lock, verify  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()
    parent = HERE.parent / "datasets" / "cache"
    cache = parent / "methods"
    if parent.is_symlink() or cache.is_symlink():
        raise ValueError("Method source cache must not be a symlink")
    if args.fetch:
        parent.mkdir(exist_ok=True)
        cache.mkdir(exist_ok=True)
    entries = load_lock(HERE / "method-source-lock.json")
    for entry in entries:
        try:
            verify(cache / entry["file"], entry)
        except ValueError:
            if not args.fetch:
                raise
            acquire(cache, entry)
    print("Verified %d pinned author method files; no code executed." % len(entries))


if __name__ == "__main__":
    main()
