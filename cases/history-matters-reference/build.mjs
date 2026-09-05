import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { canonicalize } from "../../packages/kernel/src/canonical-entry.js";
import {
  buildHistoryBenchmarkSuite, buildHistoryBenchmarkViews, contentHash, normalizeObservations, normalizeTargets, runHistoryBenchmark
} from "../../packages/history-benchmark/src/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const builderPath = "cases/history-matters-reference/build.mjs";
const controlPath = "cases/history-matters-reference/source/controls.json";
export const implementationPaths = ["contract.js", "evaluate.js", "index.js"].map((file) => `packages/history-benchmark/src/${file}`);
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const lock = async (relative) => ({ path: relative, sha256: sha256(await readFile(path.join(root, relative))) });

function unit(unitId, present, values, cutoff = values.length) {
  return { unitId, cutoff, present: { time: cutoff, value: present }, history: values.map((value, time) => ({ time, value })) };
}

// Projection never receives a target table. Semantic reference classes are built separately below.
function projectSoftware(caseId, source) {
  if (caseId === "git-history-identity") {
    const commits = new Map(source.objects.commits.map((commit) => [commit.fixtureId, commit]));
    return source.histories.map((history) => {
      const head = commits.get(history.head);
      const ancestry = history.commits.filter((id) => id !== history.head)
        .map((id) => commits.get(id)).map(({ oid, parentOids }) => ({ oid, parentOids })).sort((a, b) => a.oid < b.oid ? -1 : 1);
      return unit(history.id, head.tree, [canonicalize({ parents: head.parentOids, ancestry })]);
    });
  }
  if (caseId === "oci-layer-history") return source.histories.map((history) => unit(history.id, history.finalRootfs.identity, history.layers.map((layer) => layer.descriptor.digest)));
  return source.histories.map((history) => unit(history.executionId, history.artifact.sha256, [canonicalize({ runtime: history.runtime.name, version: history.runtime.version })]));
}

function semanticTargets(caseId, source) {
  const identities = source.histories.map((history) => caseId === "git-history-identity" ? history.ancestryIdentity
    : caseId === "oci-layer-history" ? history.layerSequenceIdentity
      : `${history.artifact.sha256}/${history.runtime.name}/${history.runtime.version}`);
  const classes = [...new Set(identities)].sort();
  return source.histories.map((history, index) => ({
    unitId: history.id ?? history.executionId,
    time: caseId === "oci-layer-history" ? history.layers.length : 1,
    label: `class-${classes.indexOf(identities[index]) + 1}`
  }));
}

