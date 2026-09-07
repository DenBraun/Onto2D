import { readFile } from "node:fs/promises";
import { fixtures as typedFixtures, packFor } from "../typed/fixtures.mjs";
import { fixtures as canonicalFixtures } from "../canonical/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json");
  const sources = new Map([
    ...(await typedFixtures()).map(f => [`typed/${f.id}`, f]),
    ...(await canonicalFixtures()).map(f => [`canonical/${f.id}`, f]),
    ...controls.graphs.map(g => [`local/${g.id}`, { pack: packFor(g), input: {} }])
  ]);
  const operations = new Map(controls.operations.map(o => [o.id, o.transformation]));
  return controls.scenarios.flatMap(s => {
    const source = sources.get(s.source);
    if (!source) throw new Error(`Unknown declared sandbox source: ${s.source}`);
    const scope = s.scope ?? source.input.scope;
    return s.operations.map(id => {
      if (!operations.has(id)) throw new Error(`Unknown declared sandbox operation: ${id}`);
      return { id: `${s.id}-${id}`, scenarioId: s.id, pack: source.pack,
        input: { regimeId: s.regimeId, ...(scope ? { scope } : {}), transformation: operations.get(id) } };
    });
  });
}
