import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildLteeEvolutionaryContingencyCase, verifyLteeEvolutionaryContingencyCaseIdentity } from "../extract.mjs";
import { buildLteeProtocolBundle } from "./protocol-model.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = "cases/ltee-evolutionary-contingency/history-benchmark";
const read = (relative) => readFile(path.join(root, relative));
const json = async (relative) => JSON.parse(await read(relative));
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export async function buildLteeBenchmarkProtocols() {
  const sourceCase = verifyLteeEvolutionaryContingencyCaseIdentity(await buildLteeEvolutionaryContingencyCase());
  const sourcePath = "cases/ltee-evolutionary-contingency/source/ltee-ara3-citrate-replay.json";
  const sourceBytes = await read(sourcePath);
  const policy = await json(`${directory}/policy.json`);
  const implementationFiles = [`${directory}/protocol-model.js`, "packages/kernel/src/canonical-entry.js"];
  const implementationLocks = await Promise.all(implementationFiles.map(async (file) => ({ path: file, sha256: sha(await read(file)) })));
  const bindings = {
    sourceSnapshotHash: sha(sourceBytes), sourceCaseHash: sourceCase.caseIdentity,
    policyHash: hashCanonical("onto2d:ltee-benchmark-policy:v1", policy),
    builderHash: sha(await read(`${directory}/build.mjs`)),
    implementationHash: hashCanonical("onto2d:ltee-benchmark-implementation:v1", implementationLocks)
  };
  const bundle = buildLteeProtocolBundle(JSON.parse(sourceBytes), policy, bindings);
  const files = new Map([
    [`${directory}/protocol-set.json`, bundle.protocolSet],
    [`${directory}/assessment.json`, bundle.assessment],
    [`${directory}/bundle.json`, bundle]
  ]);
  for (const protocol of bundle.protocolSet.protocols) files.set(`${directory}/contracts/${protocol.protocolId}.json`, protocol);
  return { files, bundle };
}

export async function run({ verify = false } = {}) {
  const { files } = await buildLteeBenchmarkProtocols();
  for (const [relative, value] of files) {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (verify) {
      if (await readFile(path.join(root, relative), "utf8") !== text) throw new Error(`LTEE benchmark artifact drift: ${relative}`);
    } else {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), text);
    }
  }
  console.log(`LTEE protocols ${verify ? "verified" : "built"}: 3 separate censuses, 38 observations, 10 not-run cells; P/P+H scoring not eligible under this profile.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown LTEE benchmark arguments: ${unknown.join(", ")}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error); process.exitCode = 1; });
}
