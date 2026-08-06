import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  auditLegacyCatalogue,
  loadLegacyCatalogue
} from "../packages/catalog-adapter/src/index.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_FILE = path.join(REPOSITORY_ROOT, "test", "fixtures", "catalogue-audit.expected.json");

function stableSnapshot(audit) {
  return {
    catalogue: audit.catalogue,
    summary: audit.summary,
    weightSumAnomalies: audit.findings.weightSumAnomalies,
    nontrivialSccs: audit.nontrivialSccs
  };
}

export async function run(options = {}) {
  const catalogue = await loadLegacyCatalogue({
    catalogueDirectory: path.join(REPOSITORY_ROOT, "scr")
  });
  const snapshot = stableSnapshot(auditLegacyCatalogue(catalogue));

  if (options.verify) {
    const expected = JSON.parse(await readFile(EXPECTED_FILE, "utf8"));
    assert.deepStrictEqual(snapshot, expected, "Legacy catalogue audit differs from the reviewed fixture.");
    console.log(
      `Catalogue check passed: ${snapshot.catalogue.nodeCount} nodes, ` +
      `${snapshot.catalogue.edgeCount} edges, ${snapshot.summary.nontrivialSccCount} nontrivial SCCs.`
    );
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }

  return snapshot;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
