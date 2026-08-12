import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  canonicalize,
  constructPackageCohorts,
  createKernel,
  evaluatePackageCandidateCensus,
  hashCanonical,
  loadKernelPackage,
  verifyPackageCohortPartition
} from "../src/index.js";

function quantity(value, semantic, absolute = 0) {
  return {
    value,
    unit: "m",
    tolerance: { absolute },
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function primitive(sourceId, invariants = {}) {
  return {
    sourceId,
    kind: "primitive",
    typeTags: [sourceId],
    invariants,
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function predicate(id, expr) {
  return {
    id,
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "below",
    expr,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  };
}

function runConfig({ maxNodes = 1, maxEdges = 0, indeterminateThreshold = 0 } = {}) {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes,
      maxEdges,
      maxCandidates: 10_000,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "package-cohort-fixture-v1",
    invariantPrecision: {
      id: "cohort-precision-v1",
      decimalPlaces: 6,
      rounding: "half-even",
      summation: "exact-decimal"
    },
    graphPolicy: {
      connected: true,
      allowParallelEdges: false,
      allowSelfLoops: false,
      connectivityProjection: "undirected",
      structuralNodeAttributes: [],
      structuralEdgeAttributes: []
    },
    substructurePolicy: {
      id: "cohort-substructure-v1",
      remove: "nodes-and-edges",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold
  };
}

function loaded({
  primitives,
  cohortRules,
  predicates = [],
  candidateAttributes = []
}) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "package-cohort-fixture",
    version: "1.0.0",
    primitives,
    predicates,
    cohortRules,
    candidateAttributes
  });
}

test("cohort keys execute package structural attribute sums", () => {
  const packageArtifact = loaded({
    primitives: [primitive("attribute-source")],
    candidateAttributes: [{
      name: "mass",
      target: "nodes",
      source: {
        kind: "constant-quantity-v1",
        value: {
          value: 1,
          unit: "kg",
          tolerance: { absolute: 0 },
          semantic: "mass",
          provenance: { kind: "declared", evidence: [] }
        }
      }
    }],
    cohortRules: [{
      id: "mass-key",
      kind: "shared-support",
      resourceKey: [{
        kind: "sum",
        attribute: "mass",
        set: { kind: "nodes", selector: { kind: "all" } }
      }]
    }]
  });
  const config = runConfig();
  config.graphPolicy.structuralNodeAttributes = ["mass"];
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const partition = constructPackageCohorts(
    packageArtifact,
    config,
    census,
    "mass-key"
  );
  assert.equal(partition.status, "complete");
  assert.equal(partition.cohorts.length, 1);
  assert.ok(partition.keyEvaluations.every((entry) =>
    entry.expressions[0].status === "resolved" &&
    entry.expressions[0].selections[0].attribute === "mass" &&
    entry.expressions[0].selections[0].valueKind === "quantity"
  ));
});

function censusAndPartition(packageArtifact, config, ruleId) {
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const partition = constructPackageCohorts(
    packageArtifact,
    config,
    census,
    ruleId
  );
  return { census, partition };
}

test("explicit global and singleton rules form exact complete partitions", () => {
  const packageArtifact = loaded({
    primitives: [primitive("source-c"), primitive("source-b"), primitive("source-a")],
    cohortRules: [
      { id: "all", kind: "global" },
      { id: "alone", kind: "singleton" }
    ]
  });
  const config = runConfig();
  const census = evaluatePackageCandidateCensus(packageArtifact, config);
  const global = constructPackageCohorts(
    packageArtifact,
    config,
    census,
    "all"
  );
  const singleton = constructPackageCohorts(
    packageArtifact,
    config,
    census,
    "alone"
  );

  assert.equal(global.status, "complete");
  assert.equal(global.cohorts.length, 1);
  assert.deepEqual(global.cohorts[0].members, global.eligibleCandidateIds);
  assert.equal(global.counts.coveredMembers, 3);
  assert.equal(singleton.status, "complete");
  assert.equal(singleton.cohorts.length, 3);
  assert.ok(singleton.cohorts.every((entry) => entry.members.length === 1));
  assert.deepEqual(
    singleton.cohorts.flatMap((entry) => entry.members).sort(),
    singleton.eligibleCandidateIds
  );
  const { partitionHash, ...basis } = global;
  assert.equal(
    partitionHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_COHORT_PARTITION, basis)
  );
  const cohort = global.cohorts[0];
  assert.equal(cohort.cohortId, hashCanonical(HASH_DOMAINS.COHORT, {
    ruleId: "all",
    ruleKind: "global",
    key: cohort.key,
    members: cohort.members
  }));
  assert.ok(Object.isFrozen(global));
  assert.ok(Object.isFrozen(global.cohorts));
});

