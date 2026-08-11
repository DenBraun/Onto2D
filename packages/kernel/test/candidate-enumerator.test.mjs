import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelValidationError,
  canonicalize,
  createCandidateStore,
  enumerateConnectedSkeletons,
  enumerateDecoratedCandidates
} from "../src/index.js";

const REF_A = `sha256:${"a".repeat(64)}`;
const REF_B = `sha256:${"b".repeat(64)}`;

const PAIR_SKELETON = Object.freeze({ nodeCount: 2, edges: [[0, 1]] });

function pairInput(overrides = {}) {
  return {
    domain: "element-exact",
    skeletons: [PAIR_SKELETON],
    nodeVariants: [{ ref: REF_A }, { ref: REF_B }],
    edgeVariants: [{ role: "supports" }],
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: [],
      structuralEdgeAttributes: []
    },
    ...overrides
  };
}

function bruteForcePairIds() {
  const store = createCandidateStore({ domain: "element-exact" });
  const variants = [{ ref: REF_A }, { ref: REF_B }];
  for (const left of variants) {
    for (const right of variants) {
      for (const [from, to] of [[0, 1], [1, 0]]) {
        store.add({
          domain: "element-exact",
          nodes: [left, right],
          edges: [{ from, to, role: "supports" }]
        });
      }
    }
  }
  return store.finalize();
}

test("decorated enumeration reconciles with a direct bounded brute-force reference", () => {
  const result = enumerateDecoratedCandidates(pairInput(), { maxEdges: 1 });
  const reference = bruteForcePairIds();

  assert.equal(result.status, "complete");
  assert.equal(result.interpretable, true);
  assert.equal(result.counts.generatedCandidates, 8);
  assert.equal(result.counts.policyExcludedCandidates, 0);
  assert.equal(result.counts.attemptedCandidates, 8);
  assert.equal(result.counts.canonicalCandidates, 4);
  assert.equal(result.counts.duplicateCandidates, 4);
  assert.equal(
    result.counts.generatedCandidates,
    result.counts.policyExcludedCandidates + result.counts.attemptedCandidates
  );
  assert.deepEqual(
    result.candidateStore.candidates.map((entry) => entry.candidateId),
    reference.candidates.map((entry) => entry.candidateId)
  );

  const fromEnumerationRecords = enumerateDecoratedCandidates(pairInput({
    skeletons: enumerateConnectedSkeletons(2).skeletons
  }), { maxEdges: 1 });
  assert.equal(canonicalize(fromEnumerationRecords), canonicalize(result));
});

test("enumeration artifacts do not depend on variant or skeleton endpoint order", () => {
  const first = enumerateDecoratedCandidates(pairInput({
    edgeVariants: [{ role: "transforms" }, { role: "supports" }]
  }), { maxEdges: 1 });
  const second = enumerateDecoratedCandidates(pairInput({
    skeletons: [{ nodeCount: 2, edges: [[1, 0]] }],
    nodeVariants: [{ ref: REF_B }, { ref: REF_A }],
    edgeVariants: [{ role: "supports" }, { role: "transforms" }]
  }), { maxEdges: 1 });

  assert.equal(canonicalize(first), canonicalize(second));
  assert.deepEqual(first.edgeVariants.map((entry) => entry.role), ["supports", "transforms"]);
});

test("parallel decoration enumerates edge-label multisets without edge-order duplicates", () => {
  const result = enumerateDecoratedCandidates(pairInput({
    nodeVariants: [{ ref: REF_A }],
    graphPolicy: {
      ...pairInput().graphPolicy,
      allowParallelEdges: true
    }
  }), { maxEdges: 2 });

  assert.equal(result.status, "complete");
  assert.equal(result.counts.generatedCandidates, 5);
  assert.equal(result.counts.canonicalCandidates, 3);
  assert.equal(result.counts.duplicateCandidates, 2);
  assert.deepEqual(
    [...new Set(result.candidateStore.candidates.map((entry) => entry.candidate.edges.length))]
      .sort((left, right) => left - right),
    [1, 2]
  );
});

test("enabled self-loops are optional decorations within the fixed edge bound", () => {
  const result = enumerateDecoratedCandidates(pairInput({
    skeletons: [{ nodeCount: 1, edges: [] }],
    nodeVariants: [{ ref: REF_A }],
    graphPolicy: {
      ...pairInput().graphPolicy,
      allowSelfLoops: true
    }
  }), { maxEdges: 1 });

  assert.equal(result.status, "complete");
  assert.equal(result.counts.generatedCandidates, 2);
  assert.equal(result.counts.canonicalCandidates, 2);
  assert.deepEqual(
    result.candidateStore.candidates.map((entry) => entry.candidate.edges.length).sort(),
    [0, 1]
  );
});

test("directed-strong connectivity exclusions remain separate from candidate-store attempts", () => {
  const result = enumerateDecoratedCandidates(pairInput({
    graphPolicy: {
      ...pairInput().graphPolicy,
      connectivityProjection: "directed-strong"
    }
  }), { maxEdges: 1 });

  assert.equal(result.status, "complete");
  assert.equal(result.counts.generatedCandidates, 8);
  assert.equal(result.counts.policyExcludedCandidates, 8);
  assert.equal(result.counts.attemptedCandidates, 0);
  assert.equal(result.counts.canonicalCandidates, 0);
  assert.equal(result.candidateStore.status, "complete");
});

