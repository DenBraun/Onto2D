"""Independent R3 comparison outcomes from source permutations and matrix closure.

Expectation generation does not read production comparison artifacts. Reuses
the prior independent Python graph references, never JS evaluators or hashes.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ["controls.json", "PROTOCOL.md", "../typed/controls.json", "../typed/reference.py",
         "../canonical/reference.py", "../topology/reference.py",
         "../../../models/causal-emergence/releases/2026.08.15/bundle.json"]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, HERE / path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


typed = module("independent_typed", "../typed/reference.py")
topology = module("independent_topology", "../topology/reference.py")
FIELDS = typed.FIELDS
TOPOLOGY = [("node-count-v1", "nodeCount"), ("edge-count-v1", "edgeCount"),
            ("weak-component-sizes-v1", "weakComponentSizes"), ("strong-component-sizes-v1", "strongComponentSizes"),
            ("reachable-ordered-pair-count-v1", "reachableOrderedPairCount"),
            ("cyclic-node-count-v1", "cyclicNodeCount"), ("isolated-node-count-v1", "isolatedNodeCount")]
UNTYPED = "canonical-directed-structure-v1"
TYPED = "canonical-typed-directed-structure-v1"


def json_file(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def sources(document):
    graphs = {name: (labels, edges) for name, labels, edges in typed.sources()}
    for g in document["graphs"]:
        labels = ["n" + str(i) for i in range(g["nodes"])]
        graphs[g["id"]] = (labels, [("e" + str(i), e["from"], e["to"], e["types"]) for i, e in enumerate(g["edges"])])
    return graphs


def scoped(graph, scope):
    labels, edges = graph
    if scope is None:
        return graph
    assert scope["kind"] == "induced"
    selected = sorted(scope["nodeIds"], key=lambda s: s.encode("utf-16-be"))
    assert len(set(selected)) == len(selected) and set(selected) <= set(labels)
    index = {label: i for i, label in enumerate(selected)}
    return selected, [(id, index[labels[u]], index[labels[v]], types) for id, u, v, types in edges
                      if labels[u] in index and labels[v] in index]


def plain_key(graph):
    labels, edges = graph
    return {"nodeCount": len(labels), "key": typed.untyped.key(len(labels), [(u, v) for _, u, v, _ in edges])}


def typed_value_key(graph):
    return {"nodeCount": len(graph[0]), "key": typed.typed_key(len(graph[0]), graph[1])}


def topology_values(graph):
    labels, edges = graph
    return topology.measure(labels, [(id, labels[u], labels[v]) for id, u, v, _ in edges])["value"]


def maps(document):
    result = {m["id"]: m["fields"] for m in json_file("../typed/controls.json")["mappings"]}
    result["identity"] = {field: [{"left": v, "right": v} for v in values] for field, values in {
        "dependencyTypeId": [0, 1, 2], "interactionModeIds": [0, 1, 2], "causalDirectionIds": [0, 1, 2],
        "ontologicalRole": ["arising", "maintenance", "modulation"],
        "necessity": ["necessary", "enabling", "contextual", "optional"]}.items()}
    return result


def expected_comparison(pair, regime, left, right, mappings):
    reasons = []
    missing = [bool(typed.missing(g[1])) for g in [left, right]]
    translated = None
    if regime == "typed-relations-v1":
        for side, gap in zip(["left", "right"], missing):
            if gap:
                reasons.append({"code": "missing-typed-observation", "side": side})
        if "mapping" not in pair:
            if pair["left"] != pair["right"]:
                reasons.append({"code": "cross-source-mapping-required"})
        else:
            mapping = mappings[pair["mapping"]]
            if not pair["approve"]:
                reasons.append({"code": "mapping-not-approved"})
            if not any(missing):
                for field in FIELDS:
                    for side, graph in [("left", left), ("right", right)]:
                        used = {v for _, _, _, t in graph[1] for v in (t[field] if field in typed.SETS else [t[field]])}
                        covered = {entry[side] for entry in mapping[field]}
                        for value in sorted(used - covered):
                            reasons.append({"code": "mapping-value-uncovered", "side": side, "field": field, "value": value})
        if not reasons:
            translated = right
            if "mapping" in pair:
                reverse = {field: {entry["right"]: entry["left"] for entry in mapping[field]} for field in FIELDS}
                translated = right[0], [(id, u, v, {field: sorted(reverse[field][v] for v in t[field]) if field in typed.SETS
                                                   else reverse[field][t[field]] for field in FIELDS}) for id, u, v, t in right[1]]
    rows = []
    if regime == "topology-only-v1":
        a, b = topology_values(left), topology_values(right)
        for observable, field in TOPOLOGY:
            rows.append((observable, "topology", a[field], b[field], [False, False], []))
    else:
        rows.append((UNTYPED, "structure", plain_key(left), plain_key(right), [False, False], []))
        if regime == "typed-relations-v1":
            rows.append((TYPED, "typed-relations", typed_value_key(left) if translated is not None else None,
                         typed_value_key(translated) if translated is not None else None, missing, reasons))
    components = []
    for observable, family, a, b, missing_sides, gaps in rows:
        details = list(gaps)
        sides = {}
        for side, absent in zip(["left", "right"], missing_sides):
            restriction = next((g for g in pair.get("evidenceGaps", []) if g["side"] == side and g["observableId"] == observable), None)
            sides[side] = {"availability": "missing" if absent else "observed", "disposition": restriction["disposition"] if restriction else "accepted"}
            if restriction:
                details.append({"code": "evidence-" + restriction["disposition"], "side": side})
        components.append({"observableId": observable, "family": family, **sides,
                           "state": "indeterminate" if details else "equal" if a == b else "different",
                           "values": None if details else {"left": a, "right": b}, "reasons": details})
    families = {}
    for row in components:
        f = families.setdefault(row["family"], {"family": row["family"], "numerator": 0, "denominator": 0})
        f["denominator"] += 1
        f["numerator"] += row["state"] != "indeterminate"
    numerator = sum(row["state"] != "indeterminate" for row in components)
    complete = numerator == len(components) and bool(components)
    different = any(row["state"] == "different" for row in components)
    return {"id": pair["id"] + "-" + regime, "components": components,
            "coverage": {"numerator": numerator, "denominator": len(components), "complete": complete, "families": list(families.values())},
            "distance": int(different) if complete else None,
            "status": "indeterminate" if not complete else "distinguishable-under-regime" if different else "indistinguishable-under-regime",
            "diagnostics": {key: [r["observableId"] for r in components if r["state"] == state] for key, state in
                            [("equalObservableIds", "equal"), ("differentObservableIds", "different"), ("incompleteObservableIds", "indeterminate")]}}


def expected():
    document = json_file("controls.json")
    graphs = sources(document)
    mappings = maps(document)
    results = [expected_comparison(pair, regime, scoped(graphs[pair["left"]], pair.get("leftScope")),
                                   scoped(graphs[pair["right"]], pair.get("rightScope")), mappings)
               for pair in document["pairs"] for regime in pair["regimes"]]
    census = [{"components": n, "profiles": 3 ** n, "equal": int(n > 0), "different": 2 ** n - 1,
               "indeterminate": 3 ** n - 2 ** n if n else 1} for n in range(8)]
    return {"schemaVersion": "1", "method": "source-permutations-matrix-closure-and-strict-complete-profile",
            "sourceHashes": {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in FILES},
            "aggregationCensus": census, "cases": results}


def actual_summary(id, artifact):
    result = {key: artifact[key] for key in ["coverage", "distance", "status", "diagnostics"]}
    components = []
    for row in artifact["components"]:
        values = row["values"]
        if values and row["observable"]["id"] in [UNTYPED, TYPED]:
            values = dict(values)
            for side, value in values.items():
                edges = [(str(i), e["from"], e["to"], e.get("types", {})) for i, e in enumerate(value["edges"])]
                graph = list(range(value["nodeCount"])), edges
                values[side] = typed_value_key(graph) if row["observable"]["id"] == TYPED else plain_key(graph)
        components.append({"observableId": row["observable"]["id"], **{k: row[k] for k in ["family", "left", "right", "state"]},
                           "values": values, "reasons": [{k: v for k, v in reason.items() if k not in ["reference", "contentHash"]} for reason in row["reasons"]]})
    return {"id": id, "components": components, **result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        mode.add_argument(option, action="store_true")
    args = parser.parse_args()
    value = expected()
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        with (HERE / "reference.json").open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Independent comparison expectations differ"
        if args.verify_artifacts:
            for case in value["cases"]:
                assert actual_summary(case["id"], json_file("artifacts/" + case["id"] + ".json")) == case, case["id"]
    print("Independent comparisons {}: {} regime runs; 3280 possible aggregation profiles.".format(
        "written" if args.write else "verified", len(value["cases"])))


if __name__ == "__main__":
    main()
