"""Independent source-derived categorical pseudometric using exact Fraction."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("independent_signature", HERE / "../signatures/reference.py")
signature = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signature)
response = signature.response
FILES = ["controls.json", "PROTOCOL.md", "../signatures/reference.py", "../signatures/build.mjs"] + ["../signatures/" + f for f in signature.FILES]
MODES = ["coverage-only", "partial-with-coverage"]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def rational(n, d):
    value = Fraction(n, d)
    return {"numerator": value.numerator, "denominator": value.denominator}


def aggregate(components, mode):
    groups = {s: [c["featureId"] for c in components if c["state"] == s] for s in ["equal", "different", "indeterminate"]}
    known, size = len(groups["equal"]) + len(groups["different"]), len(components)
    coverage = {"numerator": known, "denominator": size, "complete": size > 0 and known == size}
    distance = rational(len(groups["different"]), size) if coverage["complete"] else None
    return {"status": "indeterminate" if distance is None else "distinguishable-under-signature" if distance["numerator"] else "indistinguishable-under-signature",
            "distance": distance, "coverage": coverage,
            "diagnostics": {"equalFeatureIds": groups["equal"], "differentFeatureIds": groups["different"], "incompleteFeatureIds": groups["indeterminate"],
                            "partial": {"kind": "exploratory-pairwise-available-mean", "guarantee": "none", "coverage": coverage,
                                        "value": rational(len(groups["different"]), known) if known else None} if mode == MODES[1] else None}}


def requests_and_endpoints():
    controls, old, sig = read("controls.json"), response.read("controls.json"), signature.read("controls.json")
    graphs = [next(g for g in sig["graphs"] if g["id"] == id) for id in controls["completeFragments"]]
    graphs += [next(g for g in old["graphs"] if g["id"] == id) for id in controls["additionalFragments"]]
    graph, scopes = {"nodes": 0, "labels": [], "edges": []}, {}
    for g in graphs:
        labels = [g["id"] + ":n" + str(i) for i in range(g["nodes"])]
        scopes[g["id"]] = {"kind": "induced", "nodeIds": labels}
        graph["edges"] += [[u + graph["nodes"], v + graph["nodes"], t] for u, v, t in g["edges"]]
        graph["labels"] += labels
        graph["nodes"] += g["nodes"]
    types = {**old["types"], "contextual-necessary": {**old["types"]["contextual"], "necessity": "necessary"}}
    shared = response.records(graph, types)
    external = {id: (source, scope) for id, source, regime, scope in signature.source_cases()}
    requests = [{"id": left + "--" + right + "--" + regime, "regimeId": regime, "left": left, "right": right}
                for regime in controls["regimes"] for left in controls["completeFragments"] for right in controls["completeFragments"]] + controls["cases"]
    endpoints = {}
    for c in requests:
        for side in ["left", "right"]:
            fragment, regime = c[side], c["regimeId"]
            id = fragment + ":" + regime
            if id in endpoints:
                continue
            if fragment in ["maximum", "external"]:
                source, scope = external["maximum" if fragment == "maximum" else signature.contrast_id("diamond-feedback", regime)]
            else:
                source, scope = shared, scopes["diamond-feedback" if fragment == "foreign" else fragment]
            r = response.summary(id, source, regime, scope)
            endpoints[id] = {"id": id, "responses": r, "signature": signature.signature(r)}
    return requests, endpoints


def compare(c, endpoints):
    regime = c["regimeId"]
    left, right = [endpoints[c[s] + ":" + regime] for s in ["left", "right"]]
    context = lambda f: f if f in ["foreign", "external", "maximum"] else "shared"
    compatible = regime != "typed-relations-v1" or context(c["left"]) == context(c["right"])
    components = []
    for a, b in zip(left["signature"]["features"], right["signature"]["features"]):
        reasons = [] if compatible else [{"side": "pair", "code": "incompatible-domain", "count": 1}]
        for side, endpoint, f in [("left", left, a), ("right", right, b)]:
            reasons += [{"side": side, **r} for r in f["reasons"]]
            gate = endpoint["signature"]["summary"]["invarianceStatus"]
            if gate != "passed":
                reasons.append({"side": side, "code": "invariance-" + gate, "count": 1})
        distance = int(a["value"] != b["value"]) if not reasons and a["state"] == b["state"] == "observed" else None
        components.append({"featureId": a["id"], "weight": 1, "scale": 1, "left": {"measurement": a["state"]}, "right": {"measurement": b["state"]},
                           "state": "indeterminate" if distance is None else "different" if distance else "equal", "distance": distance, "reasons": reasons})
    canonical_calls = 0
    for e in [left, right]:
        canonical_calls += e["responses"]["work"]["canonicalizerCalls"]
        if regime != "topology-only-v1":
            canonical_calls += 5
            if regime == "typed-relations-v1" and e["responses"]["baseline"]["values"][1]["value"] is not None:
                canonical_calls += 5
    return {"id": c["id"], "domains": {"compatible": compatible, "membership": {side: "eligible" if e["signature"]["summary"]["status"] == "complete" else "ineligible" for side, e in [("left", left), ("right", right)]}},
            "components": components, **aggregate(components, c.get("diagnostics", MODES[0])),
            "work": {"componentComparisons": sum(x["state"] != "indeterminate" for x in components),
                     "observationEvaluations": sum(e["responses"]["work"]["observationEvaluations"] + 5 for e in [left, right]), "canonicalizerCalls": canonical_calls}}


def aggregation_profiles():
    return [{"features": n, "profiles": 2 * 3 ** n,
             "sha256": response.digest([aggregate([{"featureId": str(i), "state": s} for i, s in enumerate(states)], mode)
                                        for states in itertools.product(["equal", "different", "indeterminate"], repeat=n) for mode in MODES])} for n in range(6)]


def metric_properties():
    results = []
    for n in [3, 5]:
        vectors = list(itertools.product(range(3), repeat=n))
        units = [[sum(a != b for a, b in zip(x, y)) for y in vectors] for x in vectors]
        matrix = [[rational(value, n) for value in row] for row in units]
        for i, row in enumerate(units):
            assert row[i] == 0
            for j, value in enumerate(row):
                assert 0 <= value <= n and value == units[j][i]
                assert all(row[k] <= value + units[j][k] for k in range(len(vectors)))
        results.append({"dimensions": n, "vectors": len(vectors), "orderedPairs": len(vectors) ** 2,
                        "orderedTriangles": len(vectors) ** 3, "sha256": response.digest(matrix)})
    return results


def partial_counterexamples():
    results = []
    for n in [3, 5]:
        vectors = [[0, None] + [0] * (n - 2), [0] * n, [1] + [0] * (n - 1)]
        pairs = []
        for i, j in [(0, 1), (1, 2), (0, 2)]:
            components = [{"featureId": str(k), "state": "indeterminate" if a is None or b is None else "equal" if a == b else "different"} for k, (a, b) in enumerate(zip(vectors[i], vectors[j]))]
            pairs.append(aggregate(components, MODES[1]))
        fractions = [Fraction(p["diagnostics"]["partial"]["value"]["numerator"], p["diagnostics"]["partial"]["value"]["denominator"]) for p in pairs]
        assert fractions[2] > fractions[0] + fractions[1]
        assert pairs[0]["distance"] is None and pairs[2]["distance"] is None
        results.append({"dimensions": n, "vectors": vectors, "pairs": pairs})
    return results


def expected():
    requests, endpoints = requests_and_endpoints()
    return {"schemaVersion": "1", "method": "source-derived-signatures-and-Fraction-categorical-metric",
            "sourceHashes": {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in FILES},
            "endpoints": [{"id": id, "sha256": response.digest(e)} for id, e in endpoints.items()],
            "cases": [compare(c, endpoints) for c in requests], "aggregationProfiles": aggregation_profiles(),
            "metricProperties": metric_properties(), "partialCounterexamples": partial_counterexamples()}


def actual_summary(id, artifact):
    return {"id": id, "domains": {k: artifact["domains"][k] for k in ["compatible", "membership"]},
            "components": [{**{k: c[k] for k in ["featureId", "weight", "scale", "state", "distance", "reasons"]},
                            **{side: {"measurement": c[side]["measurement"]} for side in ["left", "right"]}} for c in artifact["components"]],
            **{k: artifact[k] for k in ["status", "distance", "coverage", "diagnostics", "work"]}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        group.add_argument(option, action="store_true")
    args = parser.parse_args()
    reference = expected()
    text = json.dumps(reference, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        (HERE / "reference.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Pseudometric reference differs"
        if args.verify_artifacts:
            endpoints = {e["id"]: e["sha256"] for e in reference["endpoints"]}
            requests, _ = requests_and_endpoints()
            for c, request in zip(reference["cases"], requests):
                a = read("artifacts/" + c["id"] + ".json")
                assert actual_summary(c["id"], a) == c, c["id"]
                for side in ["left", "right"]:
                    id = request[side] + ":" + request["regimeId"]
                    assert response.digest(signature.actual_summary(id, a["evidence"][side])) == endpoints[id], id
    print("Independent pseudometric reference {}: 60 controls, 59778 pairs, 14368590 triangles, 728 aggregation profiles.".format("written" if args.write else "verified"))


if __name__ == "__main__":
    main()
