import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { averageRanks, dreamTargets, MAX_RANK_VALUES, rankMetrics, TARGET_PROFILE_ID } from "./metrics.mjs";

let independent;
function reference() {
  if (independent) return independent;
  const result = spawnSync("python3", ["-B", fileURLToPath(new URL("reference.py", import.meta.url))],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  independent = JSON.parse(result.stdout);
  return independent;
}

function nativeUnit() {
  const fixture = reference().targetFixture;
  const id = "insilico_size10_1", genes = Array.from({ length: 10 }, (_, index) => `G${index + 1}`);
  const sourceMembers = [], tables = {};
  for (const [name, values] of Object.entries({ wildtype: [fixture.wildtype],
    knockouts: fixture.contrasts.knockouts.values, knockdowns: fixture.contrasts.knockdowns.values })) {
    const sourceMember = `lightlyProcessedDownloadedData/${id}/${name}.tsv`;
    const sourceSha256 = (name === "wildtype" ? "a" : name === "knockouts" ? "b" : "c").repeat(64);
    sourceMembers.push({ member: sourceMember, kind: "file", bytes: 1000, sha256: sourceSha256 });
    tables[name] = { columns: [...genes], values: structuredClone(values), nativeLines: values.map((_, index) => index + 2),
      rowCount: values.length, columnCount: 10, role: "fabricated independent observations", sourceMember, sourceSha256 };
    if (name !== "wildtype") Object.assign(tables[name], {
      interventions: genes.map((gene, rowIndex) => ({ rowIndex, gene })), alignmentEvidenceMember: "DREAM4/inst/scripts/buildRData.R" });
  }
  // Unconsumed tables and graph fields are intentionally opaque to the target
  // transform. Source-byte verification belongs to the D2 preparation pipeline.
  Object.assign(tables, { multifactorial: {}, timeseries: {}, dualknockouts: {} });
  return { id, splitGroup: id, nodeIdentityScope: "network-local", nodes: genes,
    edges: [], goldStandard: [], tables, sourceMembers, census: {} };
}

test("average ranks use exact ties and preserve original positions without mutation", () => {
  const values = [3, 1, 1, 2];
  assert.deepEqual(averageRanks(values), [4, 1.5, 1.5, 3]);
  assert.deepEqual(values, [3, 1, 1, 2]);
  assert.deepEqual(averageRanks([1, 1 + Number.EPSILON, 1]), [1.5, 3, 1.5]);
  assert.deepEqual(averageRanks([-0, 0, -1]), [2.5, 2.5, 1]);
  assert.deepEqual(averageRanks([]), []);
  assert.ok(Object.isFrozen(averageRanks(values)));
});

test("hand-checked perfect, reversed and tied rankings retain exact metric components", () => {
  const perfect = rankMetrics([1, 2, 3], [7, 8, 9]);
  assert.equal(perfect.rankSkill.value, 1);
  assert.equal(perfect.spearman.value, 1);
  assert.equal(perfect.kendallTauB.value, 1);
  assert.equal(perfect.spearman.numerator, "8");
  assert.equal(perfect.spearman.denominatorSquared, "64");
  const inverse = rankMetrics([1, 2, 3], [3, 2, 1]);
  for (const name of ["rankSkill", "spearman", "kendallTauB"]) assert.equal(inverse[name].value, -1);
  const tied = rankMetrics([1, 1, 2], [1, 2, 2]);
  assert.deepEqual(tied.rankSkill, { value: 0.5, reason: null, numerator: "1", denominator: "2" });
  assert.equal(tied.spearman.value, 0.5);
  assert.equal(tied.kendallTauB.value, 0.5);
  assert.equal(tied.kendallTauB.concordant, 1);
  assert.equal(tied.kendallTauB.tiedPredictedOnly, 1);
  assert.equal(tied.kendallTauB.tiedObservedOnly, 1);
  assert.deepEqual(rankMetrics([2, 1, 1], [2, 1, 2]), tied);
  assert.ok(Object.isFrozen(tied.rankSkill));
});

test("constant predictions score zero skill while undefined correlations remain explicit null", () => {
  const constant = rankMetrics([0, 0, 0], [1, 2, 3]);
  assert.deepEqual(constant.rankSkill, { value: 0, reason: null, numerator: "0", denominator: "3" });
  assert.equal(constant.spearman.value, null);
  assert.equal(constant.spearman.reason, "constant-prediction");
  assert.equal(constant.kendallTauB.value, null);
  const targetTies = rankMetrics([1, 2, 3], [0, 0, 0]);
  assert.equal(targetTies.rankSkill.value, null);
  assert.equal(targetTies.rankSkill.reason, "constant-observed");
  assert.equal(targetTies.spearman.reason, "constant-observation");
  assert.equal(rankMetrics([0, 0], [1, 1]).spearman.reason, "constant-prediction-and-observation");
  for (const values of [[], [1]]) {
    const result = rankMetrics(values, values);
    for (const name of ["rankSkill", "spearman", "kendallTauB"]) {
      assert.equal(result[name].value, null);
      assert.equal(result[name].reason, "too-few-observations");
    }
  }
});

test("independent Fraction reference verifies every aligned vector pair over a small complete domain", () => {
  const { vectors, pairs, invalid } = reference();
  assert.equal(vectors.length, 121);
  assert.equal(pairs.length, 7381);
  for (const { values, ranks } of vectors) assert.deepEqual(averageRanks(values), ranks);
  for (const { predictedIndex, observedIndex, expected } of pairs) {
    const actual = rankMetrics(vectors[predictedIndex].values, vectors[observedIndex].values);
    // Both references retain exact components. Coefficients alone may differ
    // by final square-root rounding between Python and JavaScript.
    const expectedCopy = structuredClone(expected), actualCopy = structuredClone(actual);
    for (const name of ["rankSkill", "spearman", "kendallTauB"]) {
      if (expected[name].value === null) assert.equal(actual[name].value, null);
      else assert.ok(Math.abs(actual[name].value - expected[name].value) <= 1e-15);
      delete expectedCopy[name].value;
      delete actualCopy[name].value;
    }
    assert.deepEqual(actualCopy, expectedCopy);
  }
  for (const item of invalid) assert.throws(() => rankMetrics(item.predicted, item.observed));
});

test("rank inputs reject missing, nonfinite, ragged, extra and oversized values without coercion", () => {
  const extra = [1, 2]; extra.note = "unexpected";
  const sparse = new Array(2); sparse[1] = 1;
  for (const value of [[1, null], [NaN], [Infinity], [-Infinity], [false], ["1"], [[1]], sparse, extra, {}, null,
    Array(MAX_RANK_VALUES + 1).fill(1)]) {
    assert.throws(() => averageRanks(value));
    assert.throws(() => rankMetrics(value, [1]));
  }
  assert.throws(() => rankMetrics([1], [1, 2]));
  const boundary = Array.from({ length: MAX_RANK_VALUES }, (_, index) => index);
  assert.equal(rankMetrics(boundary, boundary).spearman.value, 1);
});

test("DREAM4 target contract retains every off-target gene and separate KO/KD contrasts", () => {
  const unit = nativeUnit(), original = structuredClone(unit);
  for (const contrast of ["knockouts", "knockdowns"]) {
    const result = dreamTargets(unit, contrast), expected = reference().targetFixture.contrasts[contrast].targets;
    assert.equal(result.profileId, TARGET_PROFILE_ID);
    assert.equal(result.role, contrast === "knockouts" ? "primary" : "secondary");
    assert.equal(result.splitGroup, unit.id);
    assert.equal(result.interventionCount, 10);
    assert.equal(result.offTargetCount, 90);
    assert.equal(result.source.perturbed.sha256, unit.tables[contrast].sourceSha256);
    result.interventions.forEach((row, index) => {
      assert.equal(row.rowIndex, index);
      assert.equal(row.gene, unit.nodes[index]);
      assert.equal(row.genes.length, 9);
      assert.equal(new Set(row.genes).size, 9);
      assert.equal(row.genes.includes(row.gene), false);
      assert.deepEqual(row.magnitudes, expected[index].magnitudes);
      assert.deepEqual(row.ranks, expected[index].ranks);
      assert.equal(row.directlyIntervened.excluded, true);
    });
    // A native zero WT is legitimate; absolute difference requires no division.
    assert.equal(result.interventions[1].wildtype[0], 0);
    assert.ok(Number.isFinite(result.interventions[1].magnitudes[0]));
    assert.ok(Object.isFrozen(result.interventions[0].magnitudes));
  }
  assert.deepEqual(unit, original);
  assert.deepEqual(dreamTargets(unit), dreamTargets(unit, "knockouts"));
});

test("directly intervened responses and input topology never enter off-target ranking", () => {
  const unit = nativeUnit(), before = dreamTargets(unit, "knockdowns");
  unit.tables.knockdowns.values[0][0] = 1e100;
  unit.edges.push({ source: "G1", target: "G2" });
  const after = dreamTargets(unit, "knockdowns");
  assert.deepEqual(after.interventions[0].magnitudes, before.interventions[0].magnitudes);
  assert.deepEqual(after.interventions[0].ranks, before.interventions[0].ranks);
  assert.equal(after.interventions[0].directlyIntervened.perturbed, 1e100);
});

test("DREAM4 targets reject missingness, contradictory alignment, unbound sources and numeric overflow", () => {
  const mutations = [
    unit => { unit.tables.knockouts.values[0][1] = null; },
    unit => { unit.tables.knockouts.values.pop(); },
    unit => { unit.tables.knockouts.columns.reverse(); },
    unit => { unit.tables.knockouts.interventions[0].gene = "G2"; },
    unit => { unit.tables.knockouts.values[0][0] = 1; },
    unit => { unit.tables.wildtype.nativeLines = [0]; },
    unit => { unit.tables.knockouts.sourceSha256 = "d".repeat(64); },
    unit => { unit.sourceMembers.push(unit.sourceMembers[0]); },
    unit => { unit.tables.knockouts.sourceMember = "different.tsv"; },
    unit => { unit.tables.knockouts.alignmentEvidenceMember = "different.R"; },
    unit => { unit.splitGroup = "another-network"; },
    unit => { unit.nodes.reverse(); },
    unit => { unit.tables.knockouts.extra = true; },
    unit => { unit.tables.wildtype.values[0][1] = -1e308; unit.tables.knockouts.values[0][1] = 1e308; }
  ];
  for (const mutate of mutations) { const unit = nativeUnit(); mutate(unit); assert.throws(() => dreamTargets(unit)); }
  assert.throws(() => dreamTargets(nativeUnit(), "dualknockouts"));
});
