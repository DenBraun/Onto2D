"""Separate Fraction/Decimal directed weighted Forman reference (100 digits).

The production implementation uses BigInt integer square-root bounds. This
reference uses Decimal square roots and direct incidence scans, with exact
rational handling for perfect roots. It is not independent reviewer approval.
"""
import argparse
from decimal import Decimal, localcontext, ROUND_FLOOR, ROUND_CEILING
from fractions import Fraction
import json
from math import isqrt
from pathlib import Path
import sys

DIRECTORY = Path(__file__).resolve().parent
SCALE = 10 ** 12
ORDER = ["necessary", "enabling", "contextual", "optional"]


def fraction_json(value):
    return dict(numerator=str(value.numerator), denominator=str(value.denominator))


def interval_json(lower, upper):
    return dict(lowerTicks=str(lower), upperTicks=str(upper))


def selected(edge, selection):
    kind = selection["kind"]
    if kind == "all":
        return True
    if kind == "necessity":
        return ORDER.index(edge["necessity"]) <= ORDER.index(selection["through"])
    if kind == "roles":
        return edge["ontologicalRole"] in selection["roles"]
    if kind == "channel":
        value = edge.get(selection["field"])
        return selection["value"] in value if isinstance(value, list) else value == selection["value"]
    raise ValueError("Unknown selection")


def radical_ticks(ratio):
    numerator_root = isqrt(ratio.numerator)
    denominator_root = isqrt(ratio.denominator)
    if numerator_root ** 2 == ratio.numerator and denominator_root ** 2 == ratio.denominator:
        exact = Fraction(numerator_root * SCALE, denominator_root)
        lower = exact.numerator // exact.denominator
        return lower, lower + (exact.denominator != 1)
    with localcontext() as context:
        context.prec = 100
        value = (Decimal(ratio.numerator) / Decimal(ratio.denominator)).sqrt() * SCALE
        return int(value.to_integral_value(rounding=ROUND_FLOOR)), int(value.to_integral_value(rounding=ROUND_CEILING))


def calculate(graph, request):
    all_edges = graph["edges"]
    edges = [edge for edge in all_edges if selected(edge, request.get("selection", dict(kind="all")))]
    edges.sort(key=lambda edge: edge["id"].encode("utf-16-be"))
    lengths = {}
    for edge in all_edges:
        if request.get("metricPolicyId", "unit-v1") == "unit-v1":
            lengths[edge["id"]] = Fraction(1)
        else:
            weight = Fraction(edge["weight"])
            if not Fraction(1, 1000000) <= weight <= 1:
                raise ValueError("Source weight outside the declared profile")
            population_sum = sum((Fraction(other["weight"]) for other in all_edges
                                  if other["target"] == edge["target"]), Fraction(0))
            lengths[edge["id"]] = population_sum / weight
    values = []
    for edge in edges:
        lower = upper = 2 * SCALE
        for neighbor in edges:
            incidences = int(neighbor["target"] == edge["source"]) + int(neighbor["source"] == edge["target"])
            if incidences:
                term_lower, term_upper = radical_ticks(lengths[edge["id"]] / lengths[neighbor["id"]])
                lower -= incidences * term_upper
                upper -= incidences * term_lower
        values.append(dict(id=edge["id"], length=fraction_json(lengths[edge["id"]]), curvature=interval_json(lower, upper)))
    by_id = {value["id"]: value["curvature"] for value in values}
    node_values = []
    for node in sorted(graph["nodes"], key=lambda node: node["id"].encode("utf-16-be")):
        def total(endpoint, bound):
            return sum(int(by_id[edge["id"]][bound]) for edge in edges if edge[endpoint] == node["id"])
        in_lo, in_hi = total("target", "lowerTicks"), total("target", "upperTicks")
        out_lo, out_hi = total("source", "lowerTicks"), total("source", "upperTicks")
        node_values.append(dict(id=node["id"], incomingCurvature=interval_json(in_lo, in_hi),
                                outgoingCurvature=interval_json(out_lo, out_hi), balance=interval_json(in_lo-out_hi, in_hi-out_lo)))
    return dict(edges=values, nodes=node_values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--verify", action="store_true")
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--stdin", action="store_true")
    args = parser.parse_args()
    if args.stdin:
        value = json.loads(sys.stdin.buffer.read().decode("utf-8"), parse_float=Decimal)
        print(json.dumps(calculate(value["graph"], value["request"]), ensure_ascii=True))
        return
    source = json.loads((DIRECTORY / "controls.json").read_text(encoding="utf-8"), parse_float=Decimal)
    result = dict(schemaVersion="1", referenceVersion="1", precision=100,
                  cases=[dict(id=graph["id"], **calculate(graph, dict(metricPolicyId="inverse-target-share-v1")))
                         for graph in source["cases"]])
    encoded = json.dumps(result, ensure_ascii=True, indent=2) + "\n"
    target = DIRECTORY / "expected.json"
    if args.write:
        target.write_text(encoded, encoding="utf-8")
        print("Wrote weighted Forman reference controls.")
    elif target.read_text(encoding="utf-8") != encoded:
        raise ValueError("Weighted reference controls differ; investigate before regenerating")
    else:
        print("Weighted Forman reference controls verified.")


if __name__ == "__main__":
    main()
