import assert from "node:assert/strict";
import test from "node:test";
import { prepareDreamPopulation, prepareFunctionalPopulation, POPULATION_POLICY } from "./populations.mjs";
import { FUNCTIONAL_PROFILE } from "./functional.mjs";

function dreams() {
  const genes = Array.from({ length: 10 }, (_, index) => `G${index + 1}`);
  return Array.from({ length: 5 }, (_, index) => {
    const id = `insilico_size10_${index + 1}`, tables = {}, sourceMembers = [];
    for (const [tableIndex, name] of ["wildtype", "knockouts", "knockdowns"].entries()) {
      const values = name === "wildtype" ? [Array(10).fill(0)] :
        Array.from({ length: 10 }, (_, row) => genes.map((_, column) => row === column && name === "knockouts" ? 0 : column % 3));
      const sourceMember = `lightlyProcessedDownloadedData/${id}/${name}.tsv`, sourceSha256 = String(tableIndex).repeat(64);
      sourceMembers.push({ member: sourceMember, kind: "file", sha256: sourceSha256, bytes: 1000 });
      tables[name] = { columns: [...genes], values, nativeLines: values.map((_, row) => row + 2), rowCount: values.length,
        columnCount: 10, role: "fabricated expression source", sourceMember, sourceSha256 };
      if (name !== "wildtype") Object.assign(tables[name], { interventions: genes.map((gene, rowIndex) => ({ rowIndex, gene })),
        alignmentEvidenceMember: "DREAM4/inst/scripts/buildRData.R" });
    }
    Object.assign(tables, { multifactorial: {}, timeseries: {}, dualknockouts: {} });
    return { id, splitGroup: id, nodeIdentityScope: "network-local", nodes: [...genes], edges: [], goldStandard: [],
      tables, sourceMembers, census: {} };
  });
}

function functional(groupCount = 6) {
  const scopes = [], rows = [];
  for (let group = 0; group < groupCount; group += 1) {
    const source = `S${group}`;
    scopes.push({ anatomyId: "Dataset7", source, nodeIds: [source, "T0", "T1", "T2", "MISSING"],
      eligible: group !== 5, reason: group === 5 ? "geometry-budget" : null });
    for (let recording = 0; recording < 2; recording += 1) for (let target = 0; target < 3; target += 1) {
      rows.push({ recordingId: `${source}-recording-${recording}`, source, target: `T${target}`, trialIndex: 0,
        state: target === 0 ? "observed-zero" : "observed", magnitude: target, reason: null });
    }
  }
  return { scopes, rows };
}

test("DREAM eligibility preserves exactly five networks, fifty interventions and 450 target rows", () => {
  const units = dreams(), original = structuredClone(units), result = prepareDreamPopulation(units);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.coverage, { groups: 5, eligibleGroups: 5, interventions: 50, eligibleInterventions: 50,
    targetRows: 450, eligibleTargetRows: 450 });
  assert.equal(new Set(result.rows.map(row => row.id)).size, 450);
  for (const group of result.groups) {
    assert.equal(group.interventions.length, 10);
    for (const intervention of group.interventions) {
      const rows = result.rows.filter(row => row.interventionId === intervention.id);
      assert.equal(rows.length, 9);
      assert.equal(rows.every(row => row.source !== row.target && row.groupId === group.id), true);
      assert.equal(rows.every(row => row.y === (row.rank - 1) / 8), true);
    }
  }
  assert.deepEqual(prepareDreamPopulation([...units].reverse()), result);
  assert.deepEqual(units, original);
  assert.ok(Object.isFrozen(result.rows[0]));
});

test("one constant DREAM intervention makes the strict primary unavailable without dropping rows", () => {
  const units = dreams(); units[2].tables.knockouts.values[4] = Array(10).fill(0);
  const result = prepareDreamPopulation(units);
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "all-fifty-nonconstant-interventions-required");
  assert.equal(result.coverage.eligibleGroups, 4);
  assert.equal(result.coverage.eligibleInterventions, 49);
  assert.equal(result.rows.length, 450);
  const excluded = result.rows.filter(row => !row.eligible);
  assert.equal(excluded.length, 9);
  assert.equal(excluded.every(row => row.reason === "constant-observed-target" && row.magnitude === 0 && row.rank === 5 && row.y === 0.5), true);
  assert.equal(prepareDreamPopulation(units, "knockdowns").status, "complete");
});

