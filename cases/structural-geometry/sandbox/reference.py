"""Independent immutable transformations from source records, without JS imports."""
import argparse
import hashlib
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ["controls.json", "PROTOCOL.md", "../canonical/controls.json", "../typed/controls.json",
         "../../../models/causal-emergence/releases/2026.08.15/bundle.json"]
FIELDS = ["dependencyTypeId", "interactionModeIds", "ontologicalRole", "necessity", "causalDirectionIds"]
SETS = ["interactionModeIds", "causalDirectionIds"]


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def ordered(values):
    return sorted(values, key=lambda value: value.encode("utf-16-be"))


def graph_records(g, typed):
    labels = g.get("labels", ["n" + str(i) for i in range(g["nodes"])])
    edges = [{"id": "e" + str(i), "source": labels[e["from"] if typed else e[0]],
              "target": labels[e["to"] if typed else e[1]], **(e["types"] if typed else {})}
             for i, e in enumerate(g["edges"])]
    return {"nodes": labels, "edges": edges, "scope": g.get("scope")}


def sources(document):
    result = {"canonical/" + g["id"]: graph_records(g, False) for g in read("../canonical/controls.json")["controls"]}
    typed = read("../typed/controls.json")
    result.update({"typed/" + g["id"]: graph_records(g, True) for g in typed["controls"]})
    result.update({"local/" + g["id"]: graph_records(g, True) for g in document["graphs"]})
    pack = read(FILES[-1])["files"]
    result["typed/causal-fragment"] = {"nodes": [n["id"] for n in pack["model/nodes.json"]],
                                       "edges": pack["model/edges.json"], "scope": typed["causalScope"]}
    return result


