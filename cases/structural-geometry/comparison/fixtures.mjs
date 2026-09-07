import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fixtures as typedFixtures, packFor, mappingFixtures } from "../typed/fixtures.mjs";
import { createStructuralVocabularyMapping } from "@onto2d/structural-geometry/typed";

export const directory = new URL("./", import.meta.url);
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json");
  const sources = new Map((await typedFixtures()).map((f) => [f.id, f]));
  for (const graph of controls.graphs) sources.set(graph.id, { id: graph.id, pack: packFor(graph), input: { regimeId: "typed-relations-v1" } });
  const oldMappings = new Map((await mappingFixtures()).map((m) => [m.id, m.declaration.fields]));
  const identity = Object.fromEntries(Object.entries({ dependencyTypeId: [0, 1, 2], interactionModeIds: [0, 1, 2], causalDirectionIds: [0, 1, 2],
    ontologicalRole: ["arising", "maintenance", "modulation"], necessity: ["necessary", "enabling", "contextual", "optional"] })
    .map(([field, values]) => [field, values.map((value) => ({ left: value, right: value }))]));
  const reference = "cases/structural-geometry/comparison/PROTOCOL.md";
  const contentHash = `sha256:${createHash("sha256").update(await readFile(new URL("PROTOCOL.md", directory))).digest("hex")}`;
  return controls.pairs.flatMap((pair) => pair.regimes.map((regimeId) => {
    const left = sources.get(pair.left), right = sources.get(pair.right);
    const leftScope = pair.leftScope ?? left.input.scope, rightScope = pair.rightScope ?? right.input.scope;
    const input = { regimeId, ...(leftScope ? { leftScope } : {}), ...(rightScope ? { rightScope } : {}) };
    if (regimeId === "typed-relations-v1" && pair.mapping) {
      const fields = pair.mapping === "identity" ? identity : oldMappings.get(pair.mapping);
      if (!fields) throw new Error("Unknown declared mapping.");
      const mapping = createStructuralVocabularyMapping(left.pack, right.pack,
        { id: `comparison-${pair.id}`, version: "1", fields, reviewEvidence: { reference, contentHash } });
      input.vocabulary = { mapping, ...(pair.approve ? { approvedMappingHash: mapping.artifactHash } : {}) };
    }
    if (pair.evidenceGaps) input.evidenceGaps = pair.evidenceGaps.map((gap) => ({ ...gap, reference, contentHash }));
    return { id: `${pair.id}-${regimeId}`, pairId: pair.id, left: left.pack, right: right.pack, input };
  }));
}
