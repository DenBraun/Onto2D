#!/usr/bin/env python3
"""Exact rational-cost transport for normalized shadow flow, Python 3.9+."""
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import re
import sys

# Isolated Python does not add this directory to sys.path. Load only the packaged
# reference file by its explicit path, never a user-controlled module name.
spec = importlib.util.spec_from_file_location("onto2d_packaged_transport", Path(__file__).with_name("ollivier_oracle.py"))
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
require, fields, integer = transport.require, transport.fields, transport.integer
SOLVER = {"id": "onto2d-python-flow-transport-reference", "version": "1", "method": "rational-cost-integer-mass-primal-dual-v1"}
MAX_BYTES = 1048576


def rational(value, positive=False):
    fields(value, ["numerator", "denominator"])
    n, d = value["numerator"], value["denominator"]
    require(type(n) is str and type(d) is str and len(n) <= 257 and len(d) <= 256, "Rational digit bound")
    require(re.fullmatch(r"0|-?[1-9][0-9]{0,255}", n) is not None, "Rational numerator")
    require(re.fullmatch(r"[1-9][0-9]{0,255}", d) is not None, "Rational denominator")
    result = Fraction(int(n), int(d))
    require(str(result.numerator) == n and str(result.denominator) == d, "Reduced rational required")
    require(not positive or result > 0, "Positive rational required")
    return result


def encode(value):
    result = Fraction(value)
    output = {"numerator": str(result.numerator), "denominator": str(result.denominator)}
    require(all(len(v.lstrip("-")) <= 256 for v in output.values()), "Output rational digit bound")
    return output


def content_hash(value, nullable=False):
    require((nullable and value is None) or (type(value) is str and len(value) == 71 and value.startswith("sha256:") and
            all(c in "0123456789abcdef" for c in value[7:])), "Content hash required")


def evaluate(request):
    fields(request, ["schemaVersion", "flowRequestHash", "iteration", "previousStateHash", "metricHash", "solver", "problems", "requestHash"])
    require(request["schemaVersion"] == "1" and request["solver"] == SOLVER, "Unsupported flow protocol")
    for key in ["flowRequestHash", "metricHash", "requestHash"]:
        content_hash(request[key])
    content_hash(request["previousStateHash"], nullable=True)
    integer(request["iteration"], 0, 24)
    problems = request["problems"]
    require(type(problems) is list and 1 <= len(problems) <= 64, "Flow edge bound")
    prepared, cells = [], 0
    for problem in problems:
        # The original validator checks the same integral marginals and graph
        # endpoint metadata. Cost/distance validation is replaced explicitly.
        neutral = dict(problem)
        rational(problem["distance"], positive=True)
        neutral["distance"] = 1
        require(type(problem["costs"]) is list and len(problem["costs"]) <= 16, "Cost rows")
        costs = []
        for row in problem["costs"]:
            require(type(row) is list and len(row) <= 16, "Cost columns")
            values = [rational(value) for value in row]
            require(all(value >= 0 for value in values), "Negative transport cost")
            costs.append(values)
        neutral["costs"] = [[0 for _ in row] for row in costs]
        cells += transport.validate_problem(neutral)
        require(cells <= 4096, "Flow transport cell bound")
        prepared.append({**problem, "costs": costs})
    require(len({p["edgeId"] for p in problems}) == len(problems), "Duplicate flow edges")
    solutions = []
    for problem in prepared:
        result = transport.solve(problem)
        solutions.append({**result,
                          "sourcePotentials": [encode(value) for value in result["sourcePotentials"]],
                          "targetPotentials": [encode(value) for value in result["targetPotentials"]],
                          "costNumerator": encode(result["costNumerator"])})
    return {"schemaVersion": "1", "solver": SOLVER, "requestHash": request["requestHash"], "solutions": solutions}


def main():
    require(len(sys.argv) == 1, "One JSON request is accepted on stdin")
    payload = sys.stdin.buffer.read(MAX_BYTES + 1)
    require(len(payload) <= MAX_BYTES, "Flow request byte bound")
    request = json.loads(payload.decode("utf-8"), object_pairs_hook=transport.unique_object,
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
    output = json.dumps(evaluate(request), ensure_ascii=True, separators=(",", ":")).encode("ascii") + b"\n"
    require(len(output) <= MAX_BYTES, "Flow response byte bound")
    sys.stdout.buffer.write(output)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, RecursionError) as error:
        print("Flow oracle rejected request: " + str(error), file=sys.stderr)
        sys.exit(1)
