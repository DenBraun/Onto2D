import assert from "node:assert/strict";
import test from "node:test";
import { pairCoordinates } from "./geometry.mjs";
import { prepareContrast, evaluateContrast } from "./evaluation.mjs";

function fabricated() {
  const genes = Array.from({ length: 10 }, (_, i) => `G${i + 1}`);
  const units = Array.from({ length: 5 }, (_, i) => {
    const id = `insilico_size10_${i + 1}`, tables = {}, sourceMembers = [];
    for (const [index, name] of ["wildtype", "knockouts", "knockdowns"].entries()) {
      const values = name === "wildtype" ? [genes.map(() => 0)] : genes.map((_, row) => genes.map((_, column) => row === column ? 0 : column));
      const sourceMember = `lightlyProcessedDownloadedData/${id}/${name}.tsv`, sourceSha256 = String(index).repeat(64);
      sourceMembers.push({ member: sourceMember, kind: "file", sha256: sourceSha256, bytes: 1000 });
      tables[name] = { columns: [...genes], values, nativeLines: values.map((_, row) => row + 2), rowCount: values.length,
        columnCount: 10, role: "fabricated", sourceMember, sourceSha256 };
      if (name !== "wildtype") Object.assign(tables[name], { interventions: genes.map((gene, rowIndex) => ({ rowIndex, gene })),
        alignmentEvidenceMember: "DREAM4/inst/scripts/buildRData.R" });
    }
    return { id, splitGroup: id, nodeIdentityScope: "network-local", nodes: [...genes], edges: [], goldStandard: [],
      tables: { ...tables, multifactorial: {}, timeseries: {}, dualknockouts: {} }, sourceMembers, census: {} };
  });
  const geometry = units.map(unit => ({ id: unit.id, status: "complete", geometry: pairCoordinates(
    { nodes: unit.nodes, edges: unit.edges }, [], { iteration: 0, reason: "fixed-point" }) }));
  return { units, geometry };
}

test("the joint population is fixed before fitting and includes all 450 off-target rows", () => {
  const { units, geometry } = fabricated();
  for (const contrast of ["knockouts", "knockdowns"]) {
    const prepared = prepareContrast(units, geometry, contrast);
    assert.equal(prepared.complete, true);
    assert.equal(prepared.rows.length, 450);
    assert.equal(prepared.coverage.matchedRows, 450);
    assert.ok(prepared.rows.every(row => row.x.length === 54 && row.source !== row.target));
    assert.equal(new Set(prepared.rows.map(row => row.id)).size, 450);
  }
});

test("a missing geometry network or constant intervention makes the primary unavailable before fitting", () => {
  const { units, geometry } = fabricated(), costs = {};
  geometry[2] = { id: units[2].id, status: "unavailable", reason: "solver-budget" };
  const prepared = prepareContrast(units, geometry, "knockouts"), result = evaluateContrast(prepared, costs);
  assert.equal(result.report.primary, null);
  assert.equal(result.report.status, "unavailable");
  assert.equal(result.report.coverage.matchedRows, 360);
  assert.deepEqual(result.report.exclusions, [{ groupId: units[2].id, reason: "solver-budget" }]);
  assert.deepEqual(costs, {});
  const second = fabricated(); second.units[0].tables.knockouts.values[0] = Array(10).fill(0);
  const excluded = evaluateContrast(prepareContrast(second.units, second.geometry, "knockouts"), costs);
  assert.equal(excluded.report.coverage.matchedRows, 441);
  assert.equal(excluded.report.primary, null);
  assert.deepEqual(costs, {});
});

test("missing or duplicate gene-pair features cannot change the evaluation population", () => {
  const { units, geometry } = fabricated();
  assert.throws(() => prepareContrast(units, geometry.slice(1), "knockouts"));
  geometry[0].geometry.pairs[0] = geometry[0].geometry.pairs[1];
  assert.throws(() => prepareContrast(units, geometry, "knockouts"));
});

test("numeric failure leaves the entire requested primary unavailable", () => {
  const { units, geometry } = fabricated();
  geometry[0].geometry.pairs[0].geometry[0] = Infinity;
  const result = evaluateContrast(prepareContrast(units, geometry, "knockouts"));
  assert.equal(result.report.primary, null);
  assert.equal(result.report.reason, "required-computation-failed");
});
