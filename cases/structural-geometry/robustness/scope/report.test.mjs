import assert from "node:assert/strict";
import test from "node:test";
import { verifyReport, validateReport } from "./build.mjs";
import { readJson } from "./io.mjs";
import { digest } from "../../datasets/scopes.mjs";

test("complete scope report keeps all roots, bins, matched populations and unavailable alternatives", async () => {
  const report = await verifyReport(); assert.equal(report.variants.length, 4); assert.equal(report.independentAudit.scopes, 1440);
  assert.deepEqual(report.variants.map(v => v.status), ["complete", "complete", "unavailable", "unavailable"]);
});
test("rehashing cannot change source coverage, scope identity, availability, predictions, exact contrasts or verification counts", async () => {
  const original = await readJson("results.json"), audit = await readJson("source-audit.json");
  const changes = [r => r.variants.pop(), r => r.coverage[0].bins[0].parentNodes++, r => { r.profile.degreeBins[0].max = 1; },
    r => { r.sourceAuditSha256 = "0".repeat(64); }, r => r.variants[1].scopes.pop(), r => { r.variants[1].scopes[0].graphSha256 = "0".repeat(64); },
    r => { r.variants[2].status = "complete"; }, r => { r.variants[1].comparisons["alternative expanded geometry gain"].exactMeanDelta.numerator = "0"; },
    r => r.variants[1].contexts[1].models["B+G"].outerEvidence[0].predictions.reverse(),
    r => r.variants[1].independent.fitting[0].predictionsChecked++, r => r.independentAudit.scopes--];
  for (const change of changes) {
    const report = structuredClone(original); change(report); const { reportSha256, ...body } = report; report.reportSha256 = digest(body);
    await assert.rejects(validateReport(report, { audit, checkAudit: false }));
  }
});
