import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function examplePack() {
  const graph = (await readJson("../experiments/controls.json")).cases.find((g) => g.id === "typed-diamond");
  return buildModelPack({ model: { id: "provider-typed-diamond", name: "Provider control", version: "1" },
    source: { id: "declared-control", files: [] }, nodes: graph.nodes,
    edges: graph.edges.map((e) => ({ relationLayer: "source-parent", ...e })), dictionaries: {} });
}
export const examples = Object.freeze([
  { id: "unit", type: "provider", input: { providerId: "unit-v1" } },
  { id: "inverse-share", type: "provider", input: { providerId: "inverse-target-share-v1" } },
  { id: "necessity", type: "provider", input: { providerId: "necessity-filtration-v1" } },
  { id: "roles", type: "provider", input: { providerId: "role-subset-v1", parameters: { roles: ["arising", "modulation"] } } },
  { id: "channels", type: "provider", input: { providerId: "typed-channel-v1", parameters: { field: "interactionModeIds", values: [0, 1] } } },
  { id: "unit-analysis", type: "analysis", input: { analysis: "structural-geometry", metricProviderId: "unit-v1" } },
  { id: "weighted-contextual-analysis", type: "analysis", input: { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1",
    selection: { kind: "necessity", through: "contextual" } } }
]);
