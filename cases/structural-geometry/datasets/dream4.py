"""Read the locked DREAM4 distribution as data, without extraction or R execution.

This is a source adapter, not a scoring protocol. In particular, the headerless
gold standard is read independently of the archived R loader, which incorrectly
requests a header and therefore consumes its first genuine edge as column names.
"""

import csv
import gzip
import hashlib
import io
import math
from pathlib import Path, PurePosixPath
import re
import tarfile


FORMAT = "onto2d-dream4-native-v1"
NESTED_MEMBER = "DREAM4/inst/extdata/lightlyProcessedDownloadedData.tar.gz"
ALIGNMENT_MEMBER = "DREAM4/inst/scripts/buildRData.R"
INNER_ROOT = "lightlyProcessedDownloadedData"
GENES = ["G%d" % index for index in range(1, 11)]
UNIT_IDS = ["insilico_size10_%d" % index for index in range(1, 6)]
TABLE_FILES = {
    "goldStandard": "goldStandard.tsv", "wildtype": "wildtype.tsv",
    "knockouts": "knockouts.tsv", "knockdowns": "knockdowns.tsv",
    "multifactorial": "multifactorial.tsv", "timeseries": "timeseries.tsv",
    "dualknockouts": "dualknockouts.tsv",
}
MAX_COMPRESSED_BYTES = 8 * 1024 * 1024
MAX_EXPANDED_BYTES = 16 * 1024 * 1024
MAX_MEMBER_BYTES = 8 * 1024 * 1024
MAX_MEMBERS = 256
DECIMAL = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\Z")


def _digest(data):
    return hashlib.sha256(data).hexdigest()


def _archive(data, root):
    """Bound decompression before tarfile parses extended headers or members."""
    if len(data) > MAX_COMPRESSED_BYTES:
        raise ValueError("compressed archive exceeds the adapter byte bound")
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as compressed:
            expanded = compressed.read(MAX_EXPANDED_BYTES + 1)
        if len(expanded) > MAX_EXPANDED_BYTES:
            raise ValueError("expanded archive exceeds the adapter byte bound")
        files, inventory, seen = {}, [], set()
        with tarfile.open(fileobj=io.BytesIO(expanded), mode="r:") as archive:
            for member in archive:
                name = member.name.rstrip("/") if member.isdir() else member.name
                parts = PurePosixPath(name).parts
                if (not parts or parts[0] != root or ".." in parts
                        or name != "/".join(parts) or "\\" in name
                        or any(ord(char) < 32 for char in name)):
                    raise ValueError("unsafe archive member: %r" % member.name)
                if name in seen:
                    raise ValueError("duplicate archive member: %s" % name)
                seen.add(name)
                if len(seen) > MAX_MEMBERS:
                    raise ValueError("archive member count exceeds the adapter bound")
                if not member.isfile() and not member.isdir():
                    raise ValueError("non-regular archive member: %s" % name)
                if member.size < 0 or member.size > MAX_MEMBER_BYTES:
                    raise ValueError("archive member exceeds the adapter byte bound: %s" % name)
                if member.isdir():
                    if member.size:
                        raise ValueError("directory member has content: %s" % name)
                    inventory.append({"member": name, "kind": "directory", "bytes": 0})
                    continue
                with archive.extractfile(member) as stream:
                    content = stream.read(member.size + 1)
                if len(content) != member.size:
                    raise ValueError("truncated archive member: %s" % name)
                files[name] = content
                inventory.append({"member": name, "kind": "file", "bytes": len(content),
                                  "sha256": _digest(content)})
        return files, sorted(inventory, key=lambda item: item["member"])
    except (OSError, EOFError, tarfile.TarError) as error:
        raise ValueError("invalid DREAM4 archive: %s" % error) from error


def _text(data, label):
    try:
        value = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("invalid UTF-8 in %s" % label) from error
    if "\x00" in value:
        raise ValueError("NUL character in %s" % label)
    return value


def _records(data, label):
    text = _text(data, label)
    try:
        reader = csv.reader(io.StringIO(text, newline=""), delimiter="\t", strict=True)
        return [(reader.line_num, row) for row in reader]
    except csv.Error as error:
        raise ValueError("invalid TSV in %s: %s" % (label, error)) from error


def _number(value, label):
    if not DECIMAL.fullmatch(value):
        raise ValueError("missing or invalid numeric value in %s: %r" % (label, value))
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("nonfinite numeric value in %s" % label)
    # Native observed zero must remain distinguishable from a nonzero decimal
    # that IEEE-754 conversion cannot represent. Exponent digits do not affect
    # whether the source significand is exactly zero.
    significand = value.lower().split("e", 1)[0]
    if number == 0 and any(character in "123456789" for character in significand):
        raise ValueError("numeric underflow would erase a nonzero observation in %s" % label)
    return number


