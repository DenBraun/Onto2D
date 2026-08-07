import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  KernelValidationError,
  canonicalizeSkeleton,
  enumerateConnectedSkeletons
} from "../src/index.js";

const conformanceFixture = JSON.parse(await readFile(
  new URL("../../../test/fixtures/skeleton-conformance-v1.json", import.meta.url),
  "utf8"
));

test("connected skeletons match independent exhaustive permutation-orbit goldens", () => {
  assert.equal(conformanceFixture.generatedBy.importsKernel, false);
  for (const level of conformanceFixture.levels) {
    const result = enumerateConnectedSkeletons(level.nodeCount);
    assert.equal(result.status, "complete");
    assert.equal(result.interpretable, true);
    assert.equal(result.counts.totalLabelledGraphs, level.totalLabelledGraphs);
    assert.equal(result.counts.connectedLabelledGraphs, level.connectedLabelledGraphs);
    assert.equal(result.counts.uniqueSkeletons, level.uniqueSkeletons);
    assert.equal(result.skeletons.length, level.uniqueSkeletons);
    assert.equal(
      result.skeletons.reduce((sum, skeleton) => sum + skeleton.labelledMultiplicity, 0),
      result.counts.connectedLabelledGraphs
    );
    assert.deepEqual(
      result.skeletons.map((skeleton) => skeleton.id),
      result.skeletons.map((skeleton) => skeleton.id).sort()
    );
    assert.deepEqual(
      result.skeletons.map((skeleton) => ({
        id: skeleton.id,
        edges: skeleton.edges,
        bytesBase64: skeleton.canonicalForm.bytesBase64,
        labelledMultiplicity: skeleton.labelledMultiplicity
      })),
      level.skeletons,
      `n=${level.nodeCount}`
    );
  }
});

test("skeleton identity is invariant under endpoint order and node permutation", () => {
  const first = canonicalizeSkeleton({
    nodeCount: 4,
    edges: [[0, 1], [1, 2], [2, 3], [0, 2]]
  });
  const permuted = canonicalizeSkeleton({
    nodeCount: 4,
    edges: [[2, 0], [3, 2], [1, 3], [2, 1]]
  });
  assert.equal(first.skeletonId, permuted.skeletonId);
  assert.equal(first.canonicalForm.bytesBase64, permuted.canonicalForm.bytesBase64);
  assert.equal(canonicalizeSkeleton(first.skeleton).skeletonId, first.skeletonId);
  first.inputToCanonical.forEach((canonical, inputIndex) => {
    assert.equal(first.canonicalToInput[canonical], inputIndex);
  });
});

test("standalone skeleton canonicalization preserves disconnected simple graphs", () => {
  const result = canonicalizeSkeleton({
    nodeCount: 4,
    edges: [[0, 1], [2, 3]]
  });
  assert.equal(result.skeleton.nodeCount, 4);
  assert.equal(result.skeleton.edges.length, 2);
  assert.match(result.skeletonId, /^sha256:[a-f0-9]{64}$/);
});

test("simple skeleton validation rejects loops and duplicate undirected edges", () => {
  assert.throws(
    () => canonicalizeSkeleton({ nodeCount: 2, edges: [[0, 0]] }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "SKELETON_SELF_LOOP_FORBIDDEN")
  );
  assert.throws(
    () => canonicalizeSkeleton({ nodeCount: 2, edges: [[0, 1], [1, 0]] }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "SKELETON_PARALLEL_EDGE_FORBIDDEN")
  );
});

test("labelled-graph budget exhaustion is explicit and non-interpretable", () => {
  const result = enumerateConnectedSkeletons(4, { maxLabelledGraphs: 10 });
  assert.equal(result.status, "budget-exhausted");
  assert.equal(result.interpretable, false);
  assert.equal(result.counts.examinedLabelledGraphs, 10);
  assert.equal(result.budget.exhausted?.budget, "maxLabelledGraphs");
  assert.equal(result.budget.exhausted?.used, 10);
});

test("unique-skeleton budget records the first excluded canonical ID", () => {
  const result = enumerateConnectedSkeletons(3, { maxSkeletons: 1 });
  assert.equal(result.status, "budget-exhausted");
  assert.equal(result.counts.uniqueSkeletons, 1);
  assert.equal(result.budget.exhausted?.budget, "maxSkeletons");
  assert.match(result.budget.exhausted?.firstExcludedSkeletonId, /^sha256:[a-f0-9]{64}$/);
});