test("DREAM populations reject missing, repeated, foreign or malformed units and unsupported contrasts", () => {
  const units = dreams();
  assert.throws(() => prepareDreamPopulation(units.slice(1)));
  assert.throws(() => prepareDreamPopulation([units[0], ...units.slice(0, 4)]));
  const unknown = structuredClone(units); unknown[0].id = "foreign-network";
  assert.throws(() => prepareDreamPopulation(unknown));
  const bad = dreams(); bad[0].tables.knockouts.values[0][1] = null;
  assert.throws(() => prepareDreamPopulation(bad));
  assert.throws(() => prepareDreamPopulation(units, "timeseries"));
});

test("functional populations preserve all candidates and ineligible roots with explicit missingness", () => {
  const { rows, scopes } = functional(), original = structuredClone({ rows, scopes });
  const result = prepareFunctionalPopulation(rows, scopes);
  assert.equal(result.profileId, FUNCTIONAL_PROFILE.id);
  assert.equal(result.anatomyId, "Dataset7");
  assert.equal(result.status, "complete");
  assert.deepEqual(result.coverage, { groups: 6, eligibleGroups: 5, candidateRows: 24,
    recordingQualifiedRows: 18, eligibleTargetRows: 15, noTrialRows: 6, trialRows: 36 });
  const missing = result.rows.filter(row => row.target === "MISSING");
  assert.equal(missing.length, 6);
  assert.equal(missing.every(row => row.reason === "no-trial-rows" && row.magnitude === null && row.rank === null && row.y === null), true);
  const zero = result.rows.find(row => row.source === "S0" && row.target === "T0");
  assert.equal(zero.state, "observed-zero");
  assert.equal(zero.magnitude, 0);
  assert.equal(zero.rank, 1);
  assert.equal(zero.y, 0);
  assert.equal(zero.measuredRecordings, 2);
  const rejected = result.groups.find(group => group.id === "S5");
  assert.equal(rejected.reason, "root-scope-ineligible");
  assert.equal(rejected.scopeReason, "geometry-budget");
  assert.equal(result.rows.filter(row => row.source === "S5").length, 4);
  assert.deepEqual({ rows, scopes }, original);
  assert.deepEqual(prepareFunctionalPopulation([...rows].reverse(), [...scopes].reverse().map(scope => ({ ...scope, nodeIds: [...scope.nodeIds].reverse() }))), result);
  assert.ok(Object.isFrozen(result.groups[0]));
});

test("functional thresholds count distinct measured recordings and retain insufficient coverage", () => {
  const { rows, scopes } = functional();
  const reduced = rows.filter(row => !(row.source === "S0" && row.target === "T0" && row.recordingId.endsWith("-1")));
  const sole = reduced.find(row => row.source === "S0" && row.target === "T0");
  for (let trialIndex = 1; trialIndex <= 10; trialIndex += 1) reduced.push({ ...sole, trialIndex });
  const result = prepareFunctionalPopulation(reduced, scopes);
  assert.equal(result.status, "unavailable");
  assert.equal(result.coverage.eligibleGroups, 4);
  const pair = result.rows.find(row => row.source === "S0" && row.target === "T0");
  assert.equal(pair.reason, "fewer-than-two-measured-recordings");
  assert.equal(pair.measuredRecordings, 1);
  assert.equal(pair.magnitude, 0);
  assert.equal(pair.rank, null);
  assert.equal(result.groups.find(group => group.id === "S0").reason, "fewer-than-three-eligible-receivers");
});

test("constant and wholly unavailable functional outcomes remain separate exclusion reasons", () => {
  const { rows, scopes } = functional();
  for (const row of rows) if (row.source === "S0") { row.magnitude = 2; row.state = "observed"; }
  for (const row of rows) if (row.source === "S1" && row.target === "T0") {
    row.magnitude = null; row.state = "unobserved"; row.reason = "missing-window";
  }
  const result = prepareFunctionalPopulation(rows, scopes);
  assert.equal(result.status, "unavailable");
  const constant = result.groups.find(group => group.id === "S0");
  assert.equal(constant.eligibleReceiverCount, 3);
  assert.equal(constant.reason, "fewer-than-two-distinct-target-magnitudes");
  const measured = result.rows.filter(row => row.source === "S0" && row.pairEligible);
  assert.equal(measured.every(row => !row.eligible && row.rank === 2 && row.y === 0.5), true);
  const missing = result.rows.find(row => row.source === "S1" && row.target === "T0");
  assert.equal(missing.reason, "no-measured-recording-medians");
  assert.equal(missing.recordings, 2);
  assert.equal(missing.measuredRecordings, 0);
  assert.equal(missing.magnitude, null);
  assert.equal(result.aggregation.reasonCounts["missing-window"], 2);
});

