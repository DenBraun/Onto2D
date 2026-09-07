"""Independent geometric descriptors from source-derived numerical locks."""
import argparse
import hashlib
import itertools
import json
from collections import Counter
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ["controls.json", "sources.json", "PROTOCOL.md", "measurements.py", "measurements.json", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"]
IDS = ["forman-curvature-v1", "ollivier-curvature-v1", "flow-trajectory-v1"]
encode = lambda q: {"numerator": str(q.numerator), "denominator": str(q.denominator)}
decode = lambda q: F(int(q["numerator"]), int(q["denominator"]))
encoded = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
digest = lambda value: hashlib.sha256(encoded(value).encode()).hexdigest()
coverage = lambda n, d: {"numerator": n, "denominator": d, "complete": d > 0 and n == d}


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def multiset(values, key=None):
    counts = Counter(encoded(v) for v in values)
    rows = [{"value": json.loads(k), "count": n} for k, n in counts.items()]
    return sorted(rows, key=lambda r: key(r["value"]) if key else encoded(r["value"]).encode("utf-16-be"))


def roles(graph):
    edges = graph["edges"]
    incoming = Counter(e["target"] for e in edges); outgoing = Counter(e["source"] for e in edges)
    return {e["id"]: {"sourceInDegree": incoming[e["source"]], "sourceOutDegree": outgoing[e["source"]],
                       "targetInDegree": incoming[e["target"]], "targetOutDegree": outgoing[e["target"]]} for e in edges}


def scalar(samples, edge_roles, numeric):
    if not samples:
        return None
    lo = [decode(s["value"]["lower"]) for s in samples]; hi = [decode(s["value"]["upper"]) for s in samples]
    signs = {"negative": sum(h < 0 for h in hi), "positive": sum(l > 0 for l in lo), "zero": sum(l == h == 0 for l, h in zip(lo, hi)),
             "unresolved": sum(l <= 0 <= h and l != h for l, h in zip(lo, hi))}
    values, provenance = {}, {}
    for name, select in [("minimum", min), ("maximum", max)]:
        low, high = select(lo), select(hi)
        # Independent interval feasibility: fix each candidate at its favorable
        # endpoint; certainty fixes it unfavorably and all others favorably.
        possible = [i for i in range(len(samples)) if all(i == j or (lo[i] <= hi[j] if name == "minimum" else hi[i] >= lo[j]) for j in range(len(samples)))]
        certain = [i for i in range(len(samples)) if all(i == j or (hi[i] <= lo[j] if name == "minimum" else lo[i] >= hi[j]) for j in range(len(samples)))]
        values[name] = {"lower": encode(low), "upper": encode(high), "possibleRoles": multiset([edge_roles[samples[i]["id"]] for i in possible]),
                        "certainRoles": multiset([edge_roles[samples[i]["id"]] for i in certain])}
        provenance[name] = {"possibleEdgeIds": sorted([samples[i]["id"] for i in possible], key=lambda s: s.encode("utf-16-be")),
                            "certainEdgeIds": sorted([samples[i]["id"] for i in certain], key=lambda s: s.encode("utf-16-be"))}
    return {"value": {"numeric": numeric, "count": len(samples), "distribution": multiset([s["value"] for s in samples], lambda v: (decode(v["lower"]), decode(v["upper"]))),
                      "signs": signs, **values}, "provenance": provenance}


def events(states, cut):
    if cut["kind"] == "none":
        return {"value": None, "provenance": None}
    memberships = [{e["id"] for e in s["edges"] if decode(e["length"]) > decode(cut["threshold"])} for s in states]
    frames, provenance = [], []
    for i, current in enumerate(memberships):
        before = memberships[i - 1] if i else set()
        ordered = lambda values: sorted(values, key=lambda s: s.encode("utf-16-be"))
        frames.append({"iteration": states[i]["iteration"], "aboveCount": len(current), "enteredCount": len(current - before), "exitedCount": len(before - current)})
        provenance.append({"iteration": states[i]["iteration"], "aboveEdgeIds": ordered(current), "enteredEdgeIds": ordered(current - before), "exitedEdgeIds": ordered(before - current)})
    runs = []
    for edge in memberships[-1] if memberships else []:
        runs.append(next((j for j, m in enumerate(reversed(memberships)) if edge not in m), len(memberships)))
    return {"value": {"threshold": cut["threshold"], "frames": frames, "terminalRunLengths": multiset(runs, lambda x: x)}, "provenance": provenance}


def flow_descriptor(flow, edge_roles):
    frames, provenance = [], []
    for i in range(flow["horizon"] + 1):
        if i >= len(flow["states"]):
            frames.append({"iteration": i, "value": None, "reason": "after-" + flow["termination"]["reason"]})
            continue
        state = flow["states"][i]
        get = lambda field: scalar([{"id": e["id"], "value": {"lower": e[field], "upper": e[field]}} for e in state["edges"]], edge_roles, "exact-rational")
        lengths, curvatures = get("length"), get("curvature")
        frames.append({"iteration": i, "reason": None, "value": {"lengths": lengths["value"], "curvatures": curvatures["value"],
                       "jointDistribution": multiset([{k: e[k] for k in ["length", "curvature"]} for e in state["edges"]], lambda v: (decode(v["length"]), decode(v["curvature"]))),
                       **{k: state[k] for k in ["maxLengthChange", "maxCurvatureChange", "stableStepCount"]}}})
        provenance.append({"iteration": i, "lengths": lengths["provenance"], "curvatures": curvatures["provenance"]})
    threshold = events(flow["states"], flow["cuts"]["policy"])
    stop, cuts = flow["termination"], flow["cuts"]
    return {"value": {"horizon": flow["horizon"], "frames": frames,
                      "termination": {**{k: stop[k] for k in ["reason", "iteration", "cycleStart", "cyclePeriod"]}, "degenerateEdgeCount": len(stop["edgeIds"])},
                      "cuts": {"policy": cuts["policy"], "iteration": cuts["iteration"], "removedEdgeCount": len(cuts["removedEdgeIds"]),
                               "weakComponentSizes": sorted(map(len, cuts["weakComponents"])), "strongComponentSizes": sorted(map(len, cuts["strongComponents"])), "connectivity": cuts["connectivity"]},
                      "thresholdEvents": threshold["value"]},
            "provenance": {"frames": provenance, "thresholdEvents": threshold["provenance"], "degenerateEdgeIds": stop["edgeIds"], "cuts": cuts}}


def feature(id, cov, descriptor, reason):
    return {"id": id, "coverage": cov, "state": "unavailable" if descriptor is None else "observed" if cov["complete"] else "partial",
            "value": descriptor["value"] if descriptor else None, "provenance": descriptor["provenance"] if descriptor else None, "reasons": [reason] if reason else []}


def summary(features):
    cov = coverage(sum(f["state"] == "observed" for f in features), len(features))
    return {"status": "complete" if cov["complete"] else "indeterminate", "coverage": cov,
            "partialFeatureIds": [f["id"] for f in features if f["state"] == "partial"], "unavailableFeatureIds": [f["id"] for f in features if f["state"] == "unavailable"]}


def describe(c, measurement):
    graph, request = measurement["graph"], c["input"]
    n, edge_roles = len(graph["edges"]), roles(graph)
    fd = None
    if measurement["forman"] is not None:
        samples = [{"id": e["id"], "value": {"lower": encode(F(int(e["curvature"]["lowerTicks"]), 10 ** 12)), "upper": encode(F(int(e["curvature"]["upperTicks"]), 10 ** 12))}} for e in measurement["forman"]]
        fd = scalar(samples, edge_roles, "exact-rational" if request["forman"]["analysis"] == "structural-geometry" else "certified-interval")
    od = scalar([{"id": e["id"], "value": {"lower": e["curvature"], "upper": e["curvature"]}} for e in measurement["ollivier"]], edge_roles, "exact-rational") if measurement["ollivier"] is not None else None
    flow = measurement["flow"]
    observed_edges = len(measurement["ollivier"]) if measurement["ollivier"] is not None else 0
    frames = len(flow["states"]) if flow else 0
    total = request["flow"].get("maxIterations", 16) + 1 if request["flow"] is not None else 0
    features = [feature(IDS[0], coverage(len(measurement["forman"]) if measurement["forman"] is not None else 0, n), fd,
                        "not-requested" if request["forman"] is None else "empty-population" if not n else None),
                feature(IDS[1], coverage(observed_edges, n), od, "not-requested" if request["ollivier"] is None else "missing-evidence" if od is None else "partial-edge-coverage" if observed_edges != n else None),
                feature(IDS[2], coverage(frames, total), flow_descriptor(flow, edge_roles) if flow else None,
                        "not-requested" if request["flow"] is None else "missing-evidence" if flow is None else "after-" + flow["termination"]["reason"] if frames < total else None)]
    result = summary(features)
    return {"id": c["id"], "population": {"nodeIds": [n["id"] for n in graph["nodes"]], "edgeIds": [e["id"] for e in graph["edges"]]}, "features": features,
            "summary": result, "value": {"features": [{k: f[k] for k in ["id", "value"]} for f in features]} if result["status"] == "complete" else None,
            "work": {"scalarSamples": (len(measurement["forman"]) if measurement["forman"] else 0) + observed_edges + 2 * frames * n, "jointSamples": frames * n, "trajectoryFrames": frames}}


def property_controls():
    intervals = [(-1, -1), (-1, 0), (0, 0), (0, 1), (1, 1)]
    extrema = []
    for n in range(5):
        graph = {"nodes": [{"id": str(i)} for i in range(n + 1)], "edges": [{"id": str(i), "source": str(i), "target": str(i + 1)} for i in range(n)]}
        for rows in itertools.product(intervals, repeat=n):
            extrema.append(scalar([{"id": str(i), "value": {"lower": encode(F(lo)), "upper": encode(F(hi))}} for i, (lo, hi) in enumerate(rows)], roles(graph), "certified-interval"))
    traces = []
    for n in range(4):
        for values in itertools.product(range(1, 4), repeat=2 * n):
            states = [{"iteration": i, "edges": [{"id": str(j), "length": encode(F(values[2 * i + j]))} for j in range(2)]} for i in range(n)]
            traces.append(events(states, {"kind": "final-length", "threshold": encode(F(2))}))
    adjudications = [summary([{"id": str(i), "state": state} for i, state in enumerate(states)]) for n in range(4) for states in itertools.product(["observed", "partial", "unavailable"], repeat=n)]
    return {"intervalExtrema": {"profiles": len(extrema), "sha256": digest(extrema)}, "thresholdTraces": {"profiles": len(traces), "sha256": digest(traces)},
            "aggregation": {"profiles": len(adjudications), "sha256": digest(adjudications)}}


def verify_measurement_sources(measurements):
    expected_files = [f for f in FILES if f != "measurements.json"]
    assert set(measurements["sourceHashes"]) == set(expected_files)
    for f in expected_files:
        assert hashlib.sha256((HERE / f).read_bytes()).hexdigest() == measurements["sourceHashes"][f], f


def expected():
    controls, measurements = read("controls.json"), read("measurements.json")
    verify_measurement_sources(measurements)
    assert [c["id"] for c in controls["cases"]] == [m["id"] for m in measurements["cases"]]
    return {"schemaVersion": "1", "method": "independent-interval-feasibility-Fraction-multisets-and-backward-threshold-runs",
            "sourceHashes": {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in FILES},
            "cases": [describe(c, m) for c, m in zip(controls["cases"], measurements["cases"])], "properties": property_controls()}


def actual_summary(id, a):
    features = [{k: f[k] for k in ["id", "state", "coverage", "value", "provenance", "reasons"]} for f in a["features"]]
    if features[2]["provenance"]:
        for frame in features[2]["provenance"]["frames"]:
            del frame["stateHash"]
    return {"id": id, "population": {k: a["population"][k] for k in ["nodeIds", "edgeIds"]}, "features": features, **{k: a[k] for k in ["summary", "value", "work"]}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        group.add_argument(option, action="store_true")
    args = parser.parse_args(); value = expected()
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.write:
        (HERE / "reference.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Geometric descriptor reference differs"
        if args.verify_artifacts:
            for c in value["cases"]:
                assert actual_summary(c["id"], read("artifacts/" + c["id"] + ".json")) == c, c["id"]
    print("Independent geometric descriptors {}: 25 cases, 781 interval profiles, 820 threshold traces, 40 adjudications.".format("written" if args.write else "verified"))


if __name__ == "__main__":
    main()
