"""Independent source-derived graph, response, geometry and paired study reference."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from collections import Counter
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, HERE / path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


signature = module("added_value_signature", "../signatures/reference.py")
geometry = module("added_value_geometry", "../geometric-signatures/reference.py")
response = signature.response
NUMERICAL_FILES = ["PROTOCOL.md", "config.json", "panel.json", "sources.json", "measurements.py",
                   "../geometric-signatures/measurements.py", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"]
FILES = NUMERICAL_FILES + ["measurements.json", "reference.py", "../geometric-signatures/reference.py", "../signatures/reference.py",
                          "../responses/reference.py", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py"]
BASELINES = ["counts", "degrees", "topology", "motifs", "spectrum", "refinement", "canonical"]
read = lambda name: json.loads((HERE / name).read_text(encoding="utf-8"))
encoded = lambda v: json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
hashes = lambda files: {f: hashlib.sha256((HERE / f).read_bytes()).hexdigest() for f in files}


def graph(pack):
    files = pack["files"]
    nodes = sorted([n["id"] for n in files["model/nodes.json"]], key=lambda v: v.encode("utf-16-be"))
    return len(nodes), [(nodes.index(e["source"]), nodes.index(e["target"])) for e in files["model/edges.json"]]


def canonical(n, edges):
    arcs = set(edges)
    return {"nodeCount": n, "code": min("".join(str(int((p[i], p[j]) in arcs)) for i in range(n) for j in range(n) if i != j)
                                       for p in itertools.permutations(range(n)))}


def histogram(values):
    counts = Counter(encoded(v) for v in values)
    return [{"value": json.loads(k), "count": v} for k, v in sorted(counts.items())]


def degrees(n, edges):
    return histogram([[sum(v == i for u, v in edges), sum(u == i for u, v in edges)] for i in range(n)])


def topology(n, edges):
    return response.topology.measure([str(i) for i in range(n)], [(str(i), str(u), str(v)) for i, (u, v) in enumerate(edges)])["value"]


def spectrum(n, edges):
    # Leibniz determinant coefficients, then Newton identities; the production
    # baseline instead multiplies adjacency matrices and takes traces directly.
    arcs, coeff = set(edges), [0] * (n + 1)
    for p in itertools.permutations(range(n)):
        nonfixed = [i for i in range(n) if p[i] != i]
        if any((i, p[i]) not in arcs for i in nonfixed):
            continue
        inversions = sum(p[i] > p[j] for i in range(n) for j in range(i + 1, n))
        coeff[len(nonfixed)] += (-1) ** (inversions + len(nonfixed))
    powers = [0]
    for k in range(1, 7):
        powers.append(-sum(coeff[i] * powers[k - i] for i in range(1, min(k, n + 1))) - (k * coeff[k] if k <= n else 0))
    return powers[1:]


def baselines(n, edges):
    motifs = []
    for vertices in itertools.combinations(range(n), 3):
        motifs.append(canonical(3, [(vertices.index(u), vertices.index(v)) for u, v in edges if u in vertices and v in vertices])["code"])
    return {"counts": [n, len(edges)], "degrees": degrees(n, edges),
            "topology": topology(n, edges),
            "motifs": histogram(motifs), "spectrum": spectrum(n, edges), "canonical": canonical(n, edges)}


def refinement(graphs):
    colors = [[0] * n for n, edges in graphs]
    result = [[histogram(row)] for row in colors]
    for _ in range(6):
        tuples = [[encoded([colors[k][i], sorted(colors[k][u] for u, v in edges if v == i),
                           sorted(colors[k][v] for u, v in edges if u == i)]) for i in range(n)] for k, (n, edges) in enumerate(graphs)]
        ranks = {row: i for i, row in enumerate(sorted({row for group in tuples for row in group}))}
        colors = [[ranks[row] for row in group] for group in tuples]
        for i, row in enumerate(colors):
            result[i].append(histogram(row))
    return result


def audit_panel(panel, sources):
    config = read("config.json")
    assert panel["config"] == config
    assert panel["protocolSha256"] == hashes(["PROTOCOL.md"])["PROTOCOL.md"]
    old = list(read("../geometric-signatures/sources.json").values())
    prior = []
    for pack in old:
        n, edges = graph(pack)
        if n == 6 and len(edges) == 8:
            prior.append(canonical(n, edges)["code"])
    for _, source, _, scope in signature.source_cases():
        # The audited JS fixtures use their full source population, not scopes.
        if len(source["nodes"]) == 6 and len(source["edges"]) == 8:
            labels = source["nodes"]
            prior.append(canonical(6, [(labels.index(e["source"]), labels.index(e["target"])) for e in source["edges"]])["code"])
    assert panel["excludedPriorOrbits"] == sorted(set(prior))
    seen, proposals, selected = set(prior), [], []
    slots = list(itertools.combinations(range(6), 2))
    for counter in range(config["proposalBudget"]):
        raw = hashlib.sha256((config["seed"] + ":" + str(counter)).encode()).digest()
        edges = [(u, v) if raw[i] % 3 == 1 else (v, u) for i, (u, v) in enumerate(slots) if raw[i] % 3]
        disposition = "edge-count" if len(edges) != 8 else None
        if not disposition and len(topology(6, edges)["weakComponentSizes"]) != 1:
            disposition = "disconnected"
        code = canonical(6, edges)["code"] if not disposition else None
        if not disposition and code in seen:
            disposition = "prior-orbit" if code in prior else "duplicate-orbit"
        if not disposition:
            disposition = "accepted"; seen.add(code); selected.append((counter, edges))
        proposals.append({"counter": counter, "disposition": disposition, "canonicalCode": code})
        if len(selected) == 32:
            break
    assert len(selected) == 32 and proposals == panel["proposals"]
    assert len(panel["units"]) == len(sources) == 68
    for i, (counter, edges) in enumerate(selected):
        name = "evaluation-{:02d}".format(i)
        for offset, variant in [(0, "base"), (1, "transport")]:
            u = panel["units"][2 * i + offset]
            assert u["baseId"] == name and u["variant"] == variant and u["proposal"] == counter and u["split"] == "evaluation"
            assert u["id"] == name + ("-transport" if offset else "")
            n, actual = graph(sources[u["id"]])
            assert n == 6 and canonical(n, actual) == canonical(6, edges) == u["canonical"]
            assert u["degrees"] == degrees(n, actual)
    assert len({encoded(u["canonical"]) for u in panel["units"][:64:2]}) == 32
    assert not {encoded(u["canonical"]) for u in panel["units"][:64]} & {encoded(u["canonical"]) for u in panel["units"][64:]}
    bases = [u["id"] for u in panel["units"][:64:2]]
    expected_pairs = [(a, b, "evaluation") for a, b in itertools.combinations(bases, 2)] + [(a, a + "-transport", "invariance") for a in bases]
    expected_pairs += [("development-feedback", "development-isolate", "development"), ("development-feedback", "development-subdivision", "development"), ("development-path", "development-path", "development")]
    assert [(p["left"], p["right"], p["split"]) for p in panel["pairs"]] == expected_pairs
    for u in panel["units"]:
        assert u["responseInput"] == {"regimeId": config["regimeId"]}
        assert u["geometryInput"] == {**config["geometry"], "ollivier": {**config["geometry"]["ollivier"], "edgeIds": sorted([e["id"] for e in sources[u["id"]]["files"]["model/edges.json"]], key=lambda v: v.encode("utf-16-be"))}}


def eligible(r, g):
    a = r["summary"]["status"] == "complete" and r["summary"]["invarianceStatus"] == "passed"
    static = a and all(f["state"] == "observed" for f in g["features"][:2])
    return {"response": a, "static": static, "combined": static and g["summary"]["status"] == "complete",
            "reasons": ["response:" + r for r in r["summary"]["reasons"]] + [f["id"] + ":" + r for f in g["features"] for r in f["reasons"]]}


def ratio(n, d):
    if not d:
        return None
    value = Fraction(n, d)
    return {"numerator": value.numerator, "denominator": value.denominator}


def compare(spec, left, right):
    values = lambda unit: [f["value"] for f in unit["response"]["features"]] + [f["value"] for f in unit["geometry"]["features"]]
    a, b = values(left), values(right)
    mismatch = [int(x != y) for x, y in zip(a, b)]
    raw = {key: ratio(sum(mismatch[:n]), n) if left["eligibility"][key] and right["eligibility"][key] else None for key, n in [("response", 3), ("static", 5), ("combined", 6)]}
    complete = raw["combined"] is not None
    assert spec["truth"] == ("same-directed-graph" if left["baselines"]["canonical"] == right["baselines"]["canonical"] else "different-directed-graph")
    assert spec["degreeMatched"] == (left["baselines"]["degrees"] == right["baselines"]["degrees"])
    return {**spec, "eligible": complete, "raw": raw, "matched": {k: v if complete else None for k, v in raw.items()},
            "coverage": {k: {"numerator": int(left["eligibility"][k]) + int(right["eligibility"][k]), "denominator": 2} for k in raw},
            "reasons": [{"side": side, "code": code} for side, u in [("left", left), ("right", right)] for code in u["eligibility"]["reasons"]],
            "baselines": {key: int(left["baselines"][key] != right["baselines"][key]) for key in BASELINES}}


def positive(v):
    return v is not None and v["numerator"] > 0


def outcome(pairs, left="response"):
    eligible_pairs = [p for p in pairs if p["eligible"]]
    cells = Counter((positive(p["matched"][left]), positive(p["matched"]["combined"])) for p in eligible_pairs)
    both, gained, lost, neither = [cells[key] for key in [(True, True), (False, True), (True, False), (False, False)]]
    assert lost == 0
    n = len(eligible_pairs)
    return {"status": "measured" if n else "indeterminate", "totalPairs": len(pairs), "eligiblePairs": n, "excludedPairs": len(pairs) - n,
            "both": both, "gained": gained, "lost": lost, "neither": neither, "leftRate": ratio(both + lost, n), "rightRate": ratio(both + gained, n), "pairedGain": ratio(gained - lost, n)}


def summary(pairs):
    negatives = [p for p in pairs if p["split"] == "evaluation"]
    positives = [p for p in pairs if p["split"] == "invariance"]
    common = [p for p in negatives if p["eligible"]]
    gains = [p for p in common if not positive(p["matched"]["response"]) and positive(p["matched"]["combined"])]
    return {"primary": outcome(negatives), "staticToFlow": outcome(negatives, "static"), "degreeMatched": outcome([p for p in negatives if p["degreeMatched"]]),
            "invariance": {"totalPairs": len(positives), "eligiblePairs": sum(p["eligible"] for p in positives), "excludedPairs": sum(not p["eligible"] for p in positives),
                           "responseFalseDifferences": sum(positive(p["raw"]["response"]) for p in positives), "combinedFalseDifferences": sum(positive(p["raw"]["combined"]) for p in positives),
                           "baselineFalseDifferences": {k: sum(p["baselines"][k] for p in positives) for k in BASELINES}},
            "responseOnlyCoverage": {"eligiblePairs": sum(p["raw"]["response"] is not None for p in negatives), "totalPairs": len(negatives),
                                     "lostToGeometry": sum(p["raw"]["response"] is not None and not p["eligible"] for p in negatives)},
            "baselines": [{"id": k, "eligiblePairs": len(common), "distinguished": sum(p["baselines"][k] for p in common),
                           "rate": ratio(sum(p["baselines"][k] for p in common), len(common)), "geometryGainsAlreadyDistinguished": sum(p["baselines"][k] for p in gains)} for k in BASELINES],
            "unavailableBaselines": [{"id": "typed-motifs", "reason": "untyped-source-panel"}, {"id": "semantic-roles", "reason": "no-declared-domain-role-mapping"}],
            "inference": "exact-finite-panel-no-independent-pair-uncertainty-or-population-claim"}


def expected():
    panel, sources, measurements = read("panel.json"), read("sources.json"), read("measurements.json")
    audit_panel(panel, sources)
    assert measurements["sourceHashes"] == hashes(NUMERICAL_FILES)
    graphs = [graph(sources[u["id"]]) for u in panel["units"]]
    colors, units = refinement(graphs), []
    assert [u["id"] for u in panel["units"]] == [m["id"] for m in measurements["units"]]
    for i, (u, measurement) in enumerate(zip(panel["units"], measurements["units"])):
        raw = sources[u["id"]]["files"]
        r = signature.signature(response.summary(u["id"], {"nodes": [n["id"] for n in raw["model/nodes.json"]], "edges": raw["model/edges.json"]}, panel["config"]["regimeId"]))
        g = geometry.describe({"id": u["id"], "input": u["geometryInput"]}, measurement)
        units.append({"id": u["id"], "response": r, "geometry": g, "baselines": {**baselines(*graphs[i]), "refinement": colors[i]}, "eligibility": eligible(r, g)})
    lookup = {u["id"]: u for u in units}
    pairs = [compare(p, lookup[p["left"]], lookup[p["right"]]) for p in panel["pairs"]]
    return {"schemaVersion": "1", "sourceHashes": hashes(FILES), "units": units, "pairs": pairs, "summary": summary(pairs)}


def actual_unit(a):
    r, g = a["evidence"]["response"], a["evidence"]["geometry"]
    features = json.loads(encoded(g["features"]))
    for f in features:
        del f["valueHash"]
    if features[2]["provenance"]:
        for frame in features[2]["provenance"]["frames"]:
            del frame["stateHash"]
    return {"id": a["id"], "response": {"features": [{k: f[k] for k in ["id", "probeId", "state", "value", "coverage", "reasons"]} for f in r["features"]], "summary": r["summary"], "value": r["value"]},
            "geometry": {"id": a["id"], "population": {k: g["population"][k] for k in ["nodeIds", "edgeIds"]}, "features": features, "summary": g["summary"], "value": g["value"], "work": g["work"]},
            "baselines": a["baselines"], "eligibility": a["eligibility"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    for flag in ["--write", "--verify", "--verify-artifacts"]:
        group.add_argument(flag, action="store_true")
    args = parser.parse_args(); value = expected()
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.write:
        (HERE / "reference.json").write_text(text, encoding="utf-8")
    else:
        assert (HERE / "reference.json").read_text(encoding="utf-8") == text, "Independent study reference differs"
        if args.verify_artifacts:
            for u in value["units"]:
                assert actual_unit(read("artifacts/" + u["id"] + ".json")) == u, u["id"]
            suite = read("suite.json")
            assert [{k: v for k, v in p.items() if k != "evidence"} for p in suite["pairs"]] == value["pairs"]
            assert suite["summary"] == value["summary"]
    print("Independent added-value reference {}: 68 units and 531 paired outcomes.".format("written" if args.write else "verified"))


if __name__ == "__main__":
    main()
