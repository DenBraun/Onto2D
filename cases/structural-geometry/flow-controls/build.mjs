import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { createStructuralFlowAnalyzer, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { referenceValues } from "../flow/build.mjs";
import { directory, fixtures, PROTOCOL_SHA256, readJson } from "./fixtures.mjs";

const codec = { limits: { maxEntries: 500000 } };
const encoded = (value) => `${JSON.stringify(canonicalClone(value, codec), null, 2)}\n`;

export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose either write or verified report.");
  const analyzer = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  const expected = write ? null : await readJson("networkx-expected.json");
  const inputs = await fixtures();
  if (expected && (expected.protocolSha256 !== PROTOCOL_SHA256
    || canonicalize(expected.cases.map((c) => c.id)) !== canonicalize(inputs.map((f) => f.id)))) {
    throw new Error("Supplemental independent reference identity or coverage differs.");
  }
  const runs = []; const files = [];
  let stateCount = 0; let edgeCalculations = 0;
  for (const [index, fixture] of inputs.entries()) {
    const artifact = await analyzer.analyze(fixture.pack, fixture.input);
    verifyStructuralFlowArtifact(artifact, fixture.pack, fixture.input);
    const file = `artifacts/${fixture.id}.json`;
    if (!write) {
      if (await readFile(new URL(file, directory), "utf8") !== encoded(artifact)) throw new Error(`Supplemental replay differs: ${fixture.id}`);
      if (canonicalize(expected.cases[index], codec) !== canonicalize(referenceValues(fixture.id, artifact), codec)) {
        throw new Error(`Independent supplemental flow differs: ${fixture.id}`);
      }
    }
    files.push([file, encoded(artifact)]);
    stateCount += artifact.states.length; edgeCalculations += artifact.states.length * fixture.graph.edges.length;
    runs.push({ id: fixture.id, file, expectationId: fixture.expectationId,
      requestHash: artifact.request.requestHash, artifactHash: artifact.artifactHash,
      nodeCount: artifact.request.graph.nodes.length, edgeCount: artifact.request.graph.edges.length,
      stateCount: artifact.states.length, termination: artifact.termination, finalSummary: artifact.states.at(-1).summary,
      removedEdgeIds: artifact.cuts.removedEdgeIds, weakComponents: artifact.cuts.weakComponents });
  }
  const body = { schemaVersion: "1", suiteId: "structural-flow-controls-v1", protocolSha256: PROTOCOL_SHA256,
    status: "computational-agreement-only", stateCount, edgeCalculations, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-flow-controls-suite:v1", body) };
  if (write) {
    await mkdir(new URL("artifacts/", directory), { recursive: true });
    for (const [file, bytes] of [...files, ["suite.json", encoded(suite)]]) await writeFile(new URL(file, directory), bytes);
  } else if (await readFile(new URL("suite.json", directory), "utf8") !== encoded(suite)) {
    throw new Error("Supplemental flow suite index differs.");
  }
  if (report) console.table(runs.map((r) => ({ case: r.id, nodes: r.nodeCount, arcs: r.edgeCount,
    steps: r.termination.iteration, stop: r.termination.reason, cutArcs: r.removedEdgeIds.length, groups: r.weakComponents.length })));
  console.log(`Supplemental flow suite ${write ? "written" : "verified"}: ${runs.length} runs, ${stateCount} states, ${edgeCalculations} exact edge calculations.`);
  return suite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/flow-controls/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
