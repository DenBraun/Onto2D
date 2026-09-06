#!/usr/bin/env python3
"""Independent gate: NetworkX graph distances + network simplex, no oracle imports.

Reconstructs distributions and directed costs from the scoped graph rather than
trusting the request's transport matrix. Only optimal values are compared;
different algorithms may legitimately return different optimal plans.
"""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import sys

import networkx as nx

HERE = Path(__file__).resolve().parent


def ordered(values):
    return sorted(values, key=lambda value: value.encode("utf-16-be"))


def rational(value):
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def measure(graph, node, incoming, half):
    neighbors = ordered(graph.predecessors(node) if incoming else graph.successors(node))
    if not neighbors:
        return {node: Fraction(1)}
    result = {v: Fraction(1, len(neighbors) * (2 if half else 1)) for v in neighbors}
    if half:
        result[node] = Fraction(1, 2)
    return result


def evaluate(request):
    graph = nx.DiGraph()
    graph.add_nodes_from(n["id"] for n in request["graph"]["nodes"])
    graph.add_edges_from((e["source"], e["target"]) for e in request["graph"]["edges"])
    output = []
    for problem in request["problems"]:
        half = request["parameters"]["idleness"] == "half"
        left = measure(graph, problem["source"], True, half)
        right = measure(graph, problem["target"], False, half)
        denominator = problem["massDenominator"]
        for data, key in [(left, "sourceMeasure"), (right, "targetMeasure")]:
            rebuilt = [{"nodeId": node, "units": int(data[node] * denominator)} for node in ordered(data)]
            assert all((mass * denominator).denominator == 1 for mass in data.values())
            assert rebuilt == problem[key], "Independent neighborhood construction differs"
        costs = [[nx.shortest_path_length(graph, a, b) for b in ordered(right)] for a in ordered(left)]
        assert costs == problem["costs"], "Independent directed distances differ"
        distance = nx.shortest_path_length(graph, problem["source"], problem["target"])
        assert distance == problem["distance"] == 1
        transport = nx.DiGraph()
        for node, mass in left.items():
            transport.add_node(("from", node), demand=-int(mass * denominator))
        for node, mass in right.items():
            transport.add_node(("to", node), demand=int(mass * denominator))
        for a in left:
            for b in right:
                transport.add_edge(("from", a), ("to", b), weight=nx.shortest_path_length(graph, a, b))
        optimum, _ = nx.network_simplex(transport)
        value = Fraction(optimum, denominator)
        output.append({"id": problem["edgeId"], "wasserstein": rational(value), "curvature": rational(1 - value / distance)})
    return {"requestHash": request["requestHash"], "edges": output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    assert nx.__version__ == "3.2.1", "Install the pinned reference requirements"
    algorithm_file = Path(nx.__file__).parent / "algorithms" / "flow" / "networksimplex.py"
    identity = {"package": "networkx", "version": nx.__version__, "algorithm": "network_simplex",
                "algorithmSourceSha256": hashlib.sha256(algorithm_file.read_bytes()).hexdigest(),
                "sourceUrl": "https://github.com/networkx/networkx/blob/networkx-3.2.1/networkx/algorithms/flow/networksimplex.py",
                "numeric": "integer-demands-and-costs-exact-rational-output"}
    suite = json.loads((HERE / "suite.json").read_text(encoding="utf-8"))
    results = []
    for run in suite["runs"]:
        artifact = json.loads((HERE / run["file"]).read_text(encoding="utf-8"))
        independent = evaluate(artifact["request"])
        actual = [{key: edge[key] for key in ["id", "wasserstein", "curvature"]} for edge in artifact["result"]["edges"]]
        assert independent["edges"] == actual, "NetworkX disagreement: " + run["id"]
        assert independent["requestHash"] == run["requestHash"], "Suite binding differs"
        results.append({"id": run["id"], **independent})
    data = {"schemaVersion": "1", "reference": identity, "cases": results}
    payload = json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    target = HERE / "networkx-expected.json"
    if args.write:
        target.write_text(payload, encoding="utf-8")
    else:
        assert target.read_text(encoding="utf-8") == payload, "Frozen independent reference differs"
    print("Independent NetworkX reference " + ("written" if args.write else "verified") + ": " + str(len(results)) + " runs")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ValueError, nx.NetworkXException) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