test("shared-support uses transitive incidence components without overlap", () => {
  const packageArtifact = loaded({
    primitives: [
      primitive("source-d", {
        first: quantity(4, "first resource"),
        second: quantity(4, "second resource")
      }),
      primitive("source-c", {
        first: quantity(3, "first resource"),
        second: quantity(2, "second resource")
      }),
      primitive("source-b", {
        first: quantity(1, "first resource"),
        second: quantity(2, "second resource")
      }),
      primitive("source-a", {
        first: quantity(1, "first resource"),
        second: quantity(9, "second resource")
      })
    ],
    cohortRules: [{
      id: "support-components",
      kind: "shared-support",
      resourceKey: [
        { kind: "invariant", name: "first" },
        { kind: "invariant", name: "second" }
      ]
    }]
  });
  const { partition } = censusAndPartition(
    packageArtifact,
    runConfig(),
    "support-components"
  );

  assert.equal(partition.status, "complete");
  assert.equal(partition.cohorts.length, 2);
  assert.deepEqual(
    partition.cohorts.map((entry) => entry.members.length).sort(),
    [1, 3]
  );
  assert.ok(partition.keyEvaluations.every((entry) =>
    entry.key.kind === "shared-support" &&
    entry.key.resourceTokens.length === 2 &&
    entry.expressions.every((expression) =>
      expression.status === "resolved" && expression.invariants.length === 1
    )
  ));
  const members = partition.cohorts.flatMap((entry) => entry.members);
  assert.equal(new Set(members).size, 4);
  assert.deepEqual([...members].sort(), partition.eligibleCandidateIds);
});

test("profile-role preserves ordered normalized tuples", () => {
  const packageArtifact = loaded({
    primitives: [
      primitive("source-c", {
        role: quantity(2, "role"),
        polarity: quantity(1, "polarity")
      }),
      primitive("source-b", {
        role: quantity(1, "role"),
        polarity: quantity(2, "polarity")
      }),
      primitive("source-a", {
        role: quantity(1, "role"),
        polarity: quantity(2, "polarity")
      })
    ],
    cohortRules: [{
      id: "role-tuples",
      kind: "profile-role",
      roleKey: [
        { kind: "invariant", name: "role" },
        { kind: "invariant", name: "polarity" }
      ]
    }]
  });
  const { partition } = censusAndPartition(
    packageArtifact,
    runConfig(),
    "role-tuples"
  );

  assert.equal(partition.status, "complete");
  assert.deepEqual(
    partition.cohorts.map((entry) => entry.members.length).sort(),
    [1, 2]
  );
  const pair = partition.cohorts.find((entry) => entry.members.length === 2);
  assert.equal(pair.key.kind, "profile-role");
  assert.deepEqual(
    pair.key.atoms.map((atom) => atom.value.canonical),
    ["1", "2"]
  );
});

test("profile-role partitions on package-authored scalar invariant tuples", () => {
  const packageArtifact = loaded({
    primitives: [
      primitive("source-c", { role: "sink", active: false, marker: null }),
      primitive("source-b", { role: "source", active: true, marker: null }),
      primitive("source-a", { role: "source", active: true, marker: null })
    ],
    cohortRules: [{
      id: "scalar-role-tuples",
      kind: "profile-role",
      roleKey: [
        { kind: "invariant", name: "role" },
        { kind: "invariant", name: "active" },
        { kind: "invariant", name: "marker" }
      ]
    }]
  });
  const { partition } = censusAndPartition(
    packageArtifact,
    runConfig(),
    "scalar-role-tuples"
  );

  assert.equal(partition.status, "complete");
  assert.deepEqual(
    partition.cohorts.map((entry) => entry.members.length).sort(),
    [1, 2]
  );
  const pair = partition.cohorts.find((entry) => entry.members.length === 2);
  assert.deepEqual(pair.key.atoms, [
    { kind: "string", value: "source" },
    { kind: "boolean", value: true },
    { kind: "null", value: null }
  ]);
  assert.ok(partition.keyEvaluations.every((entry) =>
    entry.expressions.every((expression) =>
      expression.status === "resolved" &&
      expression.invariants[0].valueKind !== undefined
    )
  ));
});

