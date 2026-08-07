import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CATALOG_ADAPTER_STATUS,
  auditLegacyCatalogue,
  loadLegacyCatalogue
} from "../src/index.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("legacy catalogue audit reproduces the reviewed R0 facts", async () => {
  const catalogue = await loadLegacyCatalogue({ catalogueDirectory: path.join(repositoryRoot, "scr") });
  const audit = auditLegacyCatalogue(catalogue);

  assert.equal(CATALOG_ADAPTER_STATUS, "audit-implemented/classification-pending");
  assert.deepEqual(audit.catalogue, { levelCount: 8, nodeCount: 249, edgeCount: 971 });
  assert.equal(audit.summary.weightSumAnomalyCount, 3);
  assert.equal(audit.summary.nodesWithUncoveredRequirements, 107);
  assert.equal(audit.summary.uncoveredRequirementCount, 123);
  assert.equal(audit.summary.nontrivialSccCount, 3);
  assert.equal(audit.summary.nontrivialSccNodeCount, 38);
  assert.deepEqual(audit.nontrivialSccs[0], ["0.8", "0.21", "0.22"]);
});

test("catalogue audit rejects invalid tolerance configuration", () => {
  assert.throws(
    () => auditLegacyCatalogue({ levels: [], descriptions: {} }, { weightTolerance: Number.NaN }),
    TypeError
  );
});

test("catalogue audit reports non-finite relation weights", () => {
  const audit = auditLegacyCatalogue({
    levels: [[{
      Level: 0,
      Id: 0,
      TypeRole: 0,
      Phase: 0,
      Parents: [{
        ParentCode: "0.1",
        DependencyType: 0,
        InteractionModes: [],
        CausalDirections: [],
        Weight: Number.NaN
      }],
      Requirements: { MustCover: [] }
    }, {
      Level: 0,
      Id: 1,
      TypeRole: 0,
      Phase: 0,
      Parents: [],
      Requirements: { MustCover: [] }
    }]],
    descriptions: {
      DependencyTypes: [{ Id: 0 }],
      TypeRoles: [{ Id: 0 }],
      LevelPhases: [{ Id: 0 }],
      ComplexityLevels: [{ Id: 0 }]
    }
  });
  assert.equal(audit.summary.weightsOutsideUnitIntervalCount, 1);
});