export async function buildPilot() {
  const implementationHash = contentHash("implementation", await Promise.all(implementationPaths.map(lock)));
  const builderHash = (await lock(builderPath)).sha256;
  const controls = await json(controlPath);
  const definitions = controls.controls.map((control) => ({
    benchmarkId: `history-matters-reference-${control.id}-v1`, caseId: "history-matters-reference",
    title: `Synthetic ${control.id} control`, claimClass: "synthetic", effect: "future",
    directory: `cases/history-matters-reference/${control.id}`, sourcePath: controlPath,
    observations: { schemaVersion: "1", units: controls.unitIds.map((id, i) => unit(id, control.present[i], ["origin", control.history[i]], controls.cutoff)) },
    targets: { schemaVersion: "1", records: controls.unitIds.map((id, i) => ({ unitId: id, time: 3, label: control.target[i] })) },
    presentView: "Declared current symbol; unit ID and time excluded from features.",
    historyView: "Ordered origin and path symbols observed before the cutoff.",
    targetView: "Separately authored synthetic future class, at ordinal 3.",
    interpretationBoundary: "Synthetic pipeline control only. Pairwise classification under exact equality; no empirical, predictive, causal, or physical evidence. A negative result means this evaluator over-separates a sufficient present representation.",
    nullRole: control.id === "positive" ? "require-better-than-null-mean" : "diagnostic"
  }));
  const software = [
    ["git-history-identity", "history-identity", "Git ancestry", "Native final tree OID.", "Native parent closure and topology below the head; head metadata excluded.", "Declared exact ancestry classes; metadata-only control shares its ancestry class."],
    ["oci-layer-history", "oci-layer-history", "OCI layer sequence", "Normalized final rootfs identity from the bounded source fixture.", "Ordered native layer descriptor digests.", "Declared exact layer-sequence classes."],
    ["reproducible-build-equivalence", "reproducible-build-equivalence", "Reproducible build toolchain", "Specified output byte identity.", "Recorded Node.js runtime name and version; ambient session label excluded.", "Joint output-content and toolchain classes; same toolchain with changed bytes stays distinct."]
  ];
  for (const [caseId, file, title, presentView, historyView, targetView] of software) {
    const sourcePath = `cases/${caseId}/artifacts/${file}.json`;
    const source = await json(sourcePath);
    definitions.push({
      benchmarkId: `${caseId}-history-matters-v1`, caseId, title, claimClass: "semantic", effect: "identity",
      directory: `cases/${caseId}/history-benchmark`, sourcePath,
      observations: { schemaVersion: "1", units: projectSoftware(caseId, source) },
      targets: { schemaVersion: "1", records: semanticTargets(caseId, source) },
      presentView, historyView, targetView,
      interpretationBoundary: "Exact semantic sensitivity to a declared identity regime in the complete bounded source fixture. Reference classes are derived from that regime, not independent outcomes. The null is diagnostic and may preserve unique partitions. No held-out prediction, causal effect, Historical Load, or independent review is claimed.",
      nullRole: "diagnostic"
    });
  }
  const entries = [];
  const files = new Map();
  const registry = { schemaVersion: "1", suiteId: "history-matters-pilot", entries: [] };
  for (const definition of definitions) {
    const observations = normalizeObservations(definition.observations);
    const targets = normalizeTargets(definition.targets);
    const contract = {
      schemaVersion: "1", benchmarkId: definition.benchmarkId, caseId: definition.caseId,
      claimClass: definition.claimClass, designClass: definition.claimClass === "synthetic" ? "synthetic-control" : "exact",
      historyMode: "recorded", effect: definition.effect,
      population: "Every unit in the declared source fixture, including negative and metadata controls; no pair selection.",
      cutoffPolicy: "per-unit-ordinal", presentView: definition.presentView, historyView: definition.historyView, targetView: definition.targetView,
      selectionPolicy: { strategy: "complete-source-population", targetBlind: true }, splitPolicy: "complete-census",
      evaluator: { id: "identity-partition-v1", version: "1", implementationHash },
      primaryMetric: { id: "pairwise-error", direction: "lower-is-better", resolution: 0 },
      nullModel: { id: "history-permutation-v1", seed: 1729, trials: 16, role: definition.nullRole },
      bindings: { observationsHash: contentHash("observations", observations), targetsHash: contentHash("targets", targets), builderHash },
      sources: [await lock(definition.sourcePath)], interpretationBoundary: definition.interpretationBoundary
    };
    const inputs = { observations, targets };
    const views = buildHistoryBenchmarkViews(contract, observations);
    const result = runHistoryBenchmark(contract, inputs);
    entries.push({ contract, inputs, result });
    for (const [name, value] of Object.entries({ contract, observations, targets, "present-view": views.present, "history-view": views.history, split: views.split, result })) {
      files.set(`${definition.directory}/${name}.json`, value);
    }
    registry.entries.push({
      benchmarkId: contract.benchmarkId, caseId: contract.caseId, title: definition.title, status: "EVALUATED",
      claimClass: contract.claimClass, designClass: contract.designClass, historyMode: contract.historyMode, effect: contract.effect,
      contractPath: `${definition.directory}/contract.json`, resultPath: `${definition.directory}/result.json`,
      planPath: null, reason: "Complete exact pilot run; independent review has not been performed."
    });
  }
  for (const [caseId, title, status, designClass, historyMode, reason] of [
    ["operational-aging", "Operational Aging / C-MAPSS", "ILLUSTRATIVE", "predictive", "embodied", "The existing 25/72 pair was selected using RUL. Full-cohort target-blind views and held-out evaluation are pending."],
    ["ltee-evolutionary-contingency", "LTEE evolutionary contingency", "CONTRACT_DRAFT", "experimental", "recorded", "Keep the three published replay protocols separate. No pooled benchmark effect or recomputed significance is available."]
  ]) registry.entries.push({
    benchmarkId: `${caseId}-history-matters-v1`, caseId, title, status, claimClass: "empirical", designClass, historyMode, effect: "future",
    contractPath: null, resultPath: null, planPath: `cases/${caseId}/history-benchmark-plan.md`, reason
  });
  const agingDirectory = "cases/operational-aging/history-benchmark";
  const preparations = [{ contract: await json(`${agingDirectory}/contract.json`), readiness: await json(`${agingDirectory}/readiness.json`) }];
  const aging = registry.entries.find((member) => member.caseId === "operational-aging");
  Object.assign(aging, {
    status: "EVALUATION_READY", contractPath: `${agingDirectory}/contract.json`,
    preparationPath: `${agingDirectory}/expected/preparation.json`, readinessPath: `${agingDirectory}/readiness.json`,
    reason: `Full-cohort observations, ${preparations[0].readiness.counts.trainingSamples} training prefixes, ${preparations[0].readiness.counts.testSamples} test predictions and ${preparations[0].readiness.nullTrials} null preparations are frozen. Held-out outcomes remain unscored pending independent protocol review.`
  });
  const suite = buildHistoryBenchmarkSuite(entries);
  files.set("cases/history-benchmark-registry.json", registry);
  files.set("cases/history-matters-reference/expected/suite.json", suite);
  const bundle = { schemaVersion: "1", registry, suite, entries, preparations };
  files.set("apps/history-matters-benchmark/pilot.json", bundle);
  return { files, entries, registry, suite };
}

export async function run({ verify = false } = {}) {
  const { files, entries } = await buildPilot();
  for (const [relative, value] of files) {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (verify) {
      if (await readFile(path.join(root, relative), "utf8") !== text) throw new Error(`Benchmark artifact drift: ${relative}`);
    } else {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), text);
    }
  }
  const bundleText = `${JSON.stringify(files.get("apps/history-matters-benchmark/pilot.json"), null, 2)}\n`;
  const pinPath = path.join(root, "apps/history-matters-benchmark/pin.js");
  const pin = `// Generated by the pilot builder; binds the exact browser payload.\nexport const PILOT_SHA256 = "${sha256(bundleText)}";\n`;
  if (verify) {
    if (await readFile(pinPath, "utf8") !== pin) throw new Error("Benchmark browser pin drift.");
  } else await writeFile(pinPath, pin);
  console.log(`History benchmark ${verify ? "verified" : "built"}: ${entries.length} contrasts, including negative and neutral controls.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error); process.exitCode = 1; });
}
