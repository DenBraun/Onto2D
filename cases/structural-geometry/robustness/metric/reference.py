"""Independent D6.4: pinned network simplex, exact pair statistics and joint ridge."""
from fractions import Fraction
from itertools import combinations
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
PROFILE = json.loads((HERE / "profile.json").read_text())

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value

d5 = module("d5_reference", HERE.parent.parent / "celegans" / "reference.py")
d4, require = d5.d4, d5.require
COLUMNS = {"B+G": list(range(23)) + list(range(85, 116)), "B+S+G": list(range(23)) + list(range(54, 116))}

def network_reference():
    import networkx as nx
    expected = PROFILE["independent"]
    require(nx.__version__ == expected["version"], "Install the pinned NetworkX reference environment")
    algorithm = Path(nx.__file__).parent / "algorithms/flow/networksimplex.py"
    require(hashlib.sha256(algorithm.read_bytes()).hexdigest() == expected["algorithmSourceSha256"], "Network simplex implementation differs")
    sys.path.insert(0, str(HERE.parent.parent / "flow"))
    return module("independent_flow", HERE.parent.parent / "flow" / "networkx_reference.py")

def scope_geometry(scope, variant_id, reference):
    variant = next(v for v in PROFILE["variants"] if v["id"] == variant_id)
    context, measured = scope["context"], scope["measured"]
    graph, mapping, pack = context["graph"], context["mapping"], context["pack"]
    require(mapping == [{"sourceId": node, "nodeId": "n%04d" % i} for i, node in enumerate(sorted(graph["nodes"]))], "Opaque node mapping differs")
    require(0 < len(graph["edges"]) <= 64 and len(graph["nodes"]) <= 64, "Independent scoped graph exceeds bounds")
    ids = {row["sourceId"]: row["nodeId"] for row in mapping}
    edges = pack["files"]["model/edges.json"]
    require([(e["source"], e["target"], e["weight"]) for e in edges] == [(ids[e["source"]], ids[e["target"]], 1) for e in graph["edges"]], "Carrier topology or declared masses differ")
    incoming = {row["nodeId"]: sum(e["target"] == row["nodeId"] for e in edges) for row in mapping}
    outgoing = {row["nodeId"]: sum(e["source"] == row["nodeId"] for e in edges) for row in mapping}
    lengths = [Fraction(1 if variant["provider"] == "unit-v1" else incoming[e["target"]]) for e in edges]
    provider = measured["provider"]
    require(provider["request"] == {"providerId": variant["provider"], "parameters": {}}, "Metric provider request differs")
    require(provider["result"]["edges"] == [{"id": e["id"], "source": e["source"], "target": e["target"], "length": d4.encode(v), "weight": d4.encode(v)} for e, v in zip(edges, lengths)], "Independent provider lengths differ")
    initial = [Fraction(2) if variant["initial"] == "double-unit" else Fraction(1 + outgoing[e["source"]]) if variant["initial"] == "one-plus-source-outdegree" else v for e, v in zip(edges, lengths)]
    expected_input = {**PROFILE["flow"], "idleness": variant["idleness"], "initialLengths": [{"edgeId": e["id"], "length": d4.encode(v)} for e, v in zip(edges, initial)]}
    require(measured["input"] == expected_input, "Independent parameter/initialization input differs")
    if measured["status"] != "complete":
        require(measured["status"] == "unavailable" and measured["reason"] in ["STRUCTURAL_FLOW_LIMIT_EXCEEDED", "STRUCTURAL_FLOW_NUMERIC_LIMIT"], "Unknown unavailable state")
        require(measured["flow"] is None and measured["geometry"] is None, "Unavailable flow contains successful values")
        return {"states": 0, "pairs": 0, "staticEdges": 0, "failedAttemptsRetained": 1}, {}
    flow, geometry = measured["flow"], measured["geometry"]
    require(geometry["profileId"] == PROFILE["id"] + ":pair-geometry" and geometry["coordinateLayoutId"] == "biological-pair-terminal-geometry-v1", "Sensitivity geometry must not claim the original unit profile")
    require(flow["request"] == measured["request"], "Stored prepared request differs")
    require(all(flow["request"]["parameters"][k] == v for k, v in expected_input.items()), "Flow request substituted parameters")
    data = flow["request"]["graph"]
    require([n["id"] for n in data["nodes"]] == [row["nodeId"] for row in mapping], "Flow node set differs")
    require([(e["id"], e["source"], e["target"]) for e in data["edges"]] == [(e["id"], e["source"], e["target"]) for e in edges], "Flow edge set differs")
    replay = reference.evaluate(flow)
    metric, _ = reference.normalize(data, lengths)
    static_graph = reference.graph_for(data, metric)
    static = [1 - reference.solve(static_graph, e, variant["idleness"] == "half") / v for e, v in zip(edges, metric)]
    terminal = replay["states"][-1]["edges"]
    fields = [{"forman": d4.encode(Fraction(2 - incoming[e["source"]] - outgoing[e["target"]])), "ollivier": d4.encode(k),
               "length": last["length"], "curvature": last["curvature"]} for e, k, last in zip(edges, static, terminal)]
    require(geometry["fields"] == fields and geometry["termination"] == replay["termination"], "Independent static/terminal field differs")
    pairs = d5.geometry({"graph": graph, "fields": fields, "termination": replay["termination"]})
    require(geometry["pairs"] == pairs, "Independent pair geometry differs")
    return {"states": len(replay["states"]), "pairs": len(pairs), "staticEdges": len(edges), "failedAttemptsRetained": 0}, {(p["source"], p["target"]): p["geometry"] for p in pairs}

