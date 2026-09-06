#!/usr/bin/env python3
"""Independent full flow replay: Dijkstra + integer network simplex + Fractions.

Rebuilds every metric, distribution, update, stopping decision and final cut
from the frozen graph and initial parameters. No runtime implementation imports.
"""
import argparse
from fractions import Fraction as F
import hashlib
import json
from math import lcm
from pathlib import Path
import networkx as nx
from paper_reference import check_paper

HERE = Path(__file__).resolve().parent
order_key = lambda s: s.encode("utf-16-be")
ordered = lambda values: sorted(values, key=order_key)
decode = lambda v: F(int(v["numerator"]), int(v["denominator"]))
encode = lambda v: {"numerator": str(v.numerator), "denominator": str(v.denominator)}


def graph_for(data, lengths):
    graph = nx.DiGraph()
    graph.add_nodes_from(n["id"] for n in data["nodes"])
    for edge, length in zip(data["edges"], lengths):
        graph.add_edge(edge["source"], edge["target"], weight=length)
    return graph


def normalize(data, raw):
    graph = graph_for(data, raw)
    closed = [nx.dijkstra_path_length(graph, e["source"], e["target"]) for e in data["edges"]]
    factor = F(len(raw)) / sum(closed)
    return [v * factor for v in closed], {"rawSum": encode(sum(raw)), "closureSum": encode(sum(closed)),
        "factor": encode(factor), "shortenedEdgeIds": [e["id"] for e, a, b in zip(data["edges"], raw, closed) if b < a]}


def measure(graph, endpoint, incoming, half):
    neighbors = ordered(graph.predecessors(endpoint) if incoming else graph.successors(endpoint))
    if not neighbors:
        return {endpoint: F(1)}
    result = {n: F(1, len(neighbors) * (2 if half else 1)) for n in neighbors}
    if half:
        result[endpoint] = F(1, 2)
    return result


def solve(graph, edge, half):
    left = measure(graph, edge["source"], True, half)
    right = measure(graph, edge["target"], False, half)
    denominator = lcm(*(v.denominator for v in [*left.values(), *right.values()]))
    costs = {(a, b): nx.dijkstra_path_length(graph, a, b) for a in left for b in right}
    scale = lcm(*(v.denominator for v in costs.values()))
    transport = nx.DiGraph()
    for node, mass in left.items():
        transport.add_node(("from", node), demand=-int(mass * denominator))
    for node, mass in right.items():
        transport.add_node(("to", node), demand=int(mass * denominator))
    for (a, b), cost in costs.items():
        transport.add_edge(("from", a), ("to", b), weight=int(cost * scale))
    optimum, _ = nx.network_simplex(transport)
    return F(optimum, scale * denominator)


