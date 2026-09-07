import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";
import { packFor } from "../typed/fixtures.mjs";
import { graphFor } from "../responses/fixtures.mjs";
import { fixtures as signatureFixtures, contrastId } from "../signatures/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json"), signatures = await readJson("../signatures/controls.json"), responses = await readJson("../responses/controls.json");
  const graphs = [...controls.completeFragments.map(id => signatures.graphs.find(g => g.id === id)),
    ...controls.additionalFragments.map(id => responses.graphs.find(g => g.id === id))];
  const graph = { id: "pseudometric-shared", nodes: 0, labels: [], edges: [] }, scopes = new Map();
  for (const g of graphs) {
    const labels = Array.from({ length: g.nodes }, (_, i) => `${g.id}:n${i}`), offset = graph.nodes;
    scopes.set(g.id, { kind: "induced", nodeIds: labels }); graph.labels.push(...labels); graph.nodes += g.nodes;
    graph.edges.push(...g.edges.map(([u, v, t]) => [u + offset, v + offset, t]));
  }
  const types = { ...responses.types, "contextual-necessary": { ...responses.types.contextual, necessity: "necessary" } };
  const shared = packFor(graphFor(graph, types));
  const foreign = buildModelPack({ model: { ...shared.manifest.model, id: "pseudometric-foreign" }, source: shared.manifest.source,
    dictionaries: shared.files["model/dictionaries.json"], nodes: shared.files["model/nodes.json"], edges: shared.files["model/edges.json"] });
  const old = new Map((await signatureFixtures()).map(f => [f.id, f]));
  const endpoint = (fragment, regimeId) => {
    const id = `${fragment}:${regimeId}`;
    if (fragment === "maximum" || fragment === "external") {
      const f = old.get(fragment === "maximum" ? "maximum" : contrastId("diamond-feedback", regimeId));
      return { id, pack: f.pack, scope: f.input.scope ?? { kind: "full" } };
    }
    return { id, pack: fragment === "foreign" ? foreign : shared, scope: scopes.get(fragment === "foreign" ? "diamond-feedback" : fragment) };
  };
  const requests = controls.regimes.flatMap(regimeId => controls.completeFragments.flatMap(left => controls.completeFragments.map(right =>
    ({ id: `${left}--${right}--${regimeId}`, regimeId, left, right }))));
  requests.push(...controls.cases);
  return requests.map(c => {
    const left = endpoint(c.left, c.regimeId), right = endpoint(c.right, c.regimeId);
    return { id: c.id, left, right, input: { regimeId: c.regimeId, leftScope: left.scope, rightScope: right.scope,
      ...(c.diagnostics ? { diagnostics: c.diagnostics } : {}) } };
  });
}
