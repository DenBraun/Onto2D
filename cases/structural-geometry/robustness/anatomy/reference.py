"""D6.2 independent overlap, source-window and grouped-model verification.

The D5 reference supplies independently implemented native window selection,
Fraction means, Bellman-Ford coordinates and joint-intercept ridge. Anatomy
identities and shared-population selection are checked here without relabelling.
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
spec = importlib.util.spec_from_file_location("d5_reference", HERE.parent.parent / "celegans" / "reference.py")
d5 = importlib.util.module_from_spec(spec); spec.loader.exec_module(d5)
require, compact = d5.require, d5.compact


def overlap(left, right):
    require([left["anatomy"]["id"], right["anatomy"]["id"]] == ["Dataset7", "Dataset8"], "Anatomy identities differ")
    maps = [{(row["source"], row["target"]): row for row in data["matched"]["population"]["rows"] if row["eligible"]}
            for data in [left, right]]
    for mapping, data in zip(maps, [left, right]):
        require(len(mapping) == sum(row["eligible"] for row in data["matched"]["population"]["rows"]), "Duplicate eligible source/receiver pair")
    candidates, groups, expected = [], [], [{}, {}]
    for pair in sorted(set(maps[0]) | set(maps[1])):
        present = [pair in mapping for mapping in maps]
        shared = all(present)
        if shared:
            trials = [[row for row in data["responses"]["trials"] if (row["source"], row["target"]) == pair] for data in [left, right]]
            require(trials[0] == trials[1], "Shared measurement lineage differs")
            require(all(maps[0][pair][key] == maps[1][pair][key] for key in ["magnitude", "measuredRecordings", "recordings", "recordingIds"]), "Shared aggregate differs")
        candidates.append({"source": pair[0], "target": pair[1], "inDataset7": present[0], "inDataset8": present[1],
            "magnitude": maps[0][pair]["magnitude"] if shared else None, "shared": shared,
            "reason": None if shared else "absent-from-Dataset8-eligible-population" if present[0] else "absent-from-Dataset7-eligible-population"})
    for source in sorted({row["source"] for row in candidates}):
        selected = [row for row in candidates if row["source"] == source and row["shared"]]
        distinct = len({row["magnitude"] for row in selected})
        reason = "fewer-than-three-shared-receivers" if len(selected) < 3 else "fewer-than-two-distinct-target-magnitudes" if distinct < 2 else None
        groups.append({"id": source, "sharedReceiverCount": len(selected), "distinctMagnitudeCount": distinct, "eligible": reason is None, "reason": reason})
        if reason is None:
            ranks = d5.d4.ranks([row["magnitude"] for row in selected])
            for row, rank in zip(selected, ranks):
                pair = (source, row["target"])
                for index in range(2):
                    expected[index][pair] = (row["magnitude"], rank, (rank - 1) / (len(selected) - 1))
    complete = sum(group["eligible"] for group in groups) >= 5
    return {"candidates": candidates, "groups": groups, "status": "complete" if complete else "unavailable",
            "reason": None if complete else "fewer-than-five-shared-source-groups"}, expected


def descriptors(data):
    features, count = {}, 0
    require([row["source"] for row in data["geometry"]] == [row["source"] for row in data["anatomy"]["scopes"] if row["eligible"]], "Geometry source census differs")
    for entry in data["geometry"]:
        if entry["status"] != "complete":
            continue
        nodes = next(scope["nodeIds"] for scope in data["anatomy"]["scopes"] if scope["source"] == entry["source"])
        graph = {"nodes": nodes, "edges": [edge for edge in data["anatomy"]["parent"]["edges"] if edge["source"] in nodes and edge["target"] in nodes]}
        require(graph == entry["scope"]["graph"], "Induced anatomical graph differs")
        pairs = d5.geometry({"graph": graph, "fields": entry["geometry"]["fields"], "termination": entry["geometry"]["termination"]})
        require(pairs == entry["geometry"]["pairs"], "Independent pair geometry differs")
        count += len(pairs)
        for pair in pairs:
            if pair["source"] == entry["source"]:
                features[(pair["source"], pair["target"])] = pair["baseline"] + pair["geometry"]
    return features, count


def verify_rows(rows, anatomy_id, expected, features, allow_unavailable_features=False):
    require(len(rows) == len(expected) and len({row["id"] for row in rows}) == len(rows), "Evaluation row count differs")
    require({(row["source"], row["target"]) for row in rows} == set(expected), "Evaluation population differs")
    for row in rows:
        pair = (row["source"], row["target"])
        require(row["id"] == compact([anatomy_id, *pair]) and row["interventionId"] == compact([anatomy_id, row["source"]]), "Anatomy row identity differs")
        require(pair in features or allow_unavailable_features, "Required source geometry missing")
        require(row["groupId"] == row["source"] and row["x"] == features.get(pair), "Feature/group join differs")
        magnitude, rank, y = expected[pair]
        d5.d4.close(row["magnitude"], magnitude)
        require(row["rank"] == rank and row["y"] == y, "Shared target was not reranked")


def verify(value, archive):
    data, prior = value["data"], value["prior"]
    require(data["anatomy"]["id"] == "Dataset8", "Native sensitivity anatomy differs")
    requests, absent = d5.metadata(data)
    windows = d5.verify_source_windows(archive, data, requests)
    native_targets = d5.targets(data, requests, absent, windows)
    ledger, shared_targets = overlap(prior, data)
    require(value["overlap"] == ledger, "Independent overlap census differs")
    feature8, count8 = descriptors(data); feature7, count7 = descriptors(prior)
    verify_rows(data["matched"]["rows"], "Dataset8", native_targets, feature8, allow_unavailable_features=True)
    prior_targets = {(row["source"], row["target"]): (row["magnitude"], row["rank"], row["y"])
                     for row in prior["matched"]["population"]["rows"] if row["eligible"]}
    verify_rows(prior["matched"]["rows"], "Dataset7", prior_targets, feature7)
    failed = any(row["status"] != "complete" for row in data["geometry"])
    native_reason = "required-geometry-computation-failed" if failed else None if len({pair[0] for pair in native_targets}) >= 5 else "fewer-than-five-eligible-source-groups"
    definitions = [("Dataset8-native", "Dataset8", native_targets, feature8, native_reason),
                   ("Dataset7-matched", "Dataset7", shared_targets[0], feature7, ledger["reason"]),
                   ("Dataset8-matched", "Dataset8", shared_targets[1], feature8, "required-geometry-computation-failed" if failed else ledger["reason"])]
    require([row["id"] for row in value["studies"]] == [row[0] for row in definitions], "Sensitivity study population differs")
    fitting = []
    for study, (identity, anatomy, targets, features, reason) in zip(value["studies"], definitions):
        if study["trace"] is None:
            require(study["state"] == {"status": "unavailable", "reason": reason or "required-model-computation-failed"}, "Unavailable study reason differs")
            result = {"distinctReferenceFits": 0, "predictionsChecked": 0}
        else:
            require(reason is None and study["state"] == {"status": "complete", "reason": None}, "Ineligible study was evaluated")
            verify_rows(study["trace"]["rows"], anatomy, targets, features)
            result = d5.models(study["trace"])
        fitting.append({"id": identity, **result})
    return {"status": "verified", "method": "independent-native-windows-targets-overlap-bellman-ford-joint-ridge",
            "nativeEventsChecked": len(data["plan"]["events"]), "samplesChecked": len(requests) * 120,
            "descriptorPairs": count7 + count8, "eligibleTargets": len(native_targets),
            "sharedPairs": sum(row["shared"] for row in ledger["candidates"]), "fitting": fitting,
            "numericTolerance": 2e-10, "rankTies": "exact-binary64-no-tolerance"}


if __name__ == "__main__":
    start = time.monotonic()
    encoded = sys.stdin.buffer.read(192000001)
    require(len(encoded) <= 192000000, "Independent input exceeds byte bound")
    value = json.loads(encoded)
    if sys.argv[1:] == ["--overlap"]:
        ledger, expected = overlap(value[0], value[1])
        result = {"ledger": ledger, "targets": [[{"source": pair[0], "target": pair[1], "magnitude": row[0], "rank": row[1], "y": row[2]}
                   for pair, row in mapping.items()] for mapping in expected]}
        print(json.dumps(result, allow_nan=False))
    elif sys.argv[1:] == ["--models"]:
        print(json.dumps(d5.models(value), allow_nan=False))
    elif len(sys.argv) == 3 and sys.argv[1] == "--study":
        result = verify(value, Path(sys.argv[2]))
        peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
        print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000, "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak}}, allow_nan=False))
    else:
        raise ValueError("Expected --study ARCHIVE, --overlap or --models")
