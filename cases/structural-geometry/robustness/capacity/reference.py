"""Independent D6.3 graph features, feature joins and grouped ridge reference."""
from fractions import Fraction
from itertools import combinations
import importlib.util
import json
from pathlib import Path
try:
    import resource
except ImportError:  # Peak RSS is unavailable on Windows; this is not a zero.
    resource = None
import sys
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("d5_reference", HERE.parent.parent / "celegans" / "reference.py")
d5 = importlib.util.module_from_spec(spec); spec.loader.exec_module(d5)
d4, require = d5.d4, d5.require
PROFILE = json.loads((HERE / "profile.json").read_text())
B, Q, S, G = list(range(23)), list(range(23, 54)), list(range(54, 85)), list(range(85, 116))
COLUMNS = {"B": B, "B+G": B + G, "B+Q": B + Q, "B+S": B + S, "B+Q+G": B + Q + G, "B+S+G": B + S + G}
BASELINE_NAMES = ["node_count", "edge_count", "directed_density", "source_in_degree", "source_out_degree", "target_in_degree", "target_out_degree", "direct_edge", "reverse_edge", "global_reciprocity", "same_weak_component", "same_strong_component", "reachable", "directed_distance", "unreachable", "common_predecessors", "common_successors", "two_step_path_count", "feed_forward_shortcut_count", "directed_triangle_closure_count", "propagation_step_2", "propagation_step_3", "propagation_step_4"]


def features(graph):
    nodes, edges = sorted(graph["nodes"]), graph["edges"]
    n, infinity = len(nodes), len(nodes) + 1
    require(0 < n <= 64 and len(edges) <= 64, "Independent graph bound exceeded")
    positions = {node: i for i, node in enumerate(nodes)}
    arcs = {(positions[edge["source"]], positions[edge["target"]]) for edge in edges}
    require(len(arcs) == len(edges) and all(u != v for u, v in arcs), "Independent graph must be simple and loopless")
    incoming = [{u for u, v in arcs if v == node} for node in range(n)]
    outgoing = [{v for u, v in arcs if u == node} for node in range(n)]
    distances = [[0 if u == v else 1 if (u, v) in arcs else infinity for v in range(n)] for u in range(n)]
    for k in range(n):
        for u in range(n):
            for v in range(n):
                distances[u][v] = min(distances[u][v], distances[u][k] + distances[k][v])
    counts = []
    for u in range(n):
        count = [0] * n; count[u] = 1
        for v in sorted(range(n), key=lambda v: (distances[u][v], v)):
            if 0 < distances[u][v] < infinity:
                count[v] = sum(count[p] for p in incoming[v] if distances[u][p] == distances[u][v] - 1)
        counts.append(count)

    def union(u, v):
        selected, visited, pending = set(), set(), [v] if distances[u][v] < infinity else []
        while pending:
            node = pending.pop()
            if node in visited:
                continue
            visited.add(node)
            for predecessor in incoming[node]:
                if distances[u][predecessor] + 1 == distances[u][node]:
                    selected.add((predecessor, node)); pending.append(predecessor)
        return len(selected)

    def ratio(a, b):
        return Fraction(a, b) if b else Fraction(0)

    transition = [[ratio(int((u, v) in arcs), len(outgoing[u])) for v in range(n)] for u in range(n)]
    matrix, walks = [[Fraction(int(u == v)) for v in range(n)] for u in range(n)], []
    for _ in range(8):
        matrix = [[sum((matrix[u][k] * transition[k][v] for k in range(n) if matrix[u][k] and transition[k][v]), Fraction(0))
                   for v in range(n)] for u in range(n)]
        walks.append(matrix)
    baseline, pairs = d4.baselines(graph), []
    for u in range(n):
        for v in range(n):
            if u == v:
                continue
            reverse = distances[v][u]
            values = [Fraction(reverse if reverse < infinity else 0), Fraction(reverse == infinity), Fraction(counts[u][v]),
                      Fraction(union(u, v)), Fraction(counts[v][u]), Fraction(union(v, u))]
            for endpoint in [u, v]:
                for reverse_axis in [False, True]:
                    ds = [distances[other][endpoint] if reverse_axis else distances[endpoint][other] for other in range(n)]
                    values.append(sum((Fraction(1, d) for d in ds if 0 < d < infinity), Fraction(0)) / (n - 1) if n > 1 else Fraction(0))
            for endpoint in [u, v]:
                for neighbors in [incoming[endpoint], outgoing[endpoint]]:
                    for adjacency in [incoming, outgoing]:
                        values.append(ratio(sum(len(adjacency[w]) for w in neighbors), len(neighbors)))
            for endpoint in [u, v]:
                shared = len(incoming[endpoint] & outgoing[endpoint])
                values += [ratio(shared, len(incoming[endpoint])), ratio(shared, len(outgoing[endpoint]))]
            values += [walks[k][u][v] for k in [4, 5, 6, 7]] + [walks[k][v][u] for k in [1, 2, 3]]
            values += [ratio(len(a[u] & a[v]), len(a[u] | a[v])) for a in [incoming, outgoing]]
            require(len(values) == 31, "Expanded feature count differs")
            b = baseline[(nodes[u], nodes[v])]
            by_name = dict(zip(BASELINE_NAMES, b))
            q = [by_name[name] * by_name[name] for name in PROFILE["quadraticSquares"]]
            q += [by_name[a] * by_name[c] for a, c in PROFILE["quadraticProducts"]]
            pairs.append({"source": nodes[u], "target": nodes[v], "baseline": b, "quadratic": q,
                          "expanded": [float(value.numerator) / float(value.denominator) for value in values],
                          "exact": list(map(d4.encode, values))})
    return {"profileId": PROFILE["id"], "pairs": pairs}

