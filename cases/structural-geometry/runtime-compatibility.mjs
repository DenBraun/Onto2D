import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const here = new URL("./", import.meta.url);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function verifyPythonCosts(costs) {
  assert.ok(Number.isFinite(costs.elapsedMs) && costs.elapsedMs >= 0, "Invalid reference duration.");
  if (costs.pythonPeakRssBytes === null) {
    assert.equal(costs.pythonPeakRssReason, "resource-module-unavailable", "Missing peak RSS needs an explicit reason.");
  } else {
    assert.ok(Number.isFinite(costs.pythonPeakRssBytes) && costs.pythonPeakRssBytes >= 0, "Invalid reference peak RSS.");
    assert.ok(costs.pythonPeakRssReason == null, "Measured peak RSS cannot have an unavailable reason.");
  }
}

// Reports retain the exact implementation that generated them. Runtime-only
// repairs may verify that historical evidence through an explicit, byte-pinned
// receipt; unknown source changes still require a new study or verified replay.
export function validateCompatibility(expected, actual, receipt, reportSha256) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "Implementation file population differs.");
  const changed = Object.keys(expected).filter(path => expected[path] !== actual[path]);
  if (!changed.length) return;
  assert.ok(receipt, "No runtime compatibility receipt for changed implementation.");
  assert.equal(reportSha256, receipt.reportSha256, "Runtime compatibility requires the exact frozen report.");
  for (const path of changed) {
    const entry = receipt.files[path];
    assert.ok(entry, `Unreviewed implementation change: ${path}`);
    assert.equal(expected[path], entry.recordedSha256, `Recorded implementation differs: ${path}`);
    assert.equal(actual[path], entry.currentSha256, `Current implementation differs: ${path}`);
  }
}

export async function verifyImplementationBinding(reportUrl, report, actual) {
  const expected = report.implementation;
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "Implementation file population differs.");
  if (Object.keys(expected).every(path => expected[path] === actual[path])) return;
  const manifest = JSON.parse(await readFile(new URL("runtime-compatibility.json", here), "utf8"));
  assert.equal(manifest.format, "onto2d-runtime-compatibility-v1");
  assert.equal(manifest.verifierSha256, sha256(await readFile(new URL(import.meta.url))), "Runtime compatibility verifier differs.");
  assert.ok(reportUrl.href.startsWith(here.href), "Report must belong to Structural Geometry.");
  const key = reportUrl.href.slice(here.href.length);
  const receipt = manifest.reports[key];
  assert.ok(receipt, "No runtime compatibility receipt for changed implementation.");
  assert.equal(sha256(JSON.stringify(report)), receipt.contentSha256, "Runtime compatibility requires the exact frozen report content.");
  validateCompatibility(expected, actual, receipt, sha256(await readFile(reportUrl)));
}

export function validateReplayContent(expected, replayed) {
  for (const report of [expected, replayed]) {
    const { reportSha256, ...body } = report;
    assert.equal(reportSha256, sha256(JSON.stringify(body)), "Replay report digest differs.");
  }
  const { implementation: _before, reportSha256: _beforeHash, ...before } = expected;
  const { implementation: _after, reportSha256: _afterHash, ...after } = replayed;
  assert.deepEqual(after, before, "Scientific replay content differs.");
}

export async function verifyCompatibleReplay(reportUrl, replayed) {
  const expected = JSON.parse(await readFile(reportUrl, "utf8"));
  await verifyImplementationBinding(reportUrl, expected, replayed.implementation);
  validateReplayContent(expected, replayed);
}
