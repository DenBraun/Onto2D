"""Independent D4 controls: Fraction path enumeration and pivoted joint ridge.

Uses only the Python standard library, never imports the JS implementation.
Biological input and detailed predictions stay in the ignored local cache.
"""
from fractions import Fraction
from itertools import combinations
import heapq
import json
import math
import sys


def sequential_sum(values):
    """Replay the declared binary64 left fold, independent of Python sum()."""
    total = 0.0
    for value in values:
        total += value
    return total


def rational(value):
    return Fraction(int(value["numerator"]), int(value["denominator"]))


def encode(value):
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def baselines(graph):
    nodes, edges = sorted(graph["nodes"]), {(e["source"], e["target"]) for e in graph["edges"]}
    n, m = len(nodes), len(edges)
    successors = {node: {v for u, v in edges if u == node} for node in nodes}
    predecessors = {node: {u for u, v in edges if v == node} for node in nodes}
    hop, weak = {}, {}
    for source in nodes:
        distances, frontier, depth = {source: 0}, {source}, 0
        while frontier:
            depth += 1
            frontier = {v for u in frontier for v in successors[u] if v not in distances}
            distances.update({node: depth for node in frontier})
        hop[source] = distances
        reached, frontier = {source}, {source}
        while frontier:
            frontier = {v for u in frontier for v in successors[u] | predecessors[u] if v not in reached}
            reached |= frontier
        weak[source] = reached
    transition = [[Fraction(1, len(successors[u])) if v in successors[u] else Fraction(0) for v in nodes] for u in nodes]
    powers = [transition]
    for _ in range(3):
        powers.append([[sum((powers[-1][i][k] * transition[k][j] for k in range(n)), Fraction(0))
                        for j in range(n)] for i in range(n)])
    result = {}
    for i, source in enumerate(nodes):
        for j, target in enumerate(nodes):
            if source == target:
                continue
            direct, reachable = (source, target) in edges, target in hop[source]
            two_step = len(successors[source] & predecessors[target])
            result[(source, target)] = [n, m, m / (n * (n - 1)), len(predecessors[source]), len(successors[source]),
                len(predecessors[target]), len(successors[target]), int(direct), int((target, source) in edges),
                sum((v, u) in edges for u, v in edges) / m if m else 0,
                int(target in weak[source]), int(reachable and source in hop[target]), int(reachable), hop[source].get(target, 0), int(not reachable),
                len(predecessors[source] & predecessors[target]), len(successors[source] & successors[target]),
                two_step, int(direct) * two_step, int(direct) * len(successors[target] & predecessors[source]),
                *[float(powers[k][i][j]) for k in [1, 2, 3]]]
    return result


def geometry(control):
    nodes, edges, fields = sorted(control["graph"]["nodes"]), control["graph"]["edges"], control["fields"]
    if len(nodes) > 10 or len(edges) > 64:
        raise ValueError("Independent path-enumeration control exceeds its bounded domain")
    outgoing = {node: [] for node in nodes}
    for i, edge in enumerate(edges):
        outgoing[edge["source"]].append((edge["target"], i))
    result, baseline = [], baselines(control["graph"])
    for source in nodes:
        weighted, queue = {source: Fraction(0)}, [(Fraction(0), source)]
        while queue:
            length, node = heapq.heappop(queue)
            if length != weighted[node]:
                continue
            for target, i in outgoing[node]:
                candidate = length + rational(fields[i]["length"])
                if target not in weighted or candidate < weighted[target]:
                    weighted[target] = candidate
                    heapq.heappush(queue, (candidate, target))
        for target in nodes:
            if target == source:
                continue
            # Breadth-first enumeration stops at the first complete path depth.
            frontier, paths = [(source, {source}, [])], []
            while frontier and not paths:
                following = []
                for node, visited, path in frontier:
                    for neighbor, i in outgoing[node]:
                        if neighbor in visited:
                            continue
                        if neighbor == target:
                            paths.append(path + [i])
                        else:
                            following.append((neighbor, visited | {neighbor}, path + [i]))
                frontier = following
            sets = [[i for i, e in enumerate(edges) if e["target"] == source],
                    [i for i, e in enumerate(edges) if e["source"] == source],
                    [i for i, e in enumerate(edges) if e["target"] == target],
                    [i for i, e in enumerate(edges) if e["source"] == target],
                    [i for i, e in enumerate(edges) if e == {"source": source, "target": target}],
                    sorted({i for path in paths for i in path})]
            values = [sum((rational(fields[i][field]) for i in indices), Fraction(0)) / len(indices)
                      if indices else Fraction(0)
                      for field in ["forman", "ollivier", "length", "curvature"] for indices in sets]
            stop = control["termination"]
            values += [weighted.get(target, Fraction(0)), Fraction(stop["iteration"])]
            values += [Fraction(stop["reason"] == reason) for reason in
                       ["fixed-point", "tolerance", "cycle", "degenerate-length", "iteration-limit"]]
            result.append({"source": source, "target": target, "baseline": baseline[(source, target)], "exact": list(map(encode, values)),
                           "geometry": list(map(float, values))})
    return result


