import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  KernelValidationError,
  advanceDecoratedCandidateEnumeration,
  canonicalize,
  createCandidateStore,
  enumerateConnectedSkeletons,
  enumerateDecoratedCandidates,
  verifyDecoratedCandidateEnumerationStep
} from "../src/index.js";
import {
  enumerateDecoratedCandidatesWithFrontierObserver,
  enumerateDecoratedCandidatesWithNodeFrontierObserver,
  enumerateDecoratedCandidatesWithNodeFrontierPruning
} from "../src/candidate-enumerator.js";

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
  assert.equal(result.counts.preAdmissionPrunedCandidates, 0);
  assert.equal(result.counts.attemptedCandidates, 8);
  assert.equal(result.counts.canonicalCandidates, 4);
  assert.equal(result.counts.duplicateCandidates, 4);
  assert.equal(
    result.counts.generatedCandidates,
    result.counts.policyExcludedCandidates +
      result.counts.preAdmissionPrunedCandidates +
      result.counts.attemptedCandidates
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

test("internal frontier observation reproduces complete raw traversal without changing output", () => {
  const observed = [];
  const execution = enumerateDecoratedCandidatesWithFrontierObserver(
    pairInput(),
    { maxEdges: 1 },
    (entry) => observed.push({
      rawCandidateOrdinal: entry.rawCandidateOrdinal,
      candidateId: entry.canonicalization.candidateId,
      edgeGroupCounts: entry.edgeGroupCounts
    })
  );
  const ordinary = enumerateDecoratedCandidates(pairInput(), { maxEdges: 1 });

  assert.equal(canonicalize(execution.enumeration), canonicalize(ordinary));
  assert.deepEqual(
    observed.map((entry) => entry.rawCandidateOrdinal),
    [0, 1, 2, 3, 4, 5, 6, 7]
  );
  assert.ok(observed.every((entry) => entry.edgeGroupCounts.length === 1));
  assert.ok(observed.every((entry) => entry.edgeGroupCounts[0] === 1));
  assert.deepEqual(
    [...new Set(observed.map((entry) => entry.candidateId))].sort(),
    ordinary.candidateStore.candidates.map((entry) => entry.candidateId)
  );
});

test("incomplete-node frontiers expose exact descendants without changing traversal", () => {
  const observed = [];
  const execution = enumerateDecoratedCandidatesWithNodeFrontierObserver(
    pairInput(),
    { maxEdges: 1 },
    (entry) => observed.push(entry.frontier)
  );
  const ordinary = enumerateDecoratedCandidates(pairInput(), { maxEdges: 1 });

  assert.equal(canonicalize(execution.enumeration), canonicalize(ordinary));
  assert.equal(observed.length, 2);
  assert.ok(observed.every((frontier) => frontier.assignedNodes === 1));
  assert.ok(observed.every((frontier) => frontier.totalNodes === 2));
  assert.ok(observed.every(
    (frontier) => frontier.remainingNodeAssignments === 1
  ));
  assert.ok(observed.every(
    (frontier) => frontier.edgeRawCandidatesPerAssignment === 2
  ));
  assert.ok(observed.every(
    (frontier) => frontier.remainingRawCandidates === 4
  ));
});

test("node-frontier pruning reconciles exact skipped raw descendants", () => {
  const execution = enumerateDecoratedCandidatesWithNodeFrontierPruning(
    pairInput(),
    { maxEdges: 1 },
    (entry) => ({
      pruningAuthorized: entry.candidateInput.nodes[0].ref === REF_A
    })
  );

  assert.equal(execution.enumeration.status, "complete");
  assert.equal(execution.enumeration.counts.generatedCandidates, 4);
  assert.equal(execution.enumeration.counts.nodeBranchPrunedRawCandidates, 4);
  assert.equal(execution.enumeration.counts.nodeBranchPrunedFrontiers, 1);
  assert.equal(execution.enumeration.counts.logicalRawCandidates, 8);
  assert.equal(execution.pruning.nodeBranchPrunedRawCandidates, 4);
  assert.equal(execution.pruning.nodeBranchPrunedFrontiers, 1);
  assert.ok(execution.enumeration.candidateStore.candidates.every((entry) =>
    entry.candidate.nodes.some((node) => node.ref === REF_B)
  ));
});

test("resumable enumeration replays verified prefixes and returns the ordinary terminal result", () => {
  const options = { maxEdges: 1 };
  const first = advanceDecoratedCandidateEnumeration(
    pairInput(),
    options,
    { maxRawCandidatesPerStep: 3 }
  );
  assert.equal(first.status, "paused");
  assert.deepEqual(first.step, {
    startRawCandidateOrdinal: 0,
    endRawCandidateOrdinal: 3,
    maximumRawCandidates: 3,
    processedRawCandidates: 3,
    replayedRawCandidates: 0
  });
  assert.equal(first.checkpoint.nextRawCandidateOrdinal, 3);
  assert.deepEqual(
    verifyDecoratedCandidateEnumerationStep(
      first,
      pairInput(),
      options,
      { maxRawCandidatesPerStep: 3 }
    ),
    first
  );

  const second = advanceDecoratedCandidateEnumeration(
    pairInput(),
    options,
    {
      checkpoint: first.checkpoint,
      maxRawCandidatesPerStep: 3
    }
  );
  assert.equal(second.status, "paused");
  assert.equal(second.step.startRawCandidateOrdinal, 3);
  assert.equal(second.step.endRawCandidateOrdinal, 6);
  assert.equal(second.step.replayedRawCandidates, 3);
  assert.equal(second.previousCheckpointHash, first.checkpoint.checkpointHash);

  const final = advanceDecoratedCandidateEnumeration(
    pairInput(),
    options,
    {
      checkpoint: second.checkpoint,
      maxRawCandidatesPerStep: 3
    }
  );
  assert.equal(final.status, "complete");
  assert.equal(final.checkpoint, null);
  assert.equal(final.step.startRawCandidateOrdinal, 6);
  assert.equal(final.step.endRawCandidateOrdinal, 8);
  assert.equal(final.step.processedRawCandidates, 2);
  assert.equal(
    canonicalize(final.enumeration),
    canonicalize(enumerateDecoratedCandidates(pairInput(), options))
  );

  const tampered = structuredClone(first.checkpoint);
  tampered.nextRawCandidateOrdinal = 4;
  assert.throws(
    () => advanceDecoratedCandidateEnumeration(
      pairInput(),
      options,
      { checkpoint: tampered, maxRawCandidatesPerStep: 3 }
    ),
    (error) => error instanceof KernelError &&
      error.code === "CANDIDATE_RESUME_CHECKPOINT_HASH_MISMATCH"
  );
});

test("resumable enumeration never bypasses an exhausted semantic budget", () => {
  const result = advanceDecoratedCandidateEnumeration(
    pairInput(),
    { maxEdges: 1, maxRawCandidates: 2 },
    { maxRawCandidatesPerStep: 3 }
  );

  assert.equal(result.status, "budget-exhausted");
  assert.equal(result.checkpoint, null);
  assert.equal(result.enumeration.status, "budget-exhausted");
  assert.equal(result.enumeration.budget.exhausted.budget, "maxRawCandidates");
  assert.deepEqual(result.interpretation, {
    status: "budget-exhausted",
    reasons: ["semantic-enumeration-budget-exhausted"]
  });
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
