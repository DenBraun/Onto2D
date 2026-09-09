"""Independent scope selection, coverage, matched populations and fitted contrasts."""
from fractions import Fraction
import json
import math
from pathlib import Path
try:
    import resource
except ImportError:  # Peak RSS is unavailable on Windows; this is not a zero.
    resource = None
import sys
import time
import importlib.util

HERE = Path(__file__).resolve().parent
PROFILE = json.loads((HERE / "profile.json").read_text())
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value
metric = module("metric_reference", HERE.parent / "metric/reference.py")
capacity = module("capacity_reference", HERE.parent / "capacity/reference.py")
d4, require = metric.d4, metric.require
metric.COLUMNS = {name: capacity.COLUMNS[name] for name in PROFILE["models"]}

def select(graph, root, variant):
    incoming = {e["source"] for e in graph["edges"] if e["target"] == root}
    outgoing = {e["target"] for e in graph["edges"] if e["source"] == root}
    members = {root} | (incoming if variant == "incoming-one" else outgoing if variant == "outgoing-one" else incoming | outgoing)
    if variant == "weak-two":
        original = set(members)
        members |= {e["source"] for e in graph["edges"] if e["target"] in original}
        members |= {e["target"] for e in graph["edges"] if e["source"] in original}
    edges = [i for i, e in enumerate(graph["edges"]) if e["source"] in members and e["target"] in members]
    return {"root": root, "variant": variant, "nodeIds": sorted(members), "excludedNodeIds": sorted(set(graph["nodes"]) - members),
            "edgeIndexes": edges, "omittedEdgeIndexes": [i for i in range(len(graph["edges"])) if i not in edges],
            "boundaryEdgeIndexes": [i for i, e in enumerate(graph["edges"]) if (e["source"] in members) != (e["target"] in members)]}

def degrees(graph):
    rows = []
    for node in sorted(graph["nodes"]):
        incoming = {e["source"] for e in graph["edges"] if e["target"] == node}
        outgoing = {e["target"] for e in graph["edges"] if e["source"] == node}
        weak = len(incoming | outgoing)
        rows.append({"id": node, "incoming": len(incoming), "outgoing": len(outgoing), "weak": weak, "lowDegree": weak <= 5,
                     "bin": next(b["id"] for b in PROFILE["degreeBins"] if b["min"] <= weak <= b["max"])})
    return rows

def preparation(graph, providers):
    n, m = len(graph["nodes"]), len(graph["edges"])
    cells, bounded = 0, True
    incoming, outgoing = dict.fromkeys(graph["nodes"], 0), dict.fromkeys(graph["nodes"], 0)
    for e in graph["edges"]:
        incoming[e["target"]] += 1; outgoing[e["source"]] += 1
    for e in graph["edges"]:
        a, b = incoming[e["source"]], outgoing[e["target"]]
        left, right = a + 1 if a else 1, b + 1 if b else 1
        cells += left * right
        denominator = math.lcm(2 * a if a else 1, 2 * b if b else 1)
        bounded &= left <= 16 and right <= 16 and denominator <= 512
    for name, maximum in [("ollivier", 32), ("flow", 64)]:
        size_ok = 0 < n <= 64 and 0 < m <= maximum
        ready = size_ok and bounded and cells <= 4096 and (name != "flow" or cells * 5 <= 32768)
        reason = None if ready else name + "-size-or-empty-bound" if not size_ok else ("OLLIVIER" if name == "ollivier" else "STRUCTURAL_FLOW") + "_LIMIT_EXCEEDED"
        require(providers[name]["state"] == ("prepared" if ready else "ineligible") and providers[name]["reason"] == reason, "Independent provider preparation differs")
        if ready and name == "ollivier":
            require(providers[name]["transportCells"] == cells, "Transport work accounting differs")
    require(providers["commonGeometry"] == {"state": "prepared" if all(providers[name]["state"] == "prepared" for name in ["ollivier", "flow"]) else "ineligible", "execution": "not-run", "stoppingEvent": None}, "Preparation was confused with execution")