def ranks(values):
    return [1 + sum(other < value for other in values) + (sum(other == value for other in values) - 1) / 2
            for value in values]


def skill(predicted, observed):
    numerator = denominator = 0
    for i, j in combinations(range(len(observed)), 2):
        if observed[i] == observed[j]:
            continue
        denominator += 1
        numerator += ((predicted[i] > predicted[j]) - (predicted[i] < predicted[j])) * \
                     ((observed[i] > observed[j]) - (observed[i] < observed[j]))
    if not denominator:
        raise ValueError("Constant truth is not an eligible intervention")
    return numerator / denominator


def group_skill(rows, predictions):
    values = []
    for intervention in sorted({row["interventionId"] for row in rows}):
        indices = [i for i, row in enumerate(rows) if row["interventionId"] == intervention]
        values.append(skill([predictions[i] for i in indices], [rows[i]["magnitude"] for i in indices]))
    return sequential_sum(values) / len(values)


def ridge(rows, columns, penalty):
    groups = {row["groupId"] for row in rows}
    interventions = {group: {row["interventionId"] for row in rows if row["groupId"] == group} for group in groups}
    counts = {intervention: sum(row["interventionId"] == intervention for row in rows)
              for group in groups for intervention in interventions[group]}
    weights = [1 / (len(groups) * len(interventions[row["groupId"]]) * counts[row["interventionId"]]) for row in rows]
    mass = math.fsum(weights)
    weights = [weight / mass for weight in weights]
    x = [[row["x"][j] for j in columns] for row in rows]
    width = len(columns)
    means = [math.fsum(w * row[j] for w, row in zip(weights, x)) for j in range(width)]
    scales = [math.sqrt(math.fsum(w * (row[j] - means[j]) ** 2 for w, row in zip(weights, x)))
              if any(row[j] != x[0][j] for row in x) else 0 for j in range(width)]
    design = [[1] + [(v - m) / s if s else 0 for v, m, s in zip(row, means, scales)] for row in x]
    # Joint intercept and coefficients; full pivoted Gauss-Jordan elimination.
    matrix = [[math.fsum(w * row[j] * row[k] for w, row in zip(weights, design))
               + (penalty if j == k and j else 0) for k in range(width + 1)] +
              [math.fsum(w * a[j] * row["y"] for w, a, row in zip(weights, design, rows))]
              for j in range(width + 1)]
    for j in range(width + 1):
        pivot = max(range(j, width + 1), key=lambda k: abs(matrix[k][j]))
        matrix[j], matrix[pivot] = matrix[pivot], matrix[j]
        divisor = matrix[j][j]
        matrix[j] = [value / divisor for value in matrix[j]]
        for k in range(width + 1):
            if k != j:
                multiple = matrix[k][j]
                matrix[k] = [a - multiple * b for a, b in zip(matrix[k], matrix[j])]
    parameters = [row[-1] for row in matrix]
    return {"means": means, "scales": scales, "intercept": parameters[0], "coefficients": parameters[1:]}


def close(actual, expected):
    if not math.isfinite(actual) or not math.isfinite(expected) or abs(actual - expected) > 2e-10 * max(1, abs(expected)):
        raise ValueError("Independent numerical reference differs: %r != %r" % (actual, expected))


