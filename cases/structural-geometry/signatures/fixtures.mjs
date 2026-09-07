import { readFile } from "node:fs/promises";
import { packFor } from "../typed/fixtures.mjs";
import { fixtures as responseFixtures, graphFor } from "../responses/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json"), responseControls = await readJson("../responses/controls.json");
  const base = await responseFixtures();
  if (JSON.stringify(base.map(f => f.id)) !== JSON.stringify(controls.baseControlIds)) throw new Error("Signature base controls differ.");
  const types = { ...responseControls.types, "contextual-necessary": { ...responseControls.types.contextual, necessity: "necessary" } };
  const additional = controls.graphs.flatMap(g => controls.regimes
    .filter(regime => !(g.id === "diamond-feedback" && regime === "typed-relations-v1"))
    .map(regimeId => ({ id: `${g.id}-${regimeId}`, pack: packFor({ ...graphFor(g, types), id: `signature-${g.id}` }), input: { regimeId } })));
  return [...base, ...additional];
}
export function contrastId(graph, regime) {
  return graph === "diamond-feedback" && regime === "typed-relations-v1" ? "diamond-feedback-typed" : `${graph}-${regime}`;
}