test("cohort keys can explicitly aggregate non-identical numeric profile invariants", () => {
  const packageArtifact = loaded({
    primitives: [
      primitive("source-b", { score: 3 }),
      primitive("source-a", { score: 1 })
    ],
    cohortRules: [{
      id: "mean-profile-score",
      kind: "profile-role",
      roleKey: [{
        kind: "invariant",
        name: "score",
        profileAggregation: "arithmetic-mean-conservative-v1"
      }]
    }]
  });
  const config = { ...runConfig(), countingDomain: "profile-quotient" };
  const { partition } = censusAndPartition(
    packageArtifact,
    config,
    "mean-profile-score"
  );
  const expression = partition.keyEvaluations[0].expressions[0];

  assert.equal(partition.status, "complete");
  assert.equal(partition.cohorts.length, 1);
  assert.equal(partition.cohorts[0].key.atoms[0].kind, "number");
  assert.equal(partition.cohorts[0].key.atoms[0].value.canonical, "2");
  assert.equal(
    expression.invariants[0].aggregation.policy,
    "arithmetic-mean-conservative-v1"
  );
  assert.equal(expression.invariants[0].consensusPolicy, undefined);
});

test("invariant windows use exact signed floor bins and half-open boundaries", () => {
  const packageArtifact = loaded({
    primitives: [
      primitive("source-d", { position: quantity(1, "position") }),
      primitive("source-c", { position: quantity(0.999, "position") }),
      primitive("source-b", { position: quantity(0, "position") }),
      primitive("source-a", { position: quantity(-0.001, "position") })
    ],
    cohortRules: [{
      id: "position-window",
      kind: "invariant-window",
      value: { kind: "invariant", name: "position" },
      origin: quantity(0, "position"),
      width: quantity(1, "position"),
      bins: "lower-closed-upper-open"
    }]
  });
  const { partition } = censusAndPartition(
    packageArtifact,
    runConfig(),
    "position-window"
  );

  assert.equal(partition.status, "complete");
  const bins = Object.fromEntries(partition.cohorts.map((entry) => [
    entry.key.binIndex,
    entry.members.length
  ]));
  assert.deepEqual(bins, { "-1": 1, "0": 2, "1": 1 });
});

test("uncertain boundaries and missing keys block every partial cohort", () => {
  const containedPackage = loaded({
    primitives: [primitive("source-a", {
      position: quantity(0.5, "position", 0.1)
    })],
    cohortRules: [{
      id: "contained-window",
      kind: "invariant-window",
      value: { kind: "invariant", name: "position" },
      origin: quantity(0, "position"),
      width: quantity(1, "position"),
      bins: "lower-closed-upper-open"
    }]
  });
  const contained = censusAndPartition(
    containedPackage,
    runConfig(),
    "contained-window"
  ).partition;
  assert.equal(contained.status, "complete");
  assert.equal(contained.cohorts[0].key.binIndex, "0");

  const crossingPackage = loaded({
    primitives: [primitive("source-a", {
      position: quantity(0.95, "position", 0.1)
    })],
    cohortRules: [{
      id: "crossing-window",
      kind: "invariant-window",
      value: { kind: "invariant", name: "position" },
      origin: quantity(0, "position"),
      width: quantity(1, "position"),
      bins: "lower-closed-upper-open"
    }]
  });
  const crossing = censusAndPartition(
    crossingPackage,
    runConfig(),
    "crossing-window"
  ).partition;
  assert.equal(crossing.status, "indeterminate");
  assert.equal(crossing.reason, "cohort-key-indeterminate");
  assert.equal(
    crossing.keyEvaluations[0].reason,
    "window-value-crosses-boundary"
  );
  assert.deepEqual(crossing.cohorts, []);
  assert.equal(crossing.counts.coveredMembers, 0);

  const uncertainOriginPackage = loaded({
    primitives: [primitive("source-a", {
      position: quantity(0.5, "position")
    })],
    cohortRules: [{
      id: "uncertain-origin",
      kind: "invariant-window",
      value: { kind: "invariant", name: "position" },
      origin: quantity(0, "position", 0.01),
      width: quantity(1, "position"),
      bins: "lower-closed-upper-open"
    }]
  });
  const uncertainOrigin = censusAndPartition(
    uncertainOriginPackage,
    runConfig(),
    "uncertain-origin"
  ).partition;
  assert.equal(
    uncertainOrigin.keyEvaluations[0].reason,
    "window-origin-uncertain"
  );

  const missingPackage = loaded({
    primitives: [
      primitive("source-b"),
      primitive("source-a", { role: quantity(1, "role") })
    ],
    cohortRules: [{
      id: "missing-role",
      kind: "profile-role",
      roleKey: [{ kind: "invariant", name: "role" }]
    }]
  });
  const missing = censusAndPartition(
    missingPackage,
    runConfig(),
    "missing-role"
  ).partition;
  assert.equal(missing.status, "indeterminate");
  assert.ok(missing.keyEvaluations.some((entry) =>
    entry.reason === "invariant-value-unavailable"
  ));
  assert.deepEqual(missing.cohorts, []);
});

