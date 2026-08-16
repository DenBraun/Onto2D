import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalizeCandidate, hashCanonical } from "../../packages/kernel/src/index.js";
import {
  CATALOG,
  MOTIFS,
  canonicalMfinderId,
  isWeaklyConnected,
  motifCandidate
} from "../../cases/three-node-motifs/src/catalog.mjs";
import {
  adjacencyFor,
  censusGraph,
  degreeSequence,
  parseInteractions,
  parseNodeDictionary
} from "../../cases/three-node-motifs/src/census.mjs";
import {
  createTrialRng,
  randomizeByMfinderSwitches
} from "../../cases/three-node-motifs/src/randomize.mjs";
import { THREE_NODE_MOTIF_EXPLORER_DATA } from "../../apps/three-node-motif-explorer/network-motif-data.js";
import {
  analyzeFflConstruction,
  deriveEcoliReading
} from "../../apps/three-node-motif-explorer/motif-reading.js";

const OFF_DIAGONAL = [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]];

test("the frozen catalogue has 13 unique, kernel-reproducible identities", () => {
  assert.equal(MOTIFS.length, 13);
  assert.equal(
    hashCanonical(CATALOG.identityBasis.nodeRefHashDomain, CATALOG.identityBasis.nodeRefHashValue),
    CATALOG.identityBasis.nodeRef
  );
  assert.equal(new Set(MOTIFS.map((motif) => motif.triadCode)).size, 13);
  assert.equal(new Set(MOTIFS.map((motif) => motif.mfinderId)).size, 13);
  assert.equal(new Set(MOTIFS.map((motif) => motif.canonicalId)).size, 13);

  for (const motif of MOTIFS) {
    const canonical = canonicalizeCandidate(motifCandidate(motif));
    assert.equal(canonicalMfinderId(motif.edges), motif.mfinderId, `${motif.triadCode} mfinder ID`);
    assert.equal(canonical.candidateId, motif.canonicalId, `${motif.triadCode} Onto2D ID`);
    assert.equal(canonical.skeletonId, motif.skeletonId, `${motif.triadCode} skeleton ID`);
  }
});

test("all 64 labelled loopless triads contain 54 connected graphs in exactly 13 classes", () => {
  const connectedCanonicalIds = new Set();
  let connectedLabelledGraphs = 0;
  for (let mask = 0; mask < 64; mask += 1) {
    const edges = OFF_DIAGONAL.filter((_, bit) => (mask & 2 ** bit) !== 0);
    if (!isWeaklyConnected(edges)) continue;
    connectedLabelledGraphs += 1;
    connectedCanonicalIds.add(canonicalizeCandidate({
      ...motifCandidate(MOTIFS[0]),
      edges: edges.map(([from, to]) => ({ from, to, role: "directed-link" }))
    }).candidateId);
  }
  assert.equal(connectedLabelledGraphs, 54);
  assert.deepEqual(connectedCanonicalIds, new Set(MOTIFS.map((motif) => motif.canonicalId)));
});

test("the ColiNet parser reverses target/source columns and includes dictionary-only nodes", () => {
  const nodes = parseNodeDictionary("1 target\n2 regulator\n3 isolated\n");
  const edges = parseInteractions("1 2 1\n", nodes);
  assert.deepEqual(edges, [[1, 0]]);
  const census = censusGraph({ nodeCount: nodes.length, edges });
  assert.equal(census.totalConnected, 0);
});

test("the sparse induced census recognizes a feed-forward loop once", () => {
  const edges = [[0, 1], [0, 2], [1, 2], [3, 0]];
  const census = censusGraph({ nodeCount: 4, edges });
  assert.equal(census.counts["030T"], 1);
  assert.equal(census.counts["021C"], 2);
  assert.equal(census.totalConnected, 3);
});

