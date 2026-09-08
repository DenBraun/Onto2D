import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import sources


class Response(io.BytesIO):
    def geturl(self):
        return "https://example.org/source"


class SourceIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cache = Path(self.directory.name)
        self.payload = b"source bytes\n"
        self.entry = {
            "file": "source.dat", "url": "https://example.org/source",
            "byteLength": len(self.payload),
            "sha256": hashlib.sha256(self.payload).hexdigest(),
        }

    def download(self, payload):
        sources.acquire(self.cache, self.entry, lambda *args, **kwargs: Response(payload))

    def test_verified_download(self):
        self.download(self.payload)
        sources.verify(self.cache / "source.dat", self.entry)
        self.assertEqual([p.name for p in self.cache.iterdir()], ["source.dat"])

    def test_invalid_download_preserves_existing_file_and_cleans_temporary(self):
        target = self.cache / "source.dat"
        target.write_bytes(self.payload)
        for payload in (b"", self.payload[:-1], b"x" * len(self.payload), self.payload + b"x"):
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    self.download(payload)
                self.assertEqual(target.read_bytes(), self.payload)
                self.assertEqual([p.name for p in self.cache.iterdir()], ["source.dat"])

    def test_missing_or_corrupt_file_fails_verification(self):
        target = self.cache / "source.dat"
        with self.assertRaises(ValueError):
            sources.verify(target, self.entry)
        target.write_bytes(b"x" * len(self.payload))
        with self.assertRaises(ValueError):
            sources.verify(target, self.entry)

    def test_symlink_is_not_a_source_file(self):
        other = self.cache / "other.dat"
        other.write_bytes(self.payload)
        (self.cache / "source.dat").symlink_to(other)
        with self.assertRaises(ValueError):
            sources.verify(self.cache / "source.dat", self.entry)
        with self.assertRaises(ValueError):
            self.download(self.payload)

    def test_lock_rejects_traversal_duplicate_and_invalid_hash(self):
        path = self.cache / "lock.json"
        for entries in ([{**self.entry, "file": "../source"}],
                        [self.entry, self.entry], [{**self.entry, "sha256": "x" * 64}],
                        [{**self.entry, "byteLength": True}], []):
            path.write_text(json.dumps({"format": "onto2d-research-source-lock-v1", "files": entries}))
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                sources.load_lock(path)

    def test_committed_source_lock(self):
        entries = sources.load_lock(sources.HERE / "source-lock.json")
        self.assertEqual(len(entries), 14)


if __name__ == "__main__":
    unittest.main()