def population(rows, selections):
    by_root = {s["root"]: s for s in selections}
    pairs, groups, matched = [], [], []
    for row in rows:
        scope = by_root[row["source"]]
        reason = "root-scope-ineligible" if scope["providers"]["commonGeometry"]["state"] != "prepared" else "receiver-outside-scope" if row["target"] not in scope["nodeIds"] else None
        pairs.append({**{k: row[k] for k in ["id", "source", "target"]}, "retained": reason is None, "reason": reason})
    retained = {p["id"] for p in pairs if p["retained"]}
    for group in sorted({r["groupId"] for r in rows}):
        chosen = [r for r in rows if r["groupId"] == group and r["id"] in retained]
        distinct = len({r["magnitude"] for r in chosen})
        reason = "fewer-than-three-common-receivers" if len(chosen) < 3 else "fewer-than-two-distinct-magnitudes" if distinct < 2 else None
        groups.append({"id": group, "retainedCount": len(chosen), "distinctMagnitudeCount": distinct, "eligible": reason is None, "reason": reason})
        if reason is None:
            for row in chosen:
                rank = 1 + sum(other["magnitude"] < row["magnitude"] for other in chosen) + (sum(other["magnitude"] == row["magnitude"] for other in chosen) - 1) / 2
                matched.append({**row, "rank": rank, "y": (rank - 1) / (len(chosen) - 1)})
    available = sum(g["eligible"] for g in groups) >= 5
    return {"pairs": pairs, "groups": groups, "rows": matched, "status": "complete" if available else "unavailable", "reason": None if available else "fewer-than-five-common-source-groups"}

def bins(nodes):
    result = []
    for bin_ in PROFILE["degreeBins"]:
        rows = [n for n in nodes if n["bin"] == bin_["id"]]
        predicates = {"mappedNodes": "mappedRecordings", "stimulatedNodes": "exactStimulusEvents", "uncontaminatedStimulatedNodes": "uncontaminatedEvents",
                      "responseSources": "responsePairsAsSource", "responseReceivers": "responsePairsAsReceiver", "eligibleSources": "eligiblePairsAsSource", "eligibleReceivers": "eligiblePairsAsReceiver"}
        result.append({"bin": bin_["id"], "parentNodes": len(rows), **{key: sum(bool(n[field]) for n in rows) for key, field in predicates.items()},
                       "eligiblePairsBySource": sum(n["eligiblePairsAsSource"] for n in rows), "eligiblePairsByReceiver": sum(n["eligiblePairsAsReceiver"] for n in rows),
                       "variants": [{"variant": variant, "preparedRoots": sum(next(s for s in n["scopes"] if s["variant"] == variant)["rootPrepared"] for n in rows),
                                     "representedNodes": sum(next(s for s in n["scopes"] if s["variant"] == variant)["preparedScopesContainingNode"] > 0 for n in rows)} for variant in PROFILE["variants"]]})
    return result

