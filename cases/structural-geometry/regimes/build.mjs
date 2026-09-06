import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { DISTINGUISHABILITY_REGIMES, prepareStructuralRegime, verifyStructuralRegimePreparation } from "@onto2d/structural-geometry/regimes";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const outputs = [], runs = [];
  const sourceLock = await readJson("../causal-emergence/source-lock.json");
  for (const f of await fixtures()) {
    const artifact = prepareStructuralRegime(f.pack, f.input);
    verifyStructuralRegimePreparation(artifact, f.pack, f.input);
    if (f.id.endsWith("causal-fragment") && canonicalize(artifact.context.model) !== canonicalize(sourceLock)) throw new Error("Regime source lock differs.");
    const file = `artifacts/${f.id}.json`;
    outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, file, input: f.input, artifactHash: artifact.artifactHash,
      scopedNodes: artifact.scope.nodeIds.length, scopedEdges: artifact.scope.edgeIds.length, evaluation: artifact.evaluation });
  }
  const body = { schemaVersion: "1", suiteId: "structural-regime-contracts-v1", status: "contract-preparations-only",
    regimes: DISTINGUISHABILITY_REGIMES.map(({ id, version, contentHash }) => ({ id, version, contentHash })), runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-regime-suite:v1", body) };
  outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else if (await readFile(new URL(file, directory), "utf8") !== bytes) throw new Error(`Regime contract replay differs: ${file}`);
  }
  if (report) console.table(runs.map(({ id, scopedNodes, scopedEdges, evaluation }) => ({ id, scopedNodes, scopedEdges, evaluation })));
  console.log(`Regime contracts ${write ? "written" : "verified"}: 3 descriptors, 9 observable specs, 6 source-bound preparations; observations and comparisons not run.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/regimes/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
