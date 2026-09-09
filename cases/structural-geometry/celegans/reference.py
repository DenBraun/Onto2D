"""Independent source-window, target, geometry and grouped-model D5 reference.

Reuses the independently implemented D4 graph baselines and joint-intercept
Gaussian solver. Window selection and aggregation are reconstructed from native
metadata; graph distances use Bellman-Ford and predecessor backtracking.
"""
from collections import Counter, defaultdict
from fractions import Fraction
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
try:
    import resource
except ImportError:  # Peak RSS is unavailable on Windows; this is not a zero.
    resource = None
import statistics
import sys
import tarfile
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("d4_reference", HERE.parent / "dream4" / "reference.py")
d4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(d4)
compact = lambda value: json.dumps(value, separators=(",", ":"), ensure_ascii=False)
STOP_REASONS = ["fixed-point", "tolerance", "cycle", "degenerate-length", "iteration-limit"]
COLUMNS = {"B": list(range(23)), "B+F": list(range(29)), "B+O": list(range(23)) + list(range(29, 35)),
           "B+flow": list(range(23)) + list(range(35, 54)), "B+F+O": list(range(35)), "B+F+O+flow": list(range(54))}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def geometry(control):
    graph, fields = control["graph"], control["fields"]
    nodes, edges = sorted(graph["nodes"]), graph["edges"]
    require(len(nodes) <= 64 and len(edges) <= 64, "Independent geometry domain exceeds its bound")
    baseline, result = d4.baselines(graph), []
    for source in nodes:
        hops, weighted = {source: 0}, {source: Fraction(0)}
        for _ in range(len(nodes) - 1):
            old_hops, old_weighted = dict(hops), dict(weighted)
            for i, edge in enumerate(edges):
                u, v = edge["source"], edge["target"]
                if u in old_hops:
                    hops[v] = min(hops.get(v, math.inf), old_hops[u] + 1)
                if u in old_weighted:
                    candidate = old_weighted[u] + d4.rational(fields[i]["length"])
                    if v not in weighted or candidate < weighted[v]:
                        weighted[v] = candidate
        for target in nodes:
            if source == target:
                continue
            union, todo, visited = set(), [target] if target in hops else [], set()
            while todo:
                node = todo.pop()
                if node in visited:
                    continue
                visited.add(node)
                for i, edge in enumerate(edges):
                    if edge["target"] == node and edge["source"] in hops and hops[edge["source"]] + 1 == hops[node]:
                        union.add(i); todo.append(edge["source"])
            sets = [[i for i, edge in enumerate(edges) if edge["target"] == source],
                    [i for i, edge in enumerate(edges) if edge["source"] == source],
                    [i for i, edge in enumerate(edges) if edge["target"] == target],
                    [i for i, edge in enumerate(edges) if edge["source"] == target],
                    [i for i, edge in enumerate(edges) if (edge["source"], edge["target"]) == (source, target)], sorted(union)]
            values = [sum((d4.rational(fields[i][field]) for i in indices), Fraction(0)) / len(indices) if indices else Fraction(0)
                      for field in ["forman", "ollivier", "length", "curvature"] for indices in sets]
            values += [weighted.get(target, Fraction(0)), Fraction(control["termination"]["iteration"])]
            values += [Fraction(control["termination"]["reason"] == reason) for reason in STOP_REASONS]
            result.append({"source": source, "target": target, "baseline": baseline[(source, target)],
                           "exact": list(map(d4.encode, values)), "geometry": list(map(float, values))})
    return result