def models(trace):
    rows, cache, fits, predictions = trace["rows"], {}, 0, 0
    groups = sorted({row["groupId"] for row in rows})
    require(5 <= len(groups) <= 29 and len(rows) <= 4096, "Independent model population exceeds bounds")
    require(list(trace["ablations"]) == list(COLUMNS), "Independent ablation population differs")
    for name, results in trace["ablations"].items():
        require([row["heldOut"] for row in results] == groups, "Outer source groups differ")
        for result in results:
            candidates = []
            require([row["lambda"] for row in result["candidates"]] == [0.01, 0.1, 1, 10, 100], "Tuning grid differs")
            for candidate in result["candidates"]:
                require([row["validationGroup"] for row in candidate["validation"]] == [g for g in groups if g != result["heldOut"]], "Inner source groups differ")
                values = []
                for inner in candidate["validation"]:
                    excluded = [result["heldOut"], inner["validationGroup"]]
                    train = sorted((row for row in rows if row["groupId"] not in excluded), key=lambda row: row["id"])
                    test = sorted((row for row in rows if row["groupId"] == inner["validationGroup"]), key=lambda row: row["id"])
                    key = (name, tuple(sorted(excluded)), candidate["lambda"])
                    if key not in cache:
                        cache[key] = d4.ridge(train, COLUMNS[name], candidate["lambda"]); fits += 1
                    predictions += d4.check_fit(inner, cache[key], test, COLUMNS[name])
                    value = d4.group_skill(test, inner["predictions"]); values.append(value)
                    require(value == inner["summary"]["meanRankSkill"], "Inner score differs")
                value = d4.sequential_sum(values) / len(values)
                require(value == candidate["meanRankSkill"], "Inner group averaging differs")
                candidates.append((value, candidate["lambda"]))
            require(max(candidates)[1] == result["lambda"], "Selected penalty differs")
            train = sorted((row for row in rows if row["groupId"] != result["heldOut"]), key=lambda row: row["id"])
            test = sorted((row for row in rows if row["groupId"] == result["heldOut"]), key=lambda row: row["id"])
            reference = d4.ridge(train, COLUMNS[name], result["lambda"]); fits += 1
            predictions += d4.check_fit(result, reference, test, COLUMNS[name])
            require(d4.group_skill(test, result["predictions"]) == result["summary"]["meanRankSkill"], "Held-out source score differs")
    return {"distinctReferenceFits": fits, "predictionsChecked": predictions}


