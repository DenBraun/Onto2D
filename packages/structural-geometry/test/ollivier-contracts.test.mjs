import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { OLLIVIER_POLICY, prepareOllivierRequest, verifyOllivierArtifact } from "@onto2d/structural-geometry/ollivier";
import { controls, packFor, fixtures, readJson } from "../../../cases/structural-geometry/ollivier/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural"))) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(`structuralOllivier${name}`), value);

test("closed Ollivier schemas cover policies, requests, responses and every frozen artifact", async () => {
  assert.equal(validate("Policy", OLLIVIER_POLICY), true, ajv.errorsText());
  for (const fixture of await fixtures()) {
    const artifact = await readJson(`artifacts/${fixture.id}.json`);
    for (const [name, value] of [["Input", fixture.input], ["Request", artifact.request], ["Response", artifact.response], ["Artifact", artifact]]) {
      assert.equal(validate(name, value), true, `${fixture.id}: ${ajv.errorsText()}`);
    }
  }
});

test("schemas reject unsupported policy, malformed rational values, dimensions and unbound provenance", async () => {
  const artifact = await readJson("artifacts/unequal-mass-shortcuts-half.json");
  for (const change of [
    (a) => { a.request.policy.distance = "undirected"; }, (a) => { a.request.policy.idleness = ["zero"]; },
    (a) => { delete a.model.manifestHash; }, (a) => { a.request.scope.kind = "sampled"; },
    (a) => { a.request.parameters.idleness = 0.5; }, (a) => { a.request.parameters.edgeIds = []; },
    (a) => { a.request.parameters.scope = { kind: "full", nodeIds: [] }; },
    (a) => { a.request.problems[0].sourceMeasure[0].units = 0; },
    (a) => { a.request.problems[0].costs[0][0] = null; },
    (a) => { a.response.solutions[0].flow[0][0] = -1; },
    (a) => { a.response.solutions[0].sourcePotentials[0] = 4097; },
    (a) => { a.result.edges[0].curvature.numerator = "-0"; },
    (a) => { a.result.edges[0].curvature.denominator = "0"; },
    (a) => { a.result.edges[0].wasserstein.numerator = "-1"; },
    (a) => { a.extra = "unsupported"; }
  ]) {
    const broken = structuredClone(artifact); change(broken);
    assert.equal(validate("Artifact", broken), false);
  }
});

test("browser bundle prepares exact requests and verifies Python certificates without a native solver", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/ollivier.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Ollivier", write: false, logLevel: "silent" });
  const graph = controls.find((g) => g.id === "unequal-mass-shortcuts");
  const pack = packFor(graph); const input = { edgeIds: graph.edgeIds, idleness: "half" };
  const artifact = await readJson("artifacts/unequal-mass-shortcuts-half.json");
  const output = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify({
    request: Ollivier.prepareOllivierRequest(JSON.parse(packText), JSON.parse(inputText)),
    artifact: Ollivier.verifyOllivierArtifact(JSON.parse(artifactText), JSON.parse(packText), JSON.parse(inputText))
  });`, { packText: JSON.stringify(pack), inputText: JSON.stringify(input), artifactText: JSON.stringify(artifact),
    TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(output), { request: prepareOllivierRequest(pack, input), artifact: verifyOllivierArtifact(artifact, pack, input) });
});