def exact_groups(rows, evidence):
    result = []
    for group in evidence:
        test = sorted((row for row in rows if row["groupId"] == group["id"]), key=lambda row: row["id"])
        predicted, values = group["predictions"], []
        require(len(test) == len(predicted), "Exact metric prediction population differs")
        for intervention in sorted({row["interventionId"] for row in test}):
            indices = [i for i, row in enumerate(test) if row["interventionId"] == intervention]
            n = d = 0
            for i, j in combinations(indices, 2):
                a, b = test[i]["magnitude"], test[j]["magnitude"]
                if a != b:
                    d += 1
                    n += ((predicted[i] > predicted[j]) - (predicted[i] < predicted[j])) * ((a > b) - (a < b))
            require(d > 0, "Ineligible exact intervention")
            values.append(Fraction(n, d))
        result.append(sum(values, Fraction(0)) / len(values))
    return result

def check_comparisons(study, source):
    reports, rows = study["report"], study["trace"]["rows"]
    current = {name: exact_groups(rows, value["outerEvidence"]) for name, value in reports["models"].items()}
    original = {name: exact_groups(source["rows"], source["original"]["outerEvidence"][name]) for name in ["B", "B+S", "B+G", "B+S+G"]}
    names = [("expandedGain", "B+S+G", "B+S"), ("originalGain", "B+G", "B"),
             ("expandedReferenceDifference", "B+S+G", "B+S+G"), ("originalReferenceDifference", "B+G", "B+G")]
    require(list(reports["comparisons"]) == [key for key, _, _ in names], "Comparison population differs")
    for key, left, right in names:
        row = reports["comparisons"][key]
        values = [a - b for a, b in zip(current[left], original[right])]
        value = sum(values, Fraction(0)) / len(values)
        require([g["exactDelta"] for g in row["groups"]] == list(map(d4.encode, values)), "Exact group differences differ")
        require(row["exactMeanDelta"] == d4.encode(value), "Exact comparison mean differs")
        require(row["interpretation"] == ("higher" if value > 0 else "lower" if value < 0 else "equal"), "Exact interpretation differs")
    return len(names)

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


def verify(value):
    reference, details, source = network_reference(), value["details"], value["sources"]
    require([s["id"] for s in details["scopes"]] == [s["id"] for s in source["scopes"]], "Metric scoped population differs")
    counts = {"states": 0, "pairs": 0, "staticEdges": 0, "failedAttemptsRetained": 0}
    lookup = {}
    for scope, original in zip(details["scopes"], source["scopes"]):
        require(scope["context"]["graph"] == original["graph"], "Source graph was changed")
        measured, features = scope_geometry(scope, details["variantId"], reference)
        for k, v in measured.items(): counts[k] += v
        for (u, v), g in features.items(): lookup[(scope["id"], u, v)] = g
    require([s["id"] for s in details["studies"]] == PROFILE["studies"], "Metric study census differs")
    fitting, exact = [], 0
    for study, target in zip(details["studies"], source["targets"]):
        failures = [{"id": s["id"], "reason": s["measured"]["reason"]} for s in details["scopes"] if
                    (s["datasetId"] != "Dataset7" if study["id"].startswith("dream4-") else s["datasetId"] == "Dataset7") and s["measured"]["status"] != "complete"]
        if failures:
            require(study["trace"] is None and study["report"] == {"status": "unavailable", "reason": "all-original-prepared-scopes-required", "failures": failures, "models": None, "comparisons": None}, "Partial population was evaluated")
            fitting.append({"id": study["id"], "distinctReferenceFits": 0, "predictionsChecked": 0}); continue
        rows = study["trace"]["rows"]
        require(len(rows) == len(target["rows"]), "Metric target count differs")
        for row, old in zip(rows, target["rows"]):
            require({k: v for k, v in row.items() if k != "x"} == {k: v for k, v in old.items() if k != "x"}, "Metric target/group/rank changed")
            scope = d5.compact([row["groupId"], None] if study["id"].startswith("dream4-") else ["Dataset7", row["source"]])
            require(row["x"] == old["x"][:85] + lookup[(scope, row["source"], row["target"])], "Metric feature join differs")
        fitting.append({"id": study["id"], **models(study["trace"])})
        for name, fits in study["trace"]["ablations"].items():
            expected_evidence = [{"id": fit["heldOut"], "predictions": fit["predictions"]} for fit in fits]
            actual_evidence = [{k: row[k] for k in ["id", "predictions"]} for row in study["report"]["models"][name]["outerEvidence"]]
            require(actual_evidence == expected_evidence, "Report predictions differ from independently verified fitted trace")
        exact += check_comparisons(study, target)
    return {"status": "verified", "scopeCount": len(details["scopes"]), **counts, "fitting": fitting, "exactComparisonsChecked": exact}


if __name__ == "__main__":
    start = time.monotonic()
    raw = sys.stdin.buffer.read(128000001); require(len(raw) <= 128000000, "D6.4 reference input exceeds bound")
    value, mode = json.loads(raw), sys.argv[1:]
    if mode == ["--models"]:
        result = models(value)
    elif mode == ["--geometry"]:
        require(len(value) <= 32, "Geometry control batch exceeds bound")
        reference = network_reference()
        result = [scope_geometry(row, row["variantId"], reference)[0] for row in value]
    elif mode == ["--study"]:
        result = verify(value)
    else:
        raise ValueError("Expected --models, --geometry or --study")
    peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
    print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000, "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak}}, allow_nan=False))
