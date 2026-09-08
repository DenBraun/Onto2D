"""Offline, fabricated-source tests for DREAM4 ingestion and source identity."""

import gzip
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import dream4


def _tsv(rows):
    return ("\n".join("\t".join(str(value) for value in row) for row in rows) + "\n").encode()


def _native_files():
    files = {}
    genes = ["G%d" % index for index in range(1, 11)]
    for unit in range(1, 6):
        prefix = "lightlyProcessedDownloadedData/insilico_size10_%d/" % unit
        files[prefix + "goldStandard.tsv"] = _tsv([
            [source, target, int(source == "G1" and target == "G2")]
            for source in genes for target in genes if source != target])
        files[prefix + "wildtype.tsv"] = _tsv([genes, [unit + index / 10 for index in range(10)]])
        for name in ("knockouts", "knockdowns", "multifactorial"):
            values = [[0 if name == "knockouts" and row == column else unit * 100 + row * 10 + column
                       for column in range(10)] for row in range(10)]
            files[prefix + name + ".tsv"] = _tsv([genes] + values)
        timeseries = [["Time"] + genes]
        for series in range(5):
            timeseries.append([])
            timeseries.extend([[time] + [series * 10 + column / 10 for column in range(10)]
                               for time in range(0, 1001, 50)])
        files[prefix + "timeseries.tsv"] = _tsv(timeseries)
        files[prefix + "dualknockouts.tsv"] = _tsv([["G_i", "G_j"], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]])
    return files


def _tar_gz(members):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode="w") as archive:
        for name, content in members:
            if isinstance(content, tarfile.TarInfo):
                archive.addfile(content)
            else:
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
    return gzip.compress(data.getvalue(), mtime=0)


ALIGNMENT = (b'x <- t(tbl.ko)\ncolnames(x) <- paste(rownames(x), ".ko", sep="")\n'
             b'x <- t(tbl.kd)\ncolnames(x) <- paste(rownames(x), ".kd", sep="")\n'
             b'stop("this source must never execute")\n')


