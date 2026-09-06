import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export function controlPack({ dictionaries = {}, modelId = "regime-boundary-control", rename = (id) => id } = {}) {
  return buildModelPack({ model: { id: modelId, name: "Declared regime preparation control", version: "1" },
    source: { id: "declared-control", files: [] }, dictionaries,
    nodes: ["a", "b", "c", "d", "isolated"].map((id) => ({ id: rename(id) })),
    edges: [["a", "b"], ["b", "c"], ["d", "a"], ["c", "d"]].map(([a, b]) => ({
      id: rename(`${a}->${b}`), source: rename(a), target: rename(b), relationLayer: "source-parent",
      dependencyTypeId: 0, interactionModeIds: [0, 1], ontologicalRole: "arising", necessity: "necessary", causalDirectionIds: [0]
    })) });
}
export async function fixtures() {
  const causal = await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json");
  const control = controlPack();
  return ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"].flatMap((regimeId) => [
    { id: `${regimeId}-control`, pack: control, input: { regimeId } },
    { id: `${regimeId}-causal-fragment`, pack: causal, input: { regimeId,
      scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5"] } } }
  ]);
}
