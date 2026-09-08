import { deepFreeze } from "@onto2d/kernel/canonical";
import { averageRanks, dreamTargets, TARGET_PROFILE_ID } from "./metrics.mjs";
import { aggregateResponses, FUNCTIONAL_PROFILE } from "./functional.mjs";

export const POPULATION_POLICY = deepFreeze({
  id: "biological-rank-populations-v1", version: "1",
  dream: "all-five-networks-all-ten-interventions-all-nine-off-target-genes",
  dreamPrimary: "complete-only-if-every-intervention-has-at-least-two-distinct-magnitudes",
  functionalPair: "at-least-two-measured-recording-medians",
  functionalGroup: "eligible-root-at-least-three-eligible-receivers-and-two-distinct-magnitudes",
  functionalPrimary: "at-least-five-eligible-source-neuron-groups-in-one-anatomy",
  rankTarget: "(average-rank-minus-one)/(eligible-receiver-count-minus-one)",
  scope: "caller-supplied-exhaustive-root-population-with-upstream-mapping-and-geometry-eligibility",
  omission: "retain-every-candidate-and-ineligible-root; reject-unknown-or-out-of-scope-trial-identities",
  bounds: { scopes: 512, eligibleScopeNodes: 64, ineligibleScopeNodes: 4096, candidateRows: 100_000,
    trialRows: 100_000 }, evaluation: "target-population-only-no-predictive-score"
});

const text = value => typeof value === "string" && value.length > 0;
function dense(values, maximum, label) {
  if (!Array.isArray(values) || values.length > maximum || Object.getOwnPropertySymbols(values).length ||
      Object.keys(values).length !== values.length || Object.keys(values).some((key, index) => key !== String(index))) {
    throw new Error(`${label} must be a bounded dense array without extra fields.`);
  }
}
function closed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getOwnPropertySymbols(value).length ||
      Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
    throw new Error(`Expected a closed ${label}.`);
  }
}

/** Strict DREAM4 eligibility; constant outcomes retain their actual values/ranks. */
export function prepareDreamPopulation(units, contrast = "knockouts") {
  dense(units, 5, "DREAM4 network population");
  const expected = Array.from({ length: 5 }, (_, index) => `insilico_size10_${index + 1}`);
  if (units.length !== 5 || units.some(unit => !unit || !expected.includes(unit.id)) ||
      new Set(units.map(unit => unit.id)).size !== 5) throw new Error("DREAM4 requires exactly all five named source networks.");
  const rows = [], groups = [];
  for (const id of expected) {
    const targets = dreamTargets(units.find(unit => unit.id === id), contrast);
    const interventions = targets.interventions.map(target => {
      const distinctMagnitudeCount = new Set(target.magnitudes).size;
      const eligible = distinctMagnitudeCount >= 2, reason = eligible ? null : "constant-observed-target";
      const rowIds = target.genes.map((gene, index) => {
        const rowId = JSON.stringify([id, contrast, target.gene, gene]);
        rows.push({ id: rowId, groupId: id, interventionId: target.id, source: target.gene, target: gene,
          magnitude: target.magnitudes[index], rank: target.ranks[index], y: (target.ranks[index] - 1) / (target.genes.length - 1),
          eligible, reason });
        return rowId;
      });
      return { id: target.id, source: target.gene, eligible, reason, distinctMagnitudeCount, targetCount: rowIds.length, rowIds };
    });
    const eligible = interventions.every(intervention => intervention.eligible);
    groups.push({ id, eligible, reason: eligible ? null : "one-or-more-constant-interventions", source: targets.source, interventions });
  }
  const complete = groups.every(group => group.eligible);
  return deepFreeze({ profileId: TARGET_PROFILE_ID, populationPolicyId: POPULATION_POLICY.id,
    status: complete ? "complete" : "unavailable", reason: complete ? null : "all-fifty-nonconstant-interventions-required",
    contrast, role: contrast === "knockouts" ? "primary" : "secondary", groups, rows,
    coverage: { groups: 5, eligibleGroups: groups.filter(group => group.eligible).length,
      interventions: 50, eligibleInterventions: groups.reduce((total, group) => total + group.interventions.filter(item => item.eligible).length, 0),
      targetRows: rows.length, eligibleTargetRows: rows.filter(row => row.eligible).length } });
}

function readScopes(scopes) {
  dense(scopes, POPULATION_POLICY.bounds.scopes, "Functional root scopes");
  if (!scopes.length) throw new Error("An explicit nonempty anatomical root population is required.");
  const anatomyIds = new Set(), sources = new Set();
  let candidates = 0;
  const result = scopes.map(scope => {
    closed(scope, ["anatomyId", "source", "nodeIds", "eligible", "reason"], "functional root scope");
    if (!text(scope.anatomyId) || !text(scope.source) || typeof scope.eligible !== "boolean" ||
        (scope.eligible ? scope.reason !== null : !text(scope.reason))) throw new Error("Root scope identity, eligibility and reason disagree.");
    dense(scope.nodeIds, scope.eligible ? POPULATION_POLICY.bounds.eligibleScopeNodes : POPULATION_POLICY.bounds.ineligibleScopeNodes, "Root scope nodes");
    if (scope.nodeIds.some(node => !text(node)) || new Set(scope.nodeIds).size !== scope.nodeIds.length ||
        !scope.nodeIds.includes(scope.source)) throw new Error("Root scope nodes must be distinct and include their source.");
    if (sources.has(scope.source)) throw new Error("Duplicate anatomical root source.");
    sources.add(scope.source); anatomyIds.add(scope.anatomyId);
    candidates += scope.nodeIds.length - 1;
    if (candidates > POPULATION_POLICY.bounds.candidateRows) throw new Error("Functional candidate ledger exceeds its complete-population bound.");
    return { ...scope, nodeIds: [...scope.nodeIds].sort() };
  });
  if (anatomyIds.size !== 1) throw new Error("All functional source groups must share one explicit anatomy identity.");
  return result.sort((left, right) => left.source < right.source ? -1 : left.source > right.source ? 1 : 0);
}

