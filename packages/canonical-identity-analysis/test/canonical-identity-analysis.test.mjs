import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { buildModelPack } from "@onto2d/model-pack";
import { EngineError, Onto2D } from "@onto2d/engine";
import {
  CANONICAL_IDENTITY_ARTIFACT_SCHEMA,
  canonicalIdentityAnalysis,
  verifyCanonicalIdentityArtifact
} from "../src/index.js";

const ref = `sha256:${"d".repeat(64)}`;
const pack = buildModelPack({
  model: { id: "identity-fixture", name: "Identity Fixture", version: "1" },
  source: { id: "identity-source", files: [{ path: "source.json", hash: ref }] },
  nodes: [{ id: "model-node" }],
  edges: [],
  dictionaries: {}
});

const baseCandidate = {
  domain: "single-candidate",
  nodes: [{ ref }, { ref }, { ref }],
  edges: [
    { from: 0, to: 1, role: "directed-link" },
    { from: 2, to: 1, role: "directed-link" },
    { from: 0, to: 2, role: "directed-link" }
  ]
};

test("Canonical Identity is a discoverable registered analysis bound to the exact model", async () => {
  const onto = await Onto2D.create({
    models: [pack],
    model: "identity-fixture@1",
    analyses: [canonicalIdentityAnalysis]
  });
  assert.deepEqual(onto.analyses(), [{
    id: "canonical-identity",
    version: "1",
    requiredModelCapabilities: [],
    requiredAdapterCapabilities: [],
    inputSchema: "https://onto2d.dev/schemas/v1/canonical-identity-request.schema.json",
    outputArtifacts: [CANONICAL_IDENTITY_ARTIFACT_SCHEMA]
  }]);
  const artifact = await onto.analyze("canonical-identity", { candidate: baseCandidate });
  assert.equal(artifact.model.modelRootHash, pack.manifest.rootHash);
  assert.equal(artifact.result.candidateId, artifact.result.candidate.id);
  assert.equal(verifyCanonicalIdentityArtifact(artifact).artifactHash, artifact.artifactHash);
});

test("representation permutations retain identity while structural changes do not", async () => {
  const onto = await Onto2D.create({ models: [pack], analyses: [canonicalIdentityAnalysis] });
  const base = await onto.analyze("canonical-identity", { candidate: baseCandidate });
  const permuted = await onto.analyze("canonical-identity", {
    candidate: {
      ...baseCandidate,
      nodes: [baseCandidate.nodes[2], baseCandidate.nodes[0], baseCandidate.nodes[1]],
      edges: [
        { from: 1, to: 2, role: "directed-link" },
        { from: 0, to: 2, role: "directed-link" },
        { from: 1, to: 0, role: "directed-link" }
      ]
    }
  });
  const changed = await onto.analyze("canonical-identity", {
    candidate: {
      ...baseCandidate,
      edges: baseCandidate.edges.map((edge, index) => (
        index === 0 ? { ...edge, role: "inhibits" } : edge
      ))
    }
  });
  assert.equal(base.result.candidateId, permuted.result.candidateId);
  assert.equal(base.result.skeletonId, permuted.result.skeletonId);
  assert.notEqual(base.result.candidateId, changed.result.candidateId);
  assert.equal(base.result.skeletonId, changed.result.skeletonId);
});

test("Canonical Identity verification rejects result and model-binding drift", async () => {
  const onto = await Onto2D.create({ models: [pack], analyses: [canonicalIdentityAnalysis] });
  const artifact = await onto.analyze("canonical-identity", { candidate: baseCandidate });
  const tampered = structuredClone(artifact);
  tampered.result.inputToCanonical.reverse();
  assert.throws(
    () => verifyCanonicalIdentityArtifact(tampered),
    (error) => error instanceof EngineError && error.code === "CANONICAL_IDENTITY_ARTIFACT_VERIFICATION_FAILED"
  );
  assert.throws(
    () => verifyCanonicalIdentityArtifact(artifact, {
      requested: "identity-fixture@2",
      exact: "identity-fixture@2",
      modelId: "identity-fixture",
      modelVersion: "2",
      modelRootHash: `sha256:${"e".repeat(64)}`
    }),
    (error) => error instanceof EngineError && error.code === "CANONICAL_IDENTITY_MODEL_BINDING_MISMATCH"
  );
});

test("Canonical Identity requests and artifacts conform to their published schemas", async () => {
  const names = [
    "quantity",
    "candidate",
    "graph-policy",
    "canonical-identity-request",
    "canonical-identity-artifact"
  ];
  const schemas = await Promise.all(names.map(async (name) => JSON.parse(await readFile(
    new URL(`../../schemas/schemas/${name}.schema.json`, import.meta.url),
    "utf8"
  ))));
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  schemas.forEach((schema) => ajv.addSchema(schema));
  const onto = await Onto2D.create({ models: [pack], analyses: [canonicalIdentityAnalysis] });
  const artifact = await onto.analyze("canonical-identity", { candidate: baseCandidate });
  const validateRequest = ajv.getSchema(
    "https://onto2d.dev/schemas/v1/canonical-identity-request.schema.json"
  );
  const validateArtifact = ajv.getSchema(
    "https://onto2d.dev/schemas/v1/canonical-identity-artifact.schema.json"
  );
  assert.equal(validateRequest(artifact.request), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateArtifact(artifact), true, JSON.stringify(validateArtifact.errors));
});
