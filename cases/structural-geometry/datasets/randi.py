"""Bounded native Randi recording census; no response extraction or animal inference.

The caller verifies the download against source-lock.json. This adapter also binds
its output to the actual archive and every consumed member by SHA-256. Raw traces
remain in that archive; ``iter_trace_rows`` can replay one recording as finite
floats and explicit ``None`` for native NaN, without loading a matrix into RAM.
"""

from collections import Counter
import gzip
import hashlib
import math
from pathlib import Path
import re
import tarfile


FORMAT = "onto2d-randi-native-v1"
FAMILIES = ("labels", "ds_name", "t", "gcamp", "stim_neurons", "stim_volume_i")
MEMBER = re.compile(r"exported_data/(0|[1-9][0-9]*)_(labels|ds_name|t|gcamp|stim_neurons|stim_volume_i)\.txt\Z")
NUMBER = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\Z")
INTEGER = re.compile(r"-?(?:0|[1-9][0-9]*)\Z")
EXACT_NAME_CANDIDATE = re.compile(r"[A-Z][A-Z0-9]*\Z")
MAX_COMPRESSED_BYTES = 550_000_000
MAX_EXPANDED_BYTES = 1_400_000_000
MAX_MEMBER_BYTES = 80_000_000
MAX_LINE_BYTES = 64_000
MAX_COLUMNS = 1024
MAX_ROWS = 20_000
MAX_MEMBERS = 1000
MAX_VALUES = 60_000_000


class _BoundedReader:
    def __init__(self, source, limit):
        self.source = source
        self.limit = limit
        self.count = 0

    def read(self, size=-1):
        remaining = self.limit - self.count
        if size < 0 or size > remaining + 1:
            size = remaining + 1
        result = self.source.read(size)
        self.count += len(result)
        if self.count > self.limit:
            raise ValueError("Randi archive exceeds expanded-byte limit")
        return result


class _ArchiveReader:
    """Hash the compressed bytes actually consumed by the native parser."""

    def __init__(self, source):
        self.source = source
        self.count = 0
        self.digest = hashlib.sha256()

    def read(self, size=-1):
        remaining = MAX_COMPRESSED_BYTES - self.count
        if size < 0 or size > remaining + 1:
            size = remaining + 1
        result = self.source.read(size)
        self.count += len(result)
        if self.count > MAX_COMPRESSED_BYTES:
            raise ValueError("Randi archive exceeds compressed-byte limit")
        self.digest.update(result)
        return result


class _NativeTarInfo(tarfile.TarInfo):
    """Reject hidden extension headers before tarfile allocates their payload."""

    @classmethod
    def frombuf(cls, buf, encoding, errors):
        member = super().frombuf(buf, encoding, errors)
        if member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE):
            raise ValueError("Unexpected Randi archive member type")
        if member.size < 0 or member.size > MAX_MEMBER_BYTES:
            raise ValueError("Randi member exceeds byte limit")
        return member