def verify_study(data):
    descriptor_pairs, features = 0, {}
    for unit in data["geometry"]:
        expected = geometry(unit)
        actual = unit["geometry"]["pairs"]
        for left, right in zip(actual, expected):
            for key in ["source", "target", "baseline", "exact", "geometry"]:
                if left[key] != right[key]:
                    raise ValueError("Independent pair geometry differs: " + key)
            features[(unit["id"], right["source"], right["target"])] = right["baseline"] + right["geometry"]
        if len(actual) != len(expected):
            raise ValueError("Geometry population differs")
        descriptor_pairs += len(actual)
    columns = {"B": list(range(23)), "B+F": list(range(29)), "B+O": list(range(23)) + list(range(29, 35)),
               "B+flow": list(range(23)) + list(range(35, 54)), "B+F+O": list(range(35)), "B+F+O+flow": list(range(54))}
    units = {unit["id"]: unit for unit in data["units"]}
    fits = predictions_checked = 0
    for contrast, trace in data["traces"].items():
        rows = {row["id"]: row for row in trace["rows"]}
        groups = sorted({row["groupId"] for row in rows.values()})
        if len(rows) != 450 or len(groups) != 5:
            raise ValueError("DREAM4 population incomplete")
        for row in rows.values():
            unit = units[row["groupId"]]
            table, wt = unit["tables"][contrast], unit["tables"]["wildtype"]
            columns_native = table["columns"]
            source_index = columns_native.index(row["source"])
            targets = [gene for gene in columns_native if gene != row["source"]]
            magnitudes = [abs(table["values"][source_index][columns_native.index(gene)] -
                              wt["values"][0][wt["columns"].index(gene)]) for gene in targets]
            i = targets.index(row["target"])
            expected_id = json.dumps([unit["id"], contrast, row["source"], row["target"]], separators=(",", ":"))
            if row["id"] != expected_id or row["interventionId"] != unit["id"] + ":" + contrast + ":" + row["source"] or \
                    row["magnitude"] != magnitudes[i] or row["rank"] != ranks(magnitudes)[i] or row["y"] != (ranks(magnitudes)[i] - 1) / 8:
                raise ValueError("Independent source target join differs")
            if row["x"] != features[(unit["id"], row["source"], row["target"])]:
                raise ValueError("Independent source feature join differs")
        cache = {}
        for name, outer_results in trace["ablations"].items():
            if [result["heldOut"] for result in outer_results] != groups:
                raise ValueError("Outer groups differ")
            for outer in outer_results:
                scores = []
                for candidate in outer["candidates"]:
                    validation_scores = []
                    for validation in candidate["validation"]:
                        excluded = [outer["heldOut"], validation["validationGroup"]]
                        train = sorted((row for row in rows.values() if row["groupId"] not in excluded), key=lambda row: row["id"])
                        test = sorted((row for row in rows.values() if row["groupId"] == excluded[1]), key=lambda row: row["id"])
                        key = (name, tuple(sorted(excluded)), candidate["lambda"])
                        if key not in cache:
                            cache[key] = ridge(train, columns[name], candidate["lambda"])
                            fits += 1
                        predictions_checked += check_fit(validation, cache[key], test, columns[name])
                        value = group_skill(test, validation["predictions"])
                        close(value, validation["summary"]["meanRankSkill"])
                        validation_scores.append(value)
                    value = sequential_sum(validation_scores) / len(validation_scores)
                    close(value, candidate["meanRankSkill"])
                    scores.append((value, candidate["lambda"]))
                if max(scores)[1] != outer["lambda"]:
                    raise ValueError("Inner tuning differs")
                train = sorted((row for row in rows.values() if row["groupId"] != outer["heldOut"]), key=lambda row: row["id"])
                test = sorted((row for row in rows.values() if row["groupId"] == outer["heldOut"]), key=lambda row: row["id"])
                expected = ridge(train, columns[name], outer["lambda"])
                fits += 1
                predictions_checked += check_fit(outer, expected, test, columns[name])
                close(group_skill(test, outer["predictions"]), outer["summary"]["meanRankSkill"])
    return {"status": "verified", "method": "fraction-path-enumeration-and-joint-intercept-pivoted-gauss-jordan",
            "descriptorPairs": descriptor_pairs, "distinctReferenceFits": fits, "predictionsChecked": predictions_checked,
            "predictionTolerance": 2e-10, "scoreTies": "exact-stored-binary64-predictions-no-tolerance"}


def check_fit(actual, expected, test, columns):
    for key in ["means", "scales", "coefficients"]:
        if len(actual["model"][key]) != len(expected[key]):
            raise ValueError("Model width differs")
        for left, right in zip(actual["model"][key], expected[key]):
            close(left, right)
    close(actual["model"]["intercept"], expected["intercept"])
    if len(actual["predictions"]) != len(test):
        raise ValueError("Prediction population differs")
    for row, actual_value in zip(test, actual["predictions"]):
        value = expected["intercept"] + sum(((row["x"][column] - mean) / scale if scale else 0) * coefficient
                                            for column, mean, scale, coefficient in
                                            zip(columns, expected["means"], expected["scales"], expected["coefficients"]))
        close(actual_value, value)
    return len(test)


if __name__ == "__main__":
    value = json.load(sys.stdin)
    if sys.argv[1:] == ["--geometry"]:
        result = [geometry(control) for control in value]
    elif sys.argv[1:] == ["--study"]:
        result = verify_study(value)
    else:
        raise ValueError("Expected --geometry or --study")
    print(json.dumps(result, allow_nan=False))
