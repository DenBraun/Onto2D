import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGitHistoryModel } from "./git-history-model.js";

const artifact = JSON.parse(await readFile(new URL("../../cases/git-history-identity/artifacts/history-identity.json", import.meta.url), "utf8"));

test("the Lab model validates all native Git references before exposing comparisons", () => {
  const model = createGitHistoryModel(artifact);
  assert.deepEqual(model.statistics, {
    blobCount: 7,
    treeCount: 8,
    commitCount: 14,
    historyCount: 6,
    comparisonCount: 4
  });
  assert.equal(model.comparison("same-tree-different-ancestry").results.tree.equal, true);
  assert.equal(model.comparison("same-tree-different-ancestry").results.ancestry.equal, false);
  assert.equal(model.comparison("metadata-only").results.ancestry.equal, true);
  assert.equal(model.tree("converged").oid, "b15c9eed95984c6a5585bd251d095c9c1d7ffa83");
});

test("UI regime selection cannot mutate the underlying Git object identities", () => {
  const model = createGitHistoryModel(artifact);
  const before = JSON.stringify(artifact.objects);
  for (const comparison of model.comparisons) {
    for (const regime of model.regimes) {
      const result = comparison.results[regime.id];
      assert.equal(result.equal, result.left === result.right);
    }
  }
  assert.equal(JSON.stringify(artifact.objects), before);
  assert.throws(() => {
    model.commit("A2").oid = "0".repeat(40);
  }, TypeError);
});

test("cross-record substitutions and incomplete histories fail closed", () => {
  const changedTree = structuredClone(artifact);
  changedTree.objects.commits.find((commit) => commit.fixtureId === "A2").tree = changedTree.objects.trees.find((tree) => tree.fixtureId === "route-a").oid;
  assert.throws(() => createGitHistoryModel(changedTree), /unresolved tree/);

  const changedParent = structuredClone(artifact);
  changedParent.objects.commits.find((commit) => commit.fixtureId === "A2").parentOids[0] = "0".repeat(40);
  assert.throws(() => createGitHistoryModel(changedParent), /unresolved or out-of-order parent/);

  const incomplete = structuredClone(artifact);
  incomplete.histories.find((history) => history.id === "history-a").commits.shift();
  incomplete.histories.find((history) => history.id === "history-a").commitCount -= 1;
  assert.throws(() => createGitHistoryModel(incomplete), /closure is inconsistent/);

  const relabeled = structuredClone(artifact);
  relabeled.comparisons[0].results.commit.equal = true;
  assert.throws(() => createGitHistoryModel(relabeled), /equality is inconsistent/);

  const unsafePath = structuredClone(artifact);
  unsafePath.objects.trees[0].entries[0].path = "folder/../README.md";
  assert.throws(() => createGitHistoryModel(unsafePath), /invalid entry/);

  const substitutedClass = structuredClone(artifact);
  substitutedClass.comparisons[0].results["history-class"].left = "0".repeat(40);
  substitutedClass.comparisons[0].results["history-class"].right = "0".repeat(40);
  assert.throws(() => createGitHistoryModel(substitutedClass), /history class is not bound/);
});
