"""Independent source-derived response signature aggregation and eligibility."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("independent_responses", HERE / "../responses/reference.py")
response = importlib.util.module_from_spec(spec)
spec.loader.exec_module(response)
FILES = ["controls.json", "PROTOCOL.md", "../responses/reference.py", "../responses/build.mjs"] + ["../responses/" + name for name in response.FILES]
FEATURE_IDS = [name + "-response-multiset-v0" for name in ["feedback", "necessary", "enabling", "direction", "support"]]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def aggregate(features, invariance):
    numerator, denominator = sum(f["state"] == "observed" for f in features), len(features)
    complete = denominator > 0 and numerator == denominator
    reasons = ([] if complete else ["incomplete-response-features"]) + ([] if invariance == "passed" else ["invariance-" + invariance])
    return {"status": "indeterminate" if reasons else "complete", "coverage": {"numerator": numerator, "denominator": denominator, "complete": complete},
            "invarianceStatus": invariance, "reasons": reasons}


def signature(source_result):
    features = []
    for p in source_result["probes"]:
        reasons = []
        if p["execution"]["reason"]:
            reasons.append({"code": p["execution"]["reason"], "count": 1})
        rejected = sum(r["execution"] == "rejected" for r in p["runs"])
        missing = sum(r["execution"] == "applied" and r["response"]["status"] == "indeterminate" for r in p["runs"])
        for code, count in [("rejected-transformations", rejected), ("missing-observations", missing)]:
            if count:
                reasons.append({"code": code, "count": count})
        observed = p["selection"]["state"] == "complete" and len(p["runs"]) > 0 and not reasons
        value = None
        if observed:
            # Sort complete joint rows, then group adjacent equal tuples. No use
            # of the production histogram or its aggregation implementation.
            rows = sorted((r["response"]["components"] for r in p["runs"]), key=lambda row: response.encoded(row).encode("utf-16-be"))
            value = [{"components": key, "count": len(list(group))} for key, group in itertools.groupby(rows)]
        features.append({"id": FEATURE_IDS[response.PROBES.index(p["probeId"])], "probeId": p["probeId"],
                         "state": "observed" if observed else "indeterminate", "value": value, "coverage": p["summary"]["coverage"], "reasons": reasons})
    # The frozen representation adapter ignores IDs/order/presentation. Missing
    # mandatory baseline types affect all four controls; they cannot be repaired
    # by a subsequent response ablation.
    invariance = "indeterminate" if any(o["value"] is None for o in source_result["baseline"]["values"]) else "passed"
    summary = aggregate(features, invariance)
    value = {"features": [{k: f[k] for k in ["id", "value"]} for f in features]} if summary["status"] == "complete" else None
    return {"features": features, "summary": summary, "value": value}


def source_cases():
    controls = read("controls.json")
    old = response.read("controls.json")
    sources = response.sources(old)
    assert controls["baseControlIds"] == [s["id"] for s in old["scenarios"]]
    cases = [(s["id"], sources[s["source"]], s["regimeId"],
              s.get("scope", {"kind": "induced", "nodeIds": old["causalScope"]} if s["source"] == "causal" else None)) for s in old["scenarios"]]
    types = {**old["types"], "contextual-necessary": {**old["types"]["contextual"], "necessity": "necessary"}}
    for g in controls["graphs"]:
        for regime in controls["regimes"]:
            if g["id"] == "diamond-feedback" and regime == "typed-relations-v1":
                continue
            cases.append((g["id"] + "-" + regime, response.records(g, types), regime, None))
    return cases


def contrast_id(graph, regime):
    return "diamond-feedback-typed" if graph == "diamond-feedback" and regime == "typed-relations-v1" else graph + "-" + regime


def aggregation_profiles():
    rows = []
    for n in range(5):
        results = [aggregate([{"state": "observed" if state == "complete" else "indeterminate"} for state in states], invariance)
                   for states in itertools.product(["complete", "empty", "unresolved", "rejected", "missing"], repeat=n)
                   for invariance in ["passed", "failed", "indeterminate"]]
        rows.append({"features": n, "profiles": len(results), "sha256": response.digest(results)})
    return rows


def expected():
    cases = []
    for id, source, regime, scope in source_cases():
        r = response.summary(id, source, regime, scope)
        cases.append({"id": id, "responses": r, "signature": signature(r)})
    values = {c["id"]: c["signature"]["value"] for c in cases}
    controls = read("controls.json")
    contrasts = []
    for c in controls["contrasts"]:
        for i, regime in enumerate(controls["regimes"]):
            left, right = [contrast_id(c[side], regime) for side in ["left", "right"]]
            assert values[left] is not None and values[right] is not None
            outcome = "equal" if values[left] == values[right] else "different"
            assert outcome == c["expectation"][i], (c["id"], regime, outcome)
            contrasts.append({"id": c["id"], "regimeId": regime, "left": left, "right": right, "outcome": outcome})
    old = response.read("controls.json")
    census, complete, observed = [], 0, 0
    for n in range(1, 4):
        pairs = response.canonical.pairs(n)
        for mask in range(1 << len(pairs)):
            g = response.records({"nodes": n, "edges": [[u, v, old["censusType"]] for i, (u, v) in enumerate(pairs) if mask & (1 << i)]}, old["types"])
            for regime in response.REGIMES:
                id = "n{}-mask{}-{}".format(n, mask, regime)
                r = response.summary(id, g, regime)
                s = signature(r)
                census.append({"id": id, "sha256": response.digest({"id": id, "responses": r, "signature": s})})
                complete += s["summary"]["status"] == "complete"
                observed += s["summary"]["coverage"]["numerator"]
    return {"schemaVersion": "1", "method": "source-derived-independent-responses-sorted-joint-row-groups-and-strict-invariance-gate",
            "sourceHashes": {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in FILES},
            "cases": cases, "contrasts": contrasts, "census": {"requests": len(census), "complete": complete, "observedFeatures": observed, "digests": census},
            "aggregationProfiles": aggregation_profiles()}


def actual_summary(id, artifact):
    return {"id": id, "responses": response.actual_summary(id, artifact["evidence"]["responses"]),
            "signature": {"features": [{k: f[k] for k in ["id", "probeId", "state", "value", "coverage", "reasons"]} for f in artifact["features"]],
                          "summary": artifact["summary"], "value": artifact["value"]}}


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
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Signature reference differs"
        if args.verify_artifacts:
            for c in reference["cases"]:
                assert actual_summary(c["id"], read("artifacts/" + c["id"] + ".json")) == c, c["id"]
    print("Independent signature reference {}: {} controls, 9 contrasts, 207 census requests, 2343 adjudications.".format("written" if args.write else "verified", len(reference["cases"])))


if __name__ == "__main__":
    main()
