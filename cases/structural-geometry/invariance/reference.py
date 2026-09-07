"""Independent source transformations, permutation orbits and Boolean closure."""
import argparse
import copy
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ["controls.json", "PROTOCOL.md", "../sandbox/controls.json", "../canonical/controls.json", "../typed/controls.json",
         "../sandbox/reference.py", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py",
         "../../../models/causal-emergence/releases/2026.08.15/bundle.json"]
REGIMES = ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]
TRANSFORMS = ["record-order", "bijective-node-id-renaming", "bijective-edge-id-renaming", "presentation-only-changes"]
OBSERVABLES = [["canonical-directed-structure-v1"], ["node-count-v1", "edge-count-v1", "weak-component-sizes-v1",
               "strong-component-sizes-v1", "reachable-ordered-pair-count-v1", "cyclic-node-count-v1", "isolated-node-count-v1"],
              ["canonical-directed-structure-v1", "canonical-typed-directed-structure-v1"]]
TOPOLOGY_FIELDS = ["nodeCount", "edgeCount", "weakComponentSizes", "strongComponentSizes", "reachableOrderedPairCount", "cyclicNodeCount", "isolatedNodeCount"]


def module(name):
    spec = importlib.util.spec_from_file_location("independent_" + name, HERE / ("../" + name + "/reference.py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


sandbox, canonical, typed, topology = [module(name) for name in ["sandbox", "canonical", "typed", "topology"]]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def measured(data, regime, mapping):
    labels = [n["id"] for n in data["nodes"]]
    index = {label: i for i, label in enumerate(labels)}
    edges = data["edges"]
    if regime == REGIMES[1]:
        value = topology.measure(labels, [(e["id"], e["source"], e["target"]) for e in edges])["value"]
        return [{"value": value[field], "missing": []} for field in TOPOLOGY_FIELDS]
    result = [{"value": canonical.key(len(labels), [(index[e["source"]], index[e["target"]]) for e in edges]), "missing": []}]
    if regime == REGIMES[2]:
        source = {e["afterId"]: e["sourceEdgeId"] for e in mapping["edges"]}
        gaps = sorted([{"sourceEdgeId": source[e["id"]], "field": field} for e in edges for field in typed.FIELDS if field not in e["types"]],
                      key=lambda g: (g["sourceEdgeId"].encode("utf-16-be"), g["field"]))
        value = None if gaps else typed.typed_key(len(labels), [(e["id"], index[e["source"]], index[e["target"]], e["types"]) for e in edges])
        result.append({"value": value, "missing": gaps})
    return result


def adjudicate(states):
    numerator, denominator = sum(s != "indeterminate" for s in states), len(states)
    return {"status": "indeterminate" if not denominator or numerator != denominator else "failed" if "different" in states else "passed",
            "coverage": {"numerator": numerator, "denominator": denominator}}


def compare(before, after, regime):
    components = [{"observableId": id, "state": "indeterminate" if a["value"] is None or b["value"] is None else "equal" if a["value"] == b["value"] else "different"}
                  for id, a, b in zip(OBSERVABLES[REGIMES.index(regime)], before, after)]
    return {**adjudicate([c["state"] for c in components]), "components": components}


def transform(data, mapping, transformation):
    changed = copy.deepcopy(data)
    nodes = {n["id"]: "vertex:{:03d}".format(len(data["nodes"]) - i - 1) if transformation == TRANSFORMS[1] else n["id"] for i, n in enumerate(data["nodes"])}
    edges = {e["id"]: "link:{:03d}".format(len(data["edges"]) - i - 1) if transformation == TRANSFORMS[2] else e["id"] for i, e in enumerate(data["edges"])}
    transported = {kind: [{source: entry[source], "beforeId": entry[shadow], "afterId": aliases[entry[shadow]]} for entry in mapping[kind]]
                   for kind, source, shadow, aliases in [("nodes", "sourceNodeId", "shadowNodeId", nodes), ("edges", "sourceEdgeId", "shadowEdgeId", edges)]}
    for n in changed["nodes"]:
        n["id"] = nodes[n["id"]]
    for e in changed["edges"]:
        e.update(id=edges[e["id"]], source=nodes[e["source"]], target=nodes[e["target"]])
    if transformation == TRANSFORMS[0]:
        changed["nodes"].reverse()
        changed["edges"].reverse()
    if transformation == TRANSFORMS[3]:
        for i, n in enumerate(changed["nodes"]):
            n["presentation"] = {"label": "Changed vertex " + str(i), "x": 100 - n["presentation"]["x"], "y": 50 - n["presentation"]["y"]}
        for i, e in enumerate(changed["edges"]):
            e["presentation"] = {"label": "Changed link " + str(i), "color": "#e11d48"}
        changed["viewport"]["zoom"] = 2
    return changed, transported


def summary(id, source, regime, scope=None):
    raw = sandbox.summary(id, source, regime, scope, {"kind": "identity"})
    graph, mapping = raw["baseline"]["graph"], raw["baseline"]["mapping"]
    data = {"nodes": [{**n, "presentation": {"label": "Node " + str(i), "x": i, "y": -i}} for i, n in enumerate(graph["nodes"])],
            "edges": [{**e, "presentation": {"label": "Edge " + str(i), "color": "#334155"}} for i, e in enumerate(graph["edges"])], "viewport": {"zoom": 1}}
    _, baseline_mapping = transform(data, mapping, "identity")
    before = measured(data, regime, baseline_mapping)
    runs = []
    for transformation in TRANSFORMS:
        changed, transported = transform(data, mapping, transformation)
        after = measured(changed, regime, transported)
        runs.append({"transformation": transformation, "payloadChanged": transformation != TRANSFORMS[2] or bool(graph["edges"]),
                     "data": changed, "mapping": transported, "values": after, "comparison": compare(before, after, regime)})
    return {"id": id, "scopeAccounting": raw["scopeAccounting"], "baseline": {"data": data, "mapping": mapping, "values": before}, "runs": runs,
            "summary": adjudicate([c["state"] for r in runs for c in r["comparison"]["components"]]),
            "work": {"representationCount": 5, "observationEvaluations": 5,
                     "canonicalizerCalls": 0 if regime == REGIMES[1] else 5 * (1 + int(regime == REGIMES[2] and before[1]["value"] is not None))}}


def source_cases():
    controls, declared = read("controls.json"), read("../sandbox/controls.json")
    sources = sandbox.sources(declared)
    scenarios = {s["id"]: s for s in declared["scenarios"]}
    result = [(id, sources[scenarios[id]["source"]], scenarios[id]["regimeId"], scenarios[id].get("scope")) for id in controls["sandboxScenarioIds"]]
    result.extend((id, sources["typed/" + id], REGIMES[2], None) for id in controls["typedControlIds"])
    n = controls["topologyLimit"]["nodes"]
    graph = {"nodes": n, "edges": [{"from": u, "to": (u + offset) % n, "types": controls["censusTypes"]} for u in range(n) for offset in controls["topologyLimit"]["forwardOffsets"]]}
    result.append(("topology-limit", sandbox.graph_records(graph, True), REGIMES[1], None))
    return result


def negative_controls(cases):
    result = []
    for id, case_id, regime in [("remove-one-chain-edge", "chain", REGIMES[0]), ("change-reciprocal-necessity", "reciprocal", REGIMES[2]),
                               ("remove-edge-with-missing-types", "missing", REGIMES[2])]:
        case = next(c for c in cases if c["id"] == case_id)
        data = copy.deepcopy(case["baseline"]["data"])
        if id == "change-reciprocal-necessity":
            data["edges"][0]["types"]["necessity"] = "optional"
        else:
            data["edges"].pop(0)
        mapping = case["runs"][0]["mapping"]
        result.append({"id": id, "comparison": compare(case["baseline"]["values"], measured(data, regime, mapping), regime)})
    return result


def expected():
    cases = [summary(*source) for source in source_cases()]
    census = []
    for n in range(1, 4):
        pairs = canonical.pairs(n)
        for mask in range(1 << len(pairs)):
            graph = sandbox.graph_records({"nodes": n, "edges": [{"from": u, "to": v, "types": read("controls.json")["censusTypes"]} for i, (u, v) in enumerate(pairs) if mask & (1 << i)]}, True)
            for regime in REGIMES:
                id = "n{}-mask{}-{}".format(n, mask, regime)
                census.append({"id": id, "sha256": sandbox.digest(summary(id, graph, regime))})
    profiles = []
    for n in range(8):
        results = [adjudicate(list(states)) for states in itertools.product(["equal", "different", "indeterminate"], repeat=n)]
        profiles.append({"components": n, "profiles": len(results), "sha256": sandbox.digest(results)})
    return {"schemaVersion": "1", "method": "independent-source-transformations-permutation-orbits-and-boolean-closure",
            "sourceHashes": {file: hashlib.sha256((HERE / file).read_bytes()).hexdigest() for file in FILES},
            "cases": cases, "census": census, "profiles": profiles, "negativeControls": negative_controls(cases)}


def actual_values(observation, regime):
    result = []
    for entry in observation["observations"]:
        value = entry["value"]
        if value is not None and regime != REGIMES[1]:
            n, edges = value["nodeCount"], value["edges"]
            value = typed.typed_key(n, [(str(i), e["from"], e["to"], e["types"]) for i, e in enumerate(edges)]) if entry["observable"]["id"] == OBSERVABLES[2][1] else canonical.key(n, [(e["from"], e["to"]) for e in edges])
        result.append({"value": value, "missing": entry["missing"]})
    return result


def actual_summary(id, artifact):
    regime, baseline = artifact["request"]["regimeId"], artifact["baseline"]
    return {"id": id, "scopeAccounting": {k: artifact["preparation"]["scope"][k] for k in ["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"]},
            "baseline": {"data": json.loads(baseline["representation"]["payload"]), "mapping": baseline["mapping"], "values": actual_values(baseline["observation"], regime)},
            "runs": [{"transformation": TRANSFORMS[i], "data": json.loads(r["representation"]["payload"]), "values": actual_values(r["observation"], regime),
                      **{k: r[k] for k in ["mapping", "payloadChanged", "comparison"]}} for i, r in enumerate(artifact["runs"])],
            **{k: artifact[k] for k in ["summary", "work"]}}


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
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Invariance reference differs"
        if args.verify_artifacts:
            for case in value["cases"]:
                assert actual_summary(case["id"], read("artifacts/" + case["id"] + ".json")) == case, case["id"]
    print("Independent invariance {}: 13 controls, 207 requests / 828 probes, 3280 profiles, 3 negative controls.".format("written" if args.write else "verified"))


if __name__ == "__main__":
    main()