def metadata(data):
    parent, scopes = data["anatomy"]["parent"], data["anatomy"]["scopes"]
    require(sorted(scope["source"] for scope in scopes) == sorted(parent["nodes"]), "Root census incomplete")
    roots = {scope["source"]: scope for scope in scopes}
    for source, scope in roots.items():
        neighbors = {source} | {e["source"] for e in parent["edges"] if e["target"] == source} | \
                    {e["target"] for e in parent["edges"] if e["source"] == source}
        require(sorted(neighbors) == scope["nodeIds"], "Rooted scope omits anatomical nodes")
    expected_events, expected_requests, expected_receivers, absent = [], [], [], []
    for record in data["recordings"]:
        labels = [row["raw_label"].strip() for row in record["labels"] if row["column_index"] is not None]
        frequencies = Counter(labels)
        mapped = [label if label in roots and frequencies[label] == 1 else None for label in labels]
        states = ["unidentified-or-marked" if not re.fullmatch("[A-Z][A-Z0-9]*", label) else
                  "ambiguous-within-recording" if frequencies[label] > 1 else
                  "exact-label-candidate" if label in roots else "absent-from-anatomy" for label in labels]
        columns = {label: i for i, label in enumerate(mapped) if label is not None}
        for index, event in enumerate(record["stimulations"]):
            native = event["native_neuron_index"]
            source = mapped[native] if native >= 0 else None
            if native < 0:
                reason = "negative-native-target-index"
            elif source is None:
                label = labels[native]
                state = "unidentified-or-marked" if not re.fullmatch("[A-Z][A-Z0-9]*", label) else \
                        "ambiguous-within-recording" if frequencies[label] > 1 else "absent-from-anatomy"
                reason = "source-mapping:" + state
            elif not roots[source]["eligible"]:
                reason = "root-scope-ineligible"
            else:
                volume = event["volume_index"]
                interfering = any(j != index and volume - 60 <= other["volume_index"] < volume + 60
                                  for j, other in enumerate(record["stimulations"]))
                valid_grid = all(value == i / 2 for i, value in enumerate(record["time_coordinates"]))
                reason = "window-ineligible" if not valid_grid or volume < 60 or volume + 60 > record["traces"]["rows"] or interfering else None
            expected_events.append({"recordingId": record["recording_id"], "trialIndex": index, "source": source, "reason": reason, "eligible": reason is None})
            if reason is not None:
                continue
            for column, target in enumerate(mapped):
                receiver_reason = "receiver-mapping:" + states[column] if states[column] != "exact-label-candidate" else \
                    "directly-stimulated-receiver" if target == source else \
                    "receiver-outside-rooted-scope" if target not in roots[source]["nodeIds"] else None
                expected_receivers.append({"recordingId": record["recording_id"], "trialIndex": index, "columnIndex": column,
                    "source": source, "target": target, "state": "excluded" if receiver_reason else "window-requested", "reason": receiver_reason})
            for target in sorted(roots[source]["nodeIds"]):
                if target == source:
                    continue
                if target not in columns:
                    absent.append((record["recording_id"], index, source, target))
                    expected_receivers.append({"recordingId": record["recording_id"], "trialIndex": index, "columnIndex": None,
                        "source": source, "target": target, "state": "unobserved", "reason": "no-accepted-receiver-column"})
                else:
                    expected_requests.append({"id": compact([record["recording_id"], index, target]), "recordingId": record["recording_id"],
                        "recordingIndex": record["recording_index"], "trialIndex": index, "source": source, "target": target,
                        "columnIndex": columns[target], "baseline": {"startIndex": volume - 60, "endIndexExclusive": volume},
                        "post": {"startIndex": volume, "endIndexExclusive": volume + 60}})
    actual = [{key: event[key] for key in expected_events[0]} for event in data["plan"]["events"]]
    require(actual == expected_events, "Independent native event mapping/window eligibility differs")
    require(data["plan"]["requests"] == expected_requests, "Independent receiver/window selection differs")
    require(data["plan"]["receivers"] == expected_receivers, "Independent receiver exclusion ledger differs")
    return expected_requests, absent


