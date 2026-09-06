import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export const input = Object.freeze({ regimeId: "canonical-structure-v1" });
export function packFor(graph) {
  const labels = graph.labels ?? Array.from({ length: graph.nodes }, (_, i) => `n${i}`);
  return buildModelPack({ model: { id: `canonical-${graph.id}`, name: "Declared canonical structure control", version: "1" },
    source: { id: "declared-control", files: [] }, dictionaries: graph.dictionaries ?? {},
    nodes: labels.map((id) => ({ ...graph.nodeAttributes, id })),
    edges: graph.edges.map(([from, to], i) => ({ ...graph.edgeAttributes, id: `e${i}`,
      source: labels[from], target: labels[to], relationLayer: "source-parent" })) });
}
export async function fixtures() {
  const { controls } = await readJson("controls.json");
  const causal = await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json");
  return [...controls.map((graph) => ({ id: graph.id, pack: packFor(graph), input })),
    { id: "causal-fragment", pack: causal, input: { ...input,
      scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5"] } } }];
}
