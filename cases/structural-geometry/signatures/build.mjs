import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { runStructuralResponseSignature } from "@onto2d/structural-geometry/signature";
import { signatureHash, SIGNATURE_CODEC, summarizeSignature } from "../../../packages/structural-geometry/src/signature-core.js";
import { referenceSummary as responseSummary } from "../responses/build.mjs";
import { packFor } from "../typed/fixtures.mjs";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const files = ["controls.json", "PROTOCOL.md", "../responses/reference.py", "../responses/build.mjs",
  ...["controls.json", "PROTOCOL.md", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py",
    "../invariance/build.mjs", "../../../models/causal-emergence/releases/2026.08.15/bundle.json"].map(f => `../responses/${f}`)];
const digest = value => createHash("sha256").update(canonicalize(value, SIGNATURE_CODEC)).digest("hex");
const encoded = value => JSON.stringify(canonicalClone(value, SIGNATURE_CODEC), null, 2) + "\n";
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...files].sort());
  for (const file of files) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"), reference.sourceHashes[file], file);
}
export function referenceSummary(id, artifact) {
  return { id, responses: responseSummary(id, artifact.evidence.responses),
    signature: { features: artifact.features.map(f => Object.fromEntries(["id", "probeId", "state", "value", "coverage", "reasons"].map(k => [k, f[k]]))),
      summary: artifact.summary, value: artifact.value } };
}
export function verifyAggregation(reference) {
  const rows = [];
  for (let n = 0; n <= 4; n += 1) {
    const results = Array.from({ length: 5 ** n }, (_, code) => {
      const features = Array.from({ length: n }, (_, i) => ({ state: Math.floor(code / 5 ** (n - 1 - i)) % 5 === 0 ? "observed" : "indeterminate" }));
      return ["passed", "failed", "indeterminate"].map(status => summarizeSignature(features, status));
    }).flat();
    rows.push({ features: n, profiles: results.length, sha256: digest(results) });
  }
  assert.deepEqual(rows, reference.aggregationProfiles);
}
export async function verifyCensus(reference) {
  const controls = await readJson("../responses/controls.json"), types = controls.types[controls.censusType];
  const digests = []; let complete = 0, observedFeatures = 0;
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? [] : [[u, v]])).flat(2);
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const pack = packFor({ id: `signature-census-${n}-${mask}`, nodes: n, edges: pairs.filter((_, i) => mask & (1 << i)).map(([from, to]) => ({ from, to, types })) });
      for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
        const id = `n${n}-mask${mask}-${regimeId}`, a = runStructuralResponseSignature(pack, { regimeId });
        digests.push({ id, sha256: digest(referenceSummary(id, a)) });
        complete += Number(a.summary.status === "complete"); observedFeatures += a.summary.coverage.numerator;
      }
    }
  }
  assert.deepEqual({ requests: digests.length, complete, observedFeatures, digests }, reference.census);
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  const outputs = [], artifacts = new Map(), runs = [];
  for (const [i, f] of examples.entries()) {
    const artifact = runStructuralResponseSignature(f.pack, f.input);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], f.id);
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]); artifacts.set(f.id, artifact);
    runs.push({ id: f.id, file, regimeId: f.input.regimeId, summary: artifact.summary, valueHash: artifact.valueHash, artifactHash: artifact.artifactHash });
  }
  for (const c of reference.contrasts) {
    const [left, right] = [artifacts.get(c.left), artifacts.get(c.right)];
    assert.ok(left.value && right.value); assert.equal(digest(left.value) === digest(right.value) ? "equal" : "different", c.outcome);
  }
  verifyAggregation(reference); await verifyCensus(reference);
  const body = { schemaVersion: "1", suiteId: "structural-response-signature-v0", status: "bounded-computational-agreement",
    referenceHash: signatureHash("reference", reference), census: Object.fromEntries(["requests", "complete", "observedFeatures"].map(k => [k, reference.census[k]])),
    aggregationProfiles: 2343, contrasts: reference.contrasts, runs };
  const suite = { ...body, artifactHash: signatureHash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, file);
  }
  if (report) {
    console.table(runs.map(r => ({ case: r.id, status: r.summary.status, observedFeatures: r.summary.coverage.numerator,
      requiredFeatures: r.summary.coverage.denominator, invariance: r.summary.invarianceStatus })));
    console.table(reference.contrasts);
  }
  console.log(`Signature suite ${write ? "written" : "verified"}: ${runs.length} controls, 9 contrasts, 207 independent requests and 2343 adjudications.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/signatures/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(e => { console.error(e); process.exitCode = 1; });
}
