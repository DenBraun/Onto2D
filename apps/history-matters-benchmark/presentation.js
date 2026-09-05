import { contentHash } from "@onto2d/history-benchmark";
import { validateHistoryRegressionContract } from "@onto2d/history-benchmark/predictive";

export function benchmarkRows(registry, entries, preparations = []) {
  const byId = new Map(entries.map((entry) => [entry.result.benchmarkId, entry]));
  const prepared = new Map(preparations.map((entry) => [entry.contract.benchmarkId, entry]));
  if (prepared.size !== preparations.length) throw new Error("Duplicate benchmark preparation.");
  if (byId.size !== entries.length) throw new Error("Duplicate benchmark result.");
  const seen = new Set();
  const rows = registry.entries.map((member) => {
    if (seen.has(member.benchmarkId)) throw new Error("Duplicate benchmark membership.");
    seen.add(member.benchmarkId);
    const entry = byId.get(member.benchmarkId);
    const preparation = prepared.get(member.benchmarkId);
    if (Boolean(entry) !== (member.resultPath !== null)) throw new Error("Registry/result membership mismatch.");
    if (entry && (member.caseId !== entry.contract.caseId || member.claimClass !== entry.contract.claimClass
      || member.designClass !== entry.contract.designClass || member.effect !== entry.contract.effect
      || member.historyMode !== entry.contract.historyMode || member.status !== "EVALUATED")) throw new Error("Registry/result interpretation mismatch.");
    if (Boolean(preparation) !== (member.status === "EVALUATION_READY")) throw new Error("Preparation maturity mismatch.");
    if (preparation) {
      const contract = validateHistoryRegressionContract(preparation.contract);
      const readiness = preparation.readiness;
      if (entry || !member.contractPath || !member.preparationPath || !member.readinessPath
        || readiness.benchmarkId !== member.benchmarkId || readiness.status !== "EVALUATION_READY" || readiness.verdict !== "not-evaluated"
        || readiness.reviewStatus !== "pending" || readiness.heldOutTargetsRead !== false
        || readiness.contractHash !== contentHash("regression-contract", contract)
        || readiness.datasetHash !== contract.bindings.datasetHash || readiness.trainingTargetsHash !== contract.bindings.trainingTargetsHash
        || member.caseId !== contract.caseId || member.claimClass !== contract.claimClass || member.designClass !== contract.designClass
        || member.historyMode !== contract.historyMode || member.effect !== contract.effect) throw new Error("Preparation contract/readiness mismatch.");
    }
    return { ...member, contract: entry?.contract ?? preparation?.contract ?? null, readiness: preparation?.readiness ?? null, result: entry?.result ?? null, verdict: entry?.result.verdict ?? "not-evaluated" };
  });
  if ([...byId.keys()].some((id) => !seen.has(id))) throw new Error("Unregistered result.");
  if ([...prepared.keys()].some((id) => !seen.has(id))) throw new Error("Unregistered preparation.");
  return rows;
}

export function filterBenchmarkRows(rows, filters) {
  return rows.filter((row) => Object.entries(filters).every(([field, value]) => !value || row[field] === value));
}

export function formatScore(score) {
  return score === null || score.value === null ? "Not available" : `${score.errors} / ${score.pairs} pairs (${score.value.toFixed(3)})`;
}
