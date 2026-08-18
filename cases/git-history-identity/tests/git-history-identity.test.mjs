import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { buildGitHistoryCase, validateFixtureSpec } from "../build-fixture.mjs";
import { ancestryProjection, compareHistories } from "../src/history-identity.mjs";

const CASE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = path.join(CASE_ROOT, "fixture-spec.json");
const ARTIFACT_PATH = path.join(CASE_ROOT, "artifacts/history-identity.json");

async function json(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

test("the committed Git artifact is schema-valid and exposes the four required experiments", async () => {
  const [artifact, schema] = await Promise.all([
    json(ARTIFACT_PATH),
    json(path.join(CASE_ROOT, "schema/history-identity.schema.json"))
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false, formats: { email: true } }).compile(schema);
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
  assert.equal(artifact.objects.blobs.length, 7);
  assert.equal(artifact.objects.trees.length, 8);
  assert.equal(artifact.objects.commits.length, 14);
  assert.deepEqual(artifact.comparisons.map((comparison) => comparison.id), [
    "same-tree-different-ancestry",
    "different-intermediate-length",
    "merge-vs-linear",
    "metadata-only"
  ]);
});

test("every experiment preserves tree identity while changing commit identity", async () => {
  const artifact = await json(ARTIFACT_PATH);
  for (const comparison of artifact.comparisons) {
    assert.equal(comparison.results.tree.equal, true, comparison.id);
    assert.equal(comparison.results.commit.equal, false, comparison.id);
    assert.equal(comparison.results["history-class"].equal, true, comparison.id);
  }
  assert.deepEqual(artifact.comparisons.map((comparison) => comparison.results.ancestry.equal), [false, false, false, true]);
});

test("native object IDs are stable and independently verified", async () => {
  const artifact = await buildGitHistoryCase();
  assert.equal(artifact.git.objectIdentityVerifiedIndependently, true);
  assert.equal(artifact.objects.blobs.find((blob) => blob.fixtureId === "converged").oid, "dfbecf2dae140b0ca2c37528bfb2aa9e9557447f");
  assert.equal(artifact.objects.trees.find((tree) => tree.fixtureId === "converged").oid, "b15c9eed95984c6a5585bd251d095c9c1d7ffa83");
  assert.equal(artifact.objects.commits.find((commit) => commit.fixtureId === "A2").oid, "a823bf15716c09ab8d47cbbc55012ed90a97052a");
  assert.match(artifact.caseIdentity, /^sha256:[0-9a-f]{64}$/);
});

test("two independent repositories reproduce the exact case artifact", async () => {
  const [first, second, committed] = await Promise.all([
    buildGitHistoryCase(),
    buildGitHistoryCase(),
    json(ARTIFACT_PATH)
  ]);
  assert.deepEqual(first, second);
  assert.deepEqual(first, committed);
});

test("a source mutation changes source, commit, and case identity without changing final tree", async () => {
  const spec = await json(SPEC_PATH);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "onto2d-git-history-mutation-"));
  try {
    const changed = structuredClone(spec);
    changed.commits.find((commit) => commit.id === "B2").message = "history B converges with changed metadata";
    const changedPath = path.join(temporary, "fixture-spec.json");
    await writeFile(changedPath, `${JSON.stringify(changed, null, 2)}\n`);
    const [baseline, mutated] = await Promise.all([
      buildGitHistoryCase(),
      buildGitHistoryCase({ specPath: changedPath })
    ]);
    assert.notEqual(mutated.source.sourceIdentity, baseline.source.sourceIdentity);
    assert.notEqual(
      mutated.objects.commits.find((commit) => commit.fixtureId === "B2").oid,
      baseline.objects.commits.find((commit) => commit.fixtureId === "B2").oid
    );
    assert.equal(
      mutated.objects.commits.find((commit) => commit.fixtureId === "B2").tree,
      baseline.objects.commits.find((commit) => commit.fixtureId === "B2").tree
    );
    assert.notEqual(mutated.caseIdentity, baseline.caseIdentity);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("parent mutation changes ancestry and malformed parent order fails closed", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const experiment = {
    id: "parent-mutation",
    label: "Parent mutation",
    left: "history-a",
    right: "history-metadata",
    claim: "Synthetic negative test."
  };
  const baseline = compareHistories(experiment, [
    { id: "history-a", label: "A", head: "A2" },
    { id: "history-metadata", label: "M", head: "A2M" }
  ], artifact.objects.commits);
  assert.equal(baseline.results.ancestry.equal, true);
  const changedCommits = structuredClone(artifact.objects.commits);
  changedCommits.find((commit) => commit.fixtureId === "A2M").parents = ["B1"];
  const changed = compareHistories(experiment, [
    { id: "history-a", label: "A", head: "A2" },
    { id: "history-metadata", label: "M", head: "A2M" }
  ], changedCommits);
  assert.equal(changed.results.ancestry.equal, false);

  const spec = await json(SPEC_PATH);
  const invalid = structuredClone(spec);
  invalid.commits[0].parents = ["A1"];
  assert.throws(() => validateFixtureSpec(invalid), /parent A1 must precede it/);
});

test("ancestry projection rejects missing native parent evidence", async () => {
  const artifact = await json(ARTIFACT_PATH);
  const commits = artifact.objects.commits.filter((commit) => commit.fixtureId !== "A0");
  assert.throws(() => ancestryProjection("A2", commits), /unknown parent A0/);
});

test("fixture tree paths reject traversal and dot segments", async () => {
  const spec = await json(SPEC_PATH);
  for (const unsafePath of ["..", "folder/..", "folder/./state.txt", "folder//state.txt", ".git/config"]) {
    const invalid = structuredClone(spec);
    invalid.trees[0].entries[0].path = unsafePath;
    assert.throws(() => validateFixtureSpec(invalid), /path is unsafe/, unsafePath);
  }
});
