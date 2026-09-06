import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { DISTINGUISHABILITY_REGIMES, STRUCTURAL_OBSERVABLE_SPECS, prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { observeCanonicalStructure, verifyCanonicalStructureObservation } from "@onto2d/structural-geometry/canonical";
import { observeStructuralTopology, verifyStructuralTopologyObservation } from "@onto2d/structural-geometry/topology";
import { observeTypedRelations, verifyTypedRelationsObservation } from "@onto2d/structural-geometry/typed";
import { fixtures, controlPack, readJson } from "../../../cases/structural-geometry/regimes/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);

test("closed regime schemas accept all frozen policies, observable specs, source scopes and normalized preparations", async () => {
  for (const r of DISTINGUISHABILITY_REGIMES) assert.equal(validate("distinguishabilityRegime", r), true, ajv.errorsText());
  for (const s of STRUCTURAL_OBSERVABLE_SPECS) assert.equal(validate("structuralObservationSpec", s), true, ajv.errorsText());
  for (const f of await fixtures()) {
    assert.equal(validate("structuralRegimeInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralRegimePreparation", await readJson(`artifacts/${f.id}.json`)), true, ajv.errorsText());
  }
});

test("source identifiers retain exact whitespace in full and induced observations and their schemas", () => {
  const rename = (id) => ` ${id}\n`;
  const pack = controlPack({ rename });
  const before = JSON.stringify(pack);
  for (const [regimeId, schema, observe, verify] of [
    ["canonical-structure-v1", "structuralCanonicalObservation", observeCanonicalStructure, verifyCanonicalStructureObservation],
    ["topology-only-v1", "structuralTopologyObservation", observeStructuralTopology, verifyStructuralTopologyObservation],
    ["typed-relations-v1", "structuralTypedObservation", observeTypedRelations, verifyTypedRelationsObservation]
  ]) {
    for (const scope of [{ kind: "full" }, { kind: "induced", nodeIds: [rename("b"), rename("a")] }]) {
      const input = { regimeId, scope };
      assert.equal(validate("structuralRegimeInput", input), true, ajv.errorsText());
      const artifact = observe(pack, input);
      assert.equal(validate(schema, artifact), true, ajv.errorsText());
      assert.deepEqual(verify(artifact, pack, input), artifact);
      assert.ok(artifact.preparation.scope.nodeIds.every((id) => id.startsWith(" ") && id.endsWith("\n")));
      if (scope.kind === "induced") {
        assert.deepEqual(artifact.preparation.scope.edgeIds, [rename("a->b")]);
        assert.deepEqual(artifact.preparation.scope.incomingBoundaryEdgeIds, [rename("d->a")]);
        assert.deepEqual(artifact.preparation.scope.outgoingBoundaryEdgeIds, [rename("b->c")]);
        assert.deepEqual(artifact.preparation.scope.externalEdgeIds, [rename("c->d")]);
      }
    }
    assert.throws(() => observe(pack, { regimeId, scope: { kind: "induced", nodeIds: ["a"] } }),
      (error) => error.code === "STRUCTURAL_REGIME_SCOPE_INVALID");
  }
  assert.equal(JSON.stringify(pack), before);
});

test("schemas reject forged measurements, altered semantic profiles, missing provenance and incompatible regime combinations", () => {
  const original = prepareStructuralRegime(controlPack(), { regimeId: "topology-only-v1" });
  for (const change of [
    (a) => { a.evaluation = "measured"; }, (a) => { a.distance = 0; }, (a) => { a.status = "indeterminate"; },
    (a) => { a.schemaVersion = "2"; }, (a) => { delete a.context.model.manifestHash; },
    (a) => { a.context.dictionaryHash = "local-only"; }, (a) => { a.request.regimeId = "typed-relations-v1"; },
    (a) => { a.regime.matchingPolicy.graphIsomorphismClaim = true; },
    (a) => { a.regime.observables.reverse(); }, (a) => { a.observableSpecs.reverse(); },
    (a) => { a.observableSpecs[0].mandatory = false; }, (a) => { a.observableSpecs[0].supplier.version = "2"; },
    (a) => { a.scope.edgeIds.push(a.scope.edgeIds[0]); }, (a) => { a.scope.incomingBoundaryEdgeIds = ["outside"]; },
    (a) => { a.scope.kind = "induced"; }, (a) => { delete a.request.scope; },
    (a) => { a.regime.probeSets.invariance.probes = ["fake-pass"]; },
    (a) => { a.regime.missingnessPolicy.incompleteDistance = 0; }, (a) => { a.scope.extra = true; }
  ]) { const a = structuredClone(original); change(a); assert.equal(validate("structuralRegimePreparation", a), false); }
});

test("request schemas and runtime reject unknown regimes, hidden defaults and invalid or oversized induced scopes", () => {
  const source = controlPack();
  for (const input of [{}, { regimeId: "history-aware-v1" }, { regimeId: "canonical-structure-v1", threshold: 0.1 },
    ...[null, {}, { kind: "full", nodeIds: ["a"] }, { kind: "induced", nodeIds: [] },
      { kind: "induced", nodeIds: ["a", "a"] }, { kind: "induced", nodeIds: [""] },
      { kind: "induced", nodeIds: Array.from({ length: 7 }, (_, i) => `n${i}`) }].map((scope) => ({ regimeId: "canonical-structure-v1", scope }))]) {
    assert.equal(validate("structuralRegimeInput", input), false);
    assert.throws(() => prepareStructuralRegime(source, input));
  }
});

test("browser preparation and verification reproduce the complete frozen source-bound artifacts", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/regimes.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Regimes", write: false, logLevel: "silent" });
  const examples = await fixtures();
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify(JSON.parse(fixturesText).map(({pack,input}) => {
    const a = Regimes.prepareStructuralRegime(pack, input);
    Regimes.verifyDistinguishabilityRegime(a.regime, input.regimeId);
    for (const s of a.observableSpecs) Regimes.verifyStructuralObservationSpec(s, s.id);
    return Regimes.verifyStructuralRegimePreparation(a, pack, input);
  }));`, { fixturesText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), await Promise.all(examples.map((f) => readJson(`artifacts/${f.id}.json`))));
});
