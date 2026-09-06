import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { createStructuralFlowAnalyzer, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const codec = { limits: { maxEntries: 500000 } };
const encoded = (value) => `${JSON.stringify(canonicalClone(value, codec), null, 2)}\n`;
export const referenceValues = (id, artifact) => ({ id, requestHash: artifact.request.requestHash,
  states: artifact.states.map(({ iteration, edges }) => ({ iteration, edges })), termination: artifact.termination, cuts: artifact.cuts });
export async function run({ verify = false, report = false } = {}) {
  const check = verify || report;
  const analyzer = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  const expected = check ? await readJson("networkx-expected.json") : null;
  const runs = []; let stateCount = 0; let edgeCalculations = 0;
  if (!check) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const fixture of await fixtures()) {
    const artifact = await analyzer.analyze(fixture.pack, fixture.input);
    const filename = `artifacts/${fixture.id}.json`;
    if (check) {
      if (await readFile(new URL(filename, directory), "utf8") !== encoded(artifact)) throw new Error(`Flow replay differs: ${fixture.id}`);
      verifyStructuralFlowArtifact(artifact, fixture.pack, fixture.input);
      if (canonicalize(expected.cases.find((c) => c.id === fixture.id), codec) !== canonicalize(referenceValues(fixture.id, artifact), codec)) {
        throw new Error(`Independent NetworkX flow differs: ${fixture.id}`);
      }
    } else await writeFile(new URL(filename, directory), encoded(artifact));
    stateCount += artifact.states.length; edgeCalculations += artifact.states.length * artifact.request.graph.edges.length;
    runs.push({ id: fixture.id, file: filename, requestHash: artifact.request.requestHash, artifactHash: artifact.artifactHash,
      nodeCount: artifact.request.graph.nodes.length, edgeCount: artifact.request.graph.edges.length,
      boundaryEdgeCount: artifact.request.scope.boundaryEdgeCount, stateCount: artifact.states.length,
      termination: artifact.termination, finalSummary: artifact.states.at(-1).summary,
      removedEdgeIds: artifact.cuts.removedEdgeIds, weakComponents: artifact.cuts.weakComponents });
  }
  if (expected && expected.cases.length !== runs.length) throw new Error("Independent flow coverage differs.");
  const body = { schemaVersion: "1", suiteId: "structural-shadow-flow-reference-v1", status: "computational-agreement-only",
    stateCount, edgeCalculations, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-flow-suite:v1", body) };
  if (check) {
    if (await readFile(new URL("suite.json", directory), "utf8") !== encoded(suite)) throw new Error("Flow suite index differs.");
  } else await writeFile(new URL("suite.json", directory), encoded(suite));
  if (report) console.table(runs.map((r) => ({ case: r.id, nodes: r.nodeCount, edges: r.edgeCount,
    boundaryEdges: r.boundaryEdgeCount, steps: r.termination.iteration, stop: r.termination.reason,
    cutEdges: r.removedEdgeIds.length, weakComponents: r.weakComponents.length })));
  console.log(`Flow suite ${check ? "verified" : "written"}: ${runs.length} runs, ${stateCount} states, ${edgeCalculations} exact edge calculations.`);
  return suite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !["--verify", "--report"].includes(arg))) {
    console.error("Usage: node cases/structural-geometry/flow/build.mjs [--verify | --report]"); process.exitCode = 1;
  } else run({ verify: args.includes("--verify"), report: args.includes("--report") }).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