def _archive_identity(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("Randi archive must be a regular file")
    size = path.stat().st_size
    if size <= 0 or size > MAX_COMPRESSED_BYTES:
        raise ValueError("Randi archive exceeds compressed-byte limit")
    digest = hashlib.sha256()
    observed_size = 0
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            observed_size += len(chunk)
            if observed_size > MAX_COMPRESSED_BYTES:
                raise ValueError("Randi archive exceeds compressed-byte limit")
            digest.update(chunk)
    if observed_size != size:
        raise ValueError("Randi archive size changed while reading")
    return {"byte_length": size, "sha256": digest.hexdigest()}


def _members(path, expected_identity):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError("Randi archive must be a regular file")
    with path.open("rb") as raw:
        observed = _ArchiveReader(raw)
        with gzip.GzipFile(fileobj=observed, mode="rb") as compressed:
            yield from _tar_members(compressed)
        if {"byte_length": observed.count, "sha256": observed.digest.hexdigest()} != expected_identity:
            raise ValueError("Randi archive identity changed while parsing")


def _tar_members(compressed):
    """Consume the full gzip stream, including bytes after the tar end marker."""
    bounded = _BoundedReader(compressed, MAX_EXPANDED_BYTES)
    with tarfile.open(fileobj=bounded, mode="r|", tarinfo=_NativeTarInfo) as archive:
        seen = set()
        for count, member in enumerate(archive, 1):
            if count > MAX_MEMBERS:
                raise ValueError("Randi archive exceeds member limit")
            if member.name in seen:
                raise ValueError("Duplicate Randi archive member: " + member.name)
            seen.add(member.name)
            if member.isdir() and member.name == "exported_data":
                if member.size:
                    raise ValueError("Randi archive directory must not contain data")
                continue
            match = MEMBER.fullmatch(member.name)
            if not member.isfile() or match is None:
                raise ValueError("Unexpected Randi archive member: " + member.name)
            if member.size > MAX_MEMBER_BYTES:
                raise ValueError("Randi member exceeds byte limit")
            with archive.extractfile(member) as source:
                yield int(match[1]), match[2], member, source
    while bounded.read(1024 * 1024):
        pass


def _lines(source, member, reference):
    digest = hashlib.sha256()
    size = 0
    for row in range(MAX_ROWS + 1):
        line = source.readline(MAX_LINE_BYTES + 1)
        if not line:
            break
        if row == MAX_ROWS or len(line) > MAX_LINE_BYTES:
            raise ValueError("Randi member exceeds row/line limit: " + member.name)
        digest.update(line)
        size += len(line)
        try:
            text = line.decode("utf-8").rstrip("\r\n")
        except UnicodeError as error:
            raise ValueError("Invalid Randi UTF-8: " + member.name) from error
        if "\x00" in text:
            raise ValueError("NUL in Randi source text")
        yield text
    if size != member.size:
        raise ValueError("Incomplete Randi member: " + member.name)
    reference.update({"member": member.name, "byte_length": size, "sha256": digest.hexdigest()})


def _number(token, allow_missing=False):
    if token.lower() == "nan" and allow_missing:
        return None
    if not NUMBER.fullmatch(token):
        raise ValueError("Invalid Randi numeric value: " + token)
    value = float(token)
    if not math.isfinite(value):
        raise ValueError("Non-finite Randi numeric value: " + token)
    if value == 0 and any(char in "123456789" for char in token.lower().split("e")[0]):
        raise ValueError("Randi nonzero numeric value underflows to zero: " + token)
    return value


def _matrix(source, member, reference):
    columns = None
    count = 0
    finite = missing = zero = None
    for line in _lines(source, member, reference):
        tokens = line.split()
        if not tokens or len(tokens) > MAX_COLUMNS:
            raise ValueError("Invalid Randi trace column count")
        if columns is None:
            columns = len(tokens)
            finite = [0] * columns
            missing = [0] * columns
            zero = [0] * columns
        if len(tokens) != columns:
            raise ValueError("Ragged Randi trace matrix")
        for column, token in enumerate(tokens):
            value = _number(token, allow_missing=True)
            if value is None:
                missing[column] += 1
            else:
                finite[column] += 1
                zero[column] += value == 0
        count += 1
    if columns is None:
        raise ValueError("Empty Randi trace matrix")
    result = {"rows": count, "columns": columns,
              "finite_values": sum(finite), "missing_values": sum(missing),
              "zero_values": sum(zero), "finite_by_column": finite,
              "missing_by_column": missing, "zero_by_column": zero}
    return result


def _label(raw, index, trace_columns):
    normalized = raw.strip()
    if not normalized:
        status = "unidentified"
    elif normalized in ("merge", "target", "check"):
        status = "source_marker"
    elif normalized.isdigit():
        status = "numeric_placeholder"
    elif EXACT_NAME_CANDIDATE.fullmatch(normalized):
        status = "exact_name_candidate"
    else:
        status = "unresolved_label"
    return {"native_label_index": index,
            "column_index": index if index < trace_columns else None,
            "raw_label": raw, "label": normalized,
            "status": status,
            "exact_name_candidate": normalized if status == "exact_name_candidate" else None}


def _recording(index, families, identity):
    traces = families["gcamp"]["value"]
    labels = [_label(raw, i, traces["columns"])
              for i, raw in enumerate(families["labels"]["value"])]
    times = families["t"]["value"]
    neurons = families["stim_neurons"]["value"]
    volumes = families["stim_volume_i"]["value"]
    names = families["ds_name"]["value"]
    if len(names) != 1 or not names[0].strip():
        raise ValueError("Randi recording needs one nonempty source dataset name")
    if len(labels) < traces["columns"] or len(times) != traces["rows"]:
        raise ValueError("Randi label/time/trace dimensions disagree")
    # The locked source has 42 extra blank label slots in recordings 11, 20 and
    # 23. Preserve every slot, but never manufacture a trace column for it.
    unbound_labels = labels[traces["columns"]:]
    if any(label["label"] for label in unbound_labels):
        raise ValueError("Nonempty Randi label has no corresponding trace column")
    if any(b <= a for a, b in zip(times, times[1:])):
        raise ValueError("Randi time coordinates must increase strictly")
    if len(neurons) != len(volumes):
        raise ValueError("Randi stimulation neuron/volume dimensions disagree")
    if any(v < 0 or v >= len(times) for v in volumes):
        raise ValueError("Randi stimulation volume index outside trace rows")
    nonincreasing_rows = [[i, i + 1] for i, (a, b) in enumerate(zip(volumes, volumes[1:])) if b <= a]
    volume_counts = Counter(volumes)
    duplicate_volumes = [{"volume_index": volume,
                          "native_row_indices": [i for i, value in enumerate(volumes) if value == volume]}
                         for volume, count in sorted(volume_counts.items()) if count > 1]
    if any(n >= traces["columns"] for n in neurons):
        raise ValueError("Randi stimulation neuron index outside trace columns")
    duplicates = Counter(item["label"] for item in labels if item["label"])
    duplicate_labels = {name: [item["column_index"] for item in labels if item["label"] == name]
                        for name, count in sorted(duplicates.items()) if count > 1}
    stimulations = []
    for trial, (neuron, volume) in enumerate(zip(neurons, volumes)):
        label = labels[neuron] if neuron >= 0 else None
        source_order = ("first_row" if trial == 0 else
                        "increasing" if volume > volumes[trial - 1] else "nonincreasing")
        stimulations.append({"trial_index": trial, "native_stimulation_row_index": trial,
                             "native_neuron_index": neuron,
                             "volume_index": volume, "time_coordinate": times[volume],
                             "duplicate_volume": volume_counts[volume] > 1,
                             "source_order_relation": source_order,
                             "response_eligibility": "not_assessed",
                             "column_index": neuron if neuron >= 0 else None,
                             "mapping_status": "native_column" if neuron >= 0 else "native_negative_sentinel",
                             "raw_label": label["raw_label"] if label else None})
    return {"recording_index": index, "recording_id": "randi2023-recording-" + str(index),
            "source_dataset_name": names[0], "animal_id": None,
            "grouping_status": "recording_identity_only_animal_mapping_unverified",
            "archive_sha256": identity["sha256"],
            "members": {family: families[family]["source"] for family in FAMILIES},
            "labels": labels, "duplicate_labels": duplicate_labels,
            "label_alignment": {
                "status": "trailing_blank_labels_without_trace_columns" if unbound_labels else "exact",
                "native_label_slots": len(labels), "trace_columns": traces["columns"],
                "unbound_trailing_label_slots": len(unbound_labels)},
            "stimulation_alignment": {
                "status": "nonmonotonic_or_duplicate" if nonincreasing_rows or duplicate_volumes else "strictly_increasing",
                "index_identity": "trial_index is a native stimulation row, not a certified biological trial ID",
                "nonincreasing_native_row_pairs": nonincreasing_rows,
                "duplicate_volume_groups": duplicate_volumes},
            "time_coordinates": times, "traces": traces, "stimulations": stimulations}


def adapt_randi(path, *, expected_recordings=113):
    """Validate every selected recording, returning metadata with no trace matrix.

    ``expected_recordings`` is configurable for synthetic parser fixtures; the
    scientific pipeline uses the default exact indexes 0 through 112. Native
    negative stimulation sentinels and unresolved labels remain explicit. Exact
    name candidates are syntax only, not certified biological identification.
    """
    if type(expected_recordings) is not int or not 1 <= expected_recordings <= 113:
        raise ValueError("Invalid expected Randi recording count")
    identity = _archive_identity(path)
    parsed = {}
    values = 0
    for index, family, member, source in _members(path, identity):
        if index >= expected_recordings:
            raise ValueError("Unexpected Randi recording index")
        target = parsed.setdefault(index, {})
        reference = {}
        if family == "gcamp":
            value = _matrix(source, member, reference)
            values += value["rows"] * value["columns"]
            if values > MAX_VALUES:
                raise ValueError("Randi archive exceeds numeric-value limit")
        else:
            lines = list(_lines(source, member, reference))
            if family == "t":
                value = [_number(line.strip()) for line in lines]
            elif family in ("stim_neurons", "stim_volume_i"):
                if any(not INTEGER.fullmatch(line.strip()) for line in lines):
                    raise ValueError("Invalid Randi integer index")
                value = [int(line.strip()) for line in lines]
            else:
                value = lines
        target[family] = {"source": reference, "value": value}
    if sorted(parsed) != list(range(expected_recordings)):
        raise ValueError("Missing Randi recording index")
    if any(set(families) != set(FAMILIES) for families in parsed.values()):
        raise ValueError("Missing Randi recording family")
    recordings = [_recording(index, parsed[index], identity) for index in sorted(parsed)]
    label_states = Counter(label["status"] for record in recordings for label in record["labels"])
    bound_label_states = Counter(label["status"] for record in recordings
                                 for label in record["labels"] if label["column_index"] is not None)
    sentinels = Counter(str(stim["native_neuron_index"]) for record in recordings
                        for stim in record["stimulations"] if stim["native_neuron_index"] < 0)
    dataset_names = Counter(record["source_dataset_name"] for record in recordings)
    census = {"recordings": len(recordings), "regular_members": len(recordings) * len(FAMILIES),
              "uncompressed_member_bytes": sum(ref["byte_length"] for record in recordings
                                               for ref in record["members"].values()),
              "trace_columns": sum(record["traces"]["columns"] for record in recordings),
              "native_label_slots": sum(len(record["labels"]) for record in recordings),
              "unbound_trailing_label_slots": sum(record["label_alignment"]["unbound_trailing_label_slots"]
                                                  for record in recordings),
              "recordings_with_unbound_trailing_labels": sum(record["label_alignment"]["status"] != "exact"
                                                             for record in recordings),
              "time_rows": sum(record["traces"]["rows"] for record in recordings),
              "trace_values": values,
              "finite_values": sum(record["traces"]["finite_values"] for record in recordings),
              "missing_values": sum(record["traces"]["missing_values"] for record in recordings),
              "zero_values": sum(record["traces"]["zero_values"] for record in recordings),
              "stimulations": sum(len(record["stimulations"]) for record in recordings),
              "recordings_with_nonmonotonic_or_duplicate_stimulations": sum(
                  record["stimulation_alignment"]["status"] != "strictly_increasing" for record in recordings),
              "stimulation_rows_with_duplicate_volume": sum(stim["duplicate_volume"] for record in recordings
                                                              for stim in record["stimulations"]),
              "label_states": dict(sorted(label_states.items())),
              "bound_column_label_states": dict(sorted(bound_label_states.items())),
              "negative_stimulation_sentinels": dict(sorted(sentinels.items())),
              "distinct_source_dataset_names": len(dataset_names),
              "duplicate_source_dataset_name_groups": sum(count > 1 for count in dataset_names.values()),
              "recordings_with_duplicate_labels": sum(bool(record["duplicate_labels"]) for record in recordings),
              "animal_mapping": "unverified", "response_extraction": "not_performed"}
    return {"format": FORMAT, "source": identity, "census": census, "recordings": recordings}


def iter_trace_rows(path, recording):
    """Yield native (volume_index, values) rows with NaN represented by None.

    Verify the complete compressed archive before yielding. Member identity and
    dimensions are checked when iteration is exhausted; callers must consume the
    iterator fully. Time coordinates and labels are in the census recording.
    """
    identity = _archive_identity(path)
    if identity["sha256"] != recording["archive_sha256"]:
        raise ValueError("Randi trace replay archive identity differs")
    found = False
    for index, family, member, source in _members(path, identity):
        if index != recording["recording_index"] or family != "gcamp":
            continue
        reference = {}
        rows = 0
        for line in _lines(source, member, reference):
            tokens = line.split()
            if len(tokens) != recording["traces"]["columns"]:
                raise ValueError("Randi trace replay column count differs")
            yield rows, tuple(_number(token, allow_missing=True) for token in tokens)
            rows += 1
        if reference != recording["members"]["gcamp"] or rows != recording["traces"]["rows"]:
            raise ValueError("Randi trace replay member identity/dimensions differ")
        found = True
    if not found:
        raise ValueError("Randi trace replay member is missing")
