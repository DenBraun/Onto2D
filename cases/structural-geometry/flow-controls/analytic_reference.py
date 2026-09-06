#!/usr/bin/env python3
"""Independent exact star/barbell recurrence; see PROTOCOL.md for optimality witnesses.

--write freezes predictions from inputs alone. --verify also checks all runtime
artifacts. No graph library, transport solver or production implementation imports.
"""
import argparse
from fractions import Fraction as F
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROTOCOL_SHA256 = "52aa6ac26060a17ab17bcd99e31a1ffd3027c88ee5d9d5fa06b68325562f02c6"
decode = lambda v: F(int(v["numerator"]), int(v["denominator"]))
encode = lambda v: {"numerator": str(v.numerator), "denominator": str(v.denominator)}
encoded = lambda v: json.dumps(v, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def protocol():
    raw = (HERE / "protocol.json").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PROTOCOL_SHA256, "Frozen control protocol changed"
    return json.loads(raw)


def edge_class(edge, bridge):
    a, b = edge["source"], edge["target"]
    if not bridge:
        return b if a == "center" else a
    return "bridge" if a[0] != b[0] else "spoke" if "0" in (a[1], b[1]) else "internal"


def predict(run, graph):
    params = run["input"]
    bridge = graph["id"] == "two-k4-single-bridge"
    counts = {"bridge": 2, "spoke": 12, "internal": 12} if bridge else {f"leaf-{i}": 1 for i in range(1, 5)}
    total = sum(counts.values())
    lengths = {key: F(1) for key in counts} if bridge else {f"leaf-{i}": F(2 * i, 5) for i in range(1, 5)}
    normalization = {"rawSum": encode(F(total if bridge else 10)), "closureSum": encode(F(total if bridge else 10)),
                     "factor": encode(F(1) if bridge else F(2, 5)), "shortenedEdgeIds": []}
    states = []; previous = None; seen = set(); stable = 0
    for iteration in range(17 if bridge else 2):
        if bridge:
            b, s, i = (lengths[key] for key in ("bridge", "spoke", "internal"))
            assert 0 < i <= 2 * s and b > 0
            costs = {"bridge": b / 2 + 3 * s / 2, "spoke": b / 4 + s / 12 + i / 6, "internal": i / 3}
        else:
            costs = dict(lengths)
        curvatures = {key: 1 - costs[key] / lengths[key] for key in counts}
        assert sum(counts[key] * lengths[key] for key in counts) == total
        if bridge:
            # Ensure the predicted finite history has no earlier stopping event.
            metric = tuple(lengths.values())
            assert metric not in seen, "Unexpected fixed point/cycle in declared finite profile"
            seen.add(metric)
            if previous:
                small = all(abs(lengths[k] - previous[0][k]) <= decode(params["tolerance"])
                            and abs(curvatures[k] - previous[1][k]) <= decode(params["tolerance"]) for k in counts)
                stable = stable + 1 if small else 0
                assert stable < params["stableSteps"], "Declared finite profile stops on tolerance earlier"
            previous = (lengths, curvatures)
        states.append({"iteration": iteration, "classes": {key: {"length": encode(lengths[key]),
            "wasserstein": encode(costs[key]), "curvature": encode(curvatures[key])} for key in counts},
            "normalization": normalization})
        raw_sum = sum(counts[key] * costs[key] for key in counts)
        factor = total / raw_sum
        lengths = {key: factor * costs[key] for key in counts}
        normalization = {"rawSum": encode(raw_sum), "closureSum": encode(raw_sum), "factor": encode(factor), "shortenedEdgeIds": []}
    final = states[-1]["classes"]
    removed = sorted(e["id"] for e in graph["edges"] if bridge and decode(final[edge_class(e, bridge)]["length"]) > 2)
    if bridge:
        # An expectation failure is retained as a failed gate, never fixed by tuning.
        assert removed == ["a0->b0", "b0->a0"], "Frozen bridge-separation expectation failed"
        groups = [[f"{g}{i}" for i in range(4)] for g in ["a", "b"]]
        weak = strong = groups
    else:
        weak = [sorted(n["id"] for n in graph["nodes"])]
        strong = [[n] for n in weak[0]]
    iteration = len(states) - 1
    return {"id": run["id"], "states": states,
        "termination": {"reason": "iteration-limit" if bridge else "fixed-point", "iteration": iteration,
            "cycleStart": None, "cyclePeriod": None, "edgeIds": []},
        "cuts": {"policy": params["cut"], "iteration": iteration, "removedEdgeIds": removed,
            "weakComponents": weak, "strongComponents": strong, "connectivity": {"weakComponentCount": len(weak),
                "strongComponentCount": len(strong), "cyclicNodeCount": 8 if bridge else 0, "isolatedNodeCount": 0}}}


def predictions():
    data = protocol()
    return {"schemaVersion": "1", "protocolSha256": PROTOCOL_SHA256,
        "reference": {"id": "directed-star-and-two-k4-analytic-v1", "numeric": "python-fraction-exact",
            "method": "endpoint-dirac-and-three-class-transport-recurrence", "derivation": "PROTOCOL.md"},
        "cases": [predict(run, next(g for g in data["graphs"] if g["id"] == run["graphId"])) for run in data["runs"]]}


def check_artifact(run, artifact, expected):
    data = protocol()
    graph = next(g for g in data["graphs"] if g["id"] == run["graphId"])
    actual = artifact["request"]["graph"]
    assert sorted(n["id"] for n in actual["nodes"]) == sorted(n["id"] for n in graph["nodes"])
    triples = lambda g: sorted((e["id"], e["source"], e["target"]) for e in g["edges"])
    assert triples(actual) == triples(graph), "Reference source topology differs"
    params = dict(run["input"])
    params["initialLengths"] = sorted(params["initialLengths"], key=lambda e: e["edgeId"])
    assert artifact["request"]["parameters"] == params, "Reference input differs from frozen protocol"
    classes = {e["id"]: edge_class(e, graph["id"] == "two-k4-single-bridge") for e in graph["edges"]}
    assert len(artifact["states"]) == len(expected["states"]), "Analytic history length differs"
    for state, prediction in zip(artifact["states"], expected["states"]):
        assert state["iteration"] == prediction["iteration"] and state["normalization"] == prediction["normalization"]
        assert state["edges"] == [{"id": key, **prediction["classes"][classes[key]]} for key in sorted(classes)], "Analytic edge values differ"
    assert artifact["termination"] == expected["termination"] and artifact["cuts"] == expected["cuts"]


def verify():
    expected = predictions()
    assert (HERE / "analytic-expected.json").read_text(encoding="utf-8") == encoded(expected), "Frozen analytic predictions differ"
    for run, prediction in zip(protocol()["runs"], expected["cases"]):
        artifact = json.loads((HERE / "artifacts" / f"{run['id']}.json").read_text(encoding="utf-8"))
        check_artifact(run, artifact, prediction)
    return expected


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true"); mode.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    expected = predictions() if args.write else verify()
    if args.write:
        (HERE / "analytic-expected.json").write_text(encoded(expected), encoding="utf-8")
    print(f"Analytic flow controls {'predicted' if args.write else 'verified'}: {len(expected['cases'])} runs; star fixed points and finite bridge separation.")
