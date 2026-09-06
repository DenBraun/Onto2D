import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export const input = Object.freeze({ regimeId: "typed-relations-v1" });
export function packFor(graph) {
  const labels = graph.labels ?? Array.from({ length: graph.nodes }, (_, i) => `n${i}`);
  return buildModelPack({ model: { id: `typed-${graph.id}`, name: "Declared typed structure control", version: "1" },
    source: { id: "declared-control", files: [] }, dictionaries: graph.dictionaries ?? { DeclaredCodes: [0, 1, 2] },
    nodes: labels.map((id) => ({ ...graph.nodeAttributes, id })),
    edges: graph.edges.map((e, i) => ({ ...graph.edgeAttributes, ...e.types, id: `e${i}`,
      source: labels[e.from], target: labels[e.to], relationLayer: "source-parent" })) });
}
export async function fixtures() {
  const { controls, causalScope } = await readJson("controls.json");
  const causal = await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json");
  return [...controls.map((graph) => ({ id: graph.id, pack: packFor(graph), input: graph.scope
    ? { ...input, scope: { kind: "induced", nodeIds: graph.scope } } : input })),
  { id: "causal-fragment", pack: causal, input: { ...input, scope: { kind: "induced", nodeIds: causalScope } } }];
}
export async function mappingFixtures() {
  const examples = new Map((await fixtures()).map((f) => [f.id, f]));
  const evidenceHash = `sha256:${createHash("sha256").update(await readFile(new URL("PROTOCOL.md", directory))).digest("hex")}`;
  return (await readJson("controls.json")).mappings.map((m) => ({ id: m.id, left: examples.get(m.left), right: examples.get(m.right),
    declaration: { id: `declared-${m.id}`, version: "1", fields: m.fields,
      reviewEvidence: { reference: "cases/structural-geometry/typed/PROTOCOL.md", contentHash: evidenceHash } } }));
}
