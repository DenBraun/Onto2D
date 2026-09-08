"""Failure-path controls for publication of source-bound local artifacts."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prepare import write_json_atomic


class NativePublicationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.target = self.root / "native.json"

    def test_success_publishes_complete_deterministic_json(self):
        write_json_atomic(self.target, {"z": [1, None], "a": "AVAL"})
        self.assertEqual(self.target.read_bytes(), b'{"a":"AVAL","z":[1,null]}\n')
        write_json_atomic(self.target, {"result": 2})
        self.assertEqual(json.loads(self.target.read_text()), {"result": 2})
        self.assertEqual(list(self.root.iterdir()), [self.target])

    def test_failed_serialization_preserves_existing_artifact_and_removes_temporary(self):
        previous = b'{"previous":true}\n'
        self.target.write_bytes(previous)
        for invalid in ({"x": float("nan")}, {"x": float("inf")}, {"x": object()}):
            with self.subTest(invalid=invalid), self.assertRaises((ValueError, TypeError)):
                write_json_atomic(self.target, invalid)
            self.assertEqual(self.target.read_bytes(), previous)
            self.assertEqual(list(self.root.iterdir()), [self.target])

    def test_failed_replacement_preserves_existing_artifact_and_removes_temporary(self):
        self.target.write_bytes(b"previous")
        with patch.object(Path, "replace", side_effect=OSError("synthetic publication failure")):
            with self.assertRaisesRegex(OSError, "publication failure"):
                write_json_atomic(self.target, {"next": 1})
        self.assertEqual(self.target.read_bytes(), b"previous")
        self.assertEqual(list(self.root.iterdir()), [self.target])

    def test_existing_and_dangling_target_symlinks_are_rejected(self):
        outside = self.root / "outside.json"
        outside.write_bytes(b"untouched")
        for destination in (outside, self.root / "missing.json"):
            self.target.symlink_to(destination)
            with self.assertRaisesRegex(ValueError, "symlink"):
                write_json_atomic(self.target, {"next": 1})
            self.assertTrue(self.target.is_symlink())
            self.target.unlink()
        self.assertEqual(outside.read_bytes(), b"untouched")
        self.assertFalse((self.root / "missing.json").exists())

    def test_symlink_parent_is_rejected_without_writing_into_its_target(self):
        actual = self.root / "actual"
        actual.mkdir()
        alias = self.root / "alias"
        alias.symlink_to(actual, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            write_json_atomic(alias / "native.json", {"next": 1})
        self.assertEqual(list(actual.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