def audit(value):
    stored, sources = value["audit"], value["units"]
    require([u["id"] for u in sources] == PROFILE["anatomies"] == [u["id"] for u in stored["units"]], "Anatomy population differs")
    count = 0
    for unit, source in zip(stored["units"], sources):
        graph = source["parent"]
        require(unit["parent"] == graph and unit["degrees"] == degrees(graph), "Parent graph or degree changed")
        expected_selections = [select(graph, root, variant) for variant in PROFILE["variants"] for root in sorted(graph["nodes"])]
        require(len(unit["selections"]) == len(expected_selections), "Incomplete root/variant census")
        for selected, expected in zip(unit["selections"], expected_selections):
            require({k: v for k, v in selected.items() if k not in ["graphSha256", "providers"]} == expected, "Independent membership, induced edges or boundary differs")
            preparation({"nodes": selected["nodeIds"], "edges": [graph["edges"][i] for i in selected["edgeIndexes"]]}, selected["providers"]); count += 1
        nodes = []
        for node in degrees(graph):
            identity, metadata, rows = node["id"], source["metadata"], source["population"]["rows"]
            events = [e for e in metadata["events"] if e["source"] == identity and e["sourceMappingState"] == "exact-label-candidate"]
            nodes.append({**node, "mappedRecordings": [r["recordingId"] for r in metadata["labels"] if any(c["state"] == "exact-label-candidate" and c["anatomyNodeId"] == identity for c in r["columns"])],
                          "exactStimulusEvents": len(events), "uncontaminatedEvents": sum(e["window"]["eligible"] for e in events),
                          **{field: sum(r[flag] and r[endpoint] == identity for r in rows) for field, flag, endpoint in [("responsePairsAsSource", "pairEligible", "source"), ("responsePairsAsReceiver", "pairEligible", "target"), ("eligiblePairsAsSource", "eligible", "source"), ("eligiblePairsAsReceiver", "eligible", "target")]},
                          "scopes": [{"variant": variant, "rootPrepared": next(s for s in unit["selections"] if s["variant"] == variant and s["root"] == identity)["providers"]["commonGeometry"]["state"] == "prepared",
                                      "preparedScopesContainingNode": sum(s["variant"] == variant and s["providers"]["commonGeometry"]["state"] == "prepared" and identity in s["nodeIds"] for s in unit["selections"])} for variant in PROFILE["variants"]]})
        require(unit["nodes"] == nodes and unit["bins"] == bins(nodes), "Independent node/degree-bin coverage differs")
    for unit in stored["dream4"]:
        require(unit["nodes"] == [{**n, "includedInFullGraph": True, "knockoutSourcePairs": 9, "knockoutReceiverPairs": 9, "knockdownSourcePairs": 9, "knockdownReceiverPairs": 9} for n in degrees(unit["parent"])], "DREAM4 network-local coverage differs")
    populations = [{"variant": variant, **population(stored["originalTargets"], [s for s in stored["units"][0]["selections"] if s["variant"] == variant])} for variant in PROFILE["variants"]]
    require(stored["populations"] == populations, "Independent matched population/reranking differs")
    return {"status": "verified", "anatomicalNodes": sum(len(u["parent"]["nodes"]) for u in sources), "scopes": count, "dream4Nodes": sum(len(u["nodes"]) for u in stored["dream4"]),
            "originalTargetRows": len(stored["originalTargets"]), "matchedRows": [{"variant": p["variant"], "rows": len(p["rows"]), "groups": sum(g["eligible"] for g in p["groups"])} for p in populations]}

