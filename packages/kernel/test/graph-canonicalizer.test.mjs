import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  KernelValidationError,
  canonicalizeCandidate
} from "../src/index.js";

const REF_A = `sha256:${"a".repeat(64)}`;
const REF_B = `sha256:${"b".repeat(64)}`;
const REF_C = `sha256:${"c".repeat(64)}`;

function permuteCandidate(candidate, canonicalToOld) {
  const oldToNew = Array(canonicalToOld.length);
  canonicalToOld.forEach((oldIndex, newIndex) => { oldToNew[oldIndex] = newIndex; });
  return {
    domain: candidate.domain,
    nodes: canonicalToOld.map((oldIndex) => candidate.nodes[oldIndex]),
    edges: [...candidate.edges].reverse().map((edge) => ({
      ...edge,
      from: oldToNew[edge.from],
      to: oldToNew[edge.to]
    }))
  };
}

function nextPermutation(values) {
  const result = [...values];
  let pivot = result.length - 2;
  while (pivot >= 0 && result[pivot] >= result[pivot + 1]) pivot -= 1;
  if (pivot < 0) return null;
  let successor = result.length - 1;
  while (result[successor] <= result[pivot]) successor -= 1;
  [result[pivot], result[successor]] = [result[successor], result[pivot]];
  for (let left = pivot + 1, right = result.length - 1; left < right; left += 1, right -= 1) {
    [result[left], result[right]] = [result[right], result[left]];
  }
  return result;
}

function permutations(count, size) {
  const result = [];
  let current = Array.from({ length: size }, (_, index) => index);
  while (result.length < count) {
    current = nextPermutation(current);
    assert.ok(current, "fixture requested more permutations than available");
    result.push(current);
  }
  return result;
}

test("thirty independent node and edge permutations retain canonical candidate bytes", () => {
  const fixture = {
    domain: "element-exact",
    nodes: Array.from({ length: 5 }, () => ({ ref: REF_A })),
    edges: [
      { from: 0, to: 1, role: "supports" },
      { from: 1, to: 2, role: "supports" },
      { from: 2, to: 3, role: "transforms" },
      { from: 3, to: 4, role: "supports" },
      { from: 4, to: 0, role: "closes" },
      { from: 0, to: 2, role: "witnesses" }
    ]
  };
  const baseline = canonicalizeCandidate(fixture);
  for (const permutation of permutations(30, fixture.nodes.length)) {
    const result = canonicalizeCandidate(permuteCandidate(fixture, permutation));
    assert.equal(result.candidateId, baseline.candidateId);
    assert.equal(result.canonicalForm.bytesBase64, baseline.canonicalForm.bytesBase64);
    assert.equal(result.skeletonId, baseline.skeletonId);
  }
});

test("direction and role remain structural in non-isomorphic fixtures", () => {
  const forward = canonicalizeCandidate({
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [
      { from: 0, to: 1, role: "supports" },
      { from: 1, to: 2, role: "transforms" }
    ]
  });
  const reversed = canonicalizeCandidate({
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [
      { from: 1, to: 0, role: "supports" },
      { from: 1, to: 2, role: "transforms" }
    ]
  });
  const relabelled = canonicalizeCandidate({
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }, { ref: REF_C }],
    edges: [
      { from: 0, to: 1, role: "supports" },
      { from: 1, to: 2, role: "closes" }
    ]
  });
  assert.notEqual(forward.candidateId, reversed.candidateId);
  assert.notEqual(forward.candidateId, relabelled.candidateId);
  assert.equal(forward.skeletonId, reversed.skeletonId);
});

test("only declared structural attributes participate in candidate identity", () => {
  const make = (color, note) => ({
    domain: "single-candidate",
    nodes: [
      { ref: REF_A, attrs: { color, note } },
      { ref: REF_B }
    ],
    edges: [{ from: 0, to: 1, role: "supports", attrs: { confidence: color, comment: note } }]
  });
  const policy = {
    structuralNodeAttributes: ["color"],
    structuralEdgeAttributes: ["confidence"]
  };
  const first = canonicalizeCandidate(make("red", "first"), { policy });
  const annotationChanged = canonicalizeCandidate(make("red", "second"), { policy });
  const structureChanged = canonicalizeCandidate(make("blue", "second"), { policy });
  assert.equal(first.candidateId, annotationChanged.candidateId);
  assert.notEqual(first.candidateId, structureChanged.candidateId);
  assert.equal(first.candidate.nodes[0].attrs?.note, undefined);
});

