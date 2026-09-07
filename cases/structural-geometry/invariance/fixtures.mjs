import { readFile } from "node:fs/promises";
import { fixtures as sandboxFixtures } from "../sandbox/fixtures.mjs";
import { fixtures as typedFixtures, packFor } from "../typed/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json"), sandbox = await sandboxFixtures(), typed = await typedFixtures();
  const result = controls.sandboxScenarioIds.map(id => {
    const f = sandbox.find(f => f.id === `${id}-identity`);
    if (!f) throw new Error(`Unknown declared invariance source: ${id}`);
    const { transformation, ...input } = f.input;
    return { id, pack: f.pack, input };
  });
  for (const id of controls.typedControlIds) {
    const f = typed.find(f => f.id === id);
    if (!f) throw new Error(`Unknown declared typed invariance source: ${id}`);
    result.push({ id, pack: f.pack, input: f.input });
  }
  const { nodes, forwardOffsets } = controls.topologyLimit;
  result.push({ id: "topology-limit", pack: packFor({ id: "invariance-topology-limit", nodes,
    edges: Array.from({ length: nodes }, (_, from) => forwardOffsets.map(offset => ({ from, to: (from + offset) % nodes, types: controls.censusTypes }))).flat() }),
    input: { regimeId: "topology-only-v1" } });
  return result;
}
