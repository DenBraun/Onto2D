import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build as bundle } from "esbuild";
import { verifyReport as verifyScope } from "../../cases/structural-geometry/robustness/scope/build.mjs";
import { verifyReport as verifyNulls } from "../../cases/structural-geometry/robustness/build.mjs";
import { fixtures as geometricFixtures } from "../../cases/structural-geometry/geometric-signatures/fixtures.mjs";
import { fixtures as comparisonFixtures } from "../../cases/structural-geometry/comparison/fixtures.mjs";
import { verifyReferenceSources, referenceSummary, measurementSummary } from "../../cases/structural-geometry/geometric-signatures/build.mjs";
import { verifyReferenceSources as verifyComparisonSources, referenceSummary as comparisonSummary } from "../../cases/structural-geometry/comparison/build.mjs";
import { verifyReferences as verifySyntheticSources, sourceHashes as syntheticSourceHashes, REFERENCE_FILES } from "../../cases/structural-geometry/added-value/build.mjs";
import { seal, LIMITS } from "../../cases/structural-geometry/added-value/analysis.mjs";
import { replayControls, analyzeScene } from "./analysis.js";
import { verifyEvidence, REGIMES, SCENES } from "./model.js";
const root = new URL("../../", import.meta.url), here = new URL("./", import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const base = "cases/structural-geometry/";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = value => JSON.stringify(value).replace(/[^\x00-\x7f]/g,
  c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
export function compactScore(s) {
  return { featureCount: s.featureCount, meanRankSkill: s.meanRankSkill, groups: s.groups.map(g => ({ id: g.id, lambda: g.lambda, meanRankSkill: g.meanRankSkill,
    interventions: g.interventions.map(({ id, count, rankSkill }) => ({ id, count, rankSkill })) })) };
}
export async function generate() {
  const scope = await verifyScope(), nulls = await verifyNulls();
  const dream = await read(base + "dream4/results.json"), worm = await read(base + "celegans/results.json");
  const capacity = await read(base + "robustness/capacity/results.json"), metric = await read(base + "robustness/metric/results.json"), anatomy = await read(base + "robustness/anatomy/results.json");
  const synthetic = await read(base + "added-value/suite.json"), sourceAudit = await read(base + "robustness/scope/source-audit.json");
  const syntheticReference = await read(base + "added-value/reference.json");
  await verifySyntheticSources(syntheticReference, await read(base + "added-value/measurements.json"));
  assert.deepEqual(synthetic.sourceHashes, await syntheticSourceHashes([...REFERENCE_FILES, "reference.json", "generate.mjs", "baselines.mjs", "analysis.mjs", "build.mjs"]));
  assert.deepEqual(synthetic.summary, syntheticReference.summary);
  const { artifactHash: _syntheticHash, ...syntheticBody } = synthetic;
  assert.deepEqual(seal("suite", syntheticBody, LIMITS.suiteBytes), synthetic);
  const paths = ["dream4/results.json", "celegans/results.json", "robustness/results.json", "robustness/anatomy/results.json", "robustness/capacity/results.json", "robustness/metric/results.json", "robustness/scope/results.json", "added-value/suite.json"];
  const sources = [];
  for (const path of paths) {
    const bytes = await readFile(new URL(base + path, root)), r = JSON.parse(bytes);
    sources.push({ path: base + path, bytes: bytes.length, sha256: digest(bytes), reportHash: r.reportSha256 ?? r.artifactHash,
      costs: path === "added-value/suite.json" ? null : base + path.replace("results.json", "costs.json") });
  }
  const evidence = verifyEvidence({ format: "onto2d-geometry-site-v1", sources,
    studies: capacity.studies.map((s, index) => ({ id: s.id, status: s.report.status, models: Object.fromEntries(Object.entries(s.report.ablations).map(([id, m]) => [id, compactScore(m)])), primary: s.report.primary, ablations: Object.fromEntries(Object.entries((index < 2 ? dream.results[index] : worm.study).ablations).map(([id, m]) => [id, compactScore(m)])) })),
    metric: metric.variants.map(v => ({ id: v.id, studies: v.studies.map(s => ({ id: s.id, status: s.report.status, models: Object.fromEntries(Object.entries(s.report.models).map(([id, m]) => [id, compactScore(m.summary)])) })) })),
    scope: scope.variants.map(v => ({ variant: v.variant, status: v.status, reason: v.reason, population: (() => {const p = sourceAudit.populations.find(p => p.variant === v.variant); return { rows: p.rows.length, groups: p.groups.filter(g => g.eligible).length };})(),
      contexts: v.contexts?.map(c => ({ id: c.id, models: Object.fromEntries(Object.entries(c.models).map(([id, m]) => [id, compactScore(m.summary)])) })) ?? null })),
    coverage: scope.coverage,
    lowDegree: sourceAudit.units.map(u => ({ id: u.id, nodes: u.nodes.filter(n => n.lowDegree) })),
    nulls: nulls.summary.studies,
    anatomy: { population: anatomy.population.coverage, overlap: anatomy.overlap, comparison: anatomy.comparison },
    synthetic: synthetic.summary.primary
  });
  const gf = await geometricFixtures(), cf = await comparisonFixtures();
  const reference = await read(base + "geometric-signatures/reference.json"), measurements = await read(base + "geometric-signatures/measurements.json");
  await verifyReferenceSources(reference, measurements);
  const comparisonReference = await read(base + "comparison/reference.json");
  await verifyComparisonSources(comparisonReference);
  const examples = [];
  for (const id of ["path", "diamond-dag", "partial-ollivier"]) {
    const f = gf.find(x => x.id === id), artifact = await read(base + `geometric-signatures/artifacts/${id}.json`);
    assert.deepEqual(referenceSummary(id, artifact), reference.cases.find(x => x.id === id));
    assert.deepEqual(measurementSummary(id, artifact), measurements.cases.find(x => x.id === id));
    examples.push({ id, pack: f.pack, input: f.input, artifact });
  }
  const controls = [];
  for (const f of cf.filter(f => ["relabel", "joint-fields", "missing-evidence"].includes(f.pairId))) {
    const artifact = await read(base + `comparison/artifacts/${f.id}.json`);
    assert.deepEqual(comparisonSummary(f.id, artifact), comparisonReference.cases.find(c => c.id === f.id));
    controls.push({ ...f, artifact });
  }
  const payload = { format: "onto2d-geometry-lab-controls-v1", examples, controls };
  assert.equal(replayControls(payload).length, 9);
  for (const scene of SCENES) for (const regime of REGIMES) analyzeScene(payload, scene.id, regime.id);
  return { evidence, payload };
}
export async function run({ write = false } = {}) {
  const { evidence, payload } = await generate();
  const worker = await bundle({ absWorkingDir: fileURLToPath(root), entryPoints: [fileURLToPath(new URL("analysis-worker.js", here))], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022", legalComments: "none", minify: false,
    banner: { js: "// Generated by npm run structural-geometry:site:build. Do not edit." } });
  const files = { "evidence.json": encode(evidence), "controls.json": encode(payload), "worker.js": worker.outputFiles[0].text };
  const pins = Object.fromEntries(Object.entries(files).map(([path, text]) => [path, { bytes: Buffer.byteLength(text), sha256: digest(text) }]));
  files["release.js"] = `// Generated from verified research artifacts and the worker source.\nexport const RELEASE = ${JSON.stringify(pins, null, 2)};\n`;
  for (const [path, text] of Object.entries(files)) {
    if (write) await writeFile(new URL(path, here), text);
    else assert.equal(await readFile(new URL(path, here), "utf8"), text, `${path} differs; run structural-geometry:site:build`);
  }
  console.log(`Structural Geometry site ${write ? "built" : "verified"}: 3 studies, 5 metric variants, 4 scope outcomes, 9 controls, 6 scene/regime replays.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) throw new Error("Expected --write or --check");
  await run({ write: args[0] === "--write" });
}
