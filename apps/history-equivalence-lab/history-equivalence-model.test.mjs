import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHistoryEquivalenceModel } from "./history-equivalence-model.js";

const artifactUrl = new URL("../../cases/reproducible-build-equivalence/artifacts/reproducible-build-equivalence.json", import.meta.url);

async function artifact() {
  return JSON.parse(await readFile(artifactUrl, "utf8"));
}

test("the browser model exposes all histories, pairs, and regimes", async () => {
  const model = createHistoryEquivalenceModel(await artifact());
  assert.equal(model.histories.length, 4);
  assert.equal(model.comparisons.length, 3);
  assert.equal(model.regimes.length, 5);
  assert.deepEqual(model.comparisons[0].regimes.map((result) => result.equal), [true, true, false, true, false]);
});

test("the browser model rejects collapsed history and verdict mutations", async () => {
  const collapsed = await artifact();
  collapsed.histories[1].historyIdentity = collapsed.histories[0].historyIdentity;
  assert.throws(() => createHistoryEquivalenceModel(collapsed), /collapsed/);
  const verdict = await artifact();
  verdict.comparisons[0].regimes[0].equal = false;
  assert.throws(() => createHistoryEquivalenceModel(verdict), /result matrix/);
});

test("unknown browser selectors fail closed", async () => {
  const model = createHistoryEquivalenceModel(await artifact());
  assert.throws(() => model.history("unknown"), RangeError);
  assert.throws(() => model.comparison("unknown"), RangeError);
  assert.throws(() => model.verdict("cross-toolchain-rebuild", "unknown"), RangeError);
});
