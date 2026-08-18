import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildOciLayout } from "./src/oci-layout.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const LAYOUT_ROOT = path.join(CASE_ROOT, "fixtures", "oci-layout");

function fail(message) {
  throw new Error(`OCI fixture generation failed: ${message}`);
}

async function collectFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

export async function generateOciFixture({ verify = false } = {}) {
  const spec = JSON.parse(await readFile(path.join(CASE_ROOT, "fixture-spec.json"), "utf8"));
  const layout = buildOciLayout(spec);
  if (verify) {
    const actualFiles = await collectFiles(LAYOUT_ROOT);
    const expectedFiles = [...layout.files.keys()].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail("committed layout inventory differs");
    for (const [relative, expected] of layout.files) {
      const actual = await readFile(path.join(LAYOUT_ROOT, relative));
      if (!actual.equals(expected)) fail(`committed layout file differs: ${relative}`);
    }
    return layout;
  }
  for (const [relative, bytes] of layout.files) {
    const target = path.join(LAYOUT_ROOT, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return layout;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length > 0) fail(`unknown argument ${unknown[0]}`);
  generateOciFixture({ verify: process.argv.includes("--verify") }).then((layout) => {
    console.log(`${process.argv.includes("--verify") ? "Verified" : "Generated"} OCI layout with ${layout.records.length} image manifests.`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
