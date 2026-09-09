import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("window_extract", HERE / "extract.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture(directory):
    path = Path(directory) / "synthetic.tar.gz"
    members = {"labels": "S\nT\n", "ds_name": "synthetic\n", "t": "".join(f"{i / 2}\n" for i in range(180)),
               "stim_neurons": "0\n", "stim_volume_i": "60\n",
               "gcamp": "".join(f"{i} {('nan' if i == 75 else i * 2)}\n" for i in range(180))}
    with tarfile.open(path, "w:gz") as archive:
        for family, text in members.items():
            encoded = text.encode(); member = tarfile.TarInfo(f"exported_data/0_{family}.txt"); member.size = len(encoded)
            archive.addfile(member, io.BytesIO(encoded))
    parsed = module.randi.adapt_randi(path, expected_recordings=1)
    request = {"id": '["randi2023-recording-0",0,"T"]', "recordingId": "randi2023-recording-0", "recordingIndex": 0,
               "trialIndex": 0, "source": "S", "target": "T", "columnIndex": 1,
               "baseline": {"startIndex": 0, "endIndexExclusive": 60}, "post": {"startIndex": 60, "endIndexExclusive": 120}}
    return path, parsed, request


class ExtractionTests(unittest.TestCase):
    def test_independent_column_scanner_rejects_shifted_and_forged_samples(self):
        reference_spec = importlib.util.spec_from_file_location("d5_reference", HERE / "reference.py")
        reference = importlib.util.module_from_spec(reference_spec); reference_spec.loader.exec_module(reference)
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, request = fixture(directory)
            extracted = module.scan(path, parsed["recordings"], [request], parsed["source"])
            data = {"archive": parsed["source"], "recordings": parsed["recordings"], "extracted": extracted}
            verified = reference.verify_source_windows(path, data, [request])
            self.assertEqual(verified[request["id"]], extracted["windows"][0])
            extracted["windows"][0]["baseline"][0] = 123
            with self.assertRaisesRegex(ValueError, "sample selection differs"):
                reference.verify_source_windows(path, data, [request])

    def test_exact_window_coordinates_and_native_nan(self):
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, request = fixture(directory)
            result = module.scan(path, parsed["recordings"], [request], parsed["source"])
            window = result["windows"][0]
            self.assertEqual(window["baseline"], [i * 2 for i in range(60)])
            self.assertEqual(window["post"], [None if i == 75 else i * 2 for i in range(60, 120)])
            self.assertEqual(result["summary"]["verifiedMembers"], 6)
            self.assertEqual(result["summary"]["sourceNumericValues"], 360)

    def test_integrity_includes_unselected_bytes_and_archive_trailer(self):
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, request = fixture(directory)
            parsed["recordings"][0]["members"]["ds_name"]["sha256"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "Consumed native member"):
                module.scan(path, parsed["recordings"], [request], parsed["source"])
            path, parsed, request = fixture(directory)
            with path.open("ab") as output:
                output.write(gzip.compress(b"changed bytes after the tar end"))
            with self.assertRaisesRegex(ValueError, "identity changed"):
                module.scan(path, parsed["recordings"], [request], parsed["source"])

    def test_complete_archive_is_verified_even_with_no_requested_window(self):
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, _ = fixture(directory)
            result = module.scan(path, parsed["recordings"], [], parsed["source"])
            self.assertEqual(result["windows"], [])
            self.assertEqual(result["summary"]["verifiedMembers"], 6)

    def test_repeated_foreign_direct_and_incomplete_requests_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, request = fixture(directory)
            with self.assertRaisesRegex(ValueError, "Repeated"):
                module.scan(path, parsed["recordings"], [request, request], parsed["source"])
            for changed in [{**request, "recordingIndex": 1}, {**request, "columnIndex": 0},
                            {**request, "target": "OTHER"}, {**request, "post": {"startIndex": 60, "endIndexExclusive": 119}}]:
                with self.assertRaises(ValueError):
                    module.scan(path, parsed["recordings"], [changed], parsed["source"])

    def test_symlink_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path, parsed, request = fixture(directory)
            link = Path(directory) / "link.tar.gz"; link.symlink_to(path)
            with self.assertRaisesRegex(ValueError, "regular file"):
                module.scan(link, parsed["recordings"], [request], parsed["source"])


if __name__ == "__main__":
    unittest.main()