test("a pair median underflow retains measured coverage without becoming a rankable zero", () => {
  const { rows, scopes } = functional();
  const tiny = rows.find(row => row.source === "S0" && row.target === "T0" && row.recordingId.endsWith("-1"));
  tiny.state = "observed"; tiny.magnitude = Number.MIN_VALUE;
  const result = prepareFunctionalPopulation(rows, scopes);
  const pair = result.rows.find(row => row.source === "S0" && row.target === "T0");
  assert.equal(pair.measuredRecordings, 2);
  assert.equal(pair.recordings, 2);
  assert.equal(pair.state, "unobserved");
  assert.equal(pair.magnitude, null);
  assert.equal(pair.pairEligible, false);
  assert.equal(pair.eligible, false);
  assert.equal(pair.pairReason, "median-underflow");
  assert.equal(pair.reason, "median-underflow");
  assert.equal(pair.rank, null);
  assert.equal(pair.y, null);
  assert.equal(result.rows.length, 24);
  assert.equal(result.groups.find(group => group.id === "S0").eligibleReceiverCount, 2);
  assert.equal(result.coverage.recordingQualifiedRows, 17);
  assert.equal(result.coverage.eligibleGroups, 4);
  assert.equal(result.status, "unavailable");
});

test("five groups are mandatory and candidates cannot silently cross scope or anatomy identities", () => {
  const { rows, scopes } = functional(4);
  assert.equal(prepareFunctionalPopulation(rows, scopes).reason, "fewer-than-five-eligible-source-groups");
  assert.throws(() => prepareFunctionalPopulation([{ ...rows[0], source: "UNKNOWN" }], scopes), /source is absent/);
  assert.throws(() => prepareFunctionalPopulation([{ ...rows[0], target: "OUTSIDE" }], scopes), /outside/);
  assert.throws(() => prepareFunctionalPopulation(rows, scopes.map((scope, index) => ({ ...scope, anatomyId: index ? "Dataset7" : "Dataset8" }))), /one explicit anatomy/);
  assert.throws(() => prepareFunctionalPopulation(rows, [...scopes, scopes[0]]), /Duplicate/);
  assert.throws(() => prepareFunctionalPopulation(rows, scopes.map(scope => ({ ...scope, nodeIds: scope.nodeIds.slice(1) }))), /include their source/);
  assert.throws(() => prepareFunctionalPopulation([...rows, rows[0]], scopes), /Duplicate functional trial/);
  assert.throws(() => prepareFunctionalPopulation([], []));
});

test("scope and ledger work bounds reject whole populations while retaining oversized rejected scopes", () => {
  const scope = { anatomyId: "Dataset7", source: "S", nodeIds: ["S", ...Array.from({ length: 64 }, (_, index) => `T${index}`)],
    eligible: false, reason: "oversized-geometry-scope" };
  const rejected = prepareFunctionalPopulation([], [scope]);
  assert.equal(rejected.rows.length, 64);
  assert.equal(rejected.groups[0].scopeReason, "oversized-geometry-scope");
  assert.throws(() => prepareFunctionalPopulation([], [{ ...scope, eligible: true, reason: null }]), /bounded/);
  assert.throws(() => prepareFunctionalPopulation([], [{ ...scope, nodeIds: Array.from({ length: 4097 }, (_, index) => String(index)) }]), /bounded/);
  assert.throws(() => prepareFunctionalPopulation([], Array(POPULATION_POLICY.bounds.scopes + 1).fill(scope)), /bounded/);
  assert.throws(() => prepareFunctionalPopulation(Array(100_001).fill({}), [scope]), /bounded/);
  const wide = Array.from({ length: 25 }, (_, index) => ({ ...scope, source: `S${index}`,
    nodeIds: [`S${index}`, ...Array.from({ length: 4095 }, (_, node) => `T${node}`)] }));
  assert.throws(() => prepareFunctionalPopulation([], wide), /candidate ledger exceeds/);
  const sparse = [scope]; delete sparse[0];
  assert.throws(() => prepareFunctionalPopulation([], sparse), /dense/);
});
