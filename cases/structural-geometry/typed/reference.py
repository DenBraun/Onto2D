"""Independent exact typed reference: enumerate all node permutations.

All five edge fields travel together. Python stdlib only; no production
matching, mapping, hashing or observation API is imported.
"""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CAUSAL = ROOT / "models/causal-emergence/releases/2026.08.15/bundle.json"
CANONICAL = HERE.parent / "canonical/reference.py"
spec = importlib.util.spec_from_file_location("independent_permutations", CANONICAL)
untyped = importlib.util.module_from_spec(spec)
spec.loader.exec_module(untyped)
FIELDS = ["dependencyTypeId", "interactionModeIds", "ontologicalRole", "necessity", "causalDirectionIds"]
SETS = ["interactionModeIds", "causalDirectionIds"]


def normalized(types):
    return {f: sorted(types[f]) if f in SETS else types[f] for f in FIELDS if f in types}


def typed_key(n, edges):
    forms = []
    for permutation in itertools.permutations(range(n)):
        mapped = sorted([[permutation[u], permutation[v], normalized(types)] for _, u, v, types in edges], key=lambda e: (e[0], e[1]))
        forms.append(json.dumps([n, mapped], sort_keys=True, separators=(",", ":")))
    return min(forms)


def sources():
    document = json.loads((HERE / "controls.json").read_text(encoding="utf-8"))
    result = []
    for graph in document["controls"]:
        all_labels = graph.get("labels", ["n" + str(i) for i in range(graph["nodes"])])
        labels = sorted(graph.get("scope", all_labels), key=lambda label: label.encode("utf-16-be"))
        positions = {label: i for i, label in enumerate(labels)}
        records = [("e" + str(i), positions[all_labels[e["from"]]], positions[all_labels[e["to"]]], e["types"])
                   for i, e in enumerate(graph["edges"]) if all_labels[e["from"]] in positions and all_labels[e["to"]] in positions]
        result.append((graph["id"], labels, records))
    pack = json.loads(CAUSAL.read_text(encoding="utf-8"))
    labels = sorted(document["causalScope"])
    assert set(labels) <= {n["id"] for n in pack["files"]["model/nodes.json"]}
    positions = {label: i for i, label in enumerate(labels)}
    records = [(e["id"], positions[e["source"]], positions[e["target"]], {f: e[f] for f in FIELDS if f in e})
               for e in pack["files"]["model/edges.json"] if e["source"] in positions and e["target"] in positions]
    result.append(("causal-fragment", labels, records))
    return result


def missing(records):
    return [{"sourceEdgeId": edge_id, "field": f} for edge_id, _, _, types in sorted(records) for f in FIELDS if f not in types]


