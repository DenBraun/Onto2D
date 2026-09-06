import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { build } from "esbuild";
import { schemaUrls } from "@onto2d/schemas";
import { STRUCTURAL_FLOW_POLICY, STRUCTURAL_FLOW_SOLVER, createStructuralFlowAnalyzer,
  prepareStructuralFlow, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { fixtures, readJson, rational as r } from "../../../cases/structural-geometry/flow/fixtures.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false }); const ids = new Map();
for (const [name, url] of Object.entries(schemaUrls).filter(([name]) => name.startsWith("structural"))) {
  const schema = JSON.parse(await readFile(url, "utf8")); ajv.addSchema(schema); ids.set(name, schema.$id);
}
const validate = (name, value) => ajv.validate(ids.get(`structuralFlow${name}`), value);

test("closed flow schemas cover every request, transport, state and frozen history", async () => {
  assert.equal(validate("Policy", STRUCTURAL_FLOW_POLICY), true, ajv.errorsText());
  for (const f of await fixtures()) {
    const artifact = await readJson(`artifacts/${f.id}.json`);
    for (const [name, value] of [["Input", f.input], ["Request", artifact.request], ["Artifact", artifact]]) {
      assert.equal(validate(name, value), true, `${f.id}: ${ajv.errorsText()}`);
    }
    let iteration = 0;
    const replay = createStructuralFlowAnalyzer({ ...STRUCTURAL_FLOW_SOLVER, evaluate(request) {
      assert.equal(validate("TransportRequest", request), true, ajv.errorsText());
      const state = artifact.states[iteration++];
      assert.equal(validate("State", state), true, ajv.errorsText());
      assert.equal(validate("TransportResponse", state.transportResponse), true, ajv.errorsText());
      return state.transportResponse;
    } });
    assert.deepEqual(await replay.analyze(f.pack, f.input), artifact);
  }
});

test("schemas reject unsupported policy, malformed rationals and unbound history", async () => {
  const original = await readJson("artifacts/path.json");
  for (const change of [
    (a) => { a.request.policy.distance = "undirected"; }, (a) => { delete a.model.manifestHash; },
    (a) => { a.request.parameters.scope = { kind: "full", nodeIds: [] }; }, (a) => { a.request.parameters.maxIterations = 25; },
    (a) => { a.request.parameters.initialLengths[0].length = r(-1); }, (a) => { a.request.parameters.cut = { kind: "dynamic" }; },
    (a) => { a.states = []; }, (a) => { a.states[0].edges[0].length = r(0); },
    (a) => { a.states[0].edges[0].curvature = r("-0"); }, (a) => { a.states[0].edges[0].wasserstein = r(-1); },
    (a) => { a.states[0].edges[0].length = r("1".repeat(257)); },
    (a) => { a.states[0].transportResponse.solutions[0].flow[0][0] = 0.5; },
    (a) => { a.states[0].transportResponse.solutions[0].sourcePotentials[0] = r(1, 0); },
    (a) => { a.termination.reason = "converged"; }, (a) => { a.extra = true; }
  ]) {
    const broken = structuredClone(original); change(broken); assert.equal(validate("Artifact", broken), false);
  }
});

test("browser verifies a full published flow trajectory without Node or Python", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/flow.js", import.meta.url))],
    bundle: true, platform: "browser", format: "iife", globalName: "Flow", write: false, logLevel: "silent" });
  const f = (await fixtures()).find((c) => c.id === "paper-g3-2"); const artifact = await readJson(`artifacts/${f.id}.json`);
  const result = runInNewContext(`${bundle.outputFiles[0].text}\nJSON.stringify({
    request: Flow.prepareStructuralFlow(JSON.parse(packText), JSON.parse(inputText)),
    artifact: Flow.verifyStructuralFlowArtifact(JSON.parse(artifactText), JSON.parse(packText), JSON.parse(inputText))
  });`, { packText: JSON.stringify(f.pack), inputText: JSON.stringify(f.input), artifactText: JSON.stringify(artifact),
    TextEncoder, TextDecoder, Uint8Array });
  assert.deepEqual(JSON.parse(result), { request: prepareStructuralFlow(f.pack, f.input),
    artifact: verifyStructuralFlowArtifact(artifact, f.pack, f.input) });
});
