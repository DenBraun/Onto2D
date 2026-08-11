import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelValidationError,
  canonicalClone,
  canonicalize,
  createKernel,
  hashBytes,
  hashCanonical,
  loadKernelPackage,
  materializePrimitiveDepthPopulation
} from "../src/index.js";

function primitive(sourceId, typeTag, coordinate) {
  return {
    sourceId,
    kind: "primitive",
    ...(coordinate === undefined
      ? {}
      : {
          ontologyCoordinate: coordinate,
          axisProvenance: {
            ontologyLevel: "declared",
            ...(coordinate.phase === undefined ? {} : { ontologyPhase: "declared" })
          }
        }),
    typeTags: [typeTag],
    invariants: {},
    profile: {
      slots: [],
      invariantVector: [],
      precisionPolicy: "exact-structural-v1"
    },
    claimRefs: []
  };
}

function load(primitives, identityPolicy) {
  return loadKernelPackage({
    schemaVersion: "1",
    id: "primitive-depth-fixture",
    version: "1.0.0",
    primitives,
    ...(identityPolicy === undefined ? {} : { identityPolicy })
  });
}

test("primitive depth materialization emits complete immutable Element records", () => {
  const loaded = load([
    primitive("source-b", "beta"),
    primitive("source-a", "alpha", { level: 0, phase: "A" })
  ]);
  const population = materializePrimitiveDepthPopulation(loaded);

  assert.equal(population.materializer, "primitive-depth-population-v1");
  assert.equal(population.packageId, loaded.packageId);
  assert.equal(population.depthBasis, loaded.semanticManifest.depthBasis);
  assert.equal(population.depth, 0);
  assert.deepEqual(
    population.elements.map((element) => element.id),
    loaded.normalized.primitives.map((entry) => entry.elementId).sort()
  );
  for (const element of population.elements) {
    assert.equal(element.depth, 0);
    assert.equal(element.depthBasis, population.depthBasis);
    assert.equal(element.axisProvenance.derivationDepth, "computed");
    assert.equal(element.canonicalForm.hash, element.id);
    assert.equal(
      hashBytes(
        HASH_DOMAINS.ELEMENT,
        Buffer.from(element.canonicalForm.bytesBase64, "base64")
      ),
      element.id
    );
    assert.equal(element.provenance, null);
    assert.deepEqual(element.admittedBy, []);
    assert.deepEqual(element.selectedBy, []);
  }
  const coordinated = population.elements.find((element) => element.ontologyCoordinate !== undefined);
  assert.equal(coordinated?.axisProvenance.ontologyLevel, "declared");
  assert.equal(coordinated?.axisProvenance.ontologyPhase, "declared");
  assert.match(population.populationHash, /^sha256:[a-f0-9]{64}$/);
  const { populationHash, ...basis } = population;
  assert.equal(hashCanonical(HASH_DOMAINS.DEPTH_POPULATION, basis), populationHash);
  assert.ok(Object.isFrozen(population));
  assert.ok(Object.isFrozen(population.elements[0].profile));
});

test("primitive input order cannot change depth population identity", () => {
  const first = materializePrimitiveDepthPopulation(load([
    primitive("source-a", "alpha"),
    primitive("source-b", "beta")
  ]));
  const second = materializePrimitiveDepthPopulation(load([
    primitive("source-b", "beta"),
    primitive("source-a", "alpha")
  ]));

  assert.equal(first.populationHash, second.populationHash);
  assert.equal(canonicalize(first), canonicalize(second));
});

test("population provenance changes independently from policy-controlled element identity", () => {
  const first = materializePrimitiveDepthPopulation(load([
    primitive("source-a", "shared")
  ]));
  const renamed = materializePrimitiveDepthPopulation(load([
    primitive("source-b", "shared")
  ]));
  const structuralSource = materializePrimitiveDepthPopulation(load([
    primitive("source-a", "shared")
  ], { sourceIdStructural: true }));

  assert.equal(first.elements[0].id, renamed.elements[0].id);
  assert.notEqual(first.packageId, renamed.packageId);
  assert.notEqual(first.populationHash, renamed.populationHash);
  assert.notEqual(first.elements[0].id, structuralSource.elements[0].id);
  assert.notEqual(first.depthBasis, structuralSource.depthBasis);
});

test("primitive depth materialization rejects stale package and element identities", () => {
  const loaded = load([primitive("source-a", "alpha")]);
  for (const mutate of [
    (value) => { value.packageId = `sha256:${"f".repeat(64)}`; },
    (value) => { value.normalized.primitives[0].elementId = `sha256:${"e".repeat(64)}`; }
  ]) {
    const tampered = canonicalClone(loaded);
    mutate(tampered);
    assert.throws(
      () => materializePrimitiveDepthPopulation(tampered),
      (error) => error instanceof KernelValidationError &&
        error.issues.some((entry) => entry.code === "LOADED_PACKAGE_MISMATCH")
    );
  }

  const malformed = canonicalClone(loaded);
  malformed.normalized.primitives = null;
  assert.throws(
    () => materializePrimitiveDepthPopulation(malformed),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "LOADED_PACKAGE_INVALID")
  );
});

test("loaded package verification requires an independently expected kernel version", () => {
  const trusted = loadKernelPackage({
    schemaVersion: "1",
    id: "kernel-version-fixture",
    version: "1.0.0",
    primitives: [primitive("source-a", "alpha")]
  }, { kernelVersion: "trusted-version" });
  const forged = canonicalClone(trusted);
  forged.semanticManifest.kernelVersion = "forged-version";

  assert.throws(
    () => materializePrimitiveDepthPopulation(forged, { kernelVersion: "trusted-version" }),
    (error) => error instanceof KernelValidationError &&
      error.issues.some((entry) => entry.code === "LOADED_PACKAGE_KERNEL_VERSION_MISMATCH")
  );
  const reproduced = materializePrimitiveDepthPopulation(
    trusted,
    { kernelVersion: "trusted-version" }
  );
  assert.equal(reproduced.packageId, trusted.packageId);
});

test("a configured kernel injects its version into downstream package verification", async () => {
  const kernel = createKernel({ version: "configured-version" });
  const loaded = await kernel.loadPackage({
    schemaVersion: "1",
    id: "configured-kernel-version-fixture",
    version: "1.0.0",
    primitives: [primitive("source-a", "alpha")]
  });

  const population = kernel.materializePrimitiveDepthPopulation(loaded);
  assert.equal(loaded.semanticManifest.kernelVersion, "configured-version");
  assert.equal(population.packageId, loaded.packageId);
});
