"""Separate SHA256 edge-switch/union-find reference and D4/D5 numerical oracles.

Targets are bound to the already independently verified primary replay inputs.
No raw fluorescence is reinterpreted and no target is removed after rewiring.
"""
from collections import Counter
import hashlib
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
spec = importlib.util.spec_from_file_location("d5_reference", HERE.parent / "celegans" / "reference.py")
d5 = importlib.util.module_from_spec(spec); spec.loader.exec_module(d5)
require = d5.require
PROFILE = "onto2d-biological-rank-null-v1"
utf16 = lambda value: value.encode("utf-16-be")
compact = lambda value: json.dumps(value, separators=(",", ":"), ensure_ascii=False)
digest = lambda value: hashlib.sha256(compact(value).encode("utf-8")).hexdigest()


def partition(nodes, edges):
    parents = {node: node for node in nodes}
    def root(node):
        while parents[node] != node:
            node = parents[node]
        return node
    for source, target in edges:
        parents[root(source)] = root(target)
    groups = {}
    for node in nodes:
        groups.setdefault(root(node), []).append(node)
    return sorted((sorted(group, key=utf16) for group in groups.values()), key=lambda group: utf16(group[0]))


def sample(request):
    require(set(request) == {"datasetId", "root", "graph", "originalGraphSha256", "nullIndex"}, "Null request fields differ")
    graph = request["graph"]
    require(0 < len(graph["nodes"]) <= 64 and len(graph["edges"]) <= 64, "Null graph exceeds bounds")
    require(type(request["nullIndex"]) is int and 0 <= request["nullIndex"] < 32, "Null index exceeds bounds")
    nodes = sorted(graph["nodes"], key=utf16)
    require(len(set(nodes)) == len(nodes), "Duplicate native node")
    edge_set = {(edge["source"], edge["target"]) for edge in graph["edges"]}
    require(len(edge_set) == len(graph["edges"]), "Parallel native edge")
    require(all(a in nodes and b in nodes and a != b for a, b in edge_set), "Invalid native edge")
    ordered = lambda edges: sorted(edges, key=lambda edge: (utf16(edge[0]), utf16(edge[1])))
    as_graph = lambda edges: {"nodes": nodes, "edges": [{"source": a, "target": b} for a, b in ordered(edges)]}
    original_hash = digest(as_graph(edge_set))
    require(original_hash == request["originalGraphSha256"], "Original graph binding differs")
    original_partition = partition(nodes, edge_set)
    incoming, outgoing = Counter(b for a, b in edge_set), Counter(a for a, b in edge_set)
    constraints = {"degrees": [{"node": n, "incoming": incoming[n], "outgoing": outgoing[n]} for n in nodes],
                   "components": original_partition}
    accepted, attempts, required = 0, [], 10 * len(edge_set)
    for counter in range(4096):
        if not edge_set or accepted == required:
            break
        edges = ordered(edge_set)
        payload = [PROFILE, request["datasetId"], request["root"], original_hash, request["nullIndex"], counter]
        value = hashlib.sha256(compact(payload).encode("utf-8")).digest()
        first, second = int.from_bytes(value[:4], "big") % len(edges), int.from_bytes(value[4:8], "big") % len(edges)
        a, b = edges[first], edges[second]
        swapped = {(a[0], b[1]), (b[0], a[1])}
        if first == second:
            outcome = "equal-indices"
        elif a[0] == b[0] or a[1] == b[1]:
            outcome = "unchanged-edge-set"
        elif any(source == target for source, target in swapped):
            outcome = "self-loop"
        elif swapped & (edge_set - {a, b}):
            outcome = "parallel-arc"
        else:
            candidate = (edge_set - {a, b}) | swapped
            if partition(nodes, candidate) != original_partition:
                outcome = "component-membership"
            else:
                edge_set = candidate; accepted += 1; outcome = "accepted"
        attempts.append({"counter": counter, "first": first, "second": second, "outcome": outcome})
    result_graph = as_graph(edge_set)
    require(Counter(b for a, b in edge_set) == incoming and Counter(a for a, b in edge_set) == outgoing,
            "Labelled degrees changed")
    complete = bool(edge_set) and accepted == required
    return {"profileId": PROFILE, "datasetId": request["datasetId"], "root": request["root"],
            "originalGraphSha256": original_hash, "nullIndex": request["nullIndex"],
            "status": "complete" if complete else "unavailable",
            "reason": None if complete else "swap-target-not-reached" if edge_set else "empty-edge-set",
            "graph": result_graph, "graphSha256": digest(result_graph), "accepted": accepted, "required": required,
            "proposals": len(attempts), "outcomes": dict(sorted(Counter(row["outcome"] for row in attempts).items())),
            "changed": digest(result_graph) != original_hash, "constraints": constraints, "attempts": attempts}


def row_scope(study_id, row):
    return compact([row["groupId"], None]) if study_id.startswith("dream4-") else compact(["Dataset7", row["source"]])


