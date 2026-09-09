"""One bounded pass over the locked fluorescence export, retaining requested windows.

The frozen D2 parser supplies archive/member integrity and numeric token rules.
No upstream author code is executed. Unselected bytes are still consumed and
authenticated; output is released only after the complete archive is verified.
"""
import importlib.util
import json
from pathlib import Path
try:
    import resource
except ImportError:  # Peak RSS is unavailable on Windows; this is not a zero.
    resource = None
import sys
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("d2_randi", HERE.parent / "datasets" / "randi.py")
randi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(randi)
MAX_REQUESTS = 16000
MAX_SAMPLES = 2000000


def scan(path, records, requests, identity):
    if not isinstance(records, list) or not 1 <= len(records) <= 113 or not isinstance(requests, list) or \
            len(requests) > MAX_REQUESTS or len(requests) * 120 > MAX_SAMPLES:
        raise ValueError("Functional window extraction exceeds its complete-input bound")
    by_index = {record["recording_index"]: record for record in records}
    if sorted(by_index) != list(range(len(records))) or len(by_index) != len(records):
        raise ValueError("Recording census must contain every native index exactly once")
    routing, windows, seen = {}, [], set()
    for request in requests:
        record = by_index.get(request["recordingIndex"])
        if record is None or request["recordingId"] != record["recording_id"] or record["archive_sha256"] != identity["sha256"]:
            raise ValueError("Window recording identity differs")
        if request["id"] in seen:
            raise ValueError("Repeated extraction request")
        seen.add(request["id"])
        column, trial = request["columnIndex"], request["trialIndex"]
        if type(column) is not int or not 0 <= column < record["traces"]["columns"] or \
                type(trial) is not int or not 0 <= trial < len(record["stimulations"]):
            raise ValueError("Window request indexes are outside the native recording")
        event = record["stimulations"][trial]
        volume, source_column = event["volume_index"], event["native_neuron_index"]
        if source_column < 0 or source_column == column or \
                record["labels"][column]["raw_label"].strip() != request["target"] or \
                record["labels"][source_column]["raw_label"].strip() != request["source"]:
            raise ValueError("Window source/receiver differs from the bound native label")
        expected_id = json.dumps([record["recording_id"], trial, request["target"]], separators=(",", ":"))
        if request["id"] != expected_id or volume < 60 or volume + 60 > record["traces"]["rows"]:
            raise ValueError("Window identity or complete 60+60 population differs")
        expected = {"baseline": {"startIndex": volume - 60, "endIndexExclusive": volume},
                    "post": {"startIndex": volume, "endIndexExclusive": volume + 60}}
        if any(request[name] != expected[name] for name in expected):
            raise ValueError("Extraction windows differ from the native event")
        output = {"id": request["id"], "baseline": [], "post": []}
        windows.append(output)
        rows = routing.setdefault(record["recording_index"], {})
        for name, bounds in expected.items():
            for row in range(bounds["startIndex"], bounds["endIndexExclusive"]):
                rows.setdefault(row, []).append((output[name], column))
    members, trace_rows, numeric_values = set(), 0, 0
    for index, family, member, source in randi._members(path, identity):
        if index not in by_index:
            raise ValueError("Unexpected native recording")
        record = by_index[index]
        if record["archive_sha256"] != identity["sha256"]:
            raise ValueError("Recording archive binding differs")
        reference, row_count = {}, 0
        for line in randi._lines(source, member, reference):
            if family == "gcamp":
                tokens = line.split()
                if len(tokens) != record["traces"]["columns"]:
                    raise ValueError("Native trace width differs from D2")
                selected = routing.get(index, {}).get(row_count, [])
                parsed = {column: randi._number(tokens[column], allow_missing=True) for _, column in selected}
                for output, column in selected:
                    output.append(parsed[column])
            row_count += 1
        if reference != record["members"][family]:
            raise ValueError("Consumed native member differs from D2")
        if family == "gcamp":
            if row_count != record["traces"]["rows"]:
                raise ValueError("Native trace height differs from D2")
            trace_rows += row_count
            numeric_values += row_count * record["traces"]["columns"]
        members.add((index, family))
    if members != {(index, family) for index in by_index for family in randi.FAMILIES}:
        raise ValueError("Incomplete native member population")
    if any(len(window[name]) != 60 for window in windows for name in ["baseline", "post"]):
        raise ValueError("A requested window is incomplete")
    return {"format": "onto2d-celegans-extracted-windows-v1", "archive": identity, "windows": windows,
            "summary": {"verifiedMembers": len(members), "traceRows": trace_rows, "sourceNumericValues": numeric_values,
                        "requestedWindows": len(windows), "requestedSamples": len(windows) * 120}}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise ValueError("Expected the locked archive path; extraction plan arrives on stdin")
    start = time.monotonic()
    encoded = sys.stdin.buffer.read(16000001)
    if len(encoded) > 16000000:
        raise ValueError("Extraction input exceeds byte bound")
    data = json.loads(encoded)
    result = scan(Path(sys.argv[1]), data["recordings"], data["requests"], data["archive"])
    peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
    print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000,
                                                  "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak}}, allow_nan=False, separators=(",", ":")))
