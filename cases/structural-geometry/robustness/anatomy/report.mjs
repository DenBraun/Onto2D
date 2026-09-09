import assert from "node:assert/strict";
import { closed, compactReport, validateCompact } from "../report.mjs";
import { groupsOf, targetValues, compareMatched, matchAnatomies } from "./study.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { averageRanks } from "../../protocol/metrics.mjs";
import { STOP_REASONS } from "../../dream4/geometry.mjs";
const natural = (value, maximum = 100000) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= maximum);

export function summarizeStudy(id, rows, result) {
  return { id, targets: targetValues(rows), groups: groupsOf(rows),
    report: result.report.status === "complete" ? compactReport(result.report) : result.report };
}

export function validateStudy(study, id, rows, reason) {
  closed(study, ["id", "targets", "groups", "report"]); assert.equal(study.id, id);
  assert.deepEqual(study.targets, targetValues(rows)); assert.deepEqual(study.groups, groupsOf(rows));
  if (study.report.status === "complete") {
    assert.equal(reason, null); assert.ok(study.groups.length >= 5); validateCompact(study.report, study);
  } else {
    closed(study.report, ["status", "reason", "primary", ...(Object.hasOwn(study.report, "diagnostic") ? ["diagnostic"] : [])]);
    assert.equal(study.report.status, "unavailable"); assert.equal(study.report.primary, null);
    assert.equal(study.report.reason, reason ?? "required-model-computation-failed");
    if (reason === null) assert.ok(typeof study.report.diagnostic === "string" && study.report.diagnostic.length > 0);
  }
}

