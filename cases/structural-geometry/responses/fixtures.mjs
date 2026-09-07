import { readFile } from "node:fs/promises";
import { packFor } from "../typed/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export function graphFor(control, types) {
  return { ...control, id: `responses-${control.id}`, edges: control.edges.map(([from, to, type]) => {
    if (!Object.hasOwn(types, type)) throw new Error(`Unknown declared response type: ${type}`);
    return { from, to, types: types[type] };
  }) };
}
export async function fixtures() {
  const controls = await readJson("controls.json"), { cycleNodes, isolates, type } = controls.maximumCycle;
  const graphs = [...controls.graphs, { id: "maximum", nodes: cycleNodes + isolates,
    edges: Array.from({ length: cycleNodes }, (_, i) => [i, (i + 1) % cycleNodes, type]) }];
  const sources = new Map(graphs.map(g => [g.id, packFor(graphFor(g, controls.types))]));
  sources.set("causal", await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json"));
  return controls.scenarios.map(s => {
    if (!sources.has(s.source)) throw new Error(`Unknown declared response source: ${s.source}`);
    const scope = s.scope ?? (s.source === "causal" ? { kind: "induced", nodeIds: controls.causalScope } : null);
    return { id: s.id, pack: sources.get(s.source), input: { regimeId: s.regimeId, ...(scope ? { scope } : {}) } };
  });
}