def verify_replicate(payload):
    originals, targets, details = payload["originals"], payload["targets"], payload["details"]
    require(0 < len(originals) <= 34 and 0 < len(targets) <= 3, "Independent replicate exceeds bounds")
    require([row["id"] for row in details["scopes"]] == [row["id"] for row in originals], "Null scope population differs")
    require([row["id"] for row in details["studies"]] == [row["id"] for row in targets], "Null study population differs")
    features, pairs, proposals = {}, 0, 0
    for original, scope in zip(originals, details["scopes"]):
        require(original["id"] == compact([original["datasetId"], original["root"]]), "Null scope identity differs")
        expected = sample({key: original[key] for key in ["datasetId", "root", "graph", "originalGraphSha256"]} |
                          {"nullIndex": details["nullIndex"]})
        require(scope["sampled"] == expected, "Independent complete null trace differs")
        proposals += expected["proposals"]
        measured = scope["measured"]
        if expected["status"] != "complete":
            require(measured == {"status": "not-run", "reason": "sampling-unavailable"}, "An unavailable null was measured")
        elif measured["status"] != "complete":
            require(measured["status"] == "unavailable" and measured["reason"].endswith("LIMIT_EXCEEDED"), "Unrecognized geometry failure")
        else:
            calculated = d5.geometry({"graph": expected["graph"], "fields": measured["geometry"]["fields"],
                                      "termination": measured["geometry"]["termination"]})
            require(calculated == measured["geometry"]["pairs"], "Independent null pair geometry differs")
            pairs += len(calculated)
            for pair in calculated:
                features[(scope["id"], pair["source"], pair["target"])] = pair["baseline"] + pair["geometry"]
    indexed = {row["id"]: row for row in details["scopes"]}
    fits, predictions, studies_checked = 0, 0, []
    for target, study in zip(targets, details["studies"]):
        required = sorted({row_scope(target["id"], row) for row in target["rows"]})
        failures = []
        for identity in required:
            scope = indexed[identity]
            if scope["sampled"]["status"] != "complete":
                failures.append({"id": identity, "phase": "sampling", "reason": scope["sampled"]["reason"]})
            elif scope["measured"]["status"] != "complete":
                failures.append({"id": identity, "phase": "geometry", "reason": scope["measured"]["reason"]})
        require(study["failures"] == failures, "Null failure coverage differs")
        if study["status"] != "complete":
            require(study["report"] is None and study["trace"] is None, "Unavailable null acquired a partial score")
            require(study["reason"] == ("complete-matched-null-population-required" if failures else "required-null-model-computation-failed"),
                    "Null unavailable reason differs")
            studies_checked.append({"id": study["id"], "status": "unavailable", "distinctReferenceFits": 0, "predictionsChecked": 0})
            continue
        require(not failures and study["reason"] is None, "Incomplete population received a null score")
        trace, report = study["trace"], study["report"]
        require([{key: value for key, value in row.items() if key != "x"} for row in trace["rows"]] == target["rows"],
                "Original target identities, magnitudes, ranks or eligibility changed")
        require(len({row["id"] for row in trace["rows"]}) == len(trace["rows"]), "Repeated target row")
        for row in trace["rows"]:
            require(row["x"] == features[(row_scope(target["id"], row), row["source"], row["target"])], "Null feature join differs")
        counts = d5.models(trace); fits += counts["distinctReferenceFits"]; predictions += counts["predictionsChecked"]
        require(report["status"] == "complete" and report["reason"] is None, "Null report status differs")
        require(list(report["ablations"]) == list(trace["ablations"]), "Null report ablations differ")
        for name, results in trace["ablations"].items():
            groups = report["ablations"][name]["groups"]
            require([row["id"] for row in groups] == [row["heldOut"] for row in results], "Report groups differ")
            for row, outer in zip(groups, results):
                require(row["lambda"] == outer["lambda"] and row["meanRankSkill"] == outer["summary"]["meanRankSkill"], "Report score differs")
            require(report["ablations"][name]["meanRankSkill"] == d5.d4.sequential_sum(row["meanRankSkill"] for row in groups) / len(groups), "Report mean differs")
        # This deterministic graph-only reference has no learned parameters.
        propagation = []
        for group in sorted({row["groupId"] for row in trace["rows"]}):
            rows = sorted((row for row in trace["rows"] if row["groupId"] == group), key=lambda row: row["id"])
            values = [(1 / row["x"][4] if row["x"][7] else 0) / 2 + row["x"][20] / 4 + row["x"][21] / 8 + row["x"][22] / 16 for row in rows]
            propagation.append({"id": group, "meanRankSkill": d5.d4.group_skill(rows, values)})
        require([{key: row[key] for key in ["id", "meanRankSkill"]} for row in report["propagation"]["groups"]] == propagation, "Propagation scores differ")
        studies_checked.append({"id": study["id"], "status": "complete", **counts})
    return {"status": "verified", "method": "sha256-edge-set-union-find-bellman-ford-joint-intercept-ridge",
            "nullScopesChecked": len(originals), "proposalsChecked": proposals, "descriptorPairs": pairs,
            "distinctReferenceFits": fits, "predictionsChecked": predictions, "studies": studies_checked,
            "numericTolerance": 2e-10, "rankTies": "exact-binary64-no-tolerance"}


if __name__ == "__main__":
    start = time.monotonic()
    encoded = sys.stdin.buffer.read(256000001)
    require(len(encoded) <= 256000000, "Independent input exceeds complete-artifact bound")
    payload = json.loads(encoded)
    if sys.argv[1:] == ["--sampler"]:
        result = sample(payload)
    elif sys.argv[1:] == ["--replicate"]:
        result = verify_replicate(payload)
    else:
        raise ValueError("Expected --sampler or --replicate")
    peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    print(compact({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000,
                                               "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak if peak is None or sys.platform == "darwin" else peak * 1024}}))
