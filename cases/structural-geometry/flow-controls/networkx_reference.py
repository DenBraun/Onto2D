#!/usr/bin/env python3
"""Replay supplemental controls through the independent, pinned NetworkX method."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import networkx as nx
from analytic_reference import HERE, PROTOCOL_SHA256, encoded, protocol, verify

LEGACY = HERE.parent / "flow"
# Only the preserved independent reference is reused; no runtime solver imports.
sys.path.insert(0, str(LEGACY))
spec = importlib.util.spec_from_file_location("legacy_flow_reference", LEGACY / "networkx_reference.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true"); mode.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    assert nx.__version__ == "3.2.1", "Install ../flow/requirements-reference.txt"
    algorithm = Path(nx.__file__).parent / "algorithms/flow/networksimplex.py"
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert sha(algorithm) == "7a298e509e27dbe8d104df0b80fa1eb85ad4dfc3b6251081d4ed2e1241bbc248", "NetworkX algorithm source differs"
    verify()  # Both reference paths must agree before either expected output is accepted.
    suite = json.loads((HERE / "suite.json").read_text(encoding="utf-8"))
    inputs = protocol()["runs"]
    assert suite["suiteId"] == "structural-flow-controls-v1" and suite["protocolSha256"] == PROTOCOL_SHA256
    assert [r["id"] for r in suite["runs"]] == [r["id"] for r in inputs], "Supplemental suite coverage differs"
    cases = []
    for run in suite["runs"]:
        assert run["file"] == f"artifacts/{run['id']}.json"
        artifact = json.loads((HERE / run["file"]).read_text(encoding="utf-8"))
        assert artifact["request"]["requestHash"] == run["requestHash"] and artifact["artifactHash"] == run["artifactHash"]
        cases.append({"id": run["id"], **reference.evaluate(artifact)})
    identity = {"package": "networkx", "version": nx.__version__, "algorithm": "network_simplex",
        "algorithmSourceSha256": sha(algorithm), "replaySourceSha256": sha(LEGACY / "networkx_reference.py"),
        "sourceUrl": "https://github.com/networkx/networkx/blob/networkx-3.2.1/networkx/algorithms/flow/networksimplex.py",
        "numeric": "integer-scaled-rational-costs-and-demands-exact-output", "distance": "dijkstra_path_length"}
    payload = encoded({"schemaVersion": "1", "protocolSha256": PROTOCOL_SHA256, "reference": identity, "cases": cases})
    target = HERE / "networkx-expected.json"
    if args.write:
        target.write_text(payload, encoding="utf-8")
    else:
        assert target.read_text(encoding="utf-8") == payload, "Frozen supplemental NetworkX values differ"
    print(f"Independent NetworkX supplemental flow {'written' if args.write else 'verified'}: {len(cases)} runs, {sum(len(c['states']) for c in cases)} states.")


if __name__ == "__main__":
    main()