/** One scoped source-neuron group per root; no trial/pair is an IID split unit.
 * The caller certifies exact-label mappings, exhaustive selected roots, common
 * anatomical provenance and provider preflight. This helper validates the
 * supplied census; it cannot infer missing roots or verify an omitted graph.
 */
export function prepareFunctionalPopulation(trialRows, scopes) {
  const selected = readScopes(scopes);
  dense(trialRows, POPULATION_POLICY.bounds.trialRows, "Functional trial population");
  const roots = new Map(selected.map(scope => [scope.source, new Set(scope.nodeIds)]));
  const aggregation = aggregateResponses(trialRows);
  for (const row of aggregation.responses) {
    if (!roots.has(row.source)) throw new Error("Functional trial source is absent from the declared root population.");
    if (!roots.get(row.source).has(row.target)) throw new Error("Functional trial receiver is outside its declared rooted scope.");
  }
  const pairs = new Map(aggregation.responses.map(row => [JSON.stringify([row.source, row.target]), row]));
  const groups = [], rows = [], anatomyId = selected[0].anatomyId;
  for (const scope of selected) {
    const candidates = scope.nodeIds.filter(target => target !== scope.source).map(target => {
      const response = pairs.get(JSON.stringify([scope.source, target]));
      const pairObserved = response !== undefined &&
        ["observed", "observed-zero"].includes(response.state) && Number.isFinite(response.magnitude);
      const pairEligible = pairObserved && response.measuredRecordings >= 2;
      const pairReason = response === undefined ? "no-trial-rows" : response.measuredRecordings === 0 ?
        "no-measured-recording-medians" : response.measuredRecordings < 2 ? "fewer-than-two-measured-recordings" :
        !pairObserved ? response.reason ?? "unobserved-aggregate-magnitude" : null;
      return { id: JSON.stringify([anatomyId, scope.source, target]), groupId: scope.source,
        interventionId: JSON.stringify([anatomyId, scope.source]), source: scope.source, target,
        state: response?.state ?? "unobserved", magnitude: response?.magnitude ?? null,
        pairEligible, pairReason, measuredRecordings: response?.measuredRecordings ?? 0,
        recordings: response?.recordings ?? 0, recordingIds: response?.recordingIds ?? [],
        rank: null, y: null };
    });
    const qualified = candidates.filter(row => row.pairEligible);
    const distinctMagnitudeCount = new Set(qualified.map(row => row.magnitude)).size;
    const reasons = [];
    if (!scope.eligible) reasons.push("root-scope-ineligible");
    if (qualified.length < 3) reasons.push("fewer-than-three-eligible-receivers");
    if (distinctMagnitudeCount < 2) reasons.push("fewer-than-two-distinct-target-magnitudes");
    const eligible = reasons.length === 0;
    // Oversized rejected scopes still retain every candidate. A rank is only
    // materialized within the bounded, potentially evaluable root population.
    if (scope.eligible && qualified.length) {
      const ranks = averageRanks(qualified.map(row => row.magnitude));
      qualified.forEach((row, index) => {
        row.rank = ranks[index];
        row.y = qualified.length > 1 ? (ranks[index] - 1) / (qualified.length - 1) : null;
      });
    }
    for (const row of candidates) {
      row.eligible = eligible && row.pairEligible;
      row.reason = row.eligible ? null : row.pairReason ?? reasons[0];
      row.groupReasons = [...reasons]; row.scopeReason = scope.reason;
      rows.push(row);
    }
    groups.push({ id: scope.source, source: scope.source, anatomyId, scopeEligible: scope.eligible,
      scopeReason: scope.reason, eligible, reason: reasons[0] ?? null, reasons,
      candidateCount: candidates.length, eligibleReceiverCount: qualified.length, distinctMagnitudeCount,
      rowIds: candidates.map(row => row.id) });
  }
  const eligibleGroups = groups.filter(group => group.eligible).length, complete = eligibleGroups >= 5;
  return deepFreeze({ profileId: FUNCTIONAL_PROFILE.id, populationPolicyId: POPULATION_POLICY.id,
    anatomyId, status: complete ? "complete" : "unavailable", reason: complete ? null : "fewer-than-five-eligible-source-groups",
    groups, rows, aggregation,
    coverage: { groups: groups.length, eligibleGroups, candidateRows: rows.length,
      recordingQualifiedRows: rows.filter(row => row.pairEligible).length, eligibleTargetRows: rows.filter(row => row.eligible).length,
      noTrialRows: rows.filter(row => row.pairReason === "no-trial-rows").length,
      trialRows: trialRows.length } });
}
