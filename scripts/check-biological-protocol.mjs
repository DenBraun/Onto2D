import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { check } from "../cases/structural-geometry/protocol/check.mjs";
import { verifyAuditReport } from "../cases/structural-geometry/protocol/audit.mjs";

const root = new URL("../", import.meta.url), relative = "cases/structural-geometry/protocol/";
await check();
await verifyAuditReport();
const tests = (await readdir(new URL(relative, root))).filter(file => file.endsWith(".test.mjs")).sort();
const result = spawnSync(process.execPath, ["--test", ...tests.map(file => relative + file)], {
  cwd: fileURLToPath(root), stdio: "inherit"
});
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Frozen biological protocol, source-bound eligibility audit and independent synthetic controls verified; no biological predictive scores.");
