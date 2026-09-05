import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { contentHash } from "../../../packages/history-benchmark/src/index.js";
import { prepareHistoryRegression } from "../../../packages/history-benchmark/src/predictive.js";
import { canonicalClone, canonicalize } from "../../../packages/kernel/src/canonical-entry.js";
import { closed, integer, nonempty, requireValue } from "../../../packages/history-benchmark/src/contract.js";
import { buildFd001TrainingTargets, parseFd001Observations, projectFd001Observations } from "./source-projection.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = "cases/operational-aging/history-benchmark";
const read = (file) => readFile(path.join(root, file));
const json = async (file) => JSON.parse(await read(file));
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const lockFile = async (file) => ({ path: file, sha256: sha(await read(file)) });
export const regressionImplementationFiles = ["predictive.js", "contract.js"].map((file) => `packages/history-benchmark/src/${file}`);

export function validateFd001Protocol(protocol) {
  protocol = canonicalClone(protocol);
  closed(protocol, ["schemaVersion", "benchmarkId", "dataset", "expectedTrainingUnits", "expectedTestUnits", "expectedTrainingRows", "expectedTestRows", "selection", "evaluator", "primary", "secondary", "nullModel", "review"], "FD001 protocol");
  if (protocol.schemaVersion !== "1" || protocol.dataset !== "FD001") throw new Error("Unsupported FD001 protocol.");
  nonempty(protocol.benchmarkId, "benchmarkId");
  for (const field of ["expectedTrainingUnits", "expectedTestUnits", "expectedTrainingRows", "expectedTestRows"]) integer(protocol[field], 1, 1000000, field);
  closed(protocol.selection, ["trainingFirstCutoff", "trainingCutoffStep", "trainingTerminalPolicy", "testPolicy", "historyWindow", "historyPolicy", "shortHistoryPolicy", "features", "missingDataPolicy"], "selection");
  closed(protocol.evaluator, ["id", "neighbors", "tieBreak", "distance", "trainingUnitPolicy", "prediction"], "evaluator");
  closed(protocol.primary, ["baseline", "history", "metric", "resolutionCycles", "positiveRule"], "primary");
  closed(protocol.secondary, ["metric", "ageSensitivity", "uncertainty"], "secondary");
  closed(protocol.nullModel, ["id", "seed", "trials", "stratum", "justification"], "nullModel");
  closed(protocol.review, ["status", "requiredBeforeCaseScoring", "priorOutcomeExposure"], "review");
  integer(protocol.selection.trainingFirstCutoff, 2, 1e9, "trainingFirstCutoff");
  integer(protocol.selection.trainingCutoffStep, 1, 1e9, "trainingCutoffStep");
  integer(protocol.selection.historyWindow, 1, 1e9, "historyWindow");
  integer(protocol.evaluator.neighbors, 1, 64, "neighbors");
  integer(protocol.nullModel.seed, 0, 4294967295, "seed");
  integer(protocol.nullModel.trials, 1, 256, "trials");
  requireValue(Number.isFinite(protocol.primary.resolutionCycles) && protocol.primary.resolutionCycles >= 0 && protocol.primary.resolutionCycles <= 1e12, "SHAPE", "Invalid resolutionCycles.");
  nonempty(protocol.nullModel.justification, "null justification"); nonempty(protocol.review.priorOutcomeExposure, "prior outcome exposure");
  // Transport policy changes must not be silently ignored by the case compiler.
  const policy = protocol.selection;
  for (const [field, expected] of Object.entries({ trainingTerminalPolicy: "exclude-terminal-observation", testPolicy: "all-unit-final-observations", historyPolicy: "mean-prior-frames-excluding-current", shortHistoryPolicy: "all-available-prior-frames", features: "all-three-settings-and-21-sensors", missingDataPolicy: "reject-incomplete-input" })) {
    if (policy[field] !== expected) throw new Error(`Unsupported selection policy: ${field}`);
  }
  if (protocol.evaluator.distance !== "sum-squared-training-range-scaled-features" || protocol.evaluator.trainingUnitPolicy !== "one-nearest-prefix-per-unit" || protocol.evaluator.prediction !== "unweighted-mean-without-rul-capping") throw new Error("Unsupported FD001 distance or prediction policy.");
  if (protocol.evaluator.id !== "unit-nearest-neighbor-regression-v1" || protocol.evaluator.tieBreak !== "sample-id"
    || protocol.primary.metric !== "mae" || protocol.secondary.metric !== "rmse"
    || protocol.nullModel.id !== "test-history-permutation-v1" || protocol.nullModel.stratum !== "one-declared-population") throw new Error("Unsupported FD001 evaluator, metric or null policy.");
  if (protocol.primary.baseline !== "P0" || protocol.primary.history !== "P1" || protocol.primary.positiveRule !== "gain-and-true-history-advantage-over-null-mean-exceed-resolution"
    || canonicalize(protocol.secondary.ageSensitivity) !== '["P0Age","P1Age"]' || protocol.secondary.uncertainty !== "no-confidence-interval-or-significance-claim"
    || protocol.review.status !== "pending" || protocol.review.requiredBeforeCaseScoring !== true) throw new Error("Unsupported metric, sensitivity or review policy.");
  return protocol;
}