def study(value):
    details, audit_ = value["details"], value["audit"]
    pop = next(p for p in audit_["populations"] if p["variant"] == details["variant"])
    expected_pop = population(audit_["originalTargets"], [s for s in audit_["units"][0]["selections"] if s["variant"] == details["variant"]])
    require({k: v for k, v in pop.items() if k != "variant"} == expected_pop, "Matched population differs before fitting")
    roots = [g["id"] for g in pop["groups"] if g["eligible"]] if pop["status"] == "complete" else []
    require([s["root"] for s in details["scopes"]] == roots, "Required target-bearing scope omitted")
    counts = {"states": 0, "pairs": 0, "staticEdges": 0, "failedAttemptsRetained": 0}
    reference = metric.network_reference() if roots else None
    for scope in details["scopes"]:
        selection = next(s for s in audit_["units"][0]["selections"] if s["root"] == scope["root"] and s["variant"] == details["variant"])
        graph = {"nodes": selection["nodeIds"], "edges": [audit_["units"][0]["parent"]["edges"][i] for i in selection["edgeIndexes"]]}
        require(scope["context"]["graph"] == graph, "Computed scope differs from source-only selection")
        checked, _ = metric.scope_geometry(scope, "unit-half", reference)
        for k, n in checked.items(): counts[k] += n
        require(scope["features"] == (capacity.features(graph) if scope["measured"]["status"] == "complete" else None), "Independent expanded graph features differ")
    reason = pop["reason"] if pop["status"] != "complete" else "required-target-scope-computation-failed" if counts["failedAttemptsRetained"] else None
    require(details["reason"] == reason and details["status"] == ("complete" if reason is None else "unavailable"), "Unavailable comparison was silently scored")
    fitting, exact = [], 0
    if reason is not None:
        require(details["contexts"] is None and details["comparisons"] is None, "Partial comparison contains model scores")
    else:
        require([c["id"] for c in details["contexts"]] == ["reference", "alternative"], "Context comparison differs")
        for context in details["contexts"]:
            rows, trace = context["trace"]["rows"], context["trace"]
            require([{k: v for k, v in r.items() if k != "x"} for r in rows] == pop["rows"], "Matched targets or normalized ranks changed")
            for row in rows:
                scope = next(s for s in (value["referenceScopes"] if context["id"] == "reference" else details["scopes"]) if s["root"] == row["source"])
                feature = next(p for p in scope["features"]["pairs"] if (p["source"], p["target"]) == (row["source"], row["target"]))
                geometry = scope["geometry"] if context["id"] == "reference" else scope["measured"]["geometry"]
                pair = next(p for p in geometry["pairs"] if (p["source"], p["target"]) == (row["source"], row["target"]))
                require(row["x"] == feature["baseline"] + feature["quadratic"] + feature["expanded"] + pair["geometry"], "Wrong scope or feature join")
            fitting.append({"id": context["id"], **metric.models(trace)})
            for name, results in trace["ablations"].items():
                require([{k: e[k] for k in ["id", "predictions"]} for e in context["models"][name]["outerEvidence"]] == [{"id": r["heldOut"], "predictions": r["predictions"]} for r in results], "Report predictions differ from independently verified fits")
        contexts = [{name: metric.exact_groups(pop["rows"], c["models"][name]["outerEvidence"]) for name in PROFILE["models"]} for c in details["contexts"]]
        a, b = contexts
        comparisons = [(a["B+S+G"], a["B+S"]), (b["B+S+G"], b["B+S"]), (a["B+G"], a["B"]), (b["B+G"], b["B"])] + [(b[name], a[name]) for name in PROFILE["models"]]
        require(list(details["comparisons"]) == PROFILE["comparisons"], "Comparison inventory differs")
        for name, (left, right) in zip(PROFILE["comparisons"], comparisons):
            deltas = [l - r for l, r in zip(left, right)]; mean = sum(deltas, Fraction(0)) / len(deltas); item = details["comparisons"][name]
            require([g["exactDelta"] for g in item["groups"]] == list(map(d4.encode, deltas)) and item["exactMeanDelta"] == d4.encode(mean), "Independent exact scope contrast differs")
            require(item["interpretation"] == ("higher" if mean > 0 else "lower" if mean < 0 else "equal"), "Scope contrast interpretation differs"); exact += 1
    return {"status": "verified", "scopeCount": len(roots), **counts, "expandedCoordinates": counts["pairs"] * 31, "fitting": fitting, "exactComparisonsChecked": exact}

if __name__ == "__main__":
    start = time.monotonic(); raw = sys.stdin.buffer.read(128000001); require(len(raw) <= 128000000, "Reference input exceeds its bound")
    value, mode = json.loads(raw), sys.argv[1:]
    if mode == ["--audit"]: result = audit(value)
    elif mode == ["--study"]: result = study(value)
    elif mode == ["--population"]: result = population(value["rows"], value["selections"])
    else: raise ValueError("Expected --audit, --study or --population")
    print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000,
          "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)}}, allow_nan=False))
