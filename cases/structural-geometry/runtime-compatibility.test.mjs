import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { validateCompatibility, validateReplayContent } from "./runtime-compatibility.mjs";

const recorded = { "parser.py": "a".repeat(64), "model.mjs": "b".repeat(64) };
const current = { ...recorded, "parser.py": "c".repeat(64) };
const reportSha256 = "d".repeat(64);
const receipt = { reportSha256, files: { "parser.py": {
  recordedSha256: recorded["parser.py"], currentSha256: current["parser.py"]
} } };

test("runtime compatibility permits only the reviewed source pair on the exact frozen report", () => {
  assert.doesNotThrow(() => validateCompatibility(recorded, recorded, null, reportSha256));
  assert.doesNotThrow(() => validateCompatibility(recorded, current, receipt, reportSha256));
  assert.throws(() => validateCompatibility(recorded, current, null, reportSha256), /No runtime compatibility/);
  assert.throws(() => validateCompatibility(recorded, current, receipt, "e".repeat(64)), /exact frozen report/);
  assert.throws(() => validateCompatibility(recorded, { ...current, "parser.py": "e".repeat(64) }, receipt, reportSha256), /Current implementation differs/);
  assert.throws(() => validateCompatibility({ ...recorded, "parser.py": "e".repeat(64) }, current, receipt, reportSha256), /Recorded implementation differs/);
  assert.throws(() => validateCompatibility(recorded, { ...current, "model.mjs": "e".repeat(64) }, receipt, reportSha256), /Unreviewed implementation change/);
  assert.throws(() => validateCompatibility(recorded, { "parser.py": current["parser.py"] }, receipt, reportSha256), /file population/);
  assert.throws(() => validateCompatibility(recorded, { ...current, "extra.py": "e".repeat(64) }, receipt, reportSha256), /file population/);
});

test("compatible replay still requires every scientific field and local artifact hash to match", () => {
  const seal = body => ({ ...body, reportSha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
  const original = seal({ implementation: recorded, score: -0.2, localDetailsSha256: "f".repeat(64) });
  assert.doesNotThrow(() => validateReplayContent(original, seal({ ...original, implementation: current, reportSha256: undefined })));
  assert.throws(() => validateReplayContent(original, seal({ implementation: current, score: 0.2, localDetailsSha256: "f".repeat(64) })), /Scientific replay content/);
  assert.throws(() => validateReplayContent(original, seal({ implementation: current, score: -0.2, localDetailsSha256: "a".repeat(64) })), /Scientific replay content/);
  assert.throws(() => validateReplayContent(original, { ...original, score: 0.2 }), /digest differs/);
});
