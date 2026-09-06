#!/usr/bin/env python3
"""Independent closed-form recurrence: Ni et al. 2019, Appendix E, Lemma E.1.

No graph or transport library is used. This finite reproduction is a gate for
the declared symmetric G(3,2) fixture, not a proof for arbitrary directed graphs.
"""
from fractions import Fraction as F
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def fraction(value):
    return F(int(value["numerator"]), int(value["denominator"]))


def check_paper(artifact):
    request = artifact["request"]
    assert request["parameters"]["idleness"] == "zero" and request["parameters"]["step"] == "one"
    assert len(request["graph"]["nodes"]) == 12 and len(request["graph"]["edges"]) == 42
    types = {}
    for edge in request["graph"]["edges"]:
        g, i = edge["source"].split("-")
        h, j = edge["target"].split("-")
        types[edge["id"]] = 1 if g != h else 2 if "0" in [i, j] else 3
        if g != h:
            assert i == j == "0"
    assert [list(types.values()).count(i) for i in [1, 2, 3]] == [6, 18, 18]
    d1, d2, d3 = F(1), F(1), F(1)
    for iteration, state in enumerate(artifact["states"]):
        assert state["iteration"] == iteration
        assert all(fraction(e["length"]) == [d1, d2, d3][types[e["id"]] - 1] for e in state["edges"]), "Paper length recurrence differs"
        # Lemma E.1 at a=3, b=2, p=0 and alpha=0. With epsilon=1,
        # these raw next lengths are also the exact Wasserstein distances.
        next_values = [F(2, 5) * d1 + F(6, 5) * d2,
                       F(2, 5) * d1 + F(1, 15) * d2 + F(1, 5) * d3, d3 / 3]
        for edge in state["edges"]:
            w = next_values[types[edge["id"]] - 1]
            assert fraction(edge["wasserstein"]) == w, "Paper transport recurrence differs"
            assert fraction(edge["curvature"]) == 1 - w / fraction(edge["length"])
        factor = 42 / sum(n * d for n, d in zip([6, 18, 18], next_values))
        d1, d2, d3 = [d * factor for d in next_values]
    assert len(artifact["states"]) == 17 and artifact["termination"]["reason"] == "iteration-limit"
    expected = [[f"g{g}-{i}" for i in range(4)] for g in range(3)]
    assert artifact["cuts"]["weakComponents"] == artifact["cuts"]["strongComponents"] == expected
    assert set(artifact["cuts"]["removedEdgeIds"]) == {key for key, value in types.items() if value == 1}
    return len(artifact["states"]) * 42


if __name__ == "__main__":
    count = check_paper(json.loads((HERE / "artifacts/paper-g3-2.json").read_text(encoding="utf-8")))
    print(f"Published G(3,2) recurrence verified: {count} exact edge values; final cut recovers three four-node groups.")