test("empty and census-indeterminate populations remain explicit", () => {
  const rejectedPackage = loaded({
    primitives: [primitive("source-b"), primitive("source-a")],
    predicates: [predicate("requires-support", {
      op: "countRole",
      role: "support",
      min: 1
    })],
    cohortRules: [{ id: "all", kind: "global" }]
  });
  const rejected = censusAndPartition(
    rejectedPackage,
    runConfig(),
    "all"
  ).partition;
  assert.equal(rejected.status, "empty");
  assert.equal(rejected.reason, "no-eligible-candidates");
  assert.equal(rejected.excludedCandidateIds.predicateRejected.length, 2);
  assert.deepEqual(rejected.eligibleCandidateIds, []);

  const indeterminatePackage = loaded({
    primitives: [primitive("source-a")],
    predicates: [predicate("unknown-node", {
      op: "degree",
      node: { kind: "canonical-index", index: 9 },
      min: 0
    })],
    cohortRules: [{ id: "all", kind: "global" }]
  });
  const indeterminate = censusAndPartition(
    indeterminatePackage,
    runConfig({ indeterminateThreshold: 0 }),
    "all"
  ).partition;
  assert.equal(indeterminate.status, "indeterminate");
  assert.equal(indeterminate.reason, "source-census-indeterminate");
  assert.equal(indeterminate.excludedCandidateIds.filterIndeterminate.length, 1);
  assert.deepEqual(indeterminate.keyEvaluations, []);
  assert.deepEqual(indeterminate.cohorts, []);
});

test("cohort construction rejects census drift and is package-order invariant", () => {
  const source = {
    schemaVersion: "1",
    id: "package-cohort-order-fixture",
    version: "1.0.0",
    primitives: [primitive("source-b"), primitive("source-a")],
    cohortRules: [{ id: "all", kind: "global" }]
  };
  const firstPackage = loadKernelPackage(source);
  const reordered = structuredClone(source);
  reordered.primitives.reverse();
  const secondPackage = loadKernelPackage(reordered);
  const config = runConfig();
  const firstCensus = evaluatePackageCandidateCensus(firstPackage, config);
  const secondCensus = evaluatePackageCandidateCensus(secondPackage, config);
  const first = constructPackageCohorts(
    firstPackage,
    config,
    firstCensus,
    "all"
  );
  const second = constructPackageCohorts(
    secondPackage,
    config,
    secondCensus,
    "all"
  );
  assert.equal(first.partitionHash, second.partitionHash);
  assert.equal(canonicalize(first), canonicalize(second));
  assert.equal(
    verifyPackageCohortPartition(
      first,
      firstPackage,
      config,
      firstCensus
    ).partitionHash,
    first.partitionHash
  );

  const altered = canonicalClone(firstCensus);
  altered.censusHash = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => constructPackageCohorts(
      firstPackage,
      config,
      altered,
      "all"
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_CANDIDATE_CENSUS_MISMATCH"
  );

  const alteredPartition = canonicalClone(first);
  alteredPartition.partitionHash = `sha256:${"e".repeat(64)}`;
  assert.throws(
    () => verifyPackageCohortPartition(
      alteredPartition,
      firstPackage,
      config,
      firstCensus
    ),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_COHORT_PARTITION_MISMATCH"
  );
});

test("the configured kernel exposes complete cohort construction", async () => {
  const kernel = createKernel({ version: "cohort-kernel-test" });
  const packageArtifact = await kernel.loadPackage({
    schemaVersion: "1",
    id: "kernel-cohort-fixture",
    version: "1.0.0",
    primitives: [primitive("source-a")],
    cohortRules: [{ id: "all", kind: "global" }]
  });
  const config = runConfig();
  const census = kernel.evaluatePackageCandidateCensus(packageArtifact, config);
  const partition = kernel.constructPackageCohorts(
    packageArtifact,
    config,
    census,
    "all"
  );
  assert.equal(partition.status, "complete");
  assert.ok(kernel.capabilities.implemented.includes("package-cohort-partitioning"));
  assert.equal(
    kernel.verifyPackageCohortPartition(
      partition,
      packageArtifact,
      config,
      census
    ).partitionHash,
    partition.partitionHash
  );
});