def _numeric_table(data, label, columns, row_count, allow_separators=False):
    records = _records(data, label)
    if not records or records[0][1] != columns:
        raise ValueError("unexpected or duplicate table columns in %s" % label)
    values, lines, separators = [], [], []
    for line, row in records[1:]:
        if not row and allow_separators:
            separators.append({"nativeLine": line, "beforeRowIndex": len(values)})
            continue
        if len(row) != len(columns):
            raise ValueError("missing or extra table cells in %s at line %d" % (label, line))
        values.append([_number(value, label) for value in row])
        lines.append(line)
    if len(values) != row_count:
        raise ValueError("unexpected row count in %s: %d" % (label, len(values)))
    result = {"columns": list(columns), "values": values, "nativeLines": lines,
              "rowCount": len(values), "columnCount": len(columns)}
    if allow_separators:
        result["separators"] = separators
    return result


def _alignment_evidence(files):
    if ALIGNMENT_MEMBER not in files:
        raise ValueError("missing source intervention alignment evidence")
    script = _text(files[ALIGNMENT_MEMBER], ALIGNMENT_MEMBER)
    for suffix in ("ko", "kd"):
        pattern = (r"x\s*<-\s*t\(tbl\." + suffix + r"\)\s*"
                   r"colnames\(x\)\s*<-\s*paste\(rownames\(x\),\s*['\"]\."
                   + suffix + r"['\"],\s*sep\s*=\s*['\"]['\"]\)")
        if not re.search(pattern, script):
            raise ValueError("unrecognized source %s intervention alignment" % suffix)
    return {
        "member": ALIGNMENT_MEMBER, "sha256": _digest(files[ALIGNMENT_MEMBER]),
        "execution": "never executed; inspected as source text",
        "interventionRule": "row i targets gene i in the shared G1-through-G10 header order",
        "evidence": "the source loader transposes tbl.ko/tbl.kd and names each column from rownames(x)",
        "goldStandardPolicy": "headerless native rows; do not reproduce the source loader's header=TRUE",
    }


def _unit(unit_id, files, inventory):
    prefix = INNER_ROOT + "/" + unit_id + "/"
    allowed = set(TABLE_FILES.values()) | {"save.R"}
    allowed |= {"._" + filename for filename in TABLE_FILES.values()}
    unit_files = {name[len(prefix):]: data for name, data in files.items() if name.startswith(prefix)}
    if set(unit_files) - allowed:
        raise ValueError("unexpected selected-unit members in %s" % unit_id)
    if set(TABLE_FILES.values()) - set(unit_files):
        raise ValueError("missing selected-unit tables in %s" % unit_id)

    gold, seen = [], set()
    for line, row in _records(unit_files["goldStandard.tsv"], prefix + "goldStandard.tsv"):
        if (len(row) != 3 or row[0] not in GENES or row[1] not in GENES
                or row[0] == row[1] or row[2] not in ("0", "1")):
            raise ValueError("invalid headerless gold-standard record in %s" % unit_id)
        pair = (row[0], row[1])
        if pair in seen:
            raise ValueError("duplicate gold-standard pair in %s" % unit_id)
        seen.add(pair)
        gold.append({"source": row[0], "target": row[1], "value": int(row[2]), "nativeLine": line})
    if seen != {(source, target) for source in GENES for target in GENES if source != target}:
        raise ValueError("missing explicit off-diagonal gold-standard entries in %s" % unit_id)
    edges = [{"source": row["source"], "target": row["target"]} for row in gold if row["value"] == 1]
    edges.sort(key=lambda edge: (GENES.index(edge["source"]), GENES.index(edge["target"])))

    tables = {}
    for name, count in (("wildtype", 1), ("knockouts", 10), ("knockdowns", 10), ("multifactorial", 10)):
        tables[name] = _numeric_table(unit_files[TABLE_FILES[name]], prefix + TABLE_FILES[name], GENES, count)
        tables[name]["role"] = "independent simulated expression observations; never structural input edges"
    for name in ("knockouts", "knockdowns"):
        tables[name]["interventions"] = [{"rowIndex": index, "gene": gene} for index, gene in enumerate(GENES)]
        tables[name]["alignmentEvidenceMember"] = ALIGNMENT_MEMBER
    # This is a source-shape check, not an attempt to recover intervention labels
    # from expression magnitudes. The labels are fixed by the source convention.
    if any(tables["knockouts"]["values"][index][index] != 0 for index in range(10)):
        raise ValueError("knockout diagonal contradicts source intervention alignment in %s" % unit_id)

    timeseries = _numeric_table(unit_files["timeseries.tsv"], prefix + "timeseries.tsv",
                                ["Time"] + GENES, 105, allow_separators=True)
    if [item["beforeRowIndex"] for item in timeseries["separators"]] != [0, 21, 42, 63, 84]:
        raise ValueError("ambiguous time-series boundaries in %s" % unit_id)
    if [row[0] for row in timeseries["values"]] != list(range(0, 1001, 50)) * 5:
        raise ValueError("unexpected time-series coordinates in %s" % unit_id)
    timeseries["series"] = [{"id": "%s:timeseries:%d" % (unit_id, index + 1),
                             "rowIndices": list(range(index * 21, (index + 1) * 21)),
                             "intervenedGenes": None} for index in range(5)]
    timeseries["role"] = "separate temporal observations; targeted gene identities are not supplied"
    tables["timeseries"] = timeseries

    dual = _numeric_table(unit_files["dualknockouts.tsv"], prefix + "dualknockouts.tsv", ["G_i", "G_j"], 5)
    pair_set, interventions = set(), []
    for index, pair in enumerate(dual["values"]):
        if any(value != int(value) or not 1 <= value <= 10 for value in pair) or pair[0] == pair[1]:
            raise ValueError("invalid dual-knockout gene indexes in %s" % unit_id)
        key = tuple(sorted(pair))
        if key in pair_set:
            raise ValueError("duplicate dual-knockout pair in %s" % unit_id)
        pair_set.add(key)
        interventions.append({"rowIndex": index, "genes": [GENES[int(value) - 1] for value in pair]})
    dual.update({"interventions": interventions, "outcomeState": "unobserved",
                 "role": "intervention gene pairs only; no response measurements"})
    tables["dualknockouts"] = dual

    source_members = [dict(item) for item in inventory if item["member"].startswith(prefix)]
    for name, table in tables.items():
        member = prefix + TABLE_FILES[name]
        table["sourceMember"] = member
        table["sourceSha256"] = _digest(files[member])
    return {
        "id": unit_id, "splitGroup": unit_id, "nodeIdentityScope": "network-local",
        "nodes": list(GENES), "edges": edges, "goldStandard": gold, "tables": tables,
        "sourceMembers": source_members,
        "census": {"nodes": 10, "edges": len(edges), "explicitOffDiagonalEntries": len(gold),
                   "explicitZeroEntries": len(gold) - len(edges), "absentOffDiagonalEntries": 0,
                   "selfEntries": 0, "selfEntryPolicy": "not supplied; do not infer self-loop values",
                   "expressionRows": 136, "expressionValues": 1360,
                   "knockoutInterventions": 10, "knockdownInterventions": 10,
                   "temporalSeries": 5, "dualKnockoutPairs": 5, "dualKnockoutResponseRows": 0},
    }