def verify_source_windows(path, data, requests):
    identity = data["archive"]
    require(0 < identity["byte_length"] <= 550000000 and len(requests) * 120 <= 2000000, "Independent source/window bound exceeded")
    require(not path.is_symlink() and path.is_file() and path.stat().st_size == identity["byte_length"], "Independent archive size/type differs")
    def check_bytes():
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1048576), b""):
                digest.update(block)
        require(digest.hexdigest() == identity["sha256"], "Independent archive hash differs")
    check_bytes()
    by_record = defaultdict(list)
    for request in requests:
        by_record[request["recordingIndex"]].append(request)
    records = {record["recording_index"]: record for record in data["recordings"]}
    wanted = {records[index]["members"]["gcamp"]["member"]: index for index in by_record}
    windows, found = {}, set()
    with tarfile.open(path, "r|gz") as archive:
        for member in archive:
            if member.name not in wanted:
                continue
            index = wanted[member.name]; record, selected = records[index], by_record[index]
            require(member.isfile() and member.size == record["members"]["gcamp"]["byte_length"], "Independent member differs")
            rows = {i for request in selected for i in range(request["baseline"]["startIndex"], request["post"]["endIndexExclusive"])}
            columns = {request["columnIndex"] for request in selected}
            require(len(rows) * len(columns) <= 4000000, "Independent selected-column matrix exceeds work bound")
            matrix, digest = {}, hashlib.sha256()
            with archive.extractfile(member) as source:
                for row_index, line in enumerate(source):
                    digest.update(line)
                    if row_index in rows:
                        tokens = line.split()
                        require(len(tokens) == record["traces"]["columns"], "Independent matrix width differs")
                        values = {column: float(tokens[column]) for column in columns}
                        matrix[row_index] = {column: None if math.isnan(value) else value for column, value in values.items()}
            require(digest.hexdigest() == record["members"]["gcamp"]["sha256"], "Independent trace member hash differs")
            for request in selected:
                windows[request["id"]] = {"id": request["id"], **{name: [matrix[i][request["columnIndex"]]
                    for i in range(request[name]["startIndex"], request[name]["endIndexExclusive"])] for name in ["baseline", "post"]}}
            found.add(index)
    check_bytes()
    require(found == set(by_record), "Independent selected recording population incomplete")
    require(len(windows) == len(data["extracted"]["windows"]), "Independent window population differs")
    require(all(windows[row["id"]] == row for row in data["extracted"]["windows"]), "Independent source sample selection differs")
    return windows


