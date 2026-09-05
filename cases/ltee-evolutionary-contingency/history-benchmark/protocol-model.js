import { canonicalClone, canonicalize, deepFreeze, hashCanonical, isContentHash } from "@onto2d/kernel/canonical";

export const LTEE_BENCHMARK_ID = "ltee-evolutionary-contingency-history-matters-v1";
const SOURCE_HASH = "sha256:677223764414cd77fa80c4e50e56c405d54c8429985cd1e30f020f86992fc1c3";
const SOURCE_BYTES_HASH = "sha256:d4574e9bf6e34979b3a1a3cb6002a1a6f97da85180ef44da1d8e841dcf257a3d";
const CASE_HASH = "sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691";
export const LTEE_PROTOCOL_POLICY = deepFreeze({
  schemaVersion: "1", benchmarkId: LTEE_BENCHMARK_ID,
  profile: "ltee-aggregate-protocol-audit-v1", population: "Ara-3",
  selection: "all-published-generation-by-protocol-cells", cutoff: "before-new-replay",
  present: "starting-phenotype-and-protocol-context", history: "recorded-source-generation",
  target: "published-independent-Cit-plus-mutant-count", missing: "not-run-is-null",
  dependence: "unresolved-clone-clustering", comparator: "descriptive-history-collapse-only",
  evaluator: "protocol-census-audit-v1", primaryMetric: null, nullModel: "not-run",
  pooling: "forbidden", review: "pending", priorOutcomeExposure: true, preregistered: false
});
const hash = (kind, value) => hashCanonical(`onto2d:ltee-benchmark-${kind}:v1`, value);
function requireValue(condition, message) { if (!condition) throw new TypeError(`LTEE benchmark: ${message}.`); }
function signed(kind, value) { return { ...value, hash: hash(kind, value) }; }

const blockers = [
  { code: "UNRESOLVED_UNIT_LINKAGE", message: "Published cells aggregate replay units. Clone identities, repeated-clone links and individual outcomes are not resolved by the selected tables." },
  { code: "COARSE_PRESENT_VIEW", message: "Starting Cit- phenotype and protocol context define a coarse present view. Equal phenotype does not establish equal genotype or complete present state." },
  { code: "NO_REVIEWED_P0_P1_EVALUATOR", message: "Collapsing source generations supports a descriptive census. Scoring needs a reviewed model for aggregate counts and clone dependence, or additional unit-level evidence with a reviewed evaluation design." },
  { code: "NO_REVIEWED_EXCHANGEABILITY", message: "Different source backgrounds and repeated clones are not assumed exchangeable. No history permutation or new significance calculation is executed." }
];

function projectProtocol(source, protocol, bindings) {
  const rows = source.observations.filter((row) => row.experimentId === protocol.id);
  const byGeneration = new Map(rows.map((row) => [row.sourceGeneration, row]));
  const cells = source.backgrounds.map((background) => {
    const row = byGeneration.get(background.sourceGeneration);
    return { sourceGeneration: background.sourceGeneration, backgroundId: background.id,
      sourceObservationId: row?.id ?? null, outcomeStatus: row?.outcomeStatus ?? "not-run",
      replicates: row?.replicates ?? null, independentCitPlusMutants: row?.independentCitPlusMutants ?? null };
  });
  const { id, nativeLabel, mode, replicateUnit, replicates, independentCitPlusMutants, ...exposure } = protocol;
  const endpoint = id === "replay-1"
    ? `Approximately ${exposure.maximumReplayGenerationsApproximate} replay generations; screening every ${exposure.screeningIntervalGenerations} generations.`
    : `${exposure.incubationDays} days of incubation under this protocol.`;
  const basis = {
    schemaVersion: "1", contractId: `${LTEE_BENCHMARK_ID}:${id}`, protocolId: id, title: nativeLabel,
    source: { snapshotHash: bindings.sourceSnapshotHash, caseHash: bindings.sourceCaseHash, table: "T1", protocolId: id },
    cohort: { population: "Ara-3", observedUnit: "generation-by-protocol aggregate", replicateUnit,
      generations: cells.filter((cell) => cell.outcomeStatus !== "not-run").map((cell) => cell.sourceGeneration),
      notRunGenerations: cells.filter((cell) => cell.outcomeStatus === "not-run").map((cell) => cell.sourceGeneration),
      independence: "unresolved-clone-clustering" },
    selection: { rule: "Retain every published generation cell for this protocol, including zero observations; missing cells remain not-run.",
      outcomeBasedExclusions: false, generationThreshold: null, crossProtocolPooling: false },
    cutoff: { origin: "before-new-replay", historicalAvailability: "Source generation is known when the historical sample starts the replay.",
      endpoint, originalHistoryEqualsReplayHistory: false },
    mode, exposure,
    views: {
      present: { definition: "Reported starting Cit- phenotype and the declared replay environment/protocol, with source generation withheld.",
        availability: "protocol-description-only", completePresentStateObserved: false },
      history: { definition: "Add the recorded Ara-3 source generation to the same coarse present view.",
        fields: ["sourceGeneration"], cloneIdentity: "unresolved", completeGenotype: "unresolved" },
      target: { definition: "Independent Cit+ mutants reported by source generation at this protocol's endpoint.",
        fields: ["replicates", "independentCitPlusMutants", "outcomeStatus"],
        individualOutcomeLinkage: "unresolved", nonObservationMeansImpossible: false }
    },
    evaluation: { evaluator: "protocol-census-audit-v1", comparisonStatus: "requires-additional-evidence-and-reviewed-design",
      P0: "Keep this protocol and its observed-unit denominator; collapse source-generation labels for an inventory only.",
      P1: "Show the same observations separately by recorded source generation; no generation cutoff is selected from outcomes.",
      supportedComparison: "descriptive-generation-conditioned-observation-census",
      primaryMetric: null, nullModel: { status: "not-run", reason: "Clone dependence and exchangeability are unresolved; published P values remain attributed." },
      uncertainty: "No confidence interval or new significance claim.", blockers },
    cells, publishedStatistics: source.publishedStatistics.find((statistic) => statistic.experimentId === id),
    interpretationBoundary: "Retrospective protocol formalization over published aggregate observations. Generation is not a unique clone or genotype. No scored history gain, causal effect, impossibility, Historical Load or independent review is established."
  };
  requireValue(rows.reduce((n, row) => n + row.replicates, 0) === replicates
    && rows.reduce((n, row) => n + row.independentCitPlusMutants, 0) === independentCitPlusMutants, "protocol census differs");
  return signed("protocol", basis);
}