def adapt_dream4(path):
    """Return a deterministic JSON-serializable census and native Size10 tables.

    The calling acquisition/preparation pipeline verifies the distribution lock.
    This adapter also records the actual input and every archive member hash;
    synthetic archives with the same source contract are supported for testing.
    """
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("DREAM4 input must be a regular file, not a symlink")
    with path.open("rb") as stream:
        data = stream.read(MAX_COMPRESSED_BYTES + 1)
    outer_files, outer_inventory = _archive(data, "DREAM4")
    if NESTED_MEMBER not in outer_files:
        raise ValueError("missing nested DREAM4 source archive")
    evidence = _alignment_evidence(outer_files)
    nested = outer_files[NESTED_MEMBER]
    files, inventory = _archive(nested, INNER_ROOT)
    selected_seen = set()
    for item in inventory:
        parts = item["member"].split("/")
        if len(parts) > 1 and parts[1].startswith("insilico_size10_"):
            selected_seen.add(parts[1])
    if selected_seen != set(UNIT_IDS):
        raise ValueError("selected DREAM4 Size10 population must contain exactly all five units")
    units = [_unit(unit_id, files, inventory) for unit_id in UNIT_IDS]
    for item in inventory:
        parts = item["member"].split("/")
        item["selection"] = "selected-size10" if len(parts) > 1 and parts[1] in UNIT_IDS else "outside-size10-pilot"
    return {
        "format": FORMAT,
        "source": {"distribution": "Bioconductor DREAM4 1.22.0; lightly processed challenge tables",
                   "bytes": len(data), "sha256": _digest(data), "nestedMember": NESTED_MEMBER,
                   "nestedBytes": len(nested), "nestedSha256": _digest(nested)},
        "selection": {"unitIds": list(UNIT_IDS), "policy": "all five named Size10 units; no outcome selection"},
        "alignmentEvidence": evidence, "units": units,
        "archiveInventory": {"distribution": outer_inventory, "native": inventory},
        "census": {"units": len(units), "nodes": sum(len(unit["nodes"]) for unit in units),
                   "edges": sum(len(unit["edges"]) for unit in units), "explicitOffDiagonalEntries": 450,
                   "explicitZeroEntries": sum(unit["census"]["explicitZeroEntries"] for unit in units),
                   "expressionRows": 680, "expressionValues": 6800, "temporalSeries": 25,
                   "dualKnockoutPairs": 25, "dualKnockoutResponseRows": 0,
                   "distributionMembers": len(outer_inventory), "nativeMembers": len(inventory)},
    }