def summary(id, source, regime, scope, transformation):
    labels = ordered(scope["nodeIds"] if scope else source["scope"] if source["scope"] else source["nodes"])
    selected_nodes = set(labels)
    all_edges = sorted(source["edges"], key=lambda edge: edge["id"].encode("utf-16-be"))
    partitions = {key: [] for key in ["edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"]}
    for e in all_edges:
        u, v = e["source"] in selected_nodes, e["target"] in selected_nodes
        partitions["edgeIds" if u and v else "outgoingBoundaryEdgeIds" if u else "incomingBoundaryEdgeIds" if v else "externalEdgeIds"].append(e["id"])
    internal_ids = set(partitions["edgeIds"])
    internal = [e for e in all_edges if e["id"] in internal_ids]
    node_map = {label: "n{:03d}".format(i) for i, label in enumerate(labels)}
    edge_map = {e["id"]: "e{:03d}".format(i) for i, e in enumerate(internal)}
    nodes = [{"id": node_map[n]} for n in labels]
    edges = [{"id": edge_map[e["id"]], "source": node_map[e["source"]], "target": node_map[e["target"]],
              **({"types": {f: sorted(e[f]) if f in SETS else e[f] for f in FIELDS if f in e}} if regime == "typed-relations-v1" else {})}
             for e in internal]
    mapping = {"nodes": [{"sourceNodeId": n, "shadowNodeId": node_map[n]} for n in labels],
               "edges": [{"sourceEdgeId": e["id"], "shadowEdgeId": edge_map[e["id"]]} for e in internal]}
    kind = "whole-scope" if transformation["kind"] == "identity" else transformation["targets"]
    groups = [partitions["edgeIds"]] if kind == "whole-scope" else [] if not internal else [partitions["edgeIds"]] if kind == "all-scoped-edges" else [[e["id"]] for e in internal]
    runs = []
    for group in groups:
        selected = {edge_map[e] for e in group}
        removed = selected if transformation["kind"] == "remove-edges" else set()
        reversed_ids = selected if transformation["kind"] == "reverse-edges" else set()
        surviving = [e for e in edges if e["id"] not in removed]
        transformed = [{**e, "source": e["target"], "target": e["source"]} if e["id"] in reversed_ids else e for e in surviving]
        conflicts = [(a, b) for a, b in itertools.combinations(transformed, 2) if (a["source"], a["target"]) == (b["source"], b["target"])]
        assert len(conflicts) <= 1
        reverse_map = {v: k for k, v in edge_map.items()}
        target = {"kind": "single-scoped-edge" if kind == "each-scoped-edge" else kind,
                  "sourceEdgeIds": group, "shadowEdgeIds": [edge_map[e] for e in group]}
        common = {"target": target, "transformation": transformation}
        if conflicts:
            runs.append({**common, "execution": "rejected", "rejection": {"code": "parallel-edge-after-reversal",
                         "sourceEdgeIds": ordered([reverse_map[e["id"]] for e in conflicts[0]])}, "graph": None, "edgeMapping": None, "changes": None})
        else:
            runs.append({**common, "execution": "applied", "rejection": None, "graph": {"nodes": nodes, "edges": transformed},
                         "edgeMapping": [{"sourceEdgeId": e["id"], "beforeEdgeId": edge_map[e["id"]],
                                          "afterEdgeId": None if edge_map[e["id"]] in removed else edge_map[e["id"]],
                                          "action": "removed" if edge_map[e["id"]] in removed else "reversed" if edge_map[e["id"]] in reversed_ids else "preserved"} for e in internal],
                         "changes": {"removedSourceEdgeIds": ordered(reverse_map[e] for e in removed),
                                     "reversedSourceEdgeIds": ordered(reverse_map[e] for e in reversed_ids)}})
    applied = sum(r["execution"] == "applied" for r in runs)
    return {"id": id, "baseline": {"graph": {"nodes": nodes, "edges": edges}, "mapping": mapping},
            "scopeAccounting": {"nodeIds": labels, **partitions},
            "selection": {"kind": kind, "eligibleSourceEdgeIds": partitions["edgeIds"], "eligibleShadowEdgeIds": [edge_map[e["id"]] for e in internal]},
            "execution": {"state": "completed" if groups else "unavailable", "reason": None if groups else "empty-target-set",
                          "targetCount": len(groups), "appliedCount": applied, "rejectedCount": len(runs) - applied},
            "work": {"transformationEdgeVisits": len(groups) * len(internal), "outputGraphCount": 1 + applied}, "runs": runs}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def expected():
    document = read("controls.json")
    graphs = sources(document)
    operations = {o["id"]: o["transformation"] for o in document["operations"]}
    cases = [summary(s["id"] + "-" + op, graphs[s["source"]], s["regimeId"], s.get("scope"), operations[op])
             for s in document["scenarios"] for op in s["operations"]]
    rows, digests = [], []
    for n in range(1, 4):
        pairs = [(u, v) for u in range(n) for v in range(n) if u != v]
        row = {"nodes": n, "graphs": 2 ** len(pairs), "requests": 0, "targets": 0, "applied": 0, "rejected": 0, "unavailable": 0}
        for mask in range(2 ** len(pairs)):
            graph = graph_records({"nodes": n, "edges": [pair for i, pair in enumerate(pairs) if mask & (1 << i)]}, False)
            for op, transformation in operations.items():
                id = "n{}-mask{}-{}".format(n, mask, op)
                value = summary(id, graph, "topology-only-v1", None, transformation)
                digests.append({"id": id, "sha256": digest(value)})
                row["requests"] += 1
                for key, field in [("targets", "targetCount"), ("applied", "appliedCount"), ("rejected", "rejectedCount")]:
                    row[key] += value["execution"][field]
                row["unavailable"] += value["execution"]["state"] == "unavailable"
        rows.append(row)
    return {"schemaVersion": "1", "method": "independent-source-records-set-deletion-and-simultaneous-endpoint-reversal",
            "sourceHashes": {file: hashlib.sha256((HERE / file).read_bytes()).hexdigest() for file in FILES},
            "cases": cases, "census": {"rows": rows, "digests": digests}}


def actual_summary(id, artifact):
    graph = lambda g: {key: g[key] for key in ["nodes", "edges"]} if g else None
    return {"id": id, "baseline": {"graph": graph(artifact["baseline"]["graph"]), "mapping": artifact["baseline"]["mapping"]},
            "scopeAccounting": {key: artifact["preparation"]["scope"][key] for key in ["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"]},
            **{key: artifact[key] for key in ["selection", "execution", "work"]},
            "runs": [{**{key: run[key] for key in ["target", "transformation", "execution", "rejection", "edgeMapping", "changes"]},
                      "graph": graph(run["graph"])} for run in artifact["runs"]]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    for option in ["--write", "--verify", "--verify-artifacts"]:
        modes.add_argument(option, action="store_true")
    args = parser.parse_args()
    value = expected()
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        with (HERE / "reference.json").open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Sandbox reference differs"
        if args.verify_artifacts:
            for case in value["cases"]:
                assert actual_summary(case["id"], read("artifacts/" + case["id"] + ".json")) == case, case["id"]
    print("Independent sandbox {}: {} controls, 69 graphs / 345 requests.".format("written" if args.write else "verified", len(value["cases"])))


if __name__ == "__main__":
    main()
