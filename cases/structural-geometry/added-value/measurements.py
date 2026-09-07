"""Source-only numerical lock, using the existing independent NetworkX solver."""
import argparse
import hashlib
import importlib.util
import json
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("added_value_numerics", HERE / "../geometric-signatures/measurements.py")
numerics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(numerics)
FILES = ["PROTOCOL.md", "config.json", "panel.json", "sources.json", "measurements.py",
         "../geometric-signatures/measurements.py", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"]
read = lambda name: json.loads((HERE / name).read_text(encoding="utf-8"))


def expected():
    assert numerics.nx.__version__ == "3.2.1", "Use the existing pinned NetworkX 3.2.1 environment"
    sources, rows = read("sources.json"), []
    for unit in read("panel.json")["units"]:
        source = sources[unit["id"]]["files"]
        graph = {"nodes": sorted([{"id": n["id"]} for n in source["model/nodes.json"]], key=lambda n: n["id"].encode("utf-16-be")),
                 "edges": sorted([{k: e[k] for k in ["id", "source", "target"]} for e in source["model/edges.json"]], key=lambda e: e["id"].encode("utf-16-be"))}
        request = unit["geometryInput"]
        unit_graph = numerics.graph_for(graph, [F(1)] * len(graph["edges"]))
        # Sum incoming/outgoing incidences independently of the JS degree tables.
        forman = []
        for edge in graph["edges"]:
            value = 2 - sum(e["target"] == edge["source"] for e in graph["edges"]) - sum(e["source"] == edge["target"] for e in graph["edges"])
            forman.append({"id": edge["id"], "length": numerics.encode(F(1)), "curvature": {"lowerTicks": str(value * 10 ** 12), "upperTicks": str(value * 10 ** 12)}})
        ollivier = [{"id": e["id"], "curvature": numerics.encode(1 - numerics.solve(unit_graph, e, True))} for e in graph["edges"]]
        rows.append({"id": unit["id"], "graph": graph, "forman": forman, "ollivier": ollivier, "flow": numerics.simulate(graph, request["flow"])})
    algorithm = Path(numerics.nx.__file__).parent / "algorithms/flow/networksimplex.py"
    return {"schemaVersion": "1", "sourceHashes": {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in FILES},
            "reference": {"package": "networkx", "version": "3.2.1", "algorithm": "network_simplex",
                          "algorithmSourceSha256": hashlib.sha256(algorithm.read_bytes()).hexdigest()}, "units": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true"); group.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    value = expected(); text = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.write:
        (HERE / "measurements.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "measurements.json").read_text(encoding="utf-8") == text, "Independent numerical lock differs"
    print("Independent added-value numerical lock {}: {} source units.".format("written" if args.write else "verified", len(value["units"])))


if __name__ == "__main__":
    main()
