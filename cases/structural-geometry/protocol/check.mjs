import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { verifyReport } from "../datasets/build.mjs";
import { GRAPH_BASELINE_PROFILE } from "./baselines.mjs";
import { FUNCTIONAL_PROFILE } from "./functional.mjs";
import { TARGET_PROFILE_ID } from "./metrics.mjs";
import { RIDGE_PROFILE } from "./model.mjs";
import { publishExclusive } from "./io.mjs";

const here = new URL("./", import.meta.url);
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const readProtocol = async () => JSON.parse(await readFile(new URL("protocol.json", here), "utf8"));
const frozenFiles = ["PROTOCOL.md", "protocol.json", "method-source-lock.json", "methods.py", "check.mjs", "audit.mjs", "io.mjs",
  "metrics.mjs", "reference.py", "baselines.mjs", "model.mjs", "model-reference.py", "functional.mjs", "populations.mjs",
  "metrics.test.mjs", "baselines.test.mjs", "model.test.mjs", "independent-model.test.mjs", "functional.test.mjs",
  "populations.test.mjs", "protocol.test.mjs"];

export function validateProtocol(protocol) {
  if (protocol.id !== "biological-geometric-rank-study-v1" || protocol.schemaVersion !== "1" || protocol.version !== "1" ||
      protocol.dream4.targetProfileId !== TARGET_PROFILE_ID || protocol.celegans.targetProfileId !== FUNCTIONAL_PROFILE.id ||
      protocol.baselines.profileId !== GRAPH_BASELINE_PROFILE.id || protocol.baselines.featureCount !== GRAPH_BASELINE_PROFILE.featureNames.length ||
      protocol.learner.profileId !== RIDGE_PROFILE.id || JSON.stringify(protocol.learner.lambdas) !== JSON.stringify(RIDGE_PROFILE.lambdas) ||
      protocol.celegans.primaryAnatomy !== "Dataset7" || protocol.celegans.minimumGroups !== 5 ||
      JSON.stringify(protocol.dream4.unitIds) !== JSON.stringify(Array.from({ length: 5 }, (_, i) => `insilico_size10_${i + 1}`)) ||
      protocol.geometry.parameters.maxIterations !== 4 || protocol.geometry.featureCounts.fullWithBaseline !== 54 ||
      typeof protocol.inspection.auditContentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(protocol.inspection.auditContentSha256) ||
      protocol.inspection.biologicalPredictiveScoresComputed !== false || protocol.inspection.externalPreregistration !== false) throw new Error("Protocol differs from its reviewed helper contracts or selected populations.");
  return protocol;
}

async function currentBinding() {
  const files = {};
  for (const file of frozenFiles) files[file] = sha256(await readFile(new URL(file, here)));
  return { format: "onto2d-biological-protocol-lock-v1", protocolId: "biological-geometric-rank-study-v1", files };
}

export async function check({ freeze = false } = {}) {
  const protocol = validateProtocol(await readProtocol());
  await verifyReport();
  const sources = {
    datasetLockSha256: sha256(await readFile(new URL("../datasets/source-lock.json", here))),
    censusSha256: sha256(await readFile(new URL("../datasets/census.json", here))),
    methodLockSha256: sha256(await readFile(new URL("method-source-lock.json", here)))
  };
  if (JSON.stringify(protocol.sources) !== JSON.stringify(sources)) throw new Error("Protocol sources differ from the accepted census or method evidence.");
  const current = await currentBinding();
  const encoded = `${JSON.stringify({ ...current, lockSha256: sha256(JSON.stringify(current)) }, null, 2)}\n`;
  if (freeze) await publishExclusive(new URL("frozen.json", here), encoded);
  else if (await readFile(new URL("frozen.json", here), "utf8") !== encoded) throw new Error("Frozen biological protocol differs; preserve v1 and use an explicitly new protocol for a changed study.");
  return protocol;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--freeze")) {
    console.error("Usage: node cases/structural-geometry/protocol/check.mjs [--freeze]"); process.exitCode = 1;
  } else check({ freeze: args.includes("--freeze") }).then(() => console.log("Biological protocol source and contract locks verified; no predictive score calculated.")).catch(error => { console.error(error.message); process.exitCode = 1; });
}