def census():
    rows = []
    for n in range(1, 4):
        pairs = untyped.pairs(n)
        positions = {pair: i for i, pair in enumerate(pairs)}
        permutations = list(itertools.permutations(range(n)))
        keys = []
        for code in range(3 ** len(pairs)):
            labels = [(code // (3 ** i)) % 3 for i in range(len(pairs))]
            keys.append(min(sum(label * 3 ** positions[(p[u], p[v])] for label, (u, v) in zip(labels, pairs)) for p in permutations))
        rows.append({"nodes": n, "labelledGraphs": len(keys), "typedIsomorphismClasses": len(set(keys)), "keys": keys})
    return rows


def alignment_expectation(entry, graphs, mappings):
    left_labels, left_edges = graphs[entry["left"]]
    right_labels, right_edges = graphs[entry["right"]]
    if missing(left_edges) or missing(right_edges):
        return None
    if "mapping" not in entry:
        if entry["left"] != entry["right"]:
            return None
        return left_labels, left_edges, right_labels, right_edges
    if not entry["approve"]:
        return None
    mapping = mappings[entry["mapping"]]["fields"]
    for field in FIELDS:
        for side, edges in [("left", left_edges), ("right", right_edges)]:
            allowed = {pair[side] for pair in mapping[field]}
            used = {v for _, _, _, types in edges for v in (types[field] if field in SETS else [types[field]])}
            if not used <= allowed:
                return None
    reverse = {f: {pair["right"]: pair["left"] for pair in mapping[f]} for f in FIELDS}
    remapped = [(edge_id, u, v, {f: sorted(reverse[f][code] for code in types[f]) if f in SETS else reverse[f][types[f]] for f in FIELDS})
                for edge_id, u, v, types in right_edges]
    return left_labels, left_edges, right_labels, remapped


def expected():
    document = json.loads((HERE / "controls.json").read_text(encoding="utf-8"))
    graphs = {name: (labels, edges) for name, labels, edges in sources()}
    controls = []
    for name, (labels, edges) in graphs.items():
        gaps = missing(edges)
        controls.append({"id": name, "nodes": len(labels), "edges": len(edges), "missing": gaps,
                         "untypedKey": untyped.key(len(labels), [(u, v) for _, u, v, _ in edges]),
                         "typedKey": None if gaps else typed_key(len(labels), edges)})
    mappings = {m["id"]: m for m in document["mappings"]}
    alignments = []
    for entry in document["alignments"]:
        aligned = alignment_expectation(entry, graphs, mappings)
        equal = None if aligned is None else typed_key(len(aligned[0]), aligned[1]) == typed_key(len(aligned[2]), aligned[3])
        alignments.append({"id": entry["id"], "compatible": aligned is not None, "equalAlignedValues": equal})
    return {"schemaVersion": "1", "method": "joint-five-field-node-permutation-enumeration",
            "controlsFileSha256": hashlib.sha256((HERE / "controls.json").read_bytes()).hexdigest(),
            "causalFileSha256": hashlib.sha256(CAUSAL.read_bytes()).hexdigest(),
            "protocolFileSha256": hashlib.sha256((HERE / "PROTOCOL.md").read_bytes()).hexdigest(),
            "canonicalReferenceFileSha256": hashlib.sha256(CANONICAL.read_bytes()).hexdigest(),
            "census": census(), "controls": controls, "alignments": alignments}


def check_witness(value, witness, labels, edges, typed):
    mapping = {item["sourceNodeId"]: item["canonicalNode"] for item in witness["nodes"]}
    assert len(mapping) == len(witness["nodes"]) == len(labels) and set(mapping) == set(labels)
    assert set(mapping.values()) == set(range(len(labels)))
    expected = []
    for edge_id, u, v, types in edges:
        record = {"sourceEdgeId": edge_id, "from": mapping[labels[u]], "to": mapping[labels[v]]}
        if typed:
            record["types"] = normalized(types)
        expected.append(record)
    assert sorted(witness["edges"], key=lambda e: e["sourceEdgeId"]) == sorted(expected, key=lambda e: e["sourceEdgeId"])
    projected = [{k: v for k, v in e.items() if k != "sourceEdgeId"} for e in expected]
    assert sorted(value["edges"], key=lambda e: (e["from"], e["to"])) == sorted(projected, key=lambda e: (e["from"], e["to"]))


def check_typed_result(result, labels, edges):
    value = result["value"]
    assert value["nodeCount"] == len(labels)
    assert typed_key(len(labels), [(str(i), e["from"], e["to"], e["types"]) for i, e in enumerate(value["edges"])]) == typed_key(len(labels), edges)
    check_witness(value, result["witness"], labels, edges, True)


def verify_artifacts():
    graphs = {name: (labels, edges) for name, labels, edges in sources()}
    for name, (labels, edges) in graphs.items():
        artifact = json.loads((HERE / "artifacts" / (name + ".json")).read_text(encoding="utf-8"))
        first, second = artifact["observations"]
        assert first["value"]["nodeCount"] == len(labels)
        assert untyped.key(len(labels), [(e["from"], e["to"]) for e in first["value"]["edges"]]) == untyped.key(len(labels), [(u, v) for _, u, v, _ in edges])
        check_witness(first["value"], first["witness"], labels, edges, False)
        gaps = missing(edges)
        assert artifact["evidence"] == {"requiredFieldCount": 5 * len(edges), "observedFieldCount": 5 * len(edges) - len(gaps), "missing": gaps}
        if gaps:
            assert artifact["evaluation"] == "incomplete" and second["availability"] == "missing"
            assert second["value"] is None and second["valueHash"] is None and second["witness"] is None
        else:
            assert artifact["evaluation"] == "measured" and second["availability"] == "observed"
            check_typed_result(second, labels, edges)
    document = json.loads((HERE / "controls.json").read_text(encoding="utf-8"))
    mappings = {m["id"]: m for m in document["mappings"]}
    for entry in document["alignments"]:
        artifact = json.loads((HERE / "alignments" / (entry["id"] + ".json")).read_text(encoding="utf-8"))
        aligned = alignment_expectation(entry, graphs, mappings)
        if aligned is None:
            assert artifact["compatibility"]["state"] == "unresolved" and artifact["aligned"] is None
        else:
            assert artifact["compatibility"]["state"] == "compatible"
            check_typed_result(artifact["aligned"]["left"], aligned[0], aligned[1])
            check_typed_result(artifact["aligned"]["right"], aligned[2], aligned[3])
    print("Independent typed artifact replay passed: 26 observations and 8 vocabulary alignments.")


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
        assert path.read_text(encoding="utf-8") == text, "Independent typed expectations differ."
    print("Independent typed reference {}: 739 labeled graphs, {} typed classes, 26 controls.".format(
        "written" if args.write else "verified", sum(row["typedIsomorphismClasses"] for row in value["census"])))


if __name__ == "__main__":
    main()
