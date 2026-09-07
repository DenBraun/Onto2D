"""Independent source-only curvature/flow lock: Decimal, Fraction and NetworkX."""
import argparse
import hashlib
import importlib.util
import json
import sys
from decimal import Decimal
from fractions import Fraction as F
from pathlib import Path
import networkx as nx

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "../flow"))
from networkx_reference import normalize, graph_for, solve, encode, decode
spec = importlib.util.spec_from_file_location("independent_forman", HERE / "../experiments/reference.py")
forman = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forman)
FILES = ["sources.json", "controls.json", "PROTOCOL.md", "measurements.py", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"), parse_float=Decimal)


def scoped(source, scope):
    labels = set(scope["nodeIds"]) if scope and scope["kind"] == "induced" else {n["id"] for n in source["nodes"]}
    return {"nodes": sorted([n for n in source["nodes"] if n["id"] in labels], key=lambda n: n["id"].encode("utf-16-be")),
            "edges": sorted([e for e in source["edges"] if e["source"] in labels and e["target"] in labels], key=lambda e: e["id"].encode("utf-16-be"))}


def simulate(data, raw):
    by_id = {e["edgeId"]: decode(e["length"]) for e in raw.get("initialLengths", [])}
    lengths, _ = normalize(data, [by_id.get(e["id"], F(1)) for e in data["edges"]])
    step = F(1) if raw.get("step", "half") == "one" else F(1, 2)
    tolerance = decode(raw.get("tolerance", encode(F(1, 1000000))))
    cap, stable_required = raw.get("maxIterations", 16), raw.get("stableSteps", 2)
    half = raw.get("idleness", "half") == "half"
    previous, seen, stable, states = None, {}, 0, []
    for iteration in range(cap + 1):
        graph = graph_for(data, lengths)
        wasserstein = [solve(graph, e, half) for e in data["edges"]]
        curvatures = [1 - w / d for w, d in zip(wasserstein, lengths)]
        dl = max(abs(a - b) for a, b in zip(lengths, previous[0])) if previous else None
        dk = max(abs(a - b) for a, b in zip(curvatures, previous[1])) if previous else None
        stable = stable + 1 if previous and dl <= tolerance and dk <= tolerance else 0
        states.append({"iteration": iteration, "edges": [{"id": e["id"], "length": encode(d), "curvature": encode(k)} for e, d, k in zip(data["edges"], lengths, curvatures)],
                       "maxLengthChange": encode(dl) if dl is not None else None, "maxCurvatureChange": encode(dk) if dk is not None else None, "stableStepCount": stable})
        termination = {"reason": None, "iteration": iteration, "cycleStart": None, "cyclePeriod": None, "edgeIds": []}
        updated = [(1 - step) * d + step * w for d, w in zip(lengths, wasserstein)]
        if previous and lengths == previous[0]:
            termination["reason"] = "fixed-point"
        elif tuple(lengths) in seen:
            termination.update(reason="cycle", cycleStart=seen[tuple(lengths)], cyclePeriod=iteration - seen[tuple(lengths)])
        elif stable >= stable_required:
            termination["reason"] = "tolerance"
        elif iteration == cap:
            termination["reason"] = "iteration-limit"
        elif any(d <= 0 for d in updated):
            termination.update(reason="degenerate-length", edgeIds=[e["id"] for e, d in zip(data["edges"], updated) if d <= 0])
        if termination["reason"]:
            break
        seen[tuple(lengths)] = iteration
        previous = (lengths, curvatures)
        lengths, _ = normalize(data, updated)
    cut = raw.get("cut", {"kind": "none"})
    removed = [e for e, d in zip(data["edges"], lengths) if cut["kind"] == "final-length" and d > decode(cut["threshold"])]
    graph.remove_edges_from((e["source"], e["target"]) for e in removed)
    groups = lambda fn: sorted([sorted(g, key=lambda s: s.encode("utf-16-be")) for g in fn(graph)], key=lambda g: g[0].encode("utf-16-be"))
    weak, strong = groups(nx.weakly_connected_components), groups(nx.strongly_connected_components)
    cuts = {"policy": cut, "iteration": iteration, "removedEdgeIds": [e["id"] for e in removed], "weakComponents": weak, "strongComponents": strong,
            "connectivity": {"weakComponentCount": len(weak), "strongComponentCount": len(strong), "cyclicNodeCount": sum(len(g) for g in strong if len(g) > 1), "isolatedNodeCount": len(list(nx.isolates(graph)))}}
    return {"horizon": cap, "states": states, "termination": termination, "cuts": cuts}


def expected():
    assert nx.__version__ == "3.2.1", "Use the pinned NetworkX 3.2.1 environment"
    sources, cases = read("sources.json"), []
    for c in read("controls.json")["cases"]:
        pack, request = sources[c["sourceId"]], c["input"]
        source = {"nodes": pack["files"]["model/nodes.json"], "edges": pack["files"]["model/edges.json"]}
        graphs, values = [], {"forman": None, "ollivier": None, "flow": None}
        if request["forman"] is not None:
            p = request["forman"]
            g = scoped(source, None)
            g["edges"] = [e for e in g["edges"] if forman.selected(e, p.get("selection", {"kind": "all"}))]
            graphs.append(g)
            values["forman"] = forman.calculate(source, {"metricPolicyId": p["metricProviderId"], "selection": p.get("selection", {"kind": "all"})})["edges"]
        if request["ollivier"] is not None:
            p = request["ollivier"]; g = scoped(source, p.get("scope")); graphs.append(g)
            if "ollivier" not in c["missing"]:
                graph = graph_for(g, [F(1)] * len(g["edges"]))
                values["ollivier"] = [{"id": e["id"], "curvature": encode(1 - solve(graph, e, p.get("idleness", "zero") == "half"))}
                                      for e in g["edges"] if e["id"] in p["edgeIds"]]
        if request["flow"] is not None:
            p = request["flow"]; g = scoped(source, p.get("scope")); graphs.append(g)
            if "flow" not in c["missing"]:
                values["flow"] = simulate(g, p)
        graph = graphs[0] if graphs else scoped(source, None)
        population = {"nodes": [{"id": n["id"]} for n in graph["nodes"]], "edges": [{k: e[k] for k in ["id", "source", "target"]} for e in graph["edges"]]}
        cases.append({"id": c["id"], "graph": population, **values})
    algorithm = Path(nx.__file__).parent / "algorithms/flow/networksimplex.py"
    return {"schemaVersion": "1", "sourceHashes": {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in FILES},
            "reference": {"package": "networkx", "version": nx.__version__, "algorithm": "network_simplex", "algorithmSourceSha256": hashlib.sha256(algorithm.read_bytes()).hexdigest(),
                          "distance": "dijkstra_path_length", "forman": "independent-Decimal-Fraction-outward-interval"}, "cases": cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true"); group.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    value = expected(); text = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.write:
        (HERE / "measurements.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "measurements.json").read_text(encoding="utf-8") == text, "Independent geometric measurements differ"
    print("Independent source measurements {}: 25 requests.".format("written" if args.write else "verified"))


if __name__ == "__main__":
    main()