export function validateResults(report, audit, prior) {
  assert.deepEqual(report.intake, audit.intake);
  const recordingIds = new Set(audit.recordingIds);
  assert.equal(recordingIds.size, audit.recordingIds.length); assert.equal(recordingIds.size, report.intake.recordings);
  const groups = validatePopulation(report.population, report.intake, audit);
  const roots = audit.roots.filter(row => row.eligible);
  assert.deepEqual(report.geometry.map(row => row.source), roots.map(row => row.source));
  for (const [i, row] of report.geometry.entries()) {
    closed(row, ["source", "status", "reason", "scopeHash", "nodeCount", "edgeCount", "pairCount", "evidence", "termination", "stateCount", "featuresSha256"]);
    assert.equal(row.scopeHash, roots[i].graphHash); assert.equal(row.nodeCount, roots[i].nodeIds.length); assert.equal(row.edgeCount, roots[i].edgeCount);
    if (row.status === "complete") {
      assert.equal(row.reason, null); assert.equal(row.pairCount, row.nodeCount * (row.nodeCount - 1));
      assert.match(row.featuresSha256, /^[a-f0-9]{64}$/); closed(row.evidence, ["forman", "ollivier", "flow"]);
      Object.values(row.evidence).forEach(value => assert.match(value, /^sha256:[a-f0-9]{64}$/));
      closed(row.termination, ["reason", "iteration", "cycleStart", "cyclePeriod", "edgeIds"]);
      assert.ok(STOP_REASONS.includes(row.termination.reason)); natural(row.termination.iteration, 4);
      if (row.termination.reason === "cycle") {
        natural(row.termination.cycleStart, row.termination.iteration - 1);
        assert.equal(row.termination.cyclePeriod, row.termination.iteration - row.termination.cycleStart);
      } else { assert.equal(row.termination.cycleStart, null); assert.equal(row.termination.cyclePeriod, null); }
      if (row.termination.reason !== "degenerate-length") assert.deepEqual(row.termination.edgeIds, []);
      assert.equal(row.stateCount, row.termination.iteration + 1);
      if (row.termination.reason === "iteration-limit") assert.equal(row.termination.iteration, 4);
    } else {
      assert.equal(row.status, "unavailable"); assert.ok(row.reason.endsWith("LIMIT_EXCEEDED") || row.reason === "STRUCTURAL_FLOW_NUMERIC_LIMIT");
      for (const key of ["pairCount", "evidence", "termination", "stateCount", "featuresSha256"]) assert.equal(row[key], null);
    }
  }
  const native = report.studies[0];
  assert.equal(report.studies.length, 3);
  assert.equal(native.targets.length, report.population.coverage.eligibleTargetRows);
  assert.deepEqual(groupsOf(native.targets), groups.map(group => ({ id: group.id, targetCount: group.eligibleReceiverCount,
    interventionIds: [JSON.stringify(["Dataset8", group.id])] })));
  assert.equal(new Set(native.targets.map(row => row.id)).size, native.targets.length);
  for (const group of groups) {
    const rows = native.targets.filter(row => row.source === group.id), ranks = averageRanks(rows.map(row => row.magnitude));
    assert.equal(new Set(rows.map(row => row.magnitude)).size, group.distinctMagnitudeCount);
    for (const [i, row] of rows.entries()) {
      closed(row, Object.keys(report.priorTargets[0]));
      assert.equal(row.id, JSON.stringify(["Dataset8", row.source, row.target])); assert.equal(row.groupId, row.source);
      assert.ok(audit.roots.find(root => root.source === row.source).nodeIds.includes(row.target) && row.target !== row.source);
      assert.ok(Number.isFinite(row.magnitude) && row.magnitude >= 0); assert.equal(row.state, row.magnitude === 0 ? "observed-zero" : "observed");
      assert.equal(row.rank, ranks[i]); assert.equal(row.y, (ranks[i] - 1) / (rows.length - 1));
      assert.equal(row.eligible, true); assert.equal(row.pairEligible, true);
      for (const field of ["reason", "pairReason", "scopeReason"]) assert.equal(row[field], null);
      assert.deepEqual(row.groupReasons, []); natural(row.measuredRecordings, 113); assert.ok(row.measuredRecordings >= 2);
      natural(row.recordings, 113); assert.ok(row.recordings >= row.measuredRecordings);
      assert.equal(row.recordingIds.length, row.recordings); assert.equal(new Set(row.recordingIds).size, row.recordings);
      assert.ok(row.recordingIds.every(id => recordingIds.has(id)));
    }
  }
  const geometryFailed = report.geometry.some(row => row.status !== "complete");
  const nativeReason = geometryFailed ? "required-geometry-computation-failed" : report.population.reason;
  validateStudy(native, "Dataset8-native", native.targets, nativeReason);
  assert.equal(digest(report.priorTargets), audit.priorTargetValuesSha256);
  assert.deepEqual(groupsOf(report.priorTargets), prior.study.ablations.B.groups.map(row => ({ id: row.id, targetCount: row.targetCount,
    interventionIds: row.interventions.map(item => item.id) })));
  // Source replay also checks trial lineage. The public report has target values,
  // so reconstruct its overlap census and ranks without inventing trial rows.
  const data = (id, rows) => ({ anatomy: { id }, responses: { trials: [] }, matched: { rows: [], population: { rows } } });
  const overlap = matchAnatomies(data("Dataset7", report.priorTargets), data("Dataset8", native.targets));
  const { rows, ...ledger } = overlap; assert.deepEqual(report.overlap, ledger);
  for (const [i, id] of ["Dataset7", "Dataset8"].entries()) validateStudy(report.studies[i + 1], `${id}-matched`, rows[i],
    i === 1 && geometryFailed ? "required-geometry-computation-failed" : overlap.reason);
  assert.deepEqual(report.comparison, compareMatched(report.studies.slice(1).map(row => row.report)));
  const fitting = report.studies.map(study => {
    const g = study.groups.length, n = study.targets.length, ok = study.report.status === "complete";
    return { id: study.id, distinctReferenceFits: ok ? g * (g - 1) / 2 * 30 + g * 6 : 0,
      predictionsChecked: ok ? n * 6 * (5 * (g - 1) + 1) : 0 };
  });
  assert.deepEqual(report.independent, { status: "verified", method: "independent-native-windows-targets-overlap-bellman-ford-joint-ridge",
    nativeEventsChecked: report.intake.nativeEvents, samplesChecked: report.intake.requestedSamples,
    descriptorPairs: report.geometry.reduce((sum, row) => sum + (row.pairCount ?? 0), 0) + prior.geometry.reduce((sum, row) => sum + (row.pairCount ?? 0), 0),
    eligibleTargets: native.targets.length, sharedPairs: overlap.candidates.filter(row => row.shared).length,
    fitting, numericTolerance: 2e-10, rankTies: "exact-binary64-no-tolerance" });
}
export function validatePopulation(p, intake, audit) {
  closed(p, ["status", "reason", "coverage", "groups", "trialStates", "trialReasons", "recordingResponses", "measuredRecordingResponses",
    "sourceReceiverAggregates", "measuredSourceReceiverAggregates", "candidateStates", "pairExclusions", "targetExclusions"]);
  const expected = audit.roots;
  assert.deepEqual(p.groups.map(group => group.id), expected.map(group => group.source));
  for (const [i, group] of p.groups.entries()) {
    closed(group, ["id", "source", "anatomyId", "scopeEligible", "scopeReason", "eligible", "reason", "reasons",
      "candidateCount", "eligibleReceiverCount", "distinctMagnitudeCount"]);
    assert.equal(group.source, group.id); assert.equal(group.anatomyId, "Dataset8");
    assert.equal(group.scopeEligible, expected[i].eligible);
    assert.equal(group.candidateCount, expected[i].nodeIds.length - 1);
    natural(group.eligibleReceiverCount, group.candidateCount); natural(group.distinctMagnitudeCount, group.eligibleReceiverCount);
    assert.equal(group.scopeReason, expected[i].reason);
    const reasons = [...(!group.scopeEligible ? ["root-scope-ineligible"] : []),
      ...(group.eligibleReceiverCount < 3 ? ["fewer-than-three-eligible-receivers"] : []),
      ...(group.distinctMagnitudeCount < 2 ? ["fewer-than-two-distinct-target-magnitudes"] : [])];
    assert.deepEqual(group.reasons, reasons); assert.equal(group.reason, reasons[0] ?? null); assert.equal(group.eligible, !reasons.length);
  }
  const groups = p.groups.filter(group => group.eligible), c = p.coverage;
  closed(c, ["groups", "eligibleGroups", "candidateRows", "recordingQualifiedRows", "eligibleTargetRows", "noTrialRows", "trialRows"]);
  Object.values(c).forEach(value => natural(value));
  assert.equal(c.groups, p.groups.length); assert.equal(c.eligibleGroups, groups.length);
  assert.equal(c.candidateRows, p.groups.reduce((sum, group) => sum + group.candidateCount, 0));
  assert.equal(c.recordingQualifiedRows, p.groups.reduce((sum, group) => sum + group.eligibleReceiverCount, 0));
  assert.equal(c.eligibleTargetRows, groups.reduce((sum, group) => sum + group.eligibleReceiverCount, 0));
  assert.equal(p.status, groups.length >= 5 ? "complete" : "unavailable");
  assert.equal(p.reason, groups.length >= 5 ? null : "fewer-than-five-eligible-source-groups");
  const sumCounts = ledger => { Object.values(ledger).forEach(value => natural(value)); return Object.values(ledger).reduce((a, b) => a + b, 0); };
  assert.equal(sumCounts(p.trialStates), c.trialRows);
  assert.equal(sumCounts(p.trialReasons), p.trialStates.unobserved + p.trialStates["not-applicable"]);
  assert.equal(sumCounts(p.candidateStates), c.candidateRows);
  assert.equal(sumCounts(p.pairExclusions), c.candidateRows - c.recordingQualifiedRows);
  assert.equal(sumCounts(p.targetExclusions), c.candidateRows - c.eligibleTargetRows);
  assert.equal(p.pairExclusions["no-trial-rows"] ?? 0, c.noTrialRows);
  assert.equal(c.trialRows, intake.requestedWindows + (intake.receiverReasons["no-accepted-receiver-column"] ?? 0));
  assert.equal(p.sourceReceiverAggregates, c.candidateRows - c.noTrialRows);
  natural(p.recordingResponses, c.trialRows); natural(p.measuredRecordingResponses, p.recordingResponses);
  natural(p.measuredSourceReceiverAggregates, p.sourceReceiverAggregates);
  assert.ok(p.measuredSourceReceiverAggregates >= c.recordingQualifiedRows);
  return groups;
}
