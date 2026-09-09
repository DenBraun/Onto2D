import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { PROFILE, carrier, measure, numericalFlow } from "./geometry.mjs";
import { readJson, writeJson, python } from "./io.mjs";

const graph = (nodes, pairs) => ({ nodes, edges: pairs.map(([source, target]) => ({ source, target })) });
export const FIXTURES = [
  { id: "chain", graph: graph(["A", "B", "C"], [["A", "B"], ["B", "C"]]) },
  { id: "diamond", graph: graph(["A", "B", "C", "D"], [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"]]) },
  { id: "branching-cycle", graph: graph(["A", "B", "C", "D"], [["A", "B"], ["B", "C"], ["C", "A"], ["A", "D"], ["D", "A"]]) }
];
export async function generateControls({ independent = true } = {}) {
  const cases = [];
  for (const fixture of FIXTURES) {
    const context = carrier(fixture.graph, fixture.id); let base = null;
    for (const variant of PROFILE.variants) {
      const measured = await measure(context, variant.id, base?.geometry.fields.map(f => f.ollivier));
      assert.equal(measured.status, "complete");
      if (variant.id === "unit-half") base = measured;
      if (variant.id === "double-unit-initial") { assert.deepEqual(measured.geometry, base.geometry); assert.deepEqual(numericalFlow(measured.flow), numericalFlow(base.flow)); }
      cases.push({ id: fixture.id, variantId: variant.id, context, measured });
    }
  }
  const result = { profileId: PROFILE.id, independent: PROFILE.independent, cases };
  if (independent) await python("--geometry", cases, { networkx: true });
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.slice(2);
  if (mode.length !== 1 || !["--write", "--verify"].includes(mode[0])) { console.error("Expected --write or --verify"); process.exitCode = 1; }
  else generateControls().then(async value => { if (mode[0] === "--write") await writeJson("controls.json", value, { pretty: true }); else assert.deepEqual(value, await readJson("controls.json"));
    console.log("D6.4 independent controls verified: all five variants on chain, diamond and branching cycle."); }).catch(error => { console.error(error); process.exitCode = 1; });
}
