"""Synthetic tests; no downloaded biological records are bundled or required."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import witvliet
from witvliet import DATASETS, adapt_records, adapt_witvliet, parse_metadata


DATASET_METADATA = """
all_datasets = ('Dataset1', 'Dataset2', 'Dataset3', 'Dataset4',
                'Dataset5', 'Dataset6', 'Dataset7', 'Dataset8')
stage = {'Dataset1': 'L1', 'Dataset2': 'L1', 'Dataset3': 'L1', 'Dataset4': 'L1',
         'Dataset5': 'L2', 'Dataset6': 'L3', 'Dataset7': 'Adult', 'Dataset8': 'Adult'}
timepoint = {'Dataset1': 0, 'Dataset2': 5, 'Dataset3': 8, 'Dataset4': 16,
             'Dataset5': 23, 'Dataset6': 27, 'Dataset7': 50, 'Dataset8': 50}
"""

NEURON_METADATA = """
neuron_list = ('ADA', 'AVA', 'SAB', 'BWM01', 'excgl', 'DAn', 'VAn')
def ntype(n):
    if n in ('ADA', 'AVA'):
        return 'inter'
    if n in ('SAB', 'DAn', 'VAn'):
        return 'motor'
    if n in ('BWM01',):
        return 'muscle'
    if n in ('excgl',):
        return 'other'
    return 'nonvalid'
def class_members(cls):
    if cls in ('ADA', 'AVA'):
        return [cls + n for n in ('L', 'R')]
    if cls == 'SAB':
        return ['SABD', 'SABVL', 'SABVR']
    if cls == 'DAn':
        return ['DA' + str(i + 1) for i in range(9)]
    if cls == 'VAn':
        return ['VA' + str(i + 1) for i in range(12)]
    if cls in ('BWM01',):
        return ['BWM-' + n + cls[-2:] for n in ('DL', 'DR', 'VL', 'VR')]
    return [cls]
"""

EXPORT_METADATA = """
def export_nemanode_connections(path):
    synapses = data_manager.get_synapses_one_to_one().copy().assign(typ=0, syn=1)
    gapjunctions = data_manager.get_gapjunctions().copy().assign(typ=2, syn=1)