test("raw, unique-candidate, and decoration-state exhaustion are explicit", () => {
  const raw = enumerateDecoratedCandidates(pairInput(), {
    maxEdges: 1,
    maxRawCandidates: 1
  });
  assert.equal(raw.status, "budget-exhausted");
  assert.equal(raw.interpretable, false);
  assert.equal(raw.counts.generatedCandidates, 1);
  assert.equal(raw.budget.exhausted?.budget, "maxRawCandidates");
  assert.equal(raw.candidateStore.status, "open");

  const unique = enumerateDecoratedCandidates(pairInput(), {
    maxEdges: 1,
    maxCandidates: 1
  });
  assert.equal(unique.status, "budget-exhausted");
  assert.equal(unique.budget.exhausted?.budget, "maxCandidates");
  assert.equal(unique.candidateStore.status, "budget-exhausted");
  assert.equal(unique.counts.canonicalCandidates, 1);
  assert.equal(unique.counts.duplicateCandidates, 1);

  const states = enumerateDecoratedCandidates(pairInput(), {
    maxEdges: 1,
    maxDecorationStates: 1
  });
  assert.equal(states.status, "budget-exhausted");
  assert.equal(states.budget.exhausted?.budget, "maxDecorationStates");
  assert.equal(states.counts.decorationStates, 1);
  assert.equal(states.counts.generatedCandidates, 0);
});

test("edge bounds can define an empty but complete decorated universe", () => {
  const result = enumerateDecoratedCandidates(pairInput(), {
    maxEdges: 0,
    canonicalizationLimits: { maxEdges: 0 }
  });
  assert.equal(result.status, "complete");
  assert.equal(result.interpretable, true);
  assert.equal(result.counts.edgeBoundExcludedSkeletons, 1);
  assert.equal(result.counts.generatedCandidates, 0);
  assert.equal(result.candidateStore.status, "complete");

  const simplePolicyMaximum = enumerateDecoratedCandidates(pairInput({
    skeletons: [{ nodeCount: 3, edges: [[0, 1], [1, 2]] }],
    nodeVariants: [{ ref: REF_A }]
  }), {
    canonicalizationLimits: { maxEdges: 2 }
  });
  assert.equal(simplePolicyMaximum.status, "complete");
  assert.equal(simplePolicyMaximum.counts.generatedCandidates, 4);
  assert.equal(simplePolicyMaximum.budget.maxEdges, "n+2");
});

test("canonicalization search exhaustion is returned as generator truncation", () => {
  const result = enumerateDecoratedCandidates(pairInput({
    skeletons: [{
      nodeCount: 6,
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]
    }],
    nodeVariants: [{ ref: REF_A }]
  }), {
    maxEdges: 5,
    canonicalizationLimits: { maxSearchStates: 720 }
  });

  assert.equal(result.status, "budget-exhausted");
  assert.equal(result.budget.exhausted?.budget, "maxSearchStates");
  assert.equal(result.budget.exhausted?.used, 721);
  assert.equal(result.counts.generatedCandidates, 1);
  assert.equal(result.counts.canonicalizationIndeterminateCandidates, 1);
  assert.equal(result.counts.attemptedCandidates, 0);
});

test("enumeration closes its input vocabulary before doing partial work", () => {
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      nodeVariants: [{ ref: "not-a-hash" }],
      edgeVariants: [{ role: " not-normalized " }]
    }), { maxEdges: 1 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.path === "$input.nodeVariants[0].ref") &&
      error.issues.some((entry) => entry.path === "$input.edgeVariants[0].role")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      nodeVariants: [{ ref: REF_A, attrs: { hidden: true } }]
    }), { maxEdges: 1 }),
    (error) => error instanceof KernelValidationError &&
      error.code === "CANDIDATE_ENUMERATION_VALIDATION_FAILED" &&
      error.issues.some((entry) => entry.code === "CANDIDATE_ENUMERATION_ATTRIBUTE_NOT_STRUCTURAL")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      edgeVariants: [{ role: "supports" }, { role: "supports" }]
    }), { maxEdges: 1 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "CANDIDATE_ENUMERATION_EDGE_VARIANT_DUPLICATE")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput(), { maxEdges: -1 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "CANDIDATE_ENUMERATION_EDGE_BUDGET_INVALID")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      skeletons: [{ nodeCount: 1, edges: [] }],
      graphPolicy: {
        ...pairInput().graphPolicy,
        structuralNodeAttributes: ["length"]
      },
      nodeVariants: [
        {
          ref: REF_A,
          attrs: {
            length: {
              value: 1,
              unit: "m",
              tolerance: { absolute: 0.001 },
              semantic: "length",
              provenance: { kind: "declared", evidence: [] }
            }
          }
        },
        {
          ref: REF_A,
          attrs: {
            length: {
              value: 100,
              unit: "cm",
              tolerance: { absolute: 0.1 },
              semantic: "length",
              provenance: { kind: "declared", evidence: [] }
            }
          }
        }
      ]
    }), { maxEdges: 0 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "CANDIDATE_ENUMERATION_NODE_VARIANT_DUPLICATE")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      skeletons: [{ nodeCount: 3, edges: [[0, 1]] }]
    }), { maxEdges: 1 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "CANDIDATE_ENUMERATION_SKELETON_DISCONNECTED")
  );
  assert.throws(
    () => enumerateDecoratedCandidates(pairInput({
      skeletons: [{ nodeCount: 2, edges: [[0, 1]], labelledMultiplicity: "invalid" }]
    }), { maxEdges: 1 }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) =>
        entry.code === "CANDIDATE_ENUMERATION_LABELLED_MULTIPLICITY_INVALID" &&
        entry.path === "$input.skeletons[0].labelledMultiplicity"
      )
  );
});
