import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";
import { controls as previousControls, fixtures as ollivierFixtures } from "../ollivier/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export const rational = (n, d = 1) => ({ numerator: String(n), denominator: String(d) });
export function packFor(graph) {
  return buildModelPack({ model: { id: `flow-${graph.id}`, version: "1", name: "Structural flow synthetic control", status: "synthetic" },
    source: { id: "declared-synthetic-graph", files: [] }, nodes: graph.nodes,
    edges: graph.edges.map((e) => ({ relationLayer: "source-parent", ...e })), dictionaries: {} });
}

// Ni et al. (2019), Appendix E: G(a=3,b=2), represented by reciprocal arcs.
export function paperGraph() {
  const nodes = Array.from({ length: 3 }, (_, group) => Array.from({ length: 4 }, (_, i) => ({ id: `g${group}-${i}` }))).flat();
  const edges = []; const types = {};
  function pair(source, target, type) {
    for (const [a, b] of [[source, target], [target, source]]) {
      const id = `${a}->${b}`; edges.push({ id, source: a, target: b }); types[id] = type;
    }
  }
  for (let g = 0; g < 3; g += 1) for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) {
    pair(`g${g}-${i}`, `g${g}-${j}`, i === 0 ? 2 : 3);
  }
  for (let g = 0; g < 3; g += 1) for (let h = g + 1; h < 3; h += 1) pair(`g${g}-0`, `g${h}-0`, 1);
  return { id: "paper-g3-2", nodes, edges, types };
}

export function controls() {
  const find = (id) => structuredClone(previousControls.find((g) => g.id === id));
  const list = ["single-edge", "path", "diamond-dag", "asymmetric-neighborhood", "bidirected-clique"].map((id) => ({
    graph: find(id), input: { maxIterations: 8 }
  }));
  list.push({ graph: find("feedback-triangle"), input: { step: "one", idleness: "zero", maxIterations: 8 } });
  const cycle = find("reciprocal-pair"); cycle.id = "period-two";
  list.push({ graph: cycle, input: { step: "one", idleness: "zero", maxIterations: 8,
    initialLengths: cycle.edges.map((e, i) => ({ edgeId: e.id, length: rational(i + 1) })) } });
  const shortcut = { id: "initial-metric-closure", nodes: ["a", "b", "c", "isolated"].map((id) => ({ id })),
    edges: [["a", "b"], ["b", "c"], ["a", "c"]].map(([source, target]) => ({ id: `${source}->${target}`, source, target })) };
  list.push({ graph: shortcut, input: { maxIterations: 8,
    initialLengths: shortcut.edges.map((e, i) => ({ edgeId: e.id, length: rational(i === 2 ? 5 : 1) })) } });
  list.push({ graph: paperGraph(), input: { step: "one", idleness: "zero", maxIterations: 16,
    tolerance: rational(1, "1000000000000000000000000000000"), cut: { kind: "final-length", threshold: rational(2) } } });
  return list;
}

export async function fixtures() {
  const values = controls().map(({ graph, input }) => ({ id: graph.id, pack: packFor(graph), input }));
  for (const entry of (await ollivierFixtures()).filter((f) => f.id.startsWith("causal-emergence-") && f.id.endsWith("-half"))) {
    values.push({ id: entry.id.replace(/-half$/, ""), pack: entry.pack, input: { scope: entry.input.scope, maxIterations: 6 } });
  }
  return values;
}
