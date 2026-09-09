"""Synthetic source-shape tests: no downloaded corpus required."""

import copy
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import randi


def fixture(index=0):
    values = {
        "labels": "AVAL\n \nAVAL\nmerge\nAIY?\n18\n",
        "ds_name": "/source/recording-%d/" % index,
        "t": "0\n0.5\n1\n",
        "gcamp": "0 nan 2 3 4 5\n1 2 3 4 5 6\n2 3 4 nan 6 7\n",
        "stim_neurons": "0\n-2\n5\n",
        "stim_volume_i": "0\n1\n2\n",
    }
    return {"exported_data/%d_%s.txt" % (index, key): value.encode()
            for key, value in values.items()}


class RandiTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "source.tar.gz"

    def archive(self, members=None):
        members = fixture() if members is None else members
        items = list(members.items()) if isinstance(members, dict) else members
        with tarfile.open(self.path, "w:gz") as archive:
            for name, content in items:
                member = tarfile.TarInfo(name)
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
        return self.path

    def adapt(self, members=None, **kwargs):
        return randi.adapt_randi(self.archive(members), expected_recordings=1, **kwargs)

    def test_native_alignment_missing_zero_and_raw_label_preservation(self):
        result = self.adapt()
        record = result["recordings"][0]
        self.assertEqual(result["format"], "onto2d-randi-native-v1")
        self.assertEqual(record["time_coordinates"], [0, 0.5, 1])
        self.assertEqual(record["traces"]["finite_values"], 16)
        self.assertEqual(record["traces"]["missing_values"], 2)
        self.assertEqual(record["traces"]["zero_values"], 1)
        self.assertEqual(record["traces"]["missing_by_column"], [0, 1, 0, 1, 0, 0])
        self.assertEqual(record["labels"][1]["raw_label"], " ")
        self.assertEqual(record["labels"][1]["status"], "unidentified")
        self.assertEqual(record["labels"][3]["status"], "source_marker")
        self.assertEqual(record["labels"][4]["status"], "unresolved_label")
        self.assertEqual(record["labels"][5]["status"], "numeric_placeholder")
        self.assertEqual(record["duplicate_labels"], {"AVAL": [0, 2]})
        self.assertIsNone(record["animal_id"])
        self.assertEqual(record["stimulations"][1]["native_neuron_index"], -2)
        self.assertIsNone(record["stimulations"][1]["column_index"])
        self.assertEqual(record["stimulations"][2]["trial_index"], 2)
        self.assertEqual(record["stimulations"][2]["raw_label"], "18")
        self.assertEqual(record["stimulations"][2]["time_coordinate"], 1)
        json.dumps(result, allow_nan=False)
        self.assertNotIn("values", record["traces"])

    def test_source_and_member_hashes_bind_exact_bytes(self):
        result = self.adapt()
        self.assertEqual(result["source"]["sha256"], hashlib.sha256(self.path.read_bytes()).hexdigest())
        for family, reference in result["recordings"][0]["members"].items():
            raw = fixture()["exported_data/0_%s.txt" % family]
            self.assertEqual(reference["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(reference["byte_length"], len(raw))

    def test_out_of_order_recordings_and_members_preserve_indexes(self):
        members = {**fixture(1), **fixture(0)}
        result = randi.adapt_randi(self.archive(list(reversed(list(members.items())))), expected_recordings=2)
        self.assertEqual([record["recording_index"] for record in result["recordings"]], [0, 1])
        self.assertEqual(result["census"]["recordings"], 2)
        self.assertEqual(result["census"]["distinct_source_dataset_names"], 2)

    def test_native_negative_sentinels_are_not_guessed_or_indexed(self):
        members = fixture()
        members["exported_data/0_stim_neurons.txt"] = b"-1\n-2\n-3\n"
        result = self.adapt(members)
        self.assertEqual(result["census"]["negative_stimulation_sentinels"], {"-1": 1, "-2": 1, "-3": 1})
        self.assertTrue(all(stim["raw_label"] is None for stim in result["recordings"][0]["stimulations"]))

    def test_surplus_blank_label_slots_are_retained_without_inventing_columns(self):
        members = fixture()
        members["exported_data/0_labels.txt"] += b"\n \n"
        result = self.adapt(members)
        record = result["recordings"][0]
        self.assertEqual(len(record["labels"]), 8)
        self.assertEqual(record["traces"]["columns"], 6)
        self.assertEqual(record["labels"][-1]["native_label_index"], 7)
        self.assertIsNone(record["labels"][-1]["column_index"])
        self.assertEqual(result["census"]["unbound_trailing_label_slots"], 2)
        members["exported_data/0_labels.txt"] += b"AVAR\n"
        with self.assertRaisesRegex(ValueError, "no corresponding trace column"):
            self.adapt(members)

    def test_dimension_and_index_failures(self):
        bad_values = [
            ("labels", b"AVAL\n"),
            ("t", b"0\n1\n"),
            ("t", b"0\n1\n1\n"),
            ("t", b"1\n0.5\n2\n"),
            ("t", b"0\nnan\n1\n"),
            ("stim_neurons", b"0\n-2\n6\n"),
            ("stim_neurons", b"0\n1\n"),
            ("stim_neurons", b"0\n1.0\n2\n"),
            ("stim_volume_i", b"0\n1\n3\n"),
            ("stim_volume_i", b"-1\n1\n2\n"),
            ("ds_name", b"\n"),
            ("ds_name", b"one\ntwo\n"),
        ]
        for family, data in bad_values:
            with self.subTest(family=family, data=data):
                members = fixture()
                members["exported_data/0_%s.txt" % family] = data
                with self.assertRaises(ValueError):
                    self.adapt(members)

    def test_nonmonotonic_and_duplicate_stimulations_remain_in_native_order(self):
        members = fixture()
        members["exported_data/0_stim_volume_i.txt"] = b"0\n2\n0\n"
        result = self.adapt(members)
        record = result["recordings"][0]
        self.assertEqual([stim["volume_index"] for stim in record["stimulations"]], [0, 2, 0])
        self.assertEqual([stim["native_stimulation_row_index"] for stim in record["stimulations"]], [0, 1, 2])
        self.assertEqual(record["stimulation_alignment"]["nonincreasing_native_row_pairs"], [[1, 2]])
        self.assertEqual(record["stimulation_alignment"]["duplicate_volume_groups"],
                         [{"volume_index": 0, "native_row_indices": [0, 2]}])
        self.assertEqual(record["stimulations"][-1]["source_order_relation"], "nonincreasing")
        self.assertTrue(all(stim["response_eligibility"] == "not_assessed" for stim in record["stimulations"]))
        self.assertEqual(result["census"]["stimulation_rows_with_duplicate_volume"], 2)

    def test_nonfinite_malformed_ragged_and_empty_traces_fail(self):
        for data in (b"", b"\n", b"0 1\n1\n", b"inf\n", b"1e9999\n", b"1e-9999\n", b"1_0\n", b"?\n"):
            with self.subTest(data=data):
                members = fixture()
                members["exported_data/0_gcamp.txt"] = data
                with self.assertRaises(ValueError):
                    self.adapt(members)

    def test_every_recording_and_family_is_required(self):
        with self.assertRaisesRegex(ValueError, "Missing Randi recording index"):
            randi.adapt_randi(self.archive(), expected_recordings=2)
        members = fixture()
        del members["exported_data/0_gcamp.txt"]
        with self.assertRaisesRegex(ValueError, "Missing Randi recording family"):
            self.adapt(members)
        with self.assertRaisesRegex(ValueError, "Unexpected Randi recording index"):
            self.adapt(fixture(1))

    def test_duplicate_unexpected_and_unsafe_members_fail(self):
        members = list(fixture().items())
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.adapt(members + [members[0]])
        for name in ("../escape", "exported_data/0_extra.txt", "exported_data/00_labels.txt"):
            with self.subTest(name=name):
                with self.assertRaisesRegex(ValueError, "Unexpected"):
                    self.adapt(members + [(name, b"x")])
        with tarfile.open(self.path, "w:gz") as archive:
            link = tarfile.TarInfo("exported_data/0_gcamp.txt")
            link.type = tarfile.SYMTYPE
            link.linkname = "outside"
            archive.addfile(link)
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            randi.adapt_randi(self.path, expected_recordings=1)
        with tarfile.open(self.path, "w:gz", format=tarfile.PAX_FORMAT) as archive:
            member = tarfile.TarInfo("exported_data/0_labels.txt")
            member.pax_headers = {"comment": "extension metadata is outside this native format"}
            archive.addfile(member, io.BytesIO())
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            randi.adapt_randi(self.path, expected_recordings=1)

    def test_extension_headers_are_rejected_even_with_a_complete_valid_population(self):
        with tarfile.open(self.path, "w:gz", format=tarfile.PAX_FORMAT) as archive:
            for index, (name, content) in enumerate(fixture().items()):
                member = tarfile.TarInfo(name)
                member.size = len(content)
                if index == 0:
                    member.pax_headers = {"comment": "unsupported extension"}
                archive.addfile(member, io.BytesIO(content))
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            randi.adapt_randi(self.path, expected_recordings=1)

    def test_resource_limits_fail_explicitly(self):
        self.archive()
        for constant, limit in (("MAX_COMPRESSED_BYTES", 1), ("MAX_EXPANDED_BYTES", 100),
                                ("MAX_MEMBER_BYTES", 1), ("MAX_LINE_BYTES", 1),
                                ("MAX_ROWS", 1), ("MAX_COLUMNS", 1),
                                ("MAX_VALUES", 1), ("MAX_MEMBERS", 1)):
            with self.subTest(constant=constant), patch.object(randi, constant, limit):
                with self.assertRaises(ValueError):
                    randi.adapt_randi(self.path, expected_recordings=1)

    def test_trace_replay_preserves_zero_missing_and_volume_order(self):
        record = self.adapt()["recordings"][0]
        rows = list(randi.iter_trace_rows(self.path, record))
        self.assertEqual([index for index, values in rows], [0, 1, 2])
        self.assertEqual(rows[0][1], (0, None, 2, 3, 4, 5))
        self.assertIsNone(rows[2][1][3])
        invalid = copy.deepcopy(record)
        invalid["members"]["gcamp"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "member identity"):
            list(randi.iter_trace_rows(self.path, invalid))
        members = fixture()
        members["exported_data/0_ds_name.txt"] = b"changed"
        self.archive(members)
        with self.assertRaisesRegex(ValueError, "archive identity"):
            list(randi.iter_trace_rows(self.path, record))

    def test_parsed_archive_bytes_must_match_identity_before_read(self):
        record = self.adapt()["recordings"][0]
        identity = randi._archive_identity

        def replace_after_hash(path):
            result = identity(path)
            changed = fixture()
            changed["exported_data/0_ds_name.txt"] = b"different source recording"
            self.archive(changed)
            return result

        with patch.object(randi, "_archive_identity", side_effect=replace_after_hash):
            with self.assertRaisesRegex(ValueError, "archive identity changed"):
                randi.adapt_randi(self.path, expected_recordings=1)
        self.archive()
        # Restore the exact byte identity used by this new replay fixture.
        record["archive_sha256"] = identity(self.path)["sha256"]
        with patch.object(randi, "_archive_identity", side_effect=replace_after_hash):
            with self.assertRaisesRegex(ValueError, "archive identity changed"):
                list(randi.iter_trace_rows(self.path, record))

    def test_expansion_limit_covers_data_after_tar_end_marker(self):
        self.archive()
        expanded = gzip.decompress(self.path.read_bytes())
        self.path.write_bytes(gzip.compress(expanded + b"\0" * 100_000))
        with patch.object(randi, "MAX_EXPANDED_BYTES", len(expanded) + 10_000):
            with self.assertRaisesRegex(ValueError, "expanded-byte limit"):
                randi.adapt_randi(self.path, expected_recordings=1)


if __name__ == "__main__":
    unittest.main()