def targets(data, requests, absent, windows):
    trials = {(row["recordingId"], row["trialIndex"], row["source"], row["target"]): row for row in data["responses"]["trials"]}
    contrasts = {row["id"]: row for row in data["responses"]["contrasts"]}
    require(len(contrasts) == len(requests), "Intermediate contrast population differs")
    require(len(trials) == len(requests) + len(absent), "Trial ledger population differs")
    recording_values = defaultdict(list)
    for request in requests:
        identity = (request["recordingId"], request["trialIndex"], request["source"], request["target"])
        actual, window = trials[identity], windows[request["id"]]
        contrast = contrasts[request["id"]]
        require(contrast["missingCounts"] == {name: window[name].count(None) for name in ["baseline", "post"]}, "Window missingness counts differ")
        require((contrast["state"], contrast["magnitude"], contrast["reason"]) == (actual["state"], actual["magnitude"], actual["reason"]), "Trial and retained contrast disagree")
        if any(value is None for name in ["baseline", "post"] for value in window[name]):
            require(actual["state"] == "unobserved" and actual["magnitude"] is None, "Missing samples became observed")
            require(contrast["signed"] is None and contrast["baselineMean"] is None and contrast["postMean"] is None, "Missing contrast contains invented means")
            continue
        # Correctly rounded means of the exact input binary64 samples, independent
        # of the scaled compensated summation used by the production helper.
        baseline = float(sum(map(Fraction.from_float, window["baseline"]), Fraction(0)) / 60)
        post = float(sum(map(Fraction.from_float, window["post"]), Fraction(0)) / 60)
        d4.close(contrast["baselineMean"], baseline); d4.close(contrast["postMean"], post)
        if baseline <= 0:
            require(actual["state"] == "not-applicable" and actual["reason"] == "nonpositive-baseline", "Baseline eligibility differs")
            require(contrast["signed"] is None and contrast["magnitude"] is None, "Ineligible baseline contains a contrast")
            continue
        magnitude = abs((post - baseline) / baseline)
        d4.close(contrast["signed"], (post - baseline) / baseline)
        require(actual["state"] == ("observed-zero" if magnitude == 0 else "observed"), "Independent trial state differs")
        d4.close(actual["magnitude"], magnitude)
        recording_values[(identity[0], identity[2], identity[3])].append(magnitude)
    for identity in absent:
        require(trials[identity]["state"] == "unobserved" and trials[identity]["magnitude"] is None, "Absent receiver became observed")
    pairs = defaultdict(list)
    for (_, source, target), values in recording_values.items():
        pairs[(source, target)].append(statistics.median(values))
    expected, qualified = {}, {}
    for scope in data["anatomy"]["scopes"]:
        source = scope["source"]
        receivers = sorted(target for (s, target), values in pairs.items() if s == source and len(values) >= 2)
        magnitudes = [statistics.median(pairs[(source, target)]) for target in receivers]
        eligible = scope["eligible"] and len(receivers) >= 3 and len(set(magnitudes)) >= 2
        qualified[source] = receivers
        if eligible:
            for target, magnitude, rank in zip(receivers, magnitudes, d4.ranks(magnitudes)):
                expected[(source, target)] = (magnitude, rank, (rank - 1) / (len(receivers) - 1))
    population = data["matched"]["population"]
    require(len(expected) == population["coverage"]["eligibleTargetRows"], "Independent eligible target count differs")
    for group in population["groups"]:
        require(group["eligibleReceiverCount"] == len(qualified[group["source"]]), "Independent recording-qualified receiver count differs")
        require(group["eligible"] == any(source == group["source"] for source, _ in expected), "Independent source group eligibility differs")
    for row in population["rows"]:
        pair = (row["source"], row["target"])
        require(row["eligible"] == (pair in expected), "Independent target eligibility differs")
        if row["eligible"]:
            magnitude, rank, y = expected[pair]
            d4.close(row["magnitude"], magnitude)
            require((row["rank"], row["y"]) == (rank, y), "Independent target rank differs")
    return expected


def models(trace):
    rows, cache, fits, predictions = trace["rows"], {}, 0, 0
    groups = sorted({row["groupId"] for row in rows})
    require(5 <= len(groups) <= 29 and len(rows) <= 4096, "Independent model population exceeds bounds")
    require(list(trace["ablations"]) == list(COLUMNS), "Independent ablation population differs")
    for name, results in trace["ablations"].items():
        require([row["heldOut"] for row in results] == groups, "Outer source groups differ")
        for result in results:
            candidates = []
            require([row["lambda"] for row in result["candidates"]] == [0.01, 0.1, 1, 10, 100], "Tuning grid differs")
            for candidate in result["candidates"]:
                require([row["validationGroup"] for row in candidate["validation"]] == [g for g in groups if g != result["heldOut"]], "Inner source groups differ")
                values = []
                for inner in candidate["validation"]:
                    excluded = [result["heldOut"], inner["validationGroup"]]
                    train = sorted((row for row in rows if row["groupId"] not in excluded), key=lambda row: row["id"])
                    test = sorted((row for row in rows if row["groupId"] == inner["validationGroup"]), key=lambda row: row["id"])
                    key = (name, tuple(sorted(excluded)), candidate["lambda"])
                    if key not in cache:
                        cache[key] = d4.ridge(train, COLUMNS[name], candidate["lambda"]); fits += 1
                    predictions += d4.check_fit(inner, cache[key], test, COLUMNS[name])
                    value = d4.group_skill(test, inner["predictions"]); values.append(value)
                    require(value == inner["summary"]["meanRankSkill"], "Inner score differs")
                value = d4.sequential_sum(values) / len(values)
                require(value == candidate["meanRankSkill"], "Inner group averaging differs")
                candidates.append((value, candidate["lambda"]))
            require(max(candidates)[1] == result["lambda"], "Selected penalty differs")
            train = sorted((row for row in rows if row["groupId"] != result["heldOut"]), key=lambda row: row["id"])
            test = sorted((row for row in rows if row["groupId"] == result["heldOut"]), key=lambda row: row["id"])
            reference = d4.ridge(train, COLUMNS[name], result["lambda"]); fits += 1
            predictions += d4.check_fit(result, reference, test, COLUMNS[name])
            require(d4.group_skill(test, result["predictions"]) == result["summary"]["meanRankSkill"], "Held-out source score differs")
    return {"distinctReferenceFits": fits, "predictionsChecked": predictions}