"""


def record(pre, post, typ=0, contacts=None):
    contacts = contacts or [(1, 10, 20)]
    return {"pre": pre, "post": post, "typ": typ,
            "ids": [row[0] for row in contacts],
            "pre_tid": [row[1] for row in contacts],
            "post_tid": [row[2] for row in contacts], "syn": [1] * len(contacts)}


class WitvlietAdapterTests(unittest.TestCase):
    def setUp(self):
        self.metadata = parse_metadata(DATASET_METADATA, NEURON_METADATA, EXPORT_METADATA)

    def adapt(self, records):
        return adapt_records(records, "Dataset1", self.metadata)

    def test_native_channels_multiplicity_and_projection_accounting(self):
        records = [record("ADAL", "AVAL", contacts=[(1, 10, 20), (2, 11, 21)]),
                   record("AVAL", "ADAL"), record("ADAL", "BWM-DL01"),
                   record("ADAL", "Fragment"), record("ADAL", "ADAL"),
                   record("ADAL", "VAn"), record("ADAL", "ADAR", 2),
                   record("ADAR", "ADAL", 2, [(1, 20, 10)]),
                   record("ADAR", "SABD", 2, [(3, 30, 40)]),
                   record("excgl", "ADAL", 2)]
        unit = self.adapt(records)
        self.assertEqual(unit["nativeRecords"], records)
        self.assertEqual(len(unit["edges"]), len(records))
        self.assertEqual(unit["projection"]["nodes"], ["ADAL", "ADAR", "AVAL", "SABD"])
        self.assertEqual([(edge["source"], edge["target"]) for edge in unit["projection"]["edges"]],
                         [("ADAL", "AVAL"), ("AVAL", "ADAL")])
        self.assertEqual(unit["edges"][0]["contactCount"], 2)
        self.assertEqual(unit["census"]["chemicalExcludedNonNeuronOrUnresolvedCount"], 3)
        self.assertEqual(unit["census"]["chemicalExcludedNeuronLoopCount"], 1)
        self.assertEqual(unit["census"]["gapRecordCount"], 4)
        self.assertEqual(unit["census"]["gapUndirectedPairCount"], 3)
        self.assertEqual(unit["census"]["gapMirrorCounts"],
                         {"single-native-orientation": 2, "verified-mirror": 1})
        self.assertFalse(unit["nodeUniverse"]["complete"])
        self.assertIsNone(unit["nodeUniverse"]["unobservedIsolates"])
        self.assertFalse(unit["coordinates"]["endpointTreeNodeIdsAreCoordinates"])
        self.assertEqual(unit["coordinates"]["status"], "not-supplied")
        self.assertEqual(json.loads(json.dumps(unit)), unit)

    def test_source_member_expansion_does_not_guess_unknown_or_class_labels(self):
        unit = self.adapt([record("DA9", "VA12"), record("VAn", "Fragment"),
                           record("ADAL", "excgl"), record("DA99", "BWM-VL01")])
        nodes = {node["id"]: node for node in unit["nodeMetadata"]}
        self.assertTrue(nodes["DA9"]["isNeuron"])
        self.assertTrue(nodes["VA12"]["isNeuron"])
        self.assertEqual(nodes["VAn"]["labelResolution"], "class-label")
        self.assertIsNone(nodes["VAn"]["isNeuron"])
        self.assertEqual(nodes["DA99"]["labelResolution"], "unclassified")
        self.assertFalse(nodes["BWM-VL01"]["isNeuron"])
        self.assertFalse(nodes["excgl"]["isNeuron"])

    def test_gap_mirrors_are_verified_without_double_counting(self):
        unit = self.adapt([
            record("ADAL", "ADAR", 2, [(1, 10, 20), (2, 11, 21)]),
            record("ADAR", "ADAL", 2, [(2, 21, 11), (1, 20, 10)]),
            record("ADAL", "ADAL", 2, [(3, 10, 11)]),
        ])
        self.assertEqual([pair["contactCount"] for pair in unit["gapJunctionPairs"]], [1, 2])
        self.assertEqual(unit["census"]["gapMirrorCounts"], {"self-loop": 1, "verified-mirror": 1})
        self.assertEqual(unit["projection"]["edges"], [])
        with self.assertRaisesRegex(ValueError, "Conflicting mirrored"):
            self.adapt([record("ADAL", "ADAR", 2), record("ADAR", "ADAL", 2)])

    def test_reciprocal_chemicals_remain_two_arcs_and_shared_polyad_ids_are_legal(self):
        unit = self.adapt([record("ADAL", "AVAL"), record("ADAL", "ADAR"),
                           record("AVAL", "ADAL")])
        self.assertEqual(len(unit["projection"]["edges"]), 3)
        self.assertEqual(unit["gapJunctionPairs"], [])

    def test_native_records_are_preserved_without_mutating_or_aliasing_inputs(self):
        records = [record("ADAL", "AVAL")]
        original = deepcopy(records)
        unit = self.adapt(records)
        self.assertEqual(records, original)
        unit["nativeRecords"][0]["ids"][0] = 99
        unit["projection"]["edges"][0]["source"] = "changed"
        self.assertEqual(records, original)
        self.assertEqual(unit["edges"][0]["source"], "ADAL")

    def test_rejects_malformed_native_records_and_duplicate_connections(self):
        invalid = [[], {}, [None]]
        for key, value in [("typ", 1), ("typ", True), ("pre", " ADAL"),
                           ("syn", [2]), ("syn", [True]), ("ids", [-1]),
                           ("ids", [1, 2]), ("post_tid", []), ("pre_tid", None)]:
            item = record("ADAL", "AVAL")
            item[key] = value
            invalid.append([item])
        extra = record("ADAL", "AVAL")
        extra["coordinates"] = [1, 2]
        missing = record("ADAL", "AVAL")
        del missing["pre_tid"]
        invalid.extend([[extra], [missing], [record("ADAL", "AVAL")] * 2,
                        [record("ADAL", "AVAL", contacts=[(1, 10, 20)] * 2)]])
        for records in invalid:
            with self.subTest(records=records), self.assertRaises(ValueError):
                self.adapt(records)
        with self.assertRaises(ValueError):
            adapt_records([record("ADAL", "AVAL")], "Dataset9", self.metadata)

    def test_source_stages_cover_eight_distinct_units(self):
        self.assertEqual([self.metadata["stages"][dataset] for dataset in DATASETS],
                         ["L1", "L1", "L1", "L1", "L2", "L3", "Adult", "Adult"])
        self.assertEqual(self.adapt([record("ADAL", "AVAL")])["cohortRelation"],
                         "distinct-animal-cross-sectional")

    def test_metadata_is_never_executed_and_invalid_or_conflicting_tables_fail(self):
        metadata = parse_metadata("raise RuntimeError('must not execute')\n" + DATASET_METADATA,
                                  "import nonexistent_upstream_module\n" + NEURON_METADATA,
                                  EXPORT_METADATA)
        self.assertEqual(metadata, self.metadata)
        invalid = [
            (DATASET_METADATA.replace("'Dataset1': 'L1'", "'Dataset1': 'unknown'"), NEURON_METADATA, EXPORT_METADATA),
            (DATASET_METADATA.replace("'Dataset1': 'L1',", ""), NEURON_METADATA, EXPORT_METADATA),
            (DATASET_METADATA + "\nstage = {}", NEURON_METADATA, EXPORT_METADATA),
            (DATASET_METADATA.replace("'Dataset1': 0,", "'Dataset1': 0, 'Dataset1': 1,"), NEURON_METADATA, EXPORT_METADATA),
            (DATASET_METADATA, NEURON_METADATA.replace("'sensory'", "'invalid'").replace("'inter'", "'invalid'"), EXPORT_METADATA),
            (DATASET_METADATA, NEURON_METADATA.replace("('SAB', 'DAn', 'VAn')", "('SAB', 'DAn', 'VAn', 'ADA')"), EXPORT_METADATA),
            (DATASET_METADATA, NEURON_METADATA.replace("['SABD', 'SABVL', 'SABVR']", "['ADAL']"), EXPORT_METADATA),
            (DATASET_METADATA, NEURON_METADATA.replace("return [cls]", "return []"), EXPORT_METADATA),
            (DATASET_METADATA, NEURON_METADATA, EXPORT_METADATA.replace("typ=2", "typ=3")),
            (DATASET_METADATA, NEURON_METADATA, EXPORT_METADATA.replace("syn=1", "syn=2")),
            (DATASET_METADATA, NEURON_METADATA, EXPORT_METADATA.replace("syn=1", "syn=True")),
        ]
        for values in invalid:
            with self.subTest(values=values), self.assertRaises(ValueError):
                parse_metadata(*values)

    def test_missing_cache_sources_fail_before_adaptation(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Missing regular source"):
                adapt_witvliet(Path(directory))

    def synthetic_cache(self, directory):
        contents = {"witvliet2021-%s.py" % name: text.encode() for name, text in
                    (("dataset_info", DATASET_METADATA), ("neuron_info", NEURON_METADATA),
                     ("export_json", EXPORT_METADATA), ("data_manager", "raise RuntimeError('never execute')"))}
        contents.update({"witvliet2021-witvliet_2020_%d.json" % index:
                         json.dumps([record("ADAL", "AVAL")]).encode() for index in range(1, 9)})
        entries = []
        for name, content in contents.items():
            (directory / name).write_bytes(content)
            entries.append({"dataset": "celegans-witvliet-2021", "file": name,
                            "byteLength": len(content), "sha256": hashlib.sha256(content).hexdigest(),
                            "sourceCommit": "synthetic", "sourcePath": name})
        return entries

    def test_native_snapshot_uses_the_same_bytes_as_source_hashes(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            entries = self.synthetic_cache(directory)
            original = witvliet.parse_metadata

            def replace_after_metadata_read(*args):
                (directory / "witvliet2021-witvliet_2020_1.json").write_text(
                    json.dumps([record("AVAL", "ADAL")]))
                return original(*args)

            with patch.object(witvliet, "load_lock", return_value=entries), \
                    patch.object(witvliet, "parse_metadata", side_effect=replace_after_metadata_read):
                result = adapt_witvliet(directory)
            self.assertEqual(len(result["units"]), 8)
            self.assertEqual(result["units"][0]["nativeRecords"], [record("ADAL", "AVAL")])
            self.assertEqual(result["units"][0]["source"]["sha256"], entries[4]["sha256"])

    def test_source_bytes_are_bounded_verified_and_not_symlinks(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for mode in ("corrupt", "oversize", "symlink"):
                with self.subTest(mode=mode):
                    entries = self.synthetic_cache(directory)
                    path = directory / "witvliet2021-witvliet_2020_1.json"
                    if mode == "corrupt":
                        path.write_bytes(b"x" * entries[4]["byteLength"])
                    elif mode == "oversize":
                        path.write_bytes(path.read_bytes() + b"x")
                    else:
                        path.unlink()
                        path.symlink_to(directory / "witvliet2021-witvliet_2020_2.json")
                    with patch.object(witvliet, "load_lock", return_value=entries):
                        with self.assertRaises(ValueError):
                            adapt_witvliet(directory)


if __name__ == "__main__":
    unittest.main()
