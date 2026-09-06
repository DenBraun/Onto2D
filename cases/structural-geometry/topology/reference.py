"""Independent Boolean Floyd–Warshall topology reference (Python stdlib only).

No production graph traversal, hashing or regime implementation is imported.
The earlier independent permutation reference supplies small-graph orbit keys.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CAUSAL = ROOT / "models/causal-emergence/releases/2026.08.15/bundle.json"
CANONICAL = HERE.parent / "canonical/reference.py"
spec = importlib.util.spec_from_file_location("independent_permutations", CANONICAL)
permutations = importlib.util.module_from_spec(spec)
spec.loader.exec_module(permutations)


def closure(n, edges, undirected=False):
    matrix = [[u == v for v in range(n)] for u in range(n)]
    for u, v in edges:
        matrix[u][v] = True
        if undirected:
            matrix[v][u] = True
    for k in range(n):
        for u in range(n):
            for v in range(n):
                matrix[u][v] = matrix[u][v] or (matrix[u][k] and matrix[k][v])
    return matrix


def measure(labels, records):
    # Match the declared source-ID ordering, including supplementary Unicode
    # characters whose UTF-16 order differs from Python's code-point order.
    labels = sorted(labels, key=lambda label: label.encode("utf-16-be"))
    index = {label: i for i, label in enumerate(labels)}
    edges = [(index[u], index[v]) for _, u, v in records]
    n = len(labels)
    assert 1 <= n <= 64 and len(edges) <= 256 and len(set(edges)) == len(edges)
    assert all(u != v for u, v in edges)
    directed, weak = closure(n, edges), closure(n, edges, True)

    def groups(matrix):
        remaining, result = set(range(n)), []
        while remaining:
            u = min(remaining)
            component = [v for v in range(n) if matrix[u][v] and matrix[v][u]]
            result.append([labels[v] for v in component])
            remaining.difference_update(component)
        return result

    weak_groups, strong_groups = groups(weak), groups(directed)
    degrees = [sum(u == i for u, _ in edges) + sum(v == i for _, v in edges) for i in range(n)]
    counts = [sum(row) - 1 for row in directed]
    value = {"nodeCount": n, "edgeCount": len(edges),
             "weakComponentSizes": sorted(map(len, weak_groups)),
             "strongComponentSizes": sorted(map(len, strong_groups)),
             "reachableOrderedPairCount": sum(counts),
             "cyclicNodeCount": sum(len(g) for g in strong_groups if len(g) > 1),
             "isolatedNodeCount": degrees.count(0)}
    # Analytic work totals for the declared production traversal, derived from
    # closure entries. These are not counters from running its BFS algorithm.
    scans = sum(sum(directed[source][u] for u, _ in edges) for source in range(n))
    diagnostics = {"weakComponents": weak_groups, "strongComponents": strong_groups,
                   "reachablePairsBySource": [{"sourceNodeId": label, "count": counts[i]} for i, label in enumerate(labels)],
                   "work": {"reachabilityPairVisits": sum(counts) + n, "reachabilityEdgeScans": scans}}
    return {"value": value, "diagnostics": diagnostics}


def source_graphs():
    document = json.loads((HERE / "controls.json").read_text(encoding="utf-8"))
    result = []
    for g in document["controls"]:
        labels = g.get("labels", ["n" + str(i) for i in range(g["nodes"])])
        result.append((g["id"], labels, [("e" + str(i), labels[u], labels[v]) for i, (u, v) in enumerate(g["edges"])]))
    pack = json.loads(CAUSAL.read_text(encoding="utf-8"))
    for scope in document["causalScopes"]:
        labels = scope["nodeIds"]
        assert set(labels) <= {n["id"] for n in pack["files"]["model/nodes.json"]}
        edges = [(e["id"], e["source"], e["target"]) for e in pack["files"]["model/edges.json"]
                 if e["source"] in labels and e["target"] in labels]
        result.append((scope["id"], labels, edges))
    return result


def expected():
    census = []
    for n in range(1, 5):
        slots = permutations.pairs(n)
        labels = ["n" + str(i) for i in range(n)]
        profiles, indices, canonical_keys, lookup = [], [], [], {}
        for mask in range(1 << len(slots)):
            edges = [edge for bit, edge in enumerate(slots) if mask & (1 << bit)]
            value = measure(labels, [(str(i), labels[u], labels[v]) for i, (u, v) in enumerate(edges)])["value"]
            encoded = json.dumps(value, sort_keys=True)
            if encoded not in lookup:
                lookup[encoded] = len(profiles)
                profiles.append(value)
            indices.append(lookup[encoded])
            canonical_keys.append(permutations.key(n, edges))
        census.append({"nodes": n, "labelledGraphs": len(indices), "profiles": profiles,
                       "profileIndices": indices, "canonicalKeys": canonical_keys})
    controls = [{"id": name, **measure(labels, records)} for name, labels, records in source_graphs()]
    return {"schemaVersion": "1", "method": "boolean-floyd-warshall-and-independent-permutation-orbits",
            "controlsFileSha256": hashlib.sha256((HERE / "controls.json").read_bytes()).hexdigest(),
            "causalFileSha256": hashlib.sha256(CAUSAL.read_bytes()).hexdigest(),
            "canonicalReferenceFileSha256": hashlib.sha256(CANONICAL.read_bytes()).hexdigest(),
            "census": census, "controls": controls}


def verify_artifacts():
    sources = source_graphs()
    for name, labels, records in sources:
        artifact = json.loads((HERE / "artifacts" / (name + ".json")).read_text(encoding="utf-8"))
        result = measure(labels, records)
        assert artifact["observation"]["value"] == result["value"], name
        assert artifact["diagnostics"] == result["diagnostics"], name
    print("Independent matrix replay passed: {} values, component memberships and work totals.".format(len(sources)))


def main():
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        action.add_argument(option, action="store_true")
    args = parser.parse_args()
    if args.verify_artifacts:
        verify_artifacts()
        return
    value = expected()
    text = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    path = HERE / "reference.json"
    if args.write:
        with path.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
    else:
        assert path.read_text(encoding="utf-8") == text, "Frozen independent topology reference differs."
    print("Independent topology reference {}: 4165 small graphs, {} controls.".format(
        "written" if args.write else "verified", len(value["controls"])))


if __name__ == "__main__":
    main()
