import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PRESETS,
  analyzeCase,
  constraintsForStrictness,
  matchingPreset
} from "../../apps/historical-load-explorer/model.js";

const explorerMarkup = readFileSync(
  new URL("../../apps/historical-load-explorer/index.html", import.meta.url),
  "utf8"
);
const explorerApp = readFileSync(
  new URL("../../apps/historical-load-explorer/app.js", import.meta.url),
  "utf8"
);
const explorerStyles = readFileSync(
  new URL("../../assets/css/historical-load-explorer.css", import.meta.url),
  "utf8"
);

test("the constitutive bridge reproduces the illustrative +3 readout", () => {
  const result = analyzeCase("constitutive-bridge", PRESETS.physical);

  assert.equal(result.freePath.length, 5);
  assert.equal(result.admissiblePath.length, 8);
  assert.equal(result.historicalLoad, 3);
  assert.equal(result.firstDivergence.constraintId, "closure");

  const elementMap = explorerApp.match(/const elements = \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const requiredIds = [...elementMap.matchAll(/\$\("#([^"]+)"\)/g)].map((match) => match[1]);
  for (const id of requiredIds) {
    assert.match(explorerMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }

  assert.match(explorerMarkup, /id="graph-rule"/, "legacy graph hook must remain cache-compatible");
  const appRevision = explorerMarkup.match(/app\.js\?v=([^"']+)/)?.[1];
  const modelRevision = explorerApp.match(/model\.js\?v=([^"']+)/)?.[1];
  assert.ok(appRevision, "app resource must carry a cache-busting revision");
  assert.equal(modelRevision, appRevision, "module graph revisions must stay aligned");
  assert.doesNotMatch(explorerMarkup, /id="motifs"/);
  assert.doesNotMatch(explorerApp, /MOTIF_EXPLORER_DATA/);
});

test("constraint ablation is computed from the remaining path space", () => {
  const result = analyzeCase("constitutive-bridge", PRESETS.physical);

  assert.equal(result.contributions.stability, 2);
  assert.equal(result.contributions.closure, 1);
  assert.equal(result.contributions.connectivity, 0);
  assert.equal(result.contributions.dependency, 0);
});

test("constraint checkboxes keep a visible, browser-independent control", () => {
  const inputRule = explorerStyles.match(/\.constraint-row input\s*\{[^}]+\}/s)?.[0] ?? "";
  assert.match(inputRule, /width:\s*24px/);
  assert.match(inputRule, /height:\s*24px/);
  assert.doesNotMatch(inputRule, /pointer-events:\s*none/);
  assert.match(explorerStyles, /\.constraint-row input:checked \+ \.checkmark::after/);
  assert.match(explorerStyles, /\.constraint-row input:focus-visible \+ \.checkmark/);
  assert.match(explorerMarkup, /assets\/css\/historical-load-explorer\.css\?v=20260815\.5/);
});

test("free, neutral, and unreachable states remain distinct", () => {
  assert.equal(analyzeCase("constitutive-bridge", []).historicalLoad, 0);
  assert.equal(analyzeCase("simple-chain", PRESETS.physical).historicalLoad, 0);
  assert.equal(
    analyzeCase("constitutive-bridge", [...PRESETS.physical, "temporal"]).historicalLoad,
    Number.POSITIVE_INFINITY
  );
});

test("strictness thresholds map to disclosed regimes", () => {
  assert.deepEqual(constraintsForStrictness(0), PRESETS.free);
  assert.deepEqual(constraintsForStrictness(31), PRESETS.minimal);
  assert.deepEqual(constraintsForStrictness(67), PRESETS.physical);
  assert.deepEqual(constraintsForStrictness(90), [...PRESETS.physical, "temporal"]);
  assert.equal(matchingPreset(PRESETS.soma), "soma");
});

test("unknown cases and predicates are rejected", () => {
  assert.throws(() => analyzeCase("missing", []), /Unknown explorer case/);
  assert.throws(() => analyzeCase("simple-chain", ["missing"]), /Unknown admissibility constraint/);
  assert.throws(() => constraintsForStrictness(101), /Strictness/);
});
