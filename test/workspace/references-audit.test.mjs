import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditReferences } from "../../scripts/audit-references.mjs";

const schema = JSON.parse(await readFile(new URL("../../references/arising-schema.json", import.meta.url), "utf8"));

function fixture() {
  const node = (id) => ({
    Id: id, Level: 0, Name: `Node ${id}`, ShortDescription: "A bounded example.",
    Description: "A synthetic source record used to exercise the audit.",
    Phase: 0, TypeRole: 0, Science: [0], ScientificStatus: "hypothesized",
    Requirements: { MustCover: [], ShouldCover: [], OptionalCover: [] }, Parents: [],
    Evidence: [{ Type: "conceptual", Reference: "Synthetic locator; not a scientific citation.", DOI: "10.1234/example", Link: "https://example.org/paper" }]
  });
  const parent = node(0);
  const child = node(1);
  child.Requirements.MustCover = [0];
  child.Parents = [{
    ParentCode: "0.0", DependencyType: 0, CausalDirections: [2], InteractionModes: [0],
    Necessity: "necessary", OntologicalRole: "arising", Weight: 1,
    Quantization: { CarrierGroupId: 0, CarrierTypeId: 0, N_min: 1, N_crit: 2, N_sat: null }
  }];
  const entry = (Id) => ({ Id, Name: `Entry ${Id}` });
  return {
    levelFiles: ["level-0.json"], levels: [[parent, child]],
    descriptions: {
      ComplexityLevels: [entry(0), entry(1)], LevelPhases: [entry(0)], TypeRoles: [entry(0)],
      Ontologicals: [entry(0)], DependencyTypes: [entry(0)],
      CausalDirections: [entry(0), entry(1), entry(2), entry(3)], InteractionModes: [entry(0)],
      CarrierGroups: [entry(0), entry(1)], CarrierTypes: [{ ...entry(0), GroupId: 0 }]
    }
  };
}

test("references audit inventories every node, incoming relation and evidence entry without changing sources", () => {
  const source = fixture();
  const before = structuredClone(source);
  const report = auditReferences(source, schema);
  assert.deepEqual(source, before);
  assert.deepEqual(report.inventory.map((node) => [node.code, node.incomingEdges]), [["0.0", []], ["0.1", ["0.0->0.1"]]]);
  assert.equal(report.summary.evidenceCount, 2);
  assert.equal(report.summary.schemaViolationsCount, 0);
  assert.equal(report.summary.carrierGroupMismatchesCount, 0);
  assert.equal(report.summary.unknownReferencesCount, 0);
  assert.equal(report.summary.missingPublicationLocatorsCount, 0);
  assert.match(report.limits[0], /No publication retrieval/);
});

test("references audit locates schema defects separately from missing bibliography", () => {
  const source = fixture();
  source.levels[0][1].Evidence[0].DOI = null;
  source.levels[0][1].Evidence[0].Link = null;
  source.levels[0][1].ShortDescription = "x".repeat(161);
  source.levels[0][1].CrossLevels = [0];
  const report = auditReferences(source, schema);
  assert.equal(report.summary.schemaInvalidNodeCount, 1);
  assert.equal(report.summary.schemaViolationsCount, 4);
  assert.equal(report.summary.missingPublicationLocatorsCount, 1);
  assert.deepEqual(report.findings.schemaViolations.map((item) => item.instancePath).sort(), ["", "/Evidence/0/DOI", "/Evidence/0/Link", "/ShortDescription"]);
  assert.ok(report.findings.schemaViolations.every((item) => item.file === "references/level-0.json" && item.index === 1));
});

test("references audit detects dictionary and threshold defects missed by the preserved graph audit", () => {
  const source = fixture();
  const child = source.levels[0][1];
  child.Science = [99];
  child.Parents[0].Quantization = { CarrierGroupId: 1, CarrierTypeId: 0, N_min: 4, N_crit: 2, N_sat: null };
  child.Requirements.ShouldCover = [0];
  const report = auditReferences(source, schema);
  assert.equal(report.legacy.summary.unknownDictionaryReferenceCount, 0);
  assert.equal(report.summary.unknownReferencesCount, 1);
  assert.equal(report.findings.unknownReferences[0].dictionary, "Ontologicals");
  assert.deepEqual(report.findings.carrierGroupMismatches.map((item) => [item.edge, item.declaredGroup, item.expectedGroup]), [["0.0->0.1", 1, 0]]);
  assert.equal(report.summary.thresholdOrderViolationsCount, 1);
  assert.equal(report.summary.overlappingRequirementsCount, 1);
});

test("references audit keeps direction heuristics separate from reference and schema errors", () => {
  const source = fixture();
  const child = source.levels[0].pop();
  child.Level = 1;
  child.Parents[0].CausalDirections = [1];
  source.levelFiles.push("level-1.json");
  source.levels.push([child]);
  const report = auditReferences(source, schema);
  assert.equal(report.summary.schemaViolationsCount, 0);
  assert.equal(report.summary.unknownReferencesCount, 0);
  assert.equal(report.summary.fileLevelMismatchesCount, 0);
  assert.deepEqual(report.findings.directionReviewCandidates.map((item) => [item.edge, item.levelDirection]), [["0.0->1.1", "up"]]);
  assert.match(report.limits[1], /neither proves a claim false/);
});
