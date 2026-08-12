#!/usr/bin/env python3
"""Generate independently derived canonical and skeleton conformance fixtures.

This script deliberately does not import or execute the JavaScript kernel.  It
uses a small restricted canonical-JSON implementation for bounded positive
vectors and a brute-force permutation orbit for every simple graph through six
nodes.  The generated fixtures are consumed by the Node.js kernel tests.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import itertools
import json
import math
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIRECTORY = REPOSITORY_ROOT / "test" / "fixtures"
ARTIFACT_DOMAIN = "onto2d:artifact:v1"
ELEMENT_DOMAIN = "onto2d:element:v1"
CANDIDATE_DOMAIN = "onto2d:candidate:v1"
SKELETON_DOMAIN = "onto2d:skeleton:v1"


def utf16_sort_key(value: str) -> bytes:
    """Match the kernel's explicit UTF-16 code-unit key order."""

    return value.encode("utf-16-be")


def canonical_json(value: object) -> str:
    """Canonicalize the restricted positive-vector value domain.

    Non-zero floats are intentionally absent from these independent vectors:
    Python and ECMAScript expose different shortest-number formatters.  The
    kernel's binary64 edge cases remain covered by its native tests and a
    separate cross-runtime review gate.
    """

    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("non-finite fixture value")
        if value == 0:
            return "0"
        raise ValueError("non-zero floats require the ECMAScript number review gate")
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise ValueError("fixture object keys must be strings")
        members = []
        for key in sorted(value, key=utf16_sort_key):
            members.append(canonical_json(key) + ":" + canonical_json(value[key]))
        return "{" + ",".join(members) + "}"
    raise ValueError(f"unsupported fixture value: {type(value).__name__}")


def domain_hash(domain: str, payload: bytes) -> str:
    domain_bytes = domain.encode("utf-8")
    frame = (
        b"ONTO2D\0"
        + str(len(domain_bytes)).encode("ascii")
        + b"\0"
        + domain_bytes
        + b"\0"
    )
    return "sha256:" + hashlib.sha256(frame + payload).hexdigest()


def canonical_record(identifier: str, value: object) -> dict:
    serialized = canonical_json(value)
    payload = serialized.encode("utf-8")
    return {
        "id": identifier,
        "value": value,
        "canonicalJson": serialized,
        "bytesBase64": base64.b64encode(payload).decode("ascii"),
        "bytesUtf8Hex": payload.hex(),
        "hashes": {
            ARTIFACT_DOMAIN: domain_hash(ARTIFACT_DOMAIN, payload),
            ELEMENT_DOMAIN: domain_hash(ELEMENT_DOMAIN, payload),
            CANDIDATE_DOMAIN: domain_hash(CANDIDATE_DOMAIN, payload),
        },
    }


def canonical_fixture() -> dict:
    cases = [
        canonical_record(
            "nested-order-and-negative-zero",
            {"z": [3, 2, 1], "a": {"y": True, "x": -0.0}},
        ),
        canonical_record(
            "utf16-key-order",
            {"\ufffd": "replacement", "😀": "astral", "€": "bmp", "A": "ascii"},
        ),
        canonical_record(
            "json-string-escaping",
            {"text": "quote=\" slash=/ backslash=\\ controls=\b\t\n\f\r\x00 line=\u2028"},
        ),
        canonical_record(
            "scalar-array-and-safe-integers",
            {"values": [None, False, True, -12, 0, 9007199254740991]},
        ),
        canonical_record("root-string", "Onto2D/канон/😀"),
    ]
    return {
        "schemaVersion": "1",
        "policy": "rfc8785-compatible-binary64-v1",
        "generatedBy": {
            "language": "Python 3 standard library",
            "algorithm": "restricted-canonical-json-and-domain-frame-v1",
            "importsKernel": False,
            "command": "python3 scripts/reference/generate-conformance-fixtures.py",
        },
        "cases": cases,
    }


def possible_edges(node_count: int) -> List[Tuple[int, int]]:
    return [
        (left, right)
        for left in range(node_count)
        for right in range(left + 1, node_count)
    ]


def bit_for_edge(edge_index: int, edge_count: int) -> int:
    # Earlier lexicographic edges occupy more-significant bits.  For graphs
    # with equal edge counts, the maximum transformed code therefore denotes
    # the lexicographically smallest sorted edge list.
    return 1 << (edge_count - edge_index - 1)


def is_connected(node_count: int, edges: Sequence[Tuple[int, int]], code: int) -> bool:
    if node_count == 1:
        return True
    adjacency = [0] * node_count
    edge_count = len(edges)
    for index, (left, right) in enumerate(edges):
        if code & bit_for_edge(index, edge_count):
            adjacency[left] |= 1 << right
            adjacency[right] |= 1 << left
    seen = 1
    frontier = 1
    while frontier:
        node_bit = frontier & -frontier
        frontier ^= node_bit
        node = node_bit.bit_length() - 1
        unseen = adjacency[node] & ~seen
        seen |= unseen
        frontier |= unseen
    return seen == (1 << node_count) - 1


