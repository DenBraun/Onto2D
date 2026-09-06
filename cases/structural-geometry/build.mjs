import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import {
  analyzeStructuralGeometry,
  projectStructuralGeometry,
  verifyStructuralGeometryArtifact,
  verifyStructuralProjection
} from "@onto2d/structural-geometry";

const MODEL = new URL("../../models/causal-emergence/releases/2026.08.15/bundle.json", import.meta.url);
const SOURCE_LOCK = new URL("./causal-emergence/source-lock.json", import.meta.url);
const PROJECTION = new URL("./causal-emergence/projection.json", import.meta.url);
const ARTIFACT = new URL("./causal-emergence/artifact.json", import.meta.url);
const json = async (url) => JSON.parse(await readFile(url, "utf8"));
const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;

export async function run({ verify = false, report = false } = {}) {
  if (verify && report) throw new Error("Choose verification or reporting, not both.");
  const pack = await json(MODEL);
  const lock = await json(SOURCE_LOCK);
  const projection = projectStructuralGeometry(pack);
  if (canonicalize(projection.model) !== canonicalize(lock)) {
    throw new Error("Causal Emergence differs from the exact structural-geometry source lock.");
  }
  const artifact = analyzeStructuralGeometry(pack);
  if (verify || report) {
    verifyStructuralProjection(await json(PROJECTION), pack);
    verifyStructuralGeometryArtifact(await json(ARTIFACT), pack);
    for (const [url, value] of [[PROJECTION, projection], [ARTIFACT, artifact]]) {
      if (await readFile(url, "utf8") !== encoded(value)) {
        throw new Error(`Frozen structural geometry bytes differ: ${url.pathname}`);
      }
    }
  } else {
    await writeFile(PROJECTION, encoded(projection));
    await writeFile(ARTIFACT, encoded(artifact));
  }
  if (report) {
    console.log(JSON.stringify({
      status: "descriptive-unit-geometry",
      model: artifact.model,
      nodeCount: artifact.result.nodes.length,
      edgeCount: artifact.result.edges.length,
      summary: artifact.result.summary,
      byNecessity: artifact.result.groups.byNecessity,
      extrema: artifact.result.extrema,
      artifactHash: artifact.artifactHash
    }, null, 2));
  } else {
    console.log(`Causal Emergence structural geometry ${verify ? "verified" : "written"}: ` +
      `${projection.nodes.length} nodes, ${projection.edges.length} edges.`);
  }
  return { pack, projection, artifact };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !["--verify", "--report"].includes(arg))) {
    console.error("Usage: node cases/structural-geometry/build.mjs [--verify | --report]");
    process.exitCode = 1;
  } else {
    run({ verify: args.includes("--verify"), report: args.includes("--report") }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