class Dream4AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "source.tar.gz"
        self.prefix = "lightlyProcessedDownloadedData/insilico_size10_1/"

    def adapt(self, files=None, extra=(), alignment=ALIGNMENT, outer_extra=()):
        if files is None:
            files = _native_files()
        nested = _tar_gz(list(files.items()) + list(extra))
        outer = [(dream4.NESTED_MEMBER, nested)]
        if alignment is not None:
            outer.append((dream4.ALIGNMENT_MEMBER, alignment))
        self.path.write_bytes(_tar_gz(outer + list(outer_extra)))
        return dream4.adapt_dream4(self.path)

    def test_complete_population_preserves_first_edge_isolates_zeros_and_interventions(self):
        result = self.adapt()
        self.assertEqual(result["format"], "onto2d-dream4-native-v1")
        self.assertEqual(result["census"]["units"], 5)
        self.assertEqual(result["census"]["explicitZeroEntries"], 445)
        for number, unit in enumerate(result["units"], 1):
            self.assertEqual(unit["id"], "insilico_size10_%d" % number)
            self.assertEqual(len(unit["nodes"]), 10)
            self.assertEqual(unit["edges"], [{"source": "G1", "target": "G2"}])
            self.assertEqual(unit["goldStandard"][0], {"source": "G1", "target": "G2", "value": 1, "nativeLine": 1})
            ko = unit["tables"]["knockouts"]
            self.assertEqual(ko["interventions"][3], {"rowIndex": 3, "gene": "G4"})
            self.assertEqual(ko["values"][3][8], number * 100 + 38)
            self.assertEqual(ko["nativeLines"][3], 5)
            self.assertEqual(unit["tables"]["knockdowns"]["interventions"], ko["interventions"])
            dual = unit["tables"]["dualknockouts"]
            self.assertEqual(dual["outcomeState"], "unobserved")
            self.assertEqual(dual["interventions"][0]["genes"], ["G1", "G2"])
            temporal = unit["tables"]["timeseries"]
            self.assertEqual(temporal["series"][1]["rowIndices"], list(range(21, 42)))
            self.assertIsNone(temporal["series"][1]["intervenedGenes"])
        self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)

    def test_expression_changes_do_not_create_structural_edges(self):
        before = self.adapt()
        files = _native_files()
        key = self.prefix + "knockdowns.tsv"
        files[key] = files[key].replace(b"100\t101", b"900\t901", 1)
        after = self.adapt(files)
        self.assertEqual(before["units"][0]["edges"], after["units"][0]["edges"])
        self.assertNotEqual(before["units"][0]["tables"]["knockdowns"]["sourceSha256"],
                            after["units"][0]["tables"]["knockdowns"]["sourceSha256"])

    def test_gold_standard_rejects_missing_duplicate_header_self_and_unknown_rows(self):
        changes = [lambda data: data.split(b"\n", 1)[1],
                   lambda data: data + b"G1\tG2\t1\n",
                   lambda data: b"source\ttarget\tvalue\n" + data,
                   lambda data: data.replace(b"G1\tG2\t1", b"G1\tG1\t1", 1),
                   lambda data: data.replace(b"G1\tG2\t1", b"G1\tG11\t1", 1),
                   lambda data: data.replace(b"G1\tG2\t1", b"G1\tG2\t-1", 1)]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                files = _native_files()
                key = self.prefix + "goldStandard.tsv"
                files[key] = change(files[key])
                with self.assertRaisesRegex(ValueError, "gold-standard"):
                    self.adapt(files)

    def test_expression_rejects_column_mismatch_missing_cells_nonfinite_and_wrong_shape(self):
        for replacement in (b"NaN", b"inf", b"1e999", b"", b"NA"):
            with self.subTest(value=replacement):
                files = _native_files()
                key = self.prefix + "knockdowns.tsv"
                files[key] = files[key].replace(b"100\t101", replacement + b"\t101", 1)
                with self.assertRaisesRegex(ValueError, "numeric"):
                    self.adapt(files)
        for change in (lambda data: data.replace(b"G1\tG2", b"G2\tG1", 1),
                       lambda data: data.replace(b"G1\tG2", b"G1\tG1", 1),
                       lambda data: data.rsplit(b"\n", 2)[0] + b"\n",
                       lambda data: data.replace(b"100\t101", b"100", 1)):
            files = _native_files()
            key = self.prefix + "knockdowns.tsv"
            files[key] = change(files[key])
            with self.assertRaises(ValueError):
                self.adapt(files)

    def test_source_knockout_alignment_and_temporal_boundaries_are_checked(self):
        files = _native_files()
        key = self.prefix + "knockouts.tsv"
        files[key] = files[key].replace(b"\n0\t101", b"\n2\t101", 1)
        with self.assertRaisesRegex(ValueError, "knockout diagonal"):
            self.adapt(files)
        for change in (lambda data: data.replace(b"\n\n", b"\n", 1),
                       lambda data: data.replace(b"\n50\t", b"\n51\t", 1)):
            files = _native_files()
            key = self.prefix + "timeseries.tsv"
            files[key] = change(files[key])
            with self.assertRaisesRegex(ValueError, "time-series"):
                self.adapt(files)
        for alignment in (None, ALIGNMENT.replace(b"tbl.kd", b"tbl.other")):
            with self.assertRaisesRegex(ValueError, "alignment"):
                self.adapt(alignment=alignment)

    def test_numeric_underflow_never_becomes_an_observed_zero(self):
        for token in (b"1e-9999", b"-1e-9999", b".0001E-9999"):
            with self.subTest(token=token):
                files = _native_files()
                key = self.prefix + "knockdowns.tsv"
                files[key] = files[key].replace(b"100\t101", token + b"\t101", 1)
                with self.assertRaisesRegex(ValueError, "underflow"):
                    self.adapt(files)
        for token in (b"0e-9999", b"-0.000E-9999", b"0.0"):
            with self.subTest(token=token):
                files = _native_files()
                key = self.prefix + "knockdowns.tsv"
                files[key] = files[key].replace(b"100\t101", token + b"\t101", 1)
                result = self.adapt(files)
                self.assertEqual(result["units"][0]["tables"]["knockdowns"]["values"][0][0], 0)

    def test_dual_knockouts_require_distinct_integral_known_gene_pairs(self):
        for row in (b"1.5\t2", b"0\t2", b"1\t11", b"2\t2", b"3\t2"):
            with self.subTest(row=row):
                files = _native_files()
                key = self.prefix + "dualknockouts.tsv"
                files[key] = files[key].replace(b"1\t2", row, 1)
                with self.assertRaisesRegex(ValueError, "dual-knockout"):
                    self.adapt(files)

    def test_all_selected_units_and_expected_tables_are_required(self):
        files = {name: data for name, data in _native_files().items() if "insilico_size10_5/" not in name}
        with self.assertRaisesRegex(ValueError, "all five"):
            self.adapt(files)
        files = _native_files()
        del files[self.prefix + "wildtype.tsv"]
        with self.assertRaisesRegex(ValueError, "missing selected-unit tables"):
            self.adapt(files)
        with self.assertRaisesRegex(ValueError, "unexpected selected-unit"):
            self.adapt(extra=[(self.prefix + "mystery.tsv", b"1")])
        with self.assertRaisesRegex(ValueError, "all five"):
            self.adapt(extra=[("lightlyProcessedDownloadedData/insilico_size10_6/wildtype.tsv", b"1")])

    def test_archive_inventory_accounts_for_unselected_data_and_member_order_is_irrelevant(self):
        files = _native_files()
        files["lightlyProcessedDownloadedData/insilico_size100_1/unknown.tsv"] = b"not a Size10 target"
        before = self.adapt(files)
        after = self.adapt(dict(reversed(list(files.items()))))
        self.assertEqual(before["units"], after["units"])
        self.assertEqual(before["archiveInventory"]["native"], after["archiveInventory"]["native"])
        self.assertEqual(before["archiveInventory"]["native"][0]["selection"], "outside-size10-pilot")

    def test_unsafe_duplicate_link_and_oversized_archives_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate archive"):
            self.adapt(extra=[(self.prefix + "wildtype.tsv", b"duplicate")])
        for name in ("lightlyProcessedDownloadedData/../escape", "/tmp/escape", "lightlyProcessedDownloadedData/a\\b"):
            with self.subTest(name=name):
                with self.assertRaisesRegex(ValueError, "unsafe archive"):
                    self.adapt(extra=[(name, b"x")])
        link = tarfile.TarInfo(self.prefix + "link")
        link.type = tarfile.SYMTYPE
        link.linkname = "/tmp/escape"
        with self.assertRaisesRegex(ValueError, "non-regular"):
            self.adapt(extra=[(link.name, link)])
        self.adapt()
        with patch.object(dream4, "MAX_COMPRESSED_BYTES", 10):
            with self.assertRaisesRegex(ValueError, "compressed archive"):
                dream4.adapt_dream4(self.path)
        with patch.object(dream4, "MAX_EXPANDED_BYTES", 100):
            with self.assertRaisesRegex(ValueError, "expanded archive"):
                dream4.adapt_dream4(self.path)
        with patch.object(dream4, "MAX_MEMBER_BYTES", 100):
            with self.assertRaisesRegex(ValueError, "member exceeds"):
                dream4.adapt_dream4(self.path)
        with patch.object(dream4, "MAX_MEMBERS", 1):
            with self.assertRaisesRegex(ValueError, "member count"):
                dream4.adapt_dream4(self.path)
        target = self.path.with_name("symlink.tar.gz")
        target.symlink_to(self.path)
        with self.assertRaisesRegex(ValueError, "symlink"):
            dream4.adapt_dream4(target)


if __name__ == "__main__":
    unittest.main()
