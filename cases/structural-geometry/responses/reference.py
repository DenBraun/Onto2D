"""Independent response selection, set edits, Boolean closure and graph orbits."""
import argparse
import copy
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ["controls.json", "PROTOCOL.md", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py",
         "../invariance/build.mjs", "../../../models/causal-emergence/releases/2026.08.15/bundle.json"]
REGIMES = ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]
PROBES = ["feedback-edge-ablation-v1", "necessary-parent-ablation-v1", "enabling-parent-ablation-v1", "edge-direction-reversal-v1", "redundant-support-path-ablation-v1"]
OBSERVABLES = [["canonical-directed-structure-v1"], ["node-count-v1", "edge-count-v1", "weak-component-sizes-v1",
               "strong-component-sizes-v1", "reachable-ordered-pair-count-v1", "cyclic-node-count-v1", "isolated-node-count-v1"],
              ["canonical-directed-structure-v1", "canonical-typed-directed-structure-v1"]]
TOPOLOGY_FIELDS = ["nodeCount", "edgeCount", "weakComponentSizes", "strongComponentSizes", "reachableOrderedPairCount", "cyclicNodeCount", "isolatedNodeCount"]


def module(name):
    spec = importlib.util.spec_from_file_location("independent_" + name, HERE / ("../" + name + "/reference.py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


canonical, typed, topology = [module(name) for name in ["canonical", "typed", "topology"]]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(encoded(value).encode()).hexdigest()


def ordered(values):
    return sorted(values, key=lambda value: value.encode("utf-16-be"))


def records(graph, types):
    labels = graph.get("labels", ["n" + str(i) for i in range(graph["nodes"])])
    return {"nodes": labels, "edges": [{"id": "e" + str(i), "source": labels[u], "target": labels[v], **types[t]} for i, (u, v, t) in enumerate(graph["edges"])]}


def baseline(source, regime, scope):
    labels = ordered(scope["nodeIds"] if scope else source["nodes"])
    selected = set(labels)
    all_edges = sorted(source["edges"], key=lambda e: e["id"].encode("utf-16-be"))
    partitions = {key: [] for key in ["edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"]}
    for e in all_edges:
        u, v = e["source"] in selected, e["target"] in selected
        partitions["edgeIds" if u and v else "outgoingBoundaryEdgeIds" if u else "incomingBoundaryEdgeIds" if v else "externalEdgeIds"].append(e["id"])
    internal = [e for e in all_edges if e["id"] in set(partitions["edgeIds"])]
    node_map = {label: "n{:03d}".format(i) for i, label in enumerate(labels)}
    edge_map = {e["id"]: "e{:03d}".format(i) for i, e in enumerate(internal)}
    mapping = {"nodes": [{"sourceNodeId": n, "shadowNodeId": node_map[n]} for n in labels],
               "edges": [{"sourceEdgeId": e["id"], "shadowEdgeId": edge_map[e["id"]]} for e in internal]}
    graph = {"nodes": [{"id": node_map[n]} for n in labels], "edges": [{"id": edge_map[e["id"]], "source": node_map[e["source"]], "target": node_map[e["target"]],
             **({"types": typed.normalized(e)} if regime == REGIMES[2] else {})} for e in internal]}
    return graph, mapping, {"nodeIds": labels, **partitions}


def closure(graph, removed=frozenset()):
    # Boolean Floyd-Warshall in bit rows, independently of production BFS.
    labels = [n["id"] for n in graph["nodes"]]
    index = {n: i for i, n in enumerate(labels)}
    rows = [1 << i for i in range(len(labels))]
    for e in graph["edges"]:
        if e["id"] not in removed:
            rows[index[e["source"]]] |= 1 << index[e["target"]]
    for k in range(len(labels)):
        for i in range(len(labels)):
            if rows[i] & (1 << k):
                rows[i] |= rows[k]
    return {(u, v) for u in labels for v in labels if rows[index[u]] & (1 << index[v])}


def paths(graph):
    # Breadth by path length, with explicit distinct-vertex membership. The
    # production selector uses depth-first traversal and separate BFS predicates.
    layer = [([e["source"], e["target"]], [e]) for e in graph["edges"]]
    result = []
    while layer:
        result.extend(layer)
        layer = [(vertices + [e["target"]], route + [e]) for vertices, route in layer for e in graph["edges"]
                 if e["source"] == vertices[-1] and e["target"] not in vertices]
    return result


def selectors(graph, mapping, regime):
    source_nodes = {n["shadowNodeId"]: n["sourceNodeId"] for n in mapping["nodes"]}
    source_edges = {e["shadowEdgeId"]: e["sourceEdgeId"] for e in mapping["edges"]}
    reach, routes = closure(graph), paths(graph)
    compatible = PROBES if regime == REGIMES[2] else [PROBES[i] for i in [0, 3, 4]]
    plans = []
    for probe in compatible:
        unknown, chosen = [], []
        if probe in PROBES[1:3]:
            necessity = "necessary" if probe == PROBES[1] else "enabling"
            eligible = [e for e in graph["edges"] if e["types"].get("necessity") == necessity]
            unknown = ordered(source_edges[e["id"]] for e in graph["edges"] if "necessity" not in e["types"])
            if not unknown:
                chosen = [([e["source"], e["target"]], [e]) for e in eligible]
        elif probe == PROBES[4]:
            chosen = [(vertices, route) for vertices, route in routes if (vertices[0], vertices[-1]) in closure(graph, {e["id"] for e in route})]
            eligible = [e for _, route in chosen for e in route]
        else:
            eligible = [e for e in graph["edges"] if probe == PROBES[3] or (e["target"], e["source"]) in reach]
            chosen = [([e["source"], e["target"]], [e]) for e in eligible]
        targets = [{"kind": "simple-directed-path" if probe == PROBES[4] else "edge",
                    "sourceNodeIds": [source_nodes[n] for n in vertices], "shadowNodeIds": vertices,
                    "sourceEdgeIds": [source_edges[e["id"]] for e in route], "shadowEdgeIds": [e["id"] for e in route]} for vertices, route in chosen]
        targets.sort(key=lambda t: encoded(t["sourceEdgeIds"]).encode("utf-16-be"))
        plans.append({"probeId": probe, "selection": {"state": "unresolved" if unknown else "complete",
                      "knownEligibleSourceEdgeIds": ordered(set(source_edges[e["id"]] for e in eligible)), "unknownSourceEdgeIds": unknown}, "targets": targets})
    return plans, {"pathExtensions": len(routes), "reachabilitySearches": len(graph["edges"]) + len(routes)}


def observe(graph, mapping, regime):
    labels = [n["id"] for n in graph["nodes"]]
    index = {n: i for i, n in enumerate(labels)}
    edges = graph["edges"]
    if regime == REGIMES[1]:
        value = topology.measure(labels, [(e["id"], e["source"], e["target"]) for e in edges])["value"]
        return [{"value": value[f], "missing": []} for f in TOPOLOGY_FIELDS]
    result = [{"value": canonical.key(len(labels), [(index[e["source"]], index[e["target"]]) for e in edges]), "missing": []}]
    if regime == REGIMES[2]:
        source_ids = {e["shadowEdgeId"]: e["sourceEdgeId"] for e in mapping["edges"]}
        gaps = [{"sourceEdgeId": source_ids[e["id"]], "field": f} for e in edges for f in typed.FIELDS if f not in e["types"]]
        gaps.sort(key=lambda g: (g["sourceEdgeId"].encode("utf-16-be"), g["field"]))
        result.append({"value": None if gaps else typed.typed_key(len(labels), [(e["id"], index[e["source"]], index[e["target"]], e["types"]) for e in edges]), "missing": gaps})
    return result


def response(before, after, regime):
    components = []
    for id, left, right in zip(OBSERVABLES[REGIMES.index(regime)], before, after):
        a, b = left["value"], right["value"]
        observed = a is not None and b is not None
        components.append({"observableId": id, "state": "indeterminate" if not observed else "equal" if a == b else "different",
                           "delta": b - a if observed and regime == REGIMES[1] and isinstance(a, int) and isinstance(b, int) else None})
    numerator, denominator = sum(c["state"] != "indeterminate" for c in components), len(components)
    complete = bool(denominator) and numerator == denominator
    return {"status": "indeterminate" if not complete else "changed" if any(c["state"] == "different" for c in components) else "unchanged",
            "coverage": {"numerator": numerator, "denominator": denominator, "complete": complete}, "components": components}


def transform(graph, mapping, target, probe):
    selected = set(target["shadowEdgeIds"])
    reverse = probe == PROBES[3]
    source_ids = {e["shadowEdgeId"]: e["sourceEdgeId"] for e in mapping["edges"]}
    output = [{**e, "source": e["target"], "target": e["source"]} if reverse and e["id"] in selected else e
              for e in graph["edges"] if reverse or e["id"] not in selected]
    conflicts = [(a, b) for a, b in itertools.combinations(output, 2) if (a["source"], a["target"]) == (b["source"], b["target"])]
    assert len(conflicts) <= 1
    if conflicts:
        return {"execution": "rejected", "rejection": {"code": "parallel-edge-after-reversal", "sourceEdgeIds": ordered(source_ids[e["id"]] for e in conflicts[0])},
                "graph": None, "edgeMapping": None, "changes": None}
    return {"execution": "applied", "rejection": None, "graph": {"nodes": graph["nodes"], "edges": output},
            "edgeMapping": [{"sourceEdgeId": source_ids[e["id"]], "beforeEdgeId": e["id"], "afterEdgeId": e["id"] if reverse or e["id"] not in selected else None,
                             "action": "preserved" if e["id"] not in selected else "reversed" if reverse else "removed"} for e in graph["edges"]],
            "changes": {"removedSourceEdgeIds": [] if reverse else ordered(source_ids[e] for e in selected),
                        "reversedSourceEdgeIds": ordered(source_ids[e] for e in selected) if reverse else []}}


def summarize(runs, components):
    counts = {state: 0 for state in ["changed", "unchanged", "indeterminate", "rejected"]}
    histogram = {}
    numerator = 0
    for run in runs:
        status = "rejected" if run["execution"] == "rejected" else run["response"]["status"]
        counts[status] += 1
        numerator += run["response"]["coverage"]["numerator"] if run["response"] else 0
        effect = {"status": status, "components": run["response"]["components"] if run["response"] else None,
                  "rejection": run["rejection"]["code"] if run["rejection"] else None}
        key = encoded(effect)
        if key not in histogram:
            histogram[key] = {"effect": effect, "count": 0}
        histogram[key]["count"] += 1
    denominator = len(runs) * components
    complete = bool(denominator) and numerator == denominator
    return {"status": "observed" if complete else "indeterminate", "coverage": {"numerator": numerator, "denominator": denominator, "complete": complete},
            "counts": counts, "diagnostics": {"effectHistogram": [histogram[key] for key in ordered(histogram)]}}


def summary(id, source, regime, scope=None):
    graph, mapping, accounting = baseline(source, regime, scope)
    plans, selection_work = selectors(graph, mapping, regime)
    before = observe(graph, mapping, regime)
    probes = []
    calls = lambda values: 0 if regime == REGIMES[1] else 1 + int(regime == REGIMES[2] and values[1]["value"] is not None)
    canonicalizer_calls = calls(before)
    for plan in plans:
        probe, selection, targets = plan["probeId"], plan["selection"], plan["targets"]
        runs = []
        for target in targets:
            transformed = transform(graph, mapping, target, probe)
            after = None if transformed["graph"] is None else observe(transformed["graph"], mapping, regime)
            canonicalizer_calls += calls(after) if after else 0
            runs.append({"target": target, "transformation": "reverse-edge" if probe == PROBES[3] else "remove-edges", **transformed,
                         "values": after, "response": response(before, after, regime) if after else None})
        applied = sum(r["execution"] == "applied" for r in runs)
        probes.append({"probeId": probe, "selection": selection,
                       "execution": {"state": "completed" if targets else "unavailable", "reason": None if targets else "missing-selector-evidence" if selection["state"] == "unresolved" else "no-eligible-targets",
                                     "targetCount": len(targets), "appliedCount": applied, "rejectedCount": len(runs) - applied},
                       "runs": runs, "summary": summarize(runs, len(before))})
    numerator, denominator = sum(p["summary"]["status"] == "observed" for p in probes), len(probes)
    complete = numerator == denominator and denominator > 0
    total, applied, rejected = [sum(p["execution"][k] for p in probes) for k in ["targetCount", "appliedCount", "rejectedCount"]]
    return {"id": id, "scopeAccounting": accounting, "profile": {"probeIds": [p["probeId"] for p in plans], "excludedProbeIds": [p for p in PROBES if p not in [plan["probeId"] for plan in plans]]},
            "baseline": {"graph": graph, "mapping": mapping, "values": before}, "probes": probes,
            "summary": {"status": "observed" if complete else "indeterminate", "coverage": {"numerator": numerator, "denominator": denominator, "complete": complete}, "targets": {"total": total, "applied": applied, "rejected": rejected}},
            "work": {"selection": selection_work, "transformationEdgeVisits": total * len(graph["edges"]), "outputGraphCount": 1 + applied,
                     "observationEvaluations": 1 + applied, "canonicalizerCalls": canonicalizer_calls}}


def sources(document):
    result = {g["id"]: records(g, document["types"]) for g in document["graphs"]}
    bound = document["maximumCycle"]
    result["maximum"] = records({"nodes": bound["cycleNodes"] + bound["isolates"], "edges": [[u, (u + 1) % bound["cycleNodes"], bound["type"]] for u in range(bound["cycleNodes"])]}, document["types"])
    pack = read(FILES[-1])["files"]
    result["causal"] = {"nodes": [n["id"] for n in pack["model/nodes.json"]], "edges": pack["model/edges.json"]}
    return result


def aggregation_profiles():
    rows = []
    for n in range(5):
        results = []
        for states in itertools.product(["changed", "unchanged", "indeterminate", "rejected"], repeat=n):
            runs = []
            for state in states:
                if state == "rejected":
                    runs.append({"execution": "rejected", "rejection": {"code": "parallel-edge-after-reversal"}, "response": None})
                else:
                    components = [{"observableId": OBSERVABLES[2][0], "state": "equal" if state == "unchanged" else "different", "delta": None},
                                  {"observableId": OBSERVABLES[2][1], "state": "indeterminate" if state == "indeterminate" else "equal", "delta": None}]
                    runs.append({"execution": "applied", "rejection": None, "response": {"status": state, "coverage": {"numerator": 1 if state == "indeterminate" else 2}, "components": components}})
            results.append(summarize(runs, 2))
        rows.append({"targets": n, "profiles": len(results), "sha256": digest(results)})
    return rows


def expected():
    document = read("controls.json")
    graphs = sources(document)
    cases = [summary(s["id"], graphs[s["source"]], s["regimeId"], s.get("scope", {"kind": "induced", "nodeIds": document["causalScope"]} if s["source"] == "causal" else None)) for s in document["scenarios"]]
    census, totals = [], {"requests": 0, "probes": 0, "targets": 0, "applied": 0, "rejected": 0, "unavailableProbes": 0}
    for n in range(1, 4):
        pairs = canonical.pairs(n)
        for mask in range(1 << len(pairs)):
            graph = records({"nodes": n, "edges": [[u, v, document["censusType"]] for i, (u, v) in enumerate(pairs) if mask & (1 << i)]}, document["types"])
            for regime in REGIMES:
                id = "n{}-mask{}-{}".format(n, mask, regime)
                value = summary(id, graph, regime)
                census.append({"id": id, "sha256": digest(value)})
                totals["requests"] += 1
                totals["probes"] += len(value["probes"])
                for key in ["applied", "rejected"]:
                    totals[key] += value["summary"]["targets"][key]
                totals["targets"] += value["summary"]["targets"]["total"]
                totals["unavailableProbes"] += sum(p["execution"]["state"] == "unavailable" for p in value["probes"])
    return {"schemaVersion": "1", "method": "independent-source-selectors-breadth-path-enumeration-boolean-closure-and-permutation-orbits",
            "sourceHashes": {file: hashlib.sha256((HERE / file).read_bytes()).hexdigest() for file in FILES},
            "cases": cases, "census": {"totals": totals, "digests": census}, "aggregationProfiles": aggregation_profiles()}


def actual_values(observation, regime):
    if observation is None:
        return None
    result = []
    for o in observation["observations"]:
        value = o["value"]
        if value is not None and regime != REGIMES[1]:
            n, edges = value["nodeCount"], value["edges"]
            value = typed.typed_key(n, [(str(i), e["from"], e["to"], e["types"]) for i, e in enumerate(edges)]) if o["observable"]["id"] == OBSERVABLES[2][1] else canonical.key(n, [(e["from"], e["to"]) for e in edges])
        result.append({"value": value, "missing": o["missing"]})
    return result


def actual_summary(id, artifact):
    regime, b = artifact["request"]["regimeId"], artifact["baseline"]
    graph = lambda g: {k: g[k] for k in ["nodes", "edges"]} if g else None
    work = copy.deepcopy(artifact["work"])
    del work["selection"]["edgeScans"]
    return {"id": id, "scopeAccounting": {k: artifact["preparation"]["scope"][k] for k in ["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"]},
            "profile": {k: artifact["profile"][k] for k in ["probeIds", "excludedProbeIds"]},
            "baseline": {"graph": graph(b["graph"]), "mapping": b["mapping"], "values": actual_values(b["observation"], regime)},
            "probes": [{"probeId": p["probe"]["id"], **{k: p[k] for k in ["selection", "execution", "summary"]},
                        "runs": [{**{k: r[k] for k in ["target", "transformation", "execution", "rejection", "edgeMapping", "changes", "response"]},
                                  "graph": graph(r["graph"]), "values": actual_values(r["observation"], regime)} for r in p["runs"]]} for p in artifact["probes"]],
            "summary": artifact["summary"], "work": work}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        modes.add_argument(option, action="store_true")
    args = parser.parse_args()
    value = expected()
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        (HERE / "reference.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Response reference differs"
        if args.verify_artifacts:
            for case in value["cases"]:
                assert actual_summary(case["id"], read("artifacts/" + case["id"] + ".json")) == case, case["id"]
    print("Independent responses {}: {} controls; {}; 341 aggregation profiles.".format("written" if args.write else "verified", len(value["cases"]), value["census"]["totals"]))


if __name__ == "__main__":
    main()