def evaluate(artifact):
    request = artifact["request"]; data = request["graph"]; params = request["parameters"]
    lengths, normalization = normalize(data, [decode(v["length"]) for v in params["initialLengths"]])
    previous = None; seen = {}; stable = 0; states = []
    tolerance = decode(params["tolerance"]); step = F(1, 2) if params["step"] == "half" else F(1)
    for iteration in range(params["maxIterations"] + 1):
        graph = graph_for(data, lengths)
        values = [solve(graph, e, params["idleness"] == "half") for e in data["edges"]]
        curvatures = [1 - w / length for w, length in zip(values, lengths)]
        max_length = max(abs(a - b) for a, b in zip(lengths, previous[0])) if previous else None
        max_curvature = max(abs(a - b) for a, b in zip(curvatures, previous[1])) if previous else None
        stable = stable + 1 if previous and max_length <= tolerance and max_curvature <= tolerance else 0
        state = {"iteration": iteration, "edges": [{"id": e["id"], "length": encode(length), "wasserstein": encode(w), "curvature": encode(k)}
            for e, length, w, k in zip(data["edges"], lengths, values, curvatures)]}
        actual = artifact["states"][iteration]
        assert actual["normalization"] == normalization, "Metric closure or normalization differs"
        assert actual["summary"] == {"lengthSum": encode(sum(lengths)), "minimumLength": encode(min(lengths)), "maximumLength": encode(max(lengths)),
            "minimumCurvature": encode(min(curvatures)), "maximumCurvature": encode(max(curvatures)), "curvatureSum": encode(sum(curvatures)),
            "signs": {"negative": sum(k < 0 for k in curvatures), "zero": sum(k == 0 for k in curvatures), "positive": sum(k > 0 for k in curvatures)},
            "maximumLengthEdgeIds": [e["id"] for e, length in zip(data["edges"], lengths) if length == max(lengths)],
            "maxLengthChange": encode(max_length) if previous else None, "maxCurvatureChange": encode(max_curvature) if previous else None,
            "stableStepCount": stable}, "Convergence summary differs"
        assert state == {"iteration": actual["iteration"], "edges": actual["edges"]}, "Network simplex flow differs"
        states.append(state)
        termination = {"reason": None, "iteration": iteration, "cycleStart": None, "cyclePeriod": None, "edgeIds": []}
        raw = [(1 - step) * length + step * w for length, w in zip(lengths, values)]
        if previous and lengths == previous[0]:
            termination["reason"] = "fixed-point"
        elif tuple(lengths) in seen:
            termination.update(reason="cycle", cycleStart=seen[tuple(lengths)], cyclePeriod=iteration - seen[tuple(lengths)])
        elif stable >= params["stableSteps"]:
            termination["reason"] = "tolerance"
        elif iteration == params["maxIterations"]:
            termination["reason"] = "iteration-limit"
        elif any(v <= 0 for v in raw):
            termination.update(reason="degenerate-length", edgeIds=[e["id"] for e, value in zip(data["edges"], raw) if value <= 0])
        if termination["reason"]:
            break
        seen[tuple(lengths)] = iteration; previous = (lengths, curvatures)
        lengths, normalization = normalize(data, raw)
    assert len(states) == len(artifact["states"]) and termination == artifact["termination"]
    cut = params["cut"]
    removed = [e for e, length in zip(data["edges"], lengths) if cut["kind"] != "none" and length > decode(cut["threshold"])]
    graph.remove_edges_from((e["source"], e["target"]) for e in removed)
    groups = lambda fn: sorted([ordered(g) for g in fn(graph)], key=lambda g: order_key(g[0]))
    weak, strong = groups(nx.weakly_connected_components), groups(nx.strongly_connected_components)
    cuts = {"policy": cut, "iteration": iteration, "removedEdgeIds": [e["id"] for e in removed],
        "weakComponents": weak, "strongComponents": strong, "connectivity": {"weakComponentCount": len(weak), "strongComponentCount": len(strong),
        "cyclicNodeCount": sum(len(g) for g in strong if len(g) > 1), "isolatedNodeCount": len(list(nx.isolates(graph)))}}
    assert cuts == artifact["cuts"], "Final threshold cut differs"
    return {"requestHash": request["requestHash"], "states": states, "termination": termination, "cuts": cuts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--verify", action="store_true"); modes.add_argument("--write", action="store_true")
    args = parser.parse_args()
    assert nx.__version__ == "3.2.1", "Install the pinned reference requirements"
    algorithm = Path(nx.__file__).parent / "algorithms/flow/networksimplex.py"
    identity = {"package": "networkx", "version": nx.__version__, "algorithm": "network_simplex",
        "algorithmSourceSha256": hashlib.sha256(algorithm.read_bytes()).hexdigest(),
        "sourceUrl": "https://github.com/networkx/networkx/blob/networkx-3.2.1/networkx/algorithms/flow/networksimplex.py",
        "numeric": "integer-scaled-rational-costs-and-demands-exact-output", "distance": "dijkstra_path_length"}
    cases = []
    for run in json.loads((HERE / "suite.json").read_text(encoding="utf-8"))["runs"]:
        artifact = json.loads((HERE / run["file"]).read_text(encoding="utf-8"))
        assert artifact["request"]["requestHash"] == run["requestHash"]
        if run["id"] == "paper-g3-2":
            check_paper(artifact)
        cases.append({"id": run["id"], **evaluate(artifact)})
    payload = json.dumps({"schemaVersion": "1", "reference": identity, "cases": cases}, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    target = HERE / "networkx-expected.json"
    if args.write:
        target.write_text(payload, encoding="utf-8")
    else:
        assert target.read_text(encoding="utf-8") == payload, "Frozen independent reference differs"
    print(f"Independent NetworkX flow {'written' if args.write else 'verified'}: {len(cases)} runs, {sum(len(c['states']) for c in cases)} states.")


if __name__ == "__main__":
    main()
