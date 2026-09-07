import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildModelPack } from "@onto2d/model-pack";
import { canonicalize } from "@onto2d/kernel/canonical";
import { fixtures as oldSignatures } from "../signatures/fixtures.mjs";
import { baselines, canonicalGraph, graphFromPack, topology } from "./baselines.mjs";
export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export const json = value => JSON.stringify(value, null, 2) + "\n";
export const rawHash = value => createHash("sha256").update(value).digest("hex");
export async function generate() {
  const config = await readJson("config.json");
  const old = [...Object.values(await readJson("../geometric-signatures/sources.json")), ...(await oldSignatures()).map(f => f.pack)];
  const excluded = [...new Set(old.map(graphFromPack).filter(g => g.n === config.nodes && g.edges.length === config.edges).map(g => canonicalGraph(g).code))].sort();
  const seen = new Set(excluded), selected = [], proposals = [];
  const slots = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 - i - 1 }, (_, j) => [i, i + j + 1])).flat();
  for (let counter = 0; counter < config.proposalBudget && selected.length < config.evaluationUnits; counter++) {
    const bytes = createHash("sha256").update(`${config.seed}:${counter}`).digest();
    const edges = slots.flatMap(([u, v], i) => bytes[i] % 3 === 0 ? [] : [bytes[i] % 3 === 1 ? [u, v] : [v, u]]);
    const graph = { n: config.nodes, edges };
    let disposition = edges.length !== config.edges ? "edge-count" : topology(graph).weakComponentSizes.length !== 1 ? "disconnected" : null;
    const code = disposition ? null : canonicalGraph(graph).code;
    if (!disposition && seen.has(code)) disposition = excluded.includes(code) ? "prior-orbit" : "duplicate-orbit";
    if (!disposition) { disposition = "accepted"; seen.add(code); selected.push({ ...graph, counter }); }
    proposals.push({ counter, disposition, canonicalCode: code });
  }
  assert.equal(selected.length, config.evaluationUnits, "Frozen proposal budget exhausted; no source replacement allowed.");
  const sources = {}, units = [];
  function add(id, baseId, split, variant, graph, counter = null) {
    const original = Array.from({ length: graph.n }, (_, i) => `n${i}`);
    const labels = variant === "transport" ? original.map((_, i) => `${i % 2 ? "\u{10000}" : "\ue000"} node ${graph.n - i} \n`) : original;
    let nodes = labels.map(id => ({ id })), edges = graph.edges.map(([u, v], i) => ({ id: variant === "transport" ? ` edge ${graph.edges.length - i} \n` : `e${i}`,
      source: labels[u], target: labels[v], relationLayer: "source-parent" }));
    if (variant === "transport") { nodes = nodes.reverse().map(n => ({ ...n, label: "transported", presentation: { x: 42 } })); edges = edges.reverse().map(e => ({ ...e, label: "transported" })); }
    sources[id] = buildModelPack({ model: { id: `added-value-${id}`, version: "1", name: "Prospective synthetic structural control" },
      source: { id: "declared-synthetic-study", files: [] }, nodes, edges, dictionaries: {} });
    const baseline = baselines(graph);
    units.push({ id, baseId, split, variant, proposal: counter, canonical: baseline.canonical, degrees: baseline.degrees,
      responseInput: { regimeId: config.regimeId }, geometryInput: { ...config.geometry, ollivier: { ...config.geometry.ollivier, edgeIds: edges.map(e => e.id).sort() } } });
  }
  selected.forEach((g, i) => { const id = `evaluation-${String(i).padStart(2, "0")}`; add(id, id, "evaluation", "base", g, g.counter); add(`${id}-transport`, id, "evaluation", "transport", g, g.counter); });
  const feedback = [[0, 1], [1, 3], [0, 2], [2, 3], [3, 0]];
  add("development-feedback", "development-feedback", "development", "base", { n: 4, edges: feedback });
  add("development-isolate", "development-isolate", "development", "base", { n: 5, edges: feedback });
  add("development-subdivision", "development-subdivision", "development", "base", { n: 5, edges: [...feedback.slice(0, -1), [3, 4], [4, 0]] });
  add("development-path", "development-path", "development", "base", { n: 3, edges: [[0, 1], [1, 2]] });
  const pairs = [], bases = units.filter(u => u.split === "evaluation" && u.variant === "base");
  function pair(left, right, split) {
    const a = units.find(u => u.id === left), b = units.find(u => u.id === right);
    const equal = canonicalize(a.canonical) === canonicalize(b.canonical);
    pairs.push({ id: `${left}--${right}`, left, right, split, truth: equal ? "same-directed-graph" : "different-directed-graph",
      degreeMatched: canonicalize(a.degrees) === canonicalize(b.degrees) });
  }
  bases.forEach((a, i) => bases.slice(i + 1).forEach(b => pair(a.id, b.id, "evaluation")));
  bases.forEach(a => pair(a.id, `${a.id}-transport`, "invariance"));
  pair("development-feedback", "development-isolate", "development");
  pair("development-feedback", "development-subdivision", "development");
  pair("development-path", "development-path", "development");
  return { sources, panel: { schemaVersion: "1", studyId: config.studyId, protocolSha256: rawHash(await readFile(new URL("PROTOCOL.md", directory))),
    config, excludedPriorOrbits: excluded, proposals, units, pairs } };
}
export async function checkSources(write = false) {
  const generated = await generate();
  for (const [name, value] of Object.entries(generated)) {
    const file = new URL(`${name}.json`, directory), bytes = json(value);
    if (write) await writeFile(file, bytes); else assert.equal(await readFile(file, "utf8"), bytes, `${name}: source plan differs`);
  }
  console.log(`Prospective source plan ${write ? "written" : "verified"}: 32 base units, 68 source packs, 531 pairs; no response/geometry measurements.`);
  return generated;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || !["--write", "--verify"].includes(process.argv[2])) throw new Error("Use --write or --verify.");
  await checkSources(process.argv[2] === "--write");
}