def permutation_tables(
    node_count: int,
    edges: Sequence[Tuple[int, int]],
) -> Iterable[Tuple[List[int], ...]]:
    edge_count = len(edges)
    edge_indices = {edge: index for index, edge in enumerate(edges)}
    chunk_count = (edge_count + 4) // 5
    for permutation in itertools.permutations(range(node_count)):
        mapped_bits = []
        for left, right in edges:
            mapped = tuple(sorted((permutation[left], permutation[right])))
            mapped_bits.append(bit_for_edge(edge_indices[mapped], edge_count))
        chunks = []
        for chunk in range(chunk_count):
            table = []
            for pattern in range(32):
                transformed = 0
                for offset in range(5):
                    input_index = chunk * 5 + offset
                    if input_index >= edge_count:
                        break
                    pattern_bit = 1 << offset
                    if pattern & pattern_bit:
                        transformed |= mapped_bits[input_index]
                table.append(transformed)
            chunks.append(table)
        yield tuple(chunks)


def chunk_patterns(code: int, edge_count: int) -> Tuple[int, ...]:
    patterns = []
    for chunk_index in range((edge_count + 4) // 5):
        pattern = 0
        for offset in range(5):
            input_index = chunk_index * 5 + offset
            if input_index >= edge_count:
                break
            if code & bit_for_edge(input_index, edge_count):
                pattern |= 1 << offset
        patterns.append(pattern)
    return tuple(patterns)


def canonical_graph_code(
    patterns: Sequence[int],
    tables: Sequence[Tuple[List[int], ...]],
) -> int:
    canonical = 0
    for chunks in tables:
        transformed = 0
        for pattern, table in zip(patterns, chunks):
            transformed |= table[pattern]
        canonical = max(canonical, transformed)
    return canonical


def edges_from_code(edges: Sequence[Tuple[int, int]], code: int) -> List[List[int]]:
    edge_count = len(edges)
    return [
        [left, right]
        for index, (left, right) in enumerate(edges)
        if code & bit_for_edge(index, edge_count)
    ]


def skeleton_fixture() -> dict:
    expected_unique = {1: 1, 2: 1, 3: 2, 4: 6, 5: 21, 6: 112}
    expected_connected_labelled = {1: 1, 2: 1, 3: 4, 4: 38, 5: 728, 6: 26704}
    levels = []
    for node_count in range(1, 7):
        edges = possible_edges(node_count)
        edge_count = len(edges)
        tables = tuple(permutation_tables(node_count, edges))
        multiplicities: Dict[int, int] = {}
        connected_labelled = 0
        for code in range(1 << edge_count):
            if not is_connected(node_count, edges, code):
                continue
            connected_labelled += 1
            canonical = canonical_graph_code(chunk_patterns(code, edge_count), tables)
            multiplicities[canonical] = multiplicities.get(canonical, 0) + 1

        if len(multiplicities) != expected_unique[node_count]:
            raise AssertionError(f"unexpected unique count for n={node_count}")
        if connected_labelled != expected_connected_labelled[node_count]:
            raise AssertionError(f"unexpected connected labelled count for n={node_count}")

        skeletons = []
        for code, labelled_multiplicity in multiplicities.items():
            canonical_edges = edges_from_code(edges, code)
            serialized = canonical_json({"nodeCount": node_count, "edges": canonical_edges})
            payload = serialized.encode("utf-8")
            skeletons.append({
                "id": domain_hash(SKELETON_DOMAIN, payload),
                "edges": canonical_edges,
                "bytesBase64": base64.b64encode(payload).decode("ascii"),
                "labelledMultiplicity": labelled_multiplicity,
            })
        skeletons.sort(key=lambda record: record["id"])
        if sum(record["labelledMultiplicity"] for record in skeletons) != connected_labelled:
            raise AssertionError(f"multiplicity mismatch for n={node_count}")
        if any(
            math.factorial(node_count) % record["labelledMultiplicity"] != 0
            for record in skeletons
        ):
            raise AssertionError(f"orbit multiplicity mismatch for n={node_count}")
        levels.append({
            "nodeCount": node_count,
            "totalLabelledGraphs": 1 << edge_count,
            "connectedLabelledGraphs": connected_labelled,
            "uniqueSkeletons": len(skeletons),
            "skeletons": skeletons,
        })
    return {
        "schemaVersion": "1",
        "domain": SKELETON_DOMAIN,
        "generatedBy": {
            "language": "Python 3 standard library",
            "algorithm": "exhaustive-labelled-graphs-and-full-permutation-orbits-v1",
            "importsKernel": False,
            "command": "python3 scripts/reference/generate-conformance-fixtures.py",
        },
        "levels": levels,
    }


def fixture_bytes(value: dict) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n"
    ).encode("utf-8")


def write_fixture(name: str, value: dict) -> None:
    path = FIXTURE_DIRECTORY / name
    path.write_bytes(fixture_bytes(value))
    print(path.relative_to(REPOSITORY_ROOT))


def verify_fixture(name: str, value: dict) -> None:
    path = FIXTURE_DIRECTORY / name
    expected = fixture_bytes(value)
    if not path.exists():
        raise SystemExit(f"missing frozen fixture: {path.relative_to(REPOSITORY_ROOT)}")
    if path.read_bytes() != expected:
        raise SystemExit(f"frozen fixture differs from independent replay: {path.relative_to(REPOSITORY_ROOT)}")
    print(f"{path.relative_to(REPOSITORY_ROOT)} verified")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="compare an independent replay with the frozen fixtures without writing files",
    )
    args = parser.parse_args()
    fixtures = [
        ("canonical-conformance-v1.json", canonical_fixture()),
        ("skeleton-conformance-v1.json", skeleton_fixture()),
    ]
    if args.verify:
        for name, value in fixtures:
            verify_fixture(name, value)
        return
    FIXTURE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for name, value in fixtures:
        write_fixture(name, value)


if __name__ == "__main__":
    main()