test("canonical node and edge mappings are reversible", () => {
  const input = {
    domain: "profile-quotient",
    nodes: [{ ref: REF_B }, { ref: REF_A }, { ref: REF_C }],
    edges: [
      { from: 2, to: 0, role: "closes" },
      { from: 1, to: 2, role: "supports" }
    ]
  };
  const result = canonicalizeCandidate(input);
  result.inputToCanonical.forEach((canonical, inputIndex) => {
    assert.equal(result.canonicalToInput[canonical], inputIndex);
  });
  assert.deepEqual([...result.inputEdgeToCanonical].sort((a, b) => a - b), [0, 1]);
  assert.equal(canonicalizeCandidate(result.candidate).candidateId, result.candidateId);
});

test("supplied derived identities are verified instead of trusted", () => {
  const canonical = canonicalizeCandidate({
    domain: "single-candidate",
    nodes: [{ ref: REF_A }],
    edges: []
  });
  assert.throws(
    () => canonicalizeCandidate({ ...canonical.candidate, id: REF_B }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "CANDIDATE_ID_MISMATCH")
  );
});

test("graph policy rejects loops, parallel edges, and disconnected candidates", () => {
  assert.throws(
    () => canonicalizeCandidate({
      domain: "single-candidate",
      nodes: [{ ref: REF_A }],
      edges: [{ from: 0, to: 0, role: "loops" }]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "CANDIDATE_SELF_LOOP_FORBIDDEN")
  );
  assert.throws(
    () => canonicalizeCandidate({
      domain: "single-candidate",
      nodes: [{ ref: REF_A }, { ref: REF_B }],
      edges: [
        { from: 0, to: 1, role: "supports" },
        { from: 0, to: 1, role: "witnesses" }
      ]
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "CANDIDATE_PARALLEL_EDGE_FORBIDDEN")
  );
  assert.throws(
    () => canonicalizeCandidate({
      domain: "single-candidate",
      nodes: [{ ref: REF_A }, { ref: REF_B }],
      edges: []
    }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "CANDIDATE_DISCONNECTED")
  );
});

test("enabled loops and parallel multiplicity remain in canonical identity", () => {
  const policy = { allowSelfLoops: true, allowParallelEdges: true };
  const single = canonicalizeCandidate({
    domain: "single-candidate",
    nodes: [{ ref: REF_A }],
    edges: [{ from: 0, to: 0, role: "loops" }]
  }, { policy });
  const doubled = canonicalizeCandidate({
    domain: "single-candidate",
    nodes: [{ ref: REF_A }],
    edges: [
      { from: 0, to: 0, role: "loops" },
      { from: 0, to: 0, role: "loops" }
    ]
  }, { policy });
  assert.notEqual(single.candidateId, doubled.candidateId);
  assert.equal(single.skeletonId, doubled.skeletonId);
});

test("directed-strong connectivity requires reachability in both directions", () => {
  const input = {
    domain: "single-candidate",
    nodes: [{ ref: REF_A }, { ref: REF_B }],
    edges: [{ from: 0, to: 1, role: "supports" }]
  };
  assert.throws(
    () => canonicalizeCandidate(input, { policy: { connectivityProjection: "directed-strong" } }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((issue) => issue.code === "CANDIDATE_DISCONNECTED")
  );
  assert.doesNotThrow(() => canonicalizeCandidate({
    ...input,
    edges: [
      ...input.edges,
      { from: 1, to: 0, role: "supports" }
    ]
  }, { policy: { connectivityProjection: "directed-strong" } }));
});

test("canonicalization search has a hard deterministic budget", () => {
  assert.throws(
    () => canonicalizeCandidate({
      domain: "single-candidate",
      nodes: Array.from({ length: 5 }, () => ({ ref: REF_A })),
      edges: [
        { from: 0, to: 1, role: "cycle" },
        { from: 1, to: 2, role: "cycle" },
        { from: 2, to: 3, role: "cycle" },
        { from: 3, to: 4, role: "cycle" },
        { from: 4, to: 0, role: "cycle" }
      ]
    }, { limits: { maxSearchStates: 1 } }),
    (error) => error instanceof KernelError && error.code === "CANONICALIZATION_BUDGET_EXHAUSTED"
  );
});