export function buildLteeProtocolBundle(sourceInput, policyInput, bindingsInput) {
  // Snapshot before reading fields; caller-controlled accessors are never invoked.
  const source = canonicalClone(sourceInput);
  const policy = canonicalClone(policyInput);
  const bindings = canonicalClone(bindingsInput);
  requireValue(hash("source", source) === SOURCE_HASH, "source differs from the pinned complete projection");
  requireValue(canonicalize(policy) === canonicalize(LTEE_PROTOCOL_POLICY), "unsupported protocol policy");
  const keys = ["sourceSnapshotHash", "sourceCaseHash", "policyHash", "builderHash", "implementationHash"];
  requireValue(bindings !== null && typeof bindings === "object" && !Array.isArray(bindings)
    && Object.keys(bindings).length === keys.length && keys.every((key) => Object.hasOwn(bindings, key) && isContentHash(bindings[key])), "invalid bindings");
  requireValue(bindings.sourceSnapshotHash === SOURCE_BYTES_HASH && bindings.sourceCaseHash === CASE_HASH
    && bindings.policyHash === hash("policy", policy), "source or policy binding differs");
  const protocols = source.protocols.map((protocol) => projectProtocol(source, protocol, bindings));
  const protocolSet = signed("protocol-set", {
    schemaVersion: "1", format: "onto2d-ltee-history-protocol-set", benchmarkId: LTEE_BENCHMARK_ID,
    caseId: "ltee-evolutionary-contingency", claimClass: "empirical", designClass: "experimental", historyMode: "recorded", effect: "future",
    status: "NOT_ELIGIBLE", statusScope: "Scored P/P+H comparison under the selected aggregate-table profile; not the eligibility of LTEE research in general.",
    review: { status: "pending", priorOutcomeExposure: true, preregistered: false }, bindings, protocols
  });
  const assessment = signed("assessment", {
    schemaVersion: "1", format: "onto2d-ltee-history-protocol-assessment", benchmarkId: LTEE_BENCHMARK_ID,
    protocolSetHash: protocolSet.hash, status: "NOT_ELIGIBLE", verdict: "not-evaluated", aggregateScore: null,
    protocols: protocols.map((protocol) => {
      const observed = protocol.cells.filter((cell) => cell.outcomeStatus !== "not-run");
      const published = protocol.publishedStatistics;
      return { protocolId: protocol.protocolId, contractHash: protocol.hash,
        generationRows: observed.length, notRunRows: protocol.cells.length - observed.length,
        replicateUnit: protocol.cohort.replicateUnit, replicates: observed.reduce((n, cell) => n + cell.replicates, 0),
        independentCitPlusMutants: observed.reduce((n, cell) => n + cell.independentCitPlusMutants, 0),
        status: "NOT_ELIGIBLE", verdict: "not-evaluated", primary: null, blockers,
        sourceDiscrepancy: published.tableOneMeanMatchesPublishedExpected ? null : {
          status: "visible-not-resolved", publishedExpectedMeanGeneration: published.expectedMeanGeneration,
          tableOneReplicateWeightedMeanGeneration: published.tableOneReplicateWeightedMean.rounded,
          publishedPValueRecomputed: false
        }
      };
    })
  });
  return deepFreeze({ source, policy, protocolSet, assessment });
}

export function verifyLteeProtocolBundle(input) {
  const bundle = canonicalClone(input);
  requireValue(bundle !== null && typeof bundle === "object" && !Array.isArray(bundle), "invalid protocol bundle");
  const expected = buildLteeProtocolBundle(bundle.source, bundle.policy, bundle.protocolSet?.bindings);
  requireValue(canonicalize(bundle) === canonicalize(expected), "protocol or assessment replay differs");
  return expected;
}
