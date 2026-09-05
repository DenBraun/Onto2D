import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildLteeBenchmarkProtocols } from "../build.mjs";
import { buildLteeProtocolBundle, verifyLteeProtocolBundle } from "../protocol-model.js";

const built = await buildLteeBenchmarkProtocols();
const { bundle } = built;

test("LTEE contracts preserve each protocol's census, units, exposure and missing cells", () => {
  const protocols = bundle.protocolSet.protocols;
  assert.deepEqual(protocols.map((p) => p.cohort.generations.length), [12, 12, 14]);
  assert.deepEqual(protocols.map((p) => p.cohort.notRunGenerations.length), [4, 4, 2]);
  assert.deepEqual(protocols.map((p) => p.cohort.replicateUnit), ["replay population", "MC plate", "culture plated on MC agar"]);
  assert.deepEqual(bundle.assessment.protocols.map((p) => [p.replicates, p.independentCitPlusMutants]), [[72, 4], [340, 5], [2800, 8]]);
  assert.equal(protocols[0].exposure.maximumReplayGenerationsApproximate, 3700);
  assert.equal(protocols[1].exposure.incubationDays, 59);
  assert.equal(protocols[2].exposure.incubationDays, 45);
  for (const p of protocols) {
    assert.equal(p.cells.length, 16);
    const missing = p.cells.filter((r) => r.outcomeStatus === "not-run");
    assert.ok(missing.every((r) => r.replicates === null && r.independentCitPlusMutants === null));
    assert.ok(p.cells.filter((r) => r.outcomeStatus === "not-observed").every((r) => r.replicates > 0 && r.independentCitPlusMutants === 0));
    assert.equal(p.views.history.cloneIdentity, "unresolved");
    assert.equal(p.views.history.completeGenotype, "unresolved");
    assert.equal(p.cutoff.origin, "before-new-replay");
  }
});

test("an aggregate LTEE protocol audit never becomes a scored P/P+H contrast", () => {
  assert.equal(bundle.protocolSet.status, "NOT_ELIGIBLE");
  assert.equal(bundle.protocolSet.review.status, "pending");
  assert.equal(bundle.protocolSet.review.priorOutcomeExposure, true);
  assert.equal(bundle.assessment.verdict, "not-evaluated");
  assert.equal(bundle.assessment.aggregateScore, null);
  for (const p of bundle.protocolSet.protocols) {
    assert.equal(p.evaluation.primaryMetric, null);
    assert.equal(p.evaluation.nullModel.status, "not-run");
    assert.equal(p.evaluation.comparisonStatus, "requires-additional-evidence-and-reviewed-design");
    assert.equal(p.selection.outcomeBasedExclusions, false);
  }
  for (const p of bundle.assessment.protocols) {
    assert.equal(p.primary, null);
    assert.equal(p.verdict, "not-evaluated");
    assert.ok(p.blockers.some((b) => b.code === "UNRESOLVED_UNIT_LINKAGE"));
    assert.ok(p.blockers.some((b) => b.code === "NO_REVIEWED_P0_P1_EVALUATOR"));
  }
});

test("published statistics and the replay-2 discrepancy stay attributed and separate", () => {
  const second = bundle.protocolSet.protocols[1];
  assert.equal(second.publishedStatistics.expectedMeanGeneration, 28382);
  assert.equal(second.publishedStatistics.tableOneReplicateWeightedMean.rounded, 26382);
  assert.equal(second.publishedStatistics.publishedMonteCarloPValue, 0.0007);
  assert.equal(second.publishedStatistics.pValueRecomputed, false);
  assert.equal(bundle.assessment.protocols[1].sourceDiscrepancy.status, "visible-not-resolved");
  assert.equal(bundle.assessment.protocols[0].sourceDiscrepancy, null);
});

test("frozen protocol artifacts reproduce exactly and have closed schemas", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  for (const [relative, value] of built.files) {
    assert.equal(await readFile(new URL(`../../../../${relative}`, import.meta.url), "utf8"), `${JSON.stringify(value, null, 2)}\n`);
  }
  for (const [name, value] of [["protocol-set", bundle.protocolSet], ["assessment", bundle.assessment]]) {
    const schema = JSON.parse(await readFile(new URL(`../schema/${name}.schema.json`, import.meta.url)));
    const validate = ajv.compile(schema);
    assert.equal(validate(value), true, ajv.errorsText(validate.errors));
    assert.equal(validate({ ...value, pooledRate: 0 }), false);
  }
  assert.equal(canonicalize(verifyLteeProtocolBundle(bundle)), canonicalize(bundle));
  assert.equal(canonicalize(buildLteeProtocolBundle(bundle.source, bundle.policy, bundle.protocolSet.bindings)), canonicalize(bundle));
});

test("changed denominators, missing-as-zero, pooled protocols and promoted claims are rejected", () => {
  for (const mutate of [
    (b) => { b.protocolSet.protocols[1].cells[0].replicates = 30; },
    (b) => { b.protocolSet.protocols[0].cells.find((r) => r.outcomeStatus === "not-run").replicates = 0; },
    (b) => { b.protocolSet.protocols.pop(); },
    (b) => { b.protocolSet.protocols[0].views.history.completeGenotype = "resolved"; },
    (b) => { b.protocolSet.review.status = "reviewed"; },
    (b) => { b.assessment.protocols[0].primary = { gain: 1 }; },
    (b) => { b.assessment.verdict = "positive"; },
    (b) => { b.assessment.aggregateScore = 0; },
    (b) => { b.protocolSet.protocols[1].publishedStatistics.expectedMeanGeneration = 26382; }
  ]) {
    const changed = structuredClone(bundle); mutate(changed);
    // Re-sign the altered transport coherently: replay must reject its meaning,
    // not merely notice an outdated outer hash.
    const resign = (kind, value) => {
      const { hash: ignored, ...basis } = value;
      value.hash = hashCanonical(`onto2d:ltee-benchmark-${kind}:v1`, basis);
    };
    for (const protocol of changed.protocolSet.protocols) resign("protocol", protocol);
    resign("protocol-set", changed.protocolSet);
    changed.assessment.protocolSetHash = changed.protocolSet.hash;
    for (const protocol of changed.assessment.protocols) {
      protocol.contractHash = changed.protocolSet.protocols.find((p) => p.protocolId === protocol.protocolId)?.hash ?? protocol.contractHash;
    }
    resign("assessment", changed.assessment);
    assert.throws(() => verifyLteeProtocolBundle(changed), /LTEE/);
  }
});

test("source drift, policy changes, malformed bindings and accessors fail before projection", () => {
  const source = structuredClone(bundle.source); source.observations[0].replicates += 1;
  assert.throws(() => buildLteeProtocolBundle(source, bundle.policy, bundle.protocolSet.bindings), /source/);
  const policy = structuredClone(bundle.policy); policy.nullModel = "shuffle-generations";
  assert.throws(() => buildLteeProtocolBundle(bundle.source, policy, bundle.protocolSet.bindings), /policy/);
  assert.throws(() => buildLteeProtocolBundle(bundle.source, bundle.policy, { ...bundle.protocolSet.bindings, builderHash: "unbound" }), /binding/);
  let invoked = false;
  assert.throws(() => verifyLteeProtocolBundle({ get source() { invoked = true; return bundle.source; } }));
  assert.equal(invoked, false);
});
