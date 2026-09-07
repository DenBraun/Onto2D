import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { compareStructuralSignatures } from "@onto2d/structural-geometry/pseudometric";
import { fixtures, readJson } from "../../../cases/structural-geometry/pseudometric/fixtures.mjs";
const ajv = new Ajv2020({ allErrors: true, strict: false }), ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural") || name === "distinguishabilityRegime")) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(name), value);
const examples = await fixtures(), artifacts = await Promise.all(examples.map(f => readJson(`artifacts/${f.id}.json`)));
const get = id => artifacts[examples.findIndex(f => f.id === id)];
test("closed pseudometric schemas accept all 60 artifacts and complete embedded signatures", () => {
  for (const [i, f] of examples.entries()) {
    assert.equal(validate("structuralPseudometricInput", f.input), true, ajv.errorsText());
    assert.equal(validate("structuralPseudometricArtifact", artifacts[i]), true, `${f.id}: ${ajv.errorsText()}`);
  }
});
test("schemas and runtime reject unknown regimes, source scopes, modes and caller feature or mapping overrides", () => {
  for (const input of [{}, { regimeId: "unknown" }, { regimeId: "topology-only-v1", features: [] },
    { regimeId: "typed-relations-v1", vocabulary: {} }, { regimeId: "topology-only-v1", diagnostics: null },
    { regimeId: "topology-only-v1", leftScope: { kind: "induced", nodeIds: [] } },
    { regimeId: "typed-relations-v1", rightScope: { kind: "full", nodeIds: ["n0"] } }]) {
    assert.equal(validate("structuralPseudometricInput", input), false);
    assert.throws(() => compareStructuralSignatures(examples[0].left.pack, examples[0].right.pack, input));
  }
});
test("schemas reject noncanonical fractions, invented features, policy substitutions and false complete distances", () => {
  for (const mutate of [a => { a.distance = { numerator: 0, denominator: 3 }; }, a => { a.distance = 0; },
    a => { a.components.pop(); }, a => { a.components.reverse(); }, a => { a.profile.components[0].weight = 2; },
    a => { a.components[0].sourceNodeId = "x"; }, a => { a.components[0].state = "different"; },
    a => { a.components[0].left.valueHash += "\n"; }, a => { a.components[0].reasons = [{ side: "pair", code: "incompatible-domain", count: 1 }]; },
    a => { a.policy.scale = 2; }, a => { a.coverage.numerator = 0; }, a => { a.domains.compatible = false; },
    a => { a.domains.membership.left = "ineligible"; }, a => { a.evidence.left.features[0].value[0].count = 0; },
    a => { a.diagnostics.partial = { kind: "exploratory-pairwise-available-mean", guarantee: "none", coverage: a.coverage, value: a.distance }; }]) {
    const a = structuredClone(artifacts[0]); mutate(a); assert.equal(validate("structuralPseudometricArtifact", a), false, mutate.toString());
  }
  for (const id of ["partial-chain-self", "foreign-context", "empty-self"]) {
    const a = structuredClone(get(id)); a.distance = { numerator: 0, denominator: 1 }; a.status = "indistinguishable-under-signature";
    assert.equal(validate("structuralPseudometricArtifact", a), false);
  }
  const empty = structuredClone(get("empty-self")); empty.diagnostics.partial.value = { numerator: 0, denominator: 1 };
  assert.equal(validate("structuralPseudometricArtifact", empty), false);
});
test("browser verification rebuilds all 60 comparisons from both expected sources and complete upstream evidence", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/pseudometric.js", import.meta.url))], bundle: true,
    platform: "browser", format: "iife", globalName: "Pseudometric", write: false, logLevel: "silent" });
  const result = runInNewContext(`${bundle.outputFiles[0].text}\nconst values = JSON.parse(artifactText); JSON.stringify(JSON.parse(fixtureText).map(({left,right,input},i) =>
    Pseudometric.verifyStructuralPseudometric(values[i],left.pack,right.pack,input)));`,
  { artifactText: JSON.stringify(artifacts), fixtureText: JSON.stringify(examples), TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(result), artifacts);
});
