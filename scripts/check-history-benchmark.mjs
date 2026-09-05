import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { run as verifyPilot } from "../cases/history-matters-reference/build.mjs";
import { benchmarkRows } from "../apps/history-matters-benchmark/presentation.js";
import { run as verifyFd001 } from "../cases/operational-aging/history-benchmark/build.mjs";
import { run as verifyLtee } from "../cases/ltee-evolutionary-contingency/history-benchmark/build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));

export async function run() {
  const registry = await json("cases/history-benchmark-registry.json");
  const history = await json("cases/history-case-registry.json");
  const bundle = await json("apps/history-matters-benchmark/pilot.json");
  const schema = await json("packages/schemas/schemas/history-benchmark-registry.schema.json");
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(schema);
  if (!validate(registry)) throw new Error(ajv.errorsText(validate.errors));
  const aging = "cases/operational-aging/history-benchmark";
  for (const [name, artifactPath] of Object.entries({ contract: "contract.json", dataset: "dataset.json", targets: "training-targets.json", preparation: "expected/preparation.json", readiness: "readiness.json" })) {
    const regressionSchema = await json(`packages/schemas/schemas/history-regression-${name}.schema.json`);
    const check = ajv.compile(regressionSchema);
    if (!check(await json(`${aging}/${artifactPath}`))) throw new Error(`FD001 ${name}: ${ajv.errorsText(check.errors)}`);
  }
  const ltee = "cases/ltee-evolutionary-contingency/history-benchmark";
  for (const name of ["protocol-set", "assessment"]) {
    const check = ajv.compile(await json(`${ltee}/schema/${name}.schema.json`));
    if (!check(await json(`${ltee}/${name}.json`))) throw new Error(`LTEE ${name}: ${ajv.errorsText(check.errors)}`);
  }
  benchmarkRows(registry, bundle.entries, bundle.preparations, bundle.experimentalProtocols);
  const historyCases = new Map(history.cases.map((entry) => [entry.caseId, entry]));
  for (const member of registry.entries) {
    const entry = historyCases.get(member.caseId);
    if (!entry && member.caseId !== "history-matters-reference") throw new Error(`Unknown History Atlas case: ${member.caseId}`);
    if (entry) {
      if (!entry.analyses.historyMatters || entry.analyses.historyMatters === "not-primary") throw new Error(`Missing benchmark role: ${member.caseId}`);
      if (!entry.historyModes.includes(member.historyMode) || ![...entry.primaryEffects, ...entry.secondaryEffects].includes(member.effect)) throw new Error(`Benchmark taxonomy differs from History Atlas: ${member.caseId}`);
    }
    for (const field of ["contractPath", "resultPath", "planPath", "preparationPath", "readinessPath", "assessmentPath"]) {
      if (member[field] == null) continue;
      const resolved = path.resolve(root, member[field]);
      if (!resolved.startsWith(root) || member[field].includes("\\")) throw new Error(`Unsafe benchmark path: ${member[field]}`);
      await access(resolved);
    }
    if (member.resultPath === null && ["EVALUATED", "REPLICATED", "REVIEWED"].includes(member.status)) throw new Error(`Maturity without result: ${member.benchmarkId}`);
    if (member.resultPath === null && member.planPath === null) throw new Error(`Candidate without plan: ${member.benchmarkId}`);
  }
  // Regeneration checks exact source bytes, projection/evaluator implementation,
  // frozen P/H/Y/split artifacts, every result, membership, suite and browser pin.
  await verifyFd001({ verify: true });
  await verifyLtee({ verify: true });
  await verifyPilot({ verify: true });
  console.log(`History benchmark registry check passed: ${registry.entries.length} members, with no aggregate score.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