test("the deterministic switcher preserves every in/out/mutual degree", () => {
  const graph = {
    nodeCount: 8,
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 1]]
  };
  const first = randomizeByMfinderSwitches(graph, createTrialRng("test-seed", 4), 5);
  const second = randomizeByMfinderSwitches(graph, createTrialRng("test-seed", 4), 5);
  assert.deepEqual(first.edges, second.edges);
  assert.deepEqual(degreeSequence(graph.nodeCount, first.edges), degreeSequence(graph.nodeCount, graph.edges));
  assert.doesNotThrow(() => adjacencyFor(graph.nodeCount, first.edges));
});

test("the frozen 1,000-trial artifact reproduces the published E. coli ranking", async () => {
  const artifact = JSON.parse(await readFile(
    new URL("../../cases/three-node-motifs/artifacts/analysis.json", import.meta.url),
    "utf8"
  ));
  assert.equal(artifact.dataset.nodeCount, 424);
  assert.equal(artifact.dataset.edgeCount, 519);
  assert.equal(artifact.nullExecution.trials, 1000);
  assert.equal(artifact.observed.counts["030T"], 40);
  assert.equal(artifact.motifs[0].triadCode, "030T");
  assert.equal(artifact.comparison.onlyFflSignificant, true);
  assert.equal(artifact.comparison.roundedNullResultCompatible, true);
  assert.ok(artifact.motifs.find((motif) => motif.triadCode === "021C").zScore < 0);
});

test("the Explorer representation is an exact projection of the frozen case", async () => {
  const artifact = JSON.parse(await readFile(
    new URL("../../cases/three-node-motifs/artifacts/analysis.json", import.meta.url),
    "utf8"
  ));
  assert.equal(THREE_NODE_MOTIF_EXPLORER_DATA.motifs.length, 13);
  for (const catalogMotif of MOTIFS) {
    const explorerMotif = THREE_NODE_MOTIF_EXPLORER_DATA.motifs.find((motif) => motif.triadCode === catalogMotif.triadCode);
    const artifactMotif = artifact.motifs.find((motif) => motif.triadCode === catalogMotif.triadCode);
    assert.deepEqual(explorerMotif.edges, catalogMotif.edges);
    assert.equal(explorerMotif.canonicalId, catalogMotif.canonicalId);
    assert.equal(explorerMotif.observed, artifactMotif.observed);
    assert.equal(explorerMotif.nullMean, artifactMotif.nullMean);
    assert.equal(explorerMotif.zScore, artifactMotif.zScore);
    assert.equal(explorerMotif.rank, artifactMotif.rank);
  }
});

test("the Explorer derives the E. coli structural support boundary from frozen data", () => {
  const reading = deriveEcoliReading(THREE_NODE_MOTIF_EXPLORER_DATA);
  assert.equal(reading.observedClassCount, 4);
  assert.deepEqual(reading.allowedButAbsentCodes, ["030C"]);
  assert.equal(reading.nullFixedClassCount, 8);
  assert.deepEqual(reading.precursors.map((motif) => motif.triadCode), ["021D", "021U", "021C"]);
  assert.ok(Math.abs(reading.targetDeltaFromNull - 32.469) < 1e-12);
  assert.ok(reading.precursors.every((motif) => motif.deltaFromNull < 0));
});

test("the disclosed FFL edge-addition probe separates support from significance", () => {
  const observed = analyzeFflConstruction(THREE_NODE_MOTIF_EXPLORER_DATA, "observed");
  assert.equal(observed.freePathLength, 3);
  assert.equal(observed.admissiblePathLength, 3);
  assert.equal(observed.historicalLoad, 0);
  assert.equal(observed.survivingEdgeOrders, 6);

  const significant = analyzeFflConstruction(THREE_NODE_MOTIF_EXPLORER_DATA, "significant");
  assert.equal(significant.freePathLength, 3);
  assert.equal(significant.admissiblePathLength, Number.POSITIVE_INFINITY);
  assert.equal(significant.historicalLoad, Number.POSITIVE_INFINITY);
  assert.equal(significant.survivingEdgeOrders, 0);
});
