import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { buildNixDerivationCase } from "../extract.mjs";
import { compareDerivations, parseDeriveAterm, verifyNativeDerivation } from "../src/nix-identity.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_PATH = path.join(CASE_ROOT, "artifacts", "nix-derivation-identity.json");

async function json(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

test("the committed Nix artifact is closed-schema valid and preserves nine native derivations", async () => {
  const [artifact, schema] = await Promise.all([
    json(ARTIFACT_PATH),
    json(path.join(CASE_ROOT, "schema/nix-derivation-identity.schema.json"))
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
  assert.equal(artifact.derivations.length, 9);
  assert.equal(artifact.dependencyGraph.directEdges.length, 8);
  assert.equal(artifact.dependencyGraph.closureEdges.length, 5);
  assert.deepEqual(artifact.comparisons.map((comparison) => comparison.id), [
    "same-content-different-derivation",
    "partially-shared-input-closure",
    "environment-mutation",
    "addressing-mode"
  ]);
});

test("the flagship result separates verified output content from derivation identity", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const flagship = artifact.comparisons[0];
  assert.equal(flagship.results["output-content"].equal, true);
  assert.equal(flagship.results.derivation.equal, false);
  assert.equal(flagship.results["input-closure"].equal, false);
  assert.equal(flagship.results["builder-environment"].equal, false);
  assert.equal(flagship.results["history-class"].equal, true);
  const [left, right] = [flagship.leftFixtureId, flagship.rightFixtureId].map((fixtureId) => artifact.derivations.find((entry) => entry.fixtureId === fixtureId));
  assert.equal(left.outputPath, artifact.nativeOutput.path);
  assert.equal(right.outputPath, artifact.nativeOutput.path);
  assert.notEqual(left.drvPath, right.drvPath);
});

test("native direct inputs stay distinct from derived transitive closure", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const flagship = artifact.derivations.find((entry) => entry.fixtureId === "flagshipLeft");
  const leaf = artifact.derivations.find((entry) => entry.fixtureId === "sharedLeaf");
  assert.equal(flagship.directInputDrvs.some((input) => input.drvPath === leaf.drvPath), false);
  assert.equal(flagship.inputClosure.members.includes(leaf.drvPath), true);
  assert.equal(artifact.dependencyGraph.directEdges.some((edge) => edge.from === flagship.drvPath && edge.to === leaf.drvPath), false);
  assert.equal(artifact.dependencyGraph.closureEdges.some((edge) => edge.from === flagship.drvPath && edge.to === leaf.drvPath && edge.evidence === "derived"), true);
});

test("the environment mutation changes only the declared construction identities", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const comparison = artifact.comparisons.find((entry) => entry.id === "environment-mutation");
  assert.equal(comparison.results["output-content"].equal, true);
  assert.equal(comparison.results.derivation.equal, false);
  assert.equal(comparison.results["input-closure"].equal, true);
  assert.equal(comparison.results["builder-environment"].equal, false);
  const left = artifact.derivations.find((entry) => entry.fixtureId === comparison.leftFixtureId);
  const right = artifact.derivations.find((entry) => entry.fixtureId === comparison.rightFixtureId);
  assert.equal(left.env.normalizationProbe, "baseline");
  assert.equal(right.env.normalizationProbe, "mutated");
});

test("the addressing control reports absent realization as unresolved instead of equal", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const comparison = artifact.comparisons.find((entry) => entry.id === "addressing-mode");
  assert.equal(comparison.addressing.equal, false);
  assert.deepEqual(comparison.results["output-content"], { left: `sha256:${artifact.nativeOutput.contentSha256}`, right: null, equal: null, status: "unresolved" });
  assert.equal(comparison.results.derivation.equal, false);
  assert.equal(comparison.results["input-closure"].equal, true);
  assert.equal(comparison.results["history-class"].status, "unresolved");
});

test("raw ATerm and Nix JSON are cross-checked field by field", async () => {
  const [artifact, capture] = await Promise.all([
    json(ARTIFACT_PATH),
    json(path.join(CASE_ROOT, "capture/derivations.json"))
  ]);
  const flagship = artifact.derivations.find((entry) => entry.fixtureId === "flagshipLeft");
  const rawEvidence = artifact.source.rawDerivations.find((entry) => entry.fixtureId === "flagshipLeft");
  const raw = await readFile(path.join(CASE_ROOT, rawEvidence.file.replace(/^capture\//, "capture/")), "utf8");
  const parsed = parseDeriveAterm(raw);
  assert.equal(parsed.constructor, "Derive");
  assert.equal(parsed.arguments.length, 7);
  assert.equal(verifyNativeDerivation(flagship.drvPath, capture[flagship.drvPath], raw).env.fixtureVariant, "flagship-left");
  const substituted = structuredClone(capture[flagship.drvPath]);
  substituted.env.fixtureVariant = "flagship-right";
  assert.throws(() => verifyNativeDerivation(flagship.drvPath, substituted, raw), /ATerm environment differs/);
  const repeatedEnvironment = raw.replace('[("builder","/bin/sh"),', '[("builder","/bin/sh"),("builder","/bin/sh"),');
  assert.notEqual(repeatedEnvironment, raw);
  assert.throws(() => verifyNativeDerivation(flagship.drvPath, capture[flagship.drvPath], repeatedEnvironment), /environment entry builder is invalid or repeated/);
});

test("artifact extraction is byte-stable and native identity is not changed by equivalence", async () => {
  const [first, second, committed] = await Promise.all([
    buildNixDerivationCase(),
    buildNixDerivationCase(),
    json(ARTIFACT_PATH)
  ]);
  assert.deepEqual(first, second);
  assert.deepEqual(first, committed);
  const before = first.derivations.map((entry) => entry.drvPath);
  compareDerivations({ id: "immutability", label: "Immutability", left: "flagshipLeft", right: "flagshipRight", claim: "Negative test." }, first.derivations);
  assert.deepEqual(first.derivations.map((entry) => entry.drvPath), before);
});

test("source, raw derivation, and Nix JSON mutations fail closed", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-nix-mutation-"));
  try {
    const changedSource = path.join(temporary, "source");
    await cp(CASE_ROOT, changedSource, { recursive: true });
    await writeFile(path.join(changedSource, "fixtures/output.txt"), "changed output\n");
    await assert.rejects(() => buildNixDerivationCase({ caseRoot: changedSource }), /source file mismatch/);

    const changedRaw = path.join(temporary, "raw");
    await cp(CASE_ROOT, changedRaw, { recursive: true });
    const metadata = await json(path.join(changedRaw, "capture/metadata.json"));
    const target = metadata.drvFiles.find((entry) => entry.fixtureId === "flagshipLeft");
    await writeFile(path.join(changedRaw, "capture", target.file), "Derive([])");
    await assert.rejects(() => buildNixDerivationCase({ caseRoot: changedRaw }), /raw derivation bytes differ/);

    const changedJson = path.join(temporary, "json");
    await cp(CASE_ROOT, changedJson, { recursive: true });
    const derivations = await json(path.join(changedJson, "capture/derivations.json"));
    const drvPath = Object.keys(derivations).find((value) => derivations[value].env.fixtureVariant === "flagship-left");
    derivations[drvPath].env.fixtureVariant = "substituted";
    await writeFile(path.join(changedJson, "capture/derivations.json"), `${JSON.stringify(derivations, null, 2)}\n`);
    await assert.rejects(() => buildNixDerivationCase({ caseRoot: changedJson }), /ATerm environment differs/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
