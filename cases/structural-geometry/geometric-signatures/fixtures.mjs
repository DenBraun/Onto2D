import { readFile } from "node:fs/promises";
export const directory = new URL("./", import.meta.url);
export const readJson = async name => JSON.parse(await readFile(new URL(name, directory), "utf8"));
export async function fixtures() {
  const controls = await readJson("controls.json"), sources = await readJson("sources.json");
  return controls.cases.map(c => ({ ...c, pack: sources[c.sourceId] }));
}
