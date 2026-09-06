import { readFile } from "node:fs/promises";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export const controls = (await readJson("controls.json")).cases;
export function packFor(graph) {
  return buildModelPack({ model: { id: `ollivier-${graph.id}`, version: "1", name: "Ollivier synthetic control", status: "synthetic" },
    source: { id: "declared-synthetic-graph", files: [] }, nodes: graph.nodes,
    edges: graph.edges.map((edge) => ({ relationLayer: "source-parent", ...edge })), dictionaries: {} });
}

export async function fixtures() {
  const values = controls.map((graph) => ({ id: graph.id, pack: packFor(graph),
    input: { edgeIds: graph.edgeIds ?? graph.edges.map((e) => e.id) } }));
  const source = await readJson("fragments.json");
  const pack = await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json");
  const binding = { modelId: pack.manifest.model.id, modelVersion: pack.manifest.model.version,
    modelRootHash: pack.manifest.rootHash, manifestHash: pack.manifest.manifestHash };
  if (canonicalize(source.source) !== canonicalize(binding)) throw new Error("Ollivier source lock differs from the frozen Model Pack.");
  for (const fragment of source.fragments) {
    const included = new Set(fragment.nodeIds);
    values.push({ id: fragment.id, pack, input: { scope: { kind: "induced", nodeIds: fragment.nodeIds },
      edgeIds: pack.files["model/edges.json"].filter((e) => included.has(e.source) && included.has(e.target)).map((e) => e.id) } });
  }
  return values.flatMap((entry) => ["zero", "half"].map((idleness) => ({ ...entry,
    id: `${entry.id}-${idleness}`, input: { ...entry.input, idleness } })));
}