def comparisons(study):
    trace = study["trace"]
    rows, scores = trace["rows"], {}
    groups = sorted({row["groupId"] for row in rows})
    require(5 <= len(groups) <= 29 and len(rows) <= 4096, "Exact comparison population exceeds bounds")
    require(list(trace["ablations"]) == list(COLUMNS), "Exact comparison model population differs")
    for name, results in trace["ablations"].items():
        require([result["heldOut"] for result in results] == groups, "Exact comparison groups differ")
        scores[name] = []
        for result in results:
            test = sorted((row for row in rows if row["groupId"] == result["heldOut"]), key=lambda row: row["id"])
            predicted, values = result["predictions"], []
            require(len(predicted) == len(test), "Exact comparison prediction count differs")
            for intervention in sorted({row["interventionId"] for row in test}):
                indices = [i for i, row in enumerate(test) if row["interventionId"] == intervention]
                numerator = denominator = 0
                for i, j in combinations(indices, 2):
                    a, b = test[i]["magnitude"], test[j]["magnitude"]
                    if a != b:
                        denominator += 1
                        numerator += ((predicted[i] > predicted[j]) - (predicted[i] < predicted[j])) * ((a > b) - (a < b))
                require(denominator > 0, "Exact comparison has an ineligible intervention")
                values.append(Fraction(numerator, denominator))
            scores[name].append(sum(values, Fraction(0)) / len(values))
    require([[row["left"], row["right"]] for row in study["comparisons"]] == PROFILE["comparisons"], "Exact comparison census differs")
    for row in study["comparisons"]:
        deltas = [a - b for a, b in zip(scores[row["left"]], scores[row["right"]])]
        exact = sum(deltas, Fraction(0)) / len(deltas)
        require([group["id"] for group in row["groups"]] == groups, "Exact difference group order differs")
        require([group["exactDelta"] for group in row["groups"]] == list(map(d4.encode, deltas)), "Exact group differences differ")
        require(row["exactMeanDelta"] == d4.encode(exact), "Exact aggregate difference differs")
        expected = "limited-fixed-representation-gain" if exact > 0 else "no-observed-gain-for-this-pipeline"
        require(row["interpretation"] == expected, "Exact difference interpretation differs")
    return len(study["comparisons"])


def verify(value):
    require(len(value["scopes"]) == 34 and len({s["id"] for s in value["scopes"]}) == 34, "Source scope census differs")
    lookup, pair_count = {}, 0
    for scope in value["scopes"]:
        expanded = features(scope["graph"])
        require(expanded == scope["features"], "Independent graph capacity features differ")
        g = scope["geometry"]
        require(d5.geometry({"graph": scope["graph"], "fields": g["fields"], "termination": g["termination"]}) == g["pairs"], "Independent reused geometry differs")
        require(len(expanded["pairs"]) == len(g["pairs"]), "Feature pair populations differ")
        pair_count += len(expanded["pairs"])
        for pair, geometric in zip(expanded["pairs"], g["pairs"]):
            require((pair["source"], pair["target"], pair["baseline"]) == (geometric["source"], geometric["target"], geometric["baseline"]), "Pair feature identities differ")
            lookup[(scope["id"], pair["source"], pair["target"])] = pair["baseline"] + pair["quadratic"] + pair["expanded"] + geometric["geometry"]
    require([study["id"] for study in value["studies"]] == PROFILE["studies"], "Study census differs")
    fitting, exact_comparisons = [], 0
    for study in value["studies"]:
        rows = study["trace"]["rows"]
        require(len(rows) == len(study["originalRows"]), "Target count differs")
        for row, original in zip(rows, study["originalRows"]):
            require({k: v for k, v in row.items() if k != "x"} == {k: v for k, v in original.items() if k != "x"}, "Frozen target/group/rank changed")
            scope = [row["groupId"], None] if study["id"].startswith("dream4-") else ["Dataset7", row["source"]]
            expected = lookup[(d5.compact(scope), row["source"], row["target"])]
            require(row["x"] == expected and original["x"] == expected[:23] + expected[85:], "Scoped graph/geometry join differs")
        fitting.append({"id": study["id"], **models(study["trace"])})
        exact_comparisons += comparisons(study)
    return {"status": "verified", "method": "independent-floyd-warshall-predecessor-paths-fraction-matrix-walks-joint-ridge",
            "scopeCount": len(value["scopes"]), "descriptorPairs": pair_count, "expandedExactCoordinates": pair_count * 31,
            "exactComparisonsChecked": exact_comparisons, "fitting": fitting, "numericTolerance": 2e-10, "rankTies": "exact-binary64-no-tolerance"}


if __name__ == "__main__":
    start = time.monotonic()
    encoded = sys.stdin.buffer.read(192000001)
    require(len(encoded) <= 192000000, "Independent capacity input exceeds byte bound")
    value = json.loads(encoded)
    if sys.argv[1:] == ["--features"]:
        require(len(value) <= 128, "Independent control batch exceeds bound")
        print(json.dumps([features(graph) for graph in value], allow_nan=False))
    elif sys.argv[1:] == ["--models"]:
        print(json.dumps(models(value), allow_nan=False))
    elif sys.argv[1:] == ["--comparisons"]:
        print(json.dumps(comparisons(value), allow_nan=False))
    elif sys.argv[1:] == ["--study"]:
        result = verify(value)
        peak = None if resource is None else resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
        print(json.dumps({"result": result, "costs": {"elapsedMs": (time.monotonic() - start) * 1000, "pythonPeakRssReason": "resource-module-unavailable" if resource is None else None,
          "pythonPeakRssBytes": peak}}, allow_nan=False))
    else:
        raise ValueError("Expected --features, --models, --comparisons or --study")
