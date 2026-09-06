"""Separate unit Forman incidence reference; no JavaScript/runtime imports.

Saucan et al., arXiv:1809.07698, equation (5), all vertex/edge weights = 1.
This is a computational cross-check, not independent scientific review.
"""

import argparse
import json
from pathlib import Path
import sys

DIRECTORY = Path(__file__).resolve().parent


def utf16_key(value):
    return value.encode("utf-16-be")


def calculate(graph):
    nodes = graph["nodes"]
    edges = graph["edges"]
    node_ids = [node["id"] for node in nodes]
    edge_ids = [edge["id"] for edge in edges]
    if not node_ids or any(not isinstance(value, str) or not value for value in node_ids + edge_ids):
        raise ValueError("Nonempty string IDs and at least one node are required")
    if len(set(node_ids)) != len(node_ids) or len(set(edge_ids)) != len(edge_ids):
        raise ValueError("Duplicate IDs")
    pairs = set()
    for edge in edges:
        pair = (edge["source"], edge["target"])
        if pair[0] not in node_ids or pair[1] not in node_ids:
            raise ValueError("Missing endpoint")
        if pair[0] == pair[1] or pair in pairs:
            raise ValueError("Loops and parallel edges are outside this reference profile")
        pairs.add(pair)

    values = {}
    for edge in edges:
        # Eq. (5) has two vertex terms. Enumerate edge incidences separately
        # instead of using the production endpoint-degree formula. A reverse
        # edge is incident on both sides and must contribute twice.
        curvature = 1 + 1
        for neighbor in edges:
            if neighbor["target"] == edge["source"]:
                curvature -= 1
            if neighbor["source"] == edge["target"]:
                curvature -= 1
        values[edge["id"]] = curvature

    node_results = []
    for node_id in sorted(node_ids, key=utf16_key):
        incoming = sum(values[edge["id"]] for edge in edges if edge["target"] == node_id)
        outgoing = sum(values[edge["id"]] for edge in edges if edge["source"] == node_id)
        node_results.append(dict(id=node_id, incomingCurvature=incoming,
                                 outgoingCurvature=outgoing, balance=incoming - outgoing))
    return dict(edges=[dict(id=edge_id, curvature=values[edge_id])
                       for edge_id in sorted(edge_ids, key=utf16_key)], nodes=node_results)


def golden_text():
    graphs = json.loads((DIRECTORY / "graphs.json").read_text(encoding="utf-8"))
    case_ids = [graph["id"] for graph in graphs["cases"]]
    if graphs["schemaVersion"] != "1" or len(set(case_ids)) != len(case_ids):
        raise ValueError("Invalid fixture collection")
    value = dict(schemaVersion="1", referenceVersion="1",
                 definition="Saucan et al., arXiv:1809.07698, equation (5), unit weights",
                 cases=[dict(id=graph["id"], **calculate(graph)) for graph in graphs["cases"]])
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--verify", action="store_true")
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--graph-stdin", action="store_true")
    args = parser.parse_args()
    if args.graph_stdin:
        # Pipes use explicit UTF-8 input and ASCII JSON output, independent of
        # the Windows console code page or a user's locale.
        graph = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        print(json.dumps(calculate(graph), ensure_ascii=True))
        return
    expected = golden_text()
    target = DIRECTORY / "expected.json"
    if args.write:
        target.write_text(expected, encoding="utf-8")
        print("Wrote synthetic unit Forman reference values.")
    elif target.read_text(encoding="utf-8") != expected:
        raise ValueError("Synthetic reference differs; investigate before regenerating")
    else:
        print("Synthetic unit Forman reference verified.")


if __name__ == "__main__":
    main()