export async function buildFd001Preparation({ protocol: protocolInput } = {}) {
  const upstream = await json("cases/operational-aging/upstream.json");
  const protocol = validateFd001Protocol(protocolInput === undefined ? await json(`${directory}/protocol.json`) : protocolInput);
  const sourceLocks = []; const groups = {};
  for (const split of ["train", "test"]) {
    const name = `${split}_FD001.txt`; const relative = `${directory}/source/${name}.gz`;
    const compressed = await read(relative); const bytes = gunzipSync(compressed, { maxOutputLength: 5 * 1024 * 1024 });
    const expected = upstream.consumedMembers.find((member) => member.name === name);
    if (bytes.length !== expected.bytes || sha(bytes) !== `sha256:${expected.sha256}`) throw new Error(`FD001 source drift: ${name}`);
    groups[split] = parseFd001Observations(bytes, split);
    sourceLocks.push({ path: relative, compressedSha256: sha(compressed), member: name, sha256: sha(bytes), bytes: bytes.length });
  }
  const counts = {
    trainingUnits: groups.train.size, testUnits: groups.test.size,
    trainingRows: [...groups.train.values()].reduce((n, rows) => n + rows.length, 0),
    testRows: [...groups.test.values()].reduce((n, rows) => n + rows.length, 0)
  };
  for (const [field, value] of Object.entries(counts)) {
    const key = `expected${field[0].toUpperCase()}${field.slice(1)}`;
    if (protocol[key] !== value) throw new Error(`FD001 source census differs: ${field}`);
  }
  const dataset = projectFd001Observations(groups.train, groups.test, protocol);
  const trainingTargets = buildFd001TrainingTargets(groups.train, dataset);
  const source = { schemaVersion: "1", archive: upstream.archive, observations: sourceLocks,
    heldOutTargets: { member: "RUL_FD001.txt", sha256: `sha256:${upstream.consumedMembers.find((member) => member.name === "RUL_FD001.txt").sha256}`, extracted: false },
    compiler: await Promise.all([`${directory}/build.mjs`, `${directory}/source-projection.mjs`, `${directory}/capture-source.py`, "cases/operational-aging/upstream.json"].map(lockFile)) };
  const contract = {
    schemaVersion: "1", benchmarkId: protocol.benchmarkId, caseId: "operational-aging", claimClass: "empirical", designClass: "predictive", historyMode: "embodied", effect: "future",
    population: `All ${counts.testUnits} FD001 test endpoints; all ${counts.trainingUnits} training engines sampled from cycle ${protocol.selection.trainingFirstCutoff} every ${protocol.selection.trainingCutoffStep} cycles, excluding terminal observations. No target-based test selection.`,
    presentView: "All three current operating settings and 21 sensors. P0Age separately adds observed cycle age.",
    historyView: `Means of up to ${protocol.selection.historyWindow} preceding frames, excluding the current frame. Recorded observations proxy embodied degradation; latent health is not observed.`,
    targetView: "Supplied FD001 test RUL is reserved for later independent protocol review and scoring. Training RUL is derived separately from each training trajectory's terminal cycle.",
    splitPolicy: "unit-disjoint", preprocessing: "training-min-max-no-clipping",
    evaluator: { id: protocol.evaluator.id, neighbors: protocol.evaluator.neighbors, tieBreak: protocol.evaluator.tieBreak, implementationHash: contentHash("regression-implementation", await Promise.all(regressionImplementationFiles.map(lockFile))) },
    primaryMetric: { id: protocol.primary.metric, resolution: protocol.primary.resolutionCycles, units: "cycles" }, secondaryMetrics: [protocol.secondary.metric],
    nullModel: { id: protocol.nullModel.id, seed: protocol.nullModel.seed, trials: protocol.nullModel.trials, stratum: protocol.nullModel.stratum },
    bindings: { datasetHash: contentHash("regression-dataset", dataset), trainingTargetsHash: contentHash("regression-targets", trainingTargets), heldOutTargetSourceHash: source.heldOutTargets.sha256, builderHash: contentHash("regression-source", source), protocolHash: contentHash("regression-protocol", protocol) },
    interpretationBoundary: "Retrospective FD001 simulated-engine benchmark preparation. Prior source analyses already expose test outcomes; no independent preregistration, physical-engine validation, causal effect or Historical Load is claimed. Held-out performance remains unevaluated pending independent protocol review."
  };
  const preparation = prepareHistoryRegression(contract, dataset, trainingTargets);
  if (preparation.status !== "prepared") throw new Error("Incomplete prediction preparation cannot be evaluation-ready.");
  const readiness = {
    schemaVersion: "1", benchmarkId: contract.benchmarkId, status: "EVALUATION_READY", verdict: "not-evaluated",
    reviewStatus: "pending", contractHash: preparation.contractHash, preparationHash: preparation.hash,
    datasetHash: contract.bindings.datasetHash, trainingTargetsHash: contract.bindings.trainingTargetsHash,
    sourceCounts: counts, counts: preparation.counts,
    features: { present: dataset.presentFeatures.length, history: dataset.historyFeatures.length,
      activePresent: preparation.normalization.present.filter((r) => r.active).length,
      activeHistory: preparation.normalization.history.filter((r) => r.active).length,
      ageActive: preparation.normalization.age[0].active },
    nullTrials: preparation.nulls.trials.length,
    heldOutTargetsRead: false, interpretationBoundary: contract.interpretationBoundary
  };
  const files = new Map(Object.entries({ source, contract, dataset, "training-targets": trainingTargets, preparation, readiness })
    .map(([name, value]) => [`${directory}/${name === "preparation" ? "expected/" : ""}${name}.json`, value]));
  return { files, contract, dataset, trainingTargets, preparation, readiness };
}

export async function run({ verify = false } = {}) {
  const { files, readiness } = await buildFd001Preparation();
  for (const [relative, value] of files) {
    const text = `${JSON.stringify(value, null, 2)}\n`; const file = path.join(root, relative);
    if (verify) { if (await readFile(file, "utf8") !== text) throw new Error(`FD001 preparation drift: ${relative}`); }
    else { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); }
  }
  console.log(`FD001 ${verify ? "verified" : "prepared"}: ${readiness.counts.trainingUnits} training units / ${readiness.counts.trainingSamples} prefixes; ${readiness.counts.testUnits} test endpoints; no held-out scoring.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error); process.exitCode = 1; });
}
