import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalize,
  closePackageDepthLevel,
  closePackageLevel,
  createKernel,
  createPackageRunArtifactBundle,
  createPackageRunArtifactStore,
  createPackageRunArtifactStoreSession,
  explainPackageRunCandidate,
  hashCanonical,
  loadKernelPackage,
  materializePackageRunArtifact,
  verifyPackageRunArtifactBundle,
  verifyPackageRunArtifactStore
} from "../src/index.js";

function loadedFixture() {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "run-artifact-bundle-fixture",
    version: "1.0.0",
    primitives: [{
      sourceId: "bundle-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }],
    profileDefinition: {
      kind: "residual-slots-v1",
      baseProfile: {
        slots: [{
          role: "support",
          polarity: "sym",
          capacity: { min: 0, max: 1 }
        }],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      derivedTypeTags: ["derived"],
      claimRefs: []
    }
  });
}

function sourceArtifact(index, label) {
  return {
    path: `source/${label}.json`,
    mediaType: "application/json",
    schemaVersion: "1",
    bytes: index,
    hash: `sha256:${index.toString(16).padStart(64, "0")}`
  };
}

function loadedSourceMigrationFixture() {
  const artifactFields = [
    "classificationPolicy",
    "riskPolicy",
    "classificationView",
    "classificationAnnotations",
    "classificationAdjudication",
    "classificationAmendments",
    "classifiedRelations",
    "nodeResolutions",
    "condensation",
    "memberProjections",
    "reconciliation",
    "metrics",
    "explanationIndex"
  ];
  const sourceMigration = {
    policyHash: `sha256:${"f".repeat(64)}`,
    blindnessStatus: "historically-exposed",
    typedRelationLayers: Array.from(
      { length: 6 },
      (_, index) => sourceArtifact(
        artifactFields.length + index + 1,
        `typed-layer-${index}`
      )
    )
  };
  for (const [index, field] of artifactFields.entries()) {
    sourceMigration[field] = sourceArtifact(index + 1, field);
  }
  const sourceArtifacts = [
    ...artifactFields.map((field) => sourceMigration[field]),
    ...sourceMigration.typedRelationLayers
  ];
  return loadKernelPackage({
    schemaVersion: "1",
    id: "run-artifact-source-migration-fixture",
    version: "1.0.0",
    sourceArtifacts,
    sourceMigration,
    primitives: [{
      sourceId: "migration-source",
      kind: "primitive",
      typeTags: ["source"],
      invariants: {},
      profile: {
        slots: [],
        invariantVector: [],
        precisionPolicy: "exact-structural-v1"
      },
      claimRefs: []
    }]
  });
}

function runConfig() {
  return {
    schemaVersion: "1",
    countingDomain: "element-exact",
    sourceDepths: "all-below",
    reportAxes: ["derivation-depth"],
    roleAlphabet: ["support"],
    budget: {
      maxNodes: 1,
      maxEdges: 0,
      maxCandidates: 10,
      perturbationSamples: 0,
      nullModelRuns: 0
    },
    seed: "run-artifact-bundle-v1",
    invariantPrecision: {
      id: "run-artifact-bundle-precision-v1",
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
      id: "run-artifact-bundle-substructure-v1",
      remove: "nodes",
      includeDisconnected: false,
      includeEmpty: false,
      retainIsolatedNodes: true
    },
    nullModels: [],
    evidencePolicy: "allow-declared",
    indeterminateThreshold: 0
  };
}

function closedFixture() {
  const loaded = loadedFixture();
  const config = runConfig();
  const level1 = closePackageLevel(loaded, config);
  const level2 = closePackageDepthLevel(loaded, config, [level1], 2);
  return { loaded, config, level1, level2 };
}

test("run bundle freezes a complete replayable level chain and exact artifact bytes", () => {
  const { loaded, config, level1, level2 } = closedFixture();
  const bundle = createPackageRunArtifactBundle(
    loaded,
    config,
    [level1, level2]
  );

  assert.equal(bundle.targetDepth, 2);
  assert.equal(bundle.runHash, level2.run.runHash);
  assert.equal(bundle.counts.levels, 2);
  assert.equal(bundle.counts.runs, 2);
  assert.equal(bundle.counts.candidates, 3);
  assert.equal(bundle.counts.admittedElements, 3);
  assert.deepEqual(
    bundle.semanticManifest.levelRuns.map((entry) => entry.runHash),
    [level1.run.runHash, level2.run.runHash]
  );
  assert.equal(bundle.semanticManifest.inputArtifacts.length, 15);
  assert.equal(bundle.artifacts.length, 22);
  assert.equal(
    verifyPackageRunArtifactBundle(structuredClone(bundle)).bundleHash,
    bundle.bundleHash
  );

  const { bundleHash, ...bundleBasis } = bundle;
  assert.equal(
    bundleHash,
    hashCanonical(HASH_DOMAINS.PACKAGE_RUN_ARTIFACT_BUNDLE, bundleBasis)
  );
  const materialized = materializePackageRunArtifact(
    bundle,
    "levels/001/result.json"
  );
  const bytes = Buffer.from(materialized.bytesBase64, "base64");
  assert.equal(bytes.byteLength, materialized.ref.bytes);
  assert.equal(bytes.toString("utf8"), canonicalize(level2));
  assert.equal(
    materialized.ref.hash,
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`
  );
  const { materializationHash, ...materializationBasis } = materialized;
  assert.equal(
    materializationHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_ARTIFACT_MATERIALIZATION,
      materializationBasis
    )
  );

  const tampered = structuredClone(bundle);
  tampered.artifacts[0].ref.bytes += 1;
  assert.throws(
    () => verifyPackageRunArtifactBundle(tampered),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_BUNDLE_MISMATCH"
  );
  assert.throws(
    () => createPackageRunArtifactBundle(loaded, config, [level2]),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_LEVEL_CHAIN_INVALID"
  );
});

test("run bundle preserves the normalized source-migration trust boundary", () => {
  const loaded = loadedSourceMigrationFixture();
  const config = runConfig();
  const level = closePackageLevel(loaded, config);
  const bundle = createPackageRunArtifactBundle(loaded, config, [level]);

  assert.equal(
    bundle.semanticManifest.sourceMigrationHash,
    loaded.semanticManifest.sourceMigrationHash
  );
  assert.equal(bundle.semanticManifest.inputArtifacts.length, 16);
  const entry = bundle.artifacts.find((artifactEntry) =>
    artifactEntry.artifactKind === "source-migration"
  );
  assert.equal(entry.ref.path, "normalized-input/source-migration.json");
  assert.equal(entry.semanticHash, loaded.semanticManifest.sourceMigrationHash);
  const materialized = materializePackageRunArtifact(bundle, entry.ref.path);
  assert.deepEqual(
    JSON.parse(Buffer.from(materialized.bytesBase64, "base64").toString("utf8")),
    {
      schemaVersion: "1",
      sourceMigration: loaded.normalized.sourceMigration
    }
  );
  assert.equal(
    verifyPackageRunArtifactBundle(structuredClone(bundle)).bundleHash,
    bundle.bundleHash
  );
});

test("verified artifact store resolves candidate explanations only inside the bound run", async () => {
  const { loaded, config, level1, level2 } = closedFixture();
  const bundle = createPackageRunArtifactBundle(
    loaded,
    config,
    [level1, level2]
  );
  const store = createPackageRunArtifactStore([bundle]);

  assert.equal(store.counts.bundles, 1);
  assert.equal(store.counts.runs, 2);
  assert.equal(store.runIndex.length, 2);
  assert.equal(
    verifyPackageRunArtifactStore(structuredClone(store)).storeHash,
    store.storeHash
  );

  const target = bundle.levels[1];
  const candidateId = target.explanationIndex.entries[0].candidateId;
  const explanation = explainPackageRunCandidate(
    store,
    level2.run.runHash,
    candidateId
  );
  assert.equal(explanation.targetDepth, 2);
  assert.equal(explanation.bundleHash, bundle.bundleHash);
  assert.equal(
    explanation.levelExplanation.entry.candidateId,
    candidateId
  );
  const { explanationHash, ...explanationBasis } = explanation;
  assert.equal(
    explanationHash,
    hashCanonical(
      HASH_DOMAINS.PACKAGE_RUN_CANDIDATE_EXPLANATION,
      explanationBasis
    )
  );

  const session = createPackageRunArtifactStoreSession(store);
  assert.equal(
    session.explain(level2.run.runHash, candidateId).explanationHash,
    explanationHash
  );
  const kernel = createKernel({
    version: loaded.semanticManifest.kernelVersion,
    artifactStore: store
  });
  assert.equal(
    (await kernel.explain({ runHash: level2.run.runHash, candidateId }))
      .explanationHash,
    explanationHash
  );

  const unbound = createKernel({ version: loaded.semanticManifest.kernelVersion });
  await assert.rejects(
    () => unbound.explain({ runHash: level2.run.runHash, candidateId }),
    (error) => error instanceof KernelError &&
      error.code === "KERNEL_ARTIFACT_STORE_UNBOUND"
  );
  assert.throws(
    () => session.explain(`sha256:${"f".repeat(64)}`, candidateId),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_EXPLANATION_RUN_UNKNOWN"
  );

  const tamperedStore = structuredClone(store);
  tamperedStore.runIndex[0].targetDepth = 64;
  assert.throws(
    () => verifyPackageRunArtifactStore(tamperedStore),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_STORE_MISMATCH"
  );
  assert.throws(
    () => createKernel({ version: "different-kernel", artifactStore: store }),
    (error) => error instanceof KernelError &&
      error.code === "PACKAGE_RUN_ARTIFACT_KERNEL_VERSION_MISMATCH"
  );
});
