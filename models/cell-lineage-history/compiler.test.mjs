import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildCellLineageIdentityCase } from "../../cases/cell-lineage-identity/extract.mjs";
import { buildCellLineageHistoryRelease, verifyCellLineageHistoryRelease } from "./build.mjs";
import { CELL_LINEAGE_MAPPING_VERSION, compileCellLineageHistoryModelPack } from "./compiler.mjs";

const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  return { ...basis, caseIdentity: hashCanonical("onto2d:cell-lineage-identity-case:v1", basis) };
};

test("the Cell Lineage compiler emits a valid exact Model Pack", async () => {
  const pack = compileCellLineageHistoryModelPack(await buildCellLineageIdentityCase());
  assert.equal(verifyModelPack(pack).manifest.model.id, "cell-lineage-history");
  assert.equal(pack.manifest.model.version, "v1-6e6ea7be0f576db7");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 1140, edgeCount: 2450 });
  assert.equal(pack.files["model/dictionaries.json"].provenance.mappingVersion, CELL_LINEAGE_MAPPING_VERSION);
});

test("the model keeps cells, clusters, barcodes, and reconstructed groups separate", async () => {
  const pack = compileCellLineageHistoryModelPack(await buildCellLineageIdentityCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "cell-observation").length, 750);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "transcriptomic-cluster").length, 56);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "observed-barcode-state").length, 192);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "first-four-target-signature").length, 133);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "identity-regime").length, 4);
});

test("compiled edges make no parent, division, ancestry, or unique-ancestor claim", async () => {
  const pack = compileCellLineageHistoryModelPack(await buildCellLineageIdentityCase());
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.filter(({ relation }) => relation === "contains-cell-observation").length, 750);
  assert.equal(edges.filter(({ relation }) => relation === "assigned-to-cluster").length, 750);
  assert.equal(edges.filter(({ relation }) => relation === "reports-barcode-state").length, 750);
  assert.equal(edges.filter(({ relation }) => relation === "projects-to-first-four-target-signature").length, 192);
  assert.ok(edges.every((edge) => edge.parentCellClaim !== true && edge.divisionClaim !== true && edge.ancestryClaim !== true && edge.uniqueAncestorClaim !== true));
});

test("the compiler rejects an epistemic promotion after re-signing", async () => {
  const artifact = await buildCellLineageIdentityCase();
  artifact.audit.caseGeneratedDivisionCount = 1;
  assert.throws(() => compileCellLineageHistoryModelPack(resign(artifact)), /approved release/);
});

test("the committed Cell Lineage release remains byte-for-byte reproducible", async () => {
  const expected = await buildCellLineageHistoryRelease();
  const stored = await verifyCellLineageHistoryRelease(expected);
  assert.deepEqual(stored, expected);
  assert.equal(expected.manifest.rootHash, "sha256:33721d57ab0f209af29bb84dd08c89052fbfbd44cddc1e54daeb0b3c7081ffcc");
});
