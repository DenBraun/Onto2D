#!/usr/bin/env python3
"""Bounded exact transport oracle. Python 3.9+, standard library only.

Successive shortest augmenting paths solve the integer transportation problem.
Residual difference constraints produce a dual witness. The JS consumer checks
mass conservation, dual feasibility and equality of both objectives itself.
"""
import json
import sys

SOLVER = {
    "id": "onto2d-python-ollivier-reference", "version": "1",
    "method": "integer-successive-shortest-path-primal-dual-v1",
}
MAX_BYTES = 1048576


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fields(value, keys):
    require(type(value) is dict and set(value) == set(keys), "Unexpected object fields")


def integer(value, minimum, maximum):
    require(type(value) is int and minimum <= value <= maximum, "Integer out of bounds")
    return value


def validate_problem(problem):
    fields(problem, ["edgeId", "source", "target", "distance", "massDenominator",
                     "sourceMeasure", "targetMeasure", "costs"])
    require(all(type(problem[k]) is str and 0 < len(problem[k]) <= 1024
                for k in ["edgeId", "source", "target"]), "Invalid IDs")
    require(problem["source"] != problem["target"], "Self loop")
    integer(problem["distance"], 1, 1)
    denominator = integer(problem["massDenominator"], 1, 512)
    for key in ["sourceMeasure", "targetMeasure"]:
        entries = problem[key]
        require(type(entries) is list and 1 <= len(entries) <= 16, "Support size bound")
        for entry in entries:
            fields(entry, ["nodeId", "units"])
            require(type(entry["nodeId"]) is str and 0 < len(entry["nodeId"]) <= 1024, "Invalid support ID")
            integer(entry["units"], 1, denominator)
        require(len({entry["nodeId"] for entry in entries}) == len(entries), "Duplicate support")
        require(sum(entry["units"] for entry in entries) == denominator, "Unbalanced mass")
    m, n = len(problem["sourceMeasure"]), len(problem["targetMeasure"])
    costs = problem["costs"]
    require(type(costs) is list and len(costs) == m, "Cost rows")
    for row in costs:
        require(type(row) is list and len(row) == n, "Cost columns")
        for cost in row:
            integer(cost, 0, 3)
    return m * n


def solve(problem):
    supply = [entry["units"] for entry in problem["sourceMeasure"]]
    demand = [entry["units"] for entry in problem["targetMeasure"]]
    costs = problem["costs"]
    m, n = len(supply), len(demand)
    total = problem["massDenominator"]
    source, sink, size = m + n, m + n + 1, m + n + 2
    residual = [[] for _ in range(size)]

    def arc(u, v, capacity, cost):
        forward = [v, len(residual[v]), capacity, cost]
        reverse = [u, len(residual[u]), 0, -cost]
        residual[u].append(forward)
        residual[v].append(reverse)
        return forward

    for i, capacity in enumerate(supply):
        arc(source, i, capacity, 0)
    for j, capacity in enumerate(demand):
        arc(m + j, sink, capacity, 0)
    cells = [[arc(i, m + j, total + 1, costs[i][j]) for j in range(n)] for i in range(m)]
    sent = 0
    # Every augmentation sends at least one integer unit, bounding iterations.
    for _ in range(total):
        if sent == total:
            break
        distance, previous = [None] * size, [None] * size
        distance[source] = 0
        for _ in range(size - 1):
            changed = False
            for u in range(size):
                if distance[u] is None:
                    continue
                for index, (v, _, capacity, cost) in enumerate(residual[u]):
                    if capacity and (distance[v] is None or distance[v] > distance[u] + cost):
                        distance[v] = distance[u] + cost
                        previous[v] = (u, index)
                        changed = True
            if not changed:
                break
        require(previous[sink] is not None, "No feasible transport")
        amount, cursor, path = total - sent, sink, []
        while cursor != source:
            require(len(path) < size and previous[cursor] is not None, "Invalid augmenting path")
            u, index = previous[cursor]
            path.append((u, index))
            amount = min(amount, residual[u][index][2])
            cursor = u
        for u, index in path:
            edge = residual[u][index]
            edge[2] -= amount
            residual[edge[0]][edge[1]][2] += amount
        sent += amount
    require(sent == total, "Augmentation limit")
    flow = [[total + 1 - cells[i][j][2] for j in range(n)] for i in range(m)]

    # A super-source with zero arcs to every transport vertex fixes a deterministic
    # feasible potential. Positive primal cells impose equality in the dual.
    potential = [0] * (m + n)
    for iteration in range(m + n):
        changed = False
        for i in range(m):
            for j in range(n):
                cost = costs[i][j]
                if potential[m + j] > potential[i] + cost:
                    potential[m + j] = potential[i] + cost
                    changed = True
                if flow[i][j] and potential[i] > potential[m + j] - cost:
                    potential[i] = potential[m + j] - cost
                    changed = True
        if not changed:
            break
        require(iteration < m + n - 1, "Negative residual cycle")
    a, b = [-v for v in potential[:m]], potential[m:]
    primal = sum(flow[i][j] * costs[i][j] for i in range(m) for j in range(n))
    dual = sum(a[i] * supply[i] for i in range(m)) + sum(b[j] * demand[j] for j in range(n))
    require(primal == dual, "Primal/dual mismatch")
    return {"edgeId": problem["edgeId"], "flow": flow, "sourcePotentials": a,
            "targetPotentials": b, "costNumerator": primal}


def evaluate(request):
    fields(request, ["schemaVersion", "analysis", "model", "sourceProjectionHash", "projectionHash",
                     "scope", "graph", "policy", "policyHash", "parameters", "solver", "problems", "requestHash"])
    require(request["schemaVersion"] == "1" and request["solver"] == SOLVER, "Unsupported protocol")
    binding = request["requestHash"]
    require(type(binding) is str and len(binding) == 71 and binding.startswith("sha256:") and
            all(c in "0123456789abcdef" for c in binding[7:]), "Invalid request binding")
    problems = request["problems"]
    require(type(problems) is list and 1 <= len(problems) <= 32, "Problem count bound")
    require(sum(validate_problem(p) for p in problems) <= 4096, "Total cell bound")
    require(len({p["edgeId"] for p in problems}) == len(problems), "Duplicate edge IDs")
    return {"schemaVersion": "1", "requestHash": binding, "solver": SOLVER,
            "solutions": [solve(p) for p in problems]}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON property")
        result[key] = value
    return result


def main():
    require(len(sys.argv) == 1, "The oracle accepts one JSON request on stdin")
    payload = sys.stdin.buffer.read(MAX_BYTES + 1)
    require(len(payload) <= MAX_BYTES, "Request byte bound")
    request = json.loads(payload.decode("utf-8"), object_pairs_hook=unique_object,
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
    output = json.dumps(evaluate(request), ensure_ascii=True, separators=(",", ":")).encode("ascii")
    require(len(output) <= MAX_BYTES, "Response byte bound")
    sys.stdout.buffer.write(output + b"\n")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, RecursionError) as error:
        print("Ollivier oracle rejected request: " + str(error), file=sys.stderr)
        sys.exit(1)
