import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { createOllivierAnalyzer, verifyOllivierArtifact } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;
export async function run({ verify = false, report = false } = {}) {
  const analyzer = createOllivierAnalyzer(createPythonOllivierAdapter(), { maxCacheEntries: 0 });
  const expected = verify || report ? await readJson("networkx-expected.json") : null;
  const runs = [];
  let edgeCount = 0;
  for (const fixture of await fixtures()) {
    const artifact = await analyzer.analyze(fixture.pack, fixture.input);
    const filename = `artifacts/${fixture.id}.json`;
    if (verify || report) {
      if (await readFile(new URL(filename, directory), "utf8") !== encoded(artifact)) throw new Error(`Ollivier replay differs: ${fixture.id}`);
      verifyOllivierArtifact(artifact, fixture.pack, fixture.input);
      const independent = expected.cases.find((entry) => entry.id === fixture.id);
      const actual = { id: fixture.id, requestHash: artifact.request.requestHash,
        edges: artifact.result.edges.map(({ id, wasserstein, curvature }) => ({ id, wasserstein, curvature })) };
      if (canonicalize(independent) !== canonicalize(actual)) throw new Error(`Independent NetworkX result differs: ${fixture.id}`);
    } else await writeFile(new URL(filename, directory), encoded(artifact));
    edgeCount += artifact.result.edges.length;
    runs.push({ id: fixture.id, file: filename, requestHash: artifact.request.requestHash, artifactHash: artifact.artifactHash,
      nodeCount: artifact.request.graph.nodes.length, scopedEdgeCount: artifact.request.graph.edges.length,
      boundaryEdgeCount: artifact.request.scope.boundaryEdgeCount, summary: artifact.result.summary });
  }
  if (expected && expected.cases.length !== runs.length) throw new Error("Independent reference case coverage differs.");
  const body = { schemaVersion: "1", suiteId: "structural-ollivier-reference-v1", status: "computational-agreement-only", edgeCount, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-ollivier-suite:v1", body) };
  const target = new URL("suite.json", directory);
  if (verify || report) {
    if (await readFile(target, "utf8") !== encoded(suite)) throw new Error("Ollivier suite index differs.");
  } else await writeFile(target, encoded(suite));
  if (report) {
    console.table(runs.filter((r) => /degree-control|causal-emergence|unequal-mass/.test(r.id)).map((r) => ({
      case: r.id, nodes: r.nodeCount, scopedEdges: r.scopedEdgeCount, analyzedEdges: r.summary.count,
      boundaryEdges: r.boundaryEdgeCount, negative: r.summary.signs.negative, zero: r.summary.signs.zero, positive: r.summary.signs.positive
    })));
  }
  console.log(`Ollivier suite ${verify || report ? "verified" : "written"}: ${runs.length} runs, ${edgeCount} exact edge calculations.`);
  return suite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !["--verify", "--report"].includes(arg))) {
    console.error("Usage: node cases/structural-geometry/ollivier/build.mjs [--verify | --report]"); process.exitCode = 1;
  } else run({ verify: args.includes("--verify"), report: args.includes("--report") }).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