def verify(data, trace, archive, evaluation_state):
    requests, absent = metadata(data)
    windows = verify_source_windows(archive, data, requests)
    expected_targets = targets(data, requests, absent, windows)
    features, descriptor_pairs = {}, 0
    for entry in data["geometry"]:
        if entry["status"] != "complete":
            continue
        node_ids = next(scope["nodeIds"] for scope in data["anatomy"]["scopes"] if scope["source"] == entry["source"])
        induced = {"nodes": node_ids, "edges": [edge for edge in data["anatomy"]["parent"]["edges"]
                   if edge["source"] in node_ids and edge["target"] in node_ids]}
        require(entry["scope"]["graph"] == induced, "Geometry omitted induced anatomical edges")
        expected = geometry({"graph": entry["scope"]["graph"], "fields": entry["geometry"]["fields"], "termination": entry["geometry"]["termination"]})
        require(expected == entry["geometry"]["pairs"], "Independent geometric descriptors differ")
        descriptor_pairs += len(expected)
        for pair in expected:
            if pair["source"] == entry["source"]:
                features[(pair["source"], pair["target"])] = pair["baseline"] + pair["geometry"]
    if trace is not None:
        require(evaluation_state == {"status": "complete", "reason": None}, "Complete trace has inconsistent evaluation state")
        require(len(trace["rows"]) == len(expected_targets) and len({row["id"] for row in trace["rows"]}) == len(trace["rows"]), "Matched evaluation rows repeat or omit targets")
        require({(row["source"], row["target"]) for row in trace["rows"]} == set(expected_targets), "Matched evaluation population differs")
        for row in trace["rows"]:
            pair = (row["source"], row["target"])
            require(row["x"] == features[pair] and row["groupId"] == row["source"], "Source feature/group join differs")
            require(row["id"] == compact(["Dataset7", *pair]) and row["interventionId"] == compact(["Dataset7", row["source"]]), "Source row identity differs")
        fitting = models(trace)
    else:
        require(evaluation_state["status"] == "unavailable", "Missing trace must remain unavailable")
        require(evaluation_state["reason"] == (data["matched"]["reason"] if data["matched"]["status"] == "unavailable" else "required-model-computation-failed"), "Unavailable computation reason differs")
        fitting = {"distinctReferenceFits": 0, "predictionsChecked": 0}
    return {"status": "verified", "method": "independent-native-window-selection-fraction-means-bellman-ford-joint-ridge",
            "nativeEventsChecked": len(data["plan"]["events"]), "samplesChecked": len(requests) * 120,
            "descriptorPairs": descriptor_pairs, "eligibleTargets": len(expected_targets), **fitting,
            "numericTolerance": 2e-10, "rankTies": "exact-binary64-no-tolerance"}


if __name__ == "__main__":
    start = time.monotonic()
    encoded = sys.stdin.buffer.read(128000001)
    require(len(encoded) <= 128000000, "Independent input exceeds byte bound")
    value = json.loads(encoded)
    if sys.argv[1:] == ["--geometry"]:
        result = [geometry(control) for control in value]
        print(json.dumps(result, allow_nan=False))
    elif len(sys.argv) == 3 and sys.argv[1] == "--study":
        result = verify(value["data"], value["trace"], Path(sys.argv[2]), value["evaluationState"])
        peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
        print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000,
                                                      "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak}}, allow_nan=False))
    else:
        raise ValueError("Expected --geometry or --study ARCHIVE")
