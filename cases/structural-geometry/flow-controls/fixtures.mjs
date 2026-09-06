import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { packFor } from "../flow/fixtures.mjs";

export const directory = new URL("./", import.meta.url);
export const PROTOCOL_SHA256 = "52aa6ac26060a17ab17bcd99e31a1ffd3027c88ee5d9d5fa06b68325562f02c6";
export const readJson = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));

export async function fixtures() {
  const bytes = await readFile(new URL("protocol.json", directory));
  if (createHash("sha256").update(bytes).digest("hex") !== PROTOCOL_SHA256) {
    throw new Error("Supplemental flow protocol differs from the frozen input/expectation lock.");
  }
  const protocol = JSON.parse(bytes);
  return protocol.runs.map((run) => {
    const graph = protocol.graphs.find((g) => g.id === run.graphId);
    return { ...run, graph, pack: packFor(graph) };
  });
}
