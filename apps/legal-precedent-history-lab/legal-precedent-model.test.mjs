import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLegalPrecedentModel } from "./legal-precedent-model.js";

const artifactUrl = new URL("../../cases/legal-precedent-history/artifacts/legal-precedent-history.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("the browser model exposes the approved Green context", async () => {
  const model = createLegalPrecedentModel(await load());
  assert.equal(model.opinions.length, 7);
  assert.equal(model.citations.length, 16);
  assert.deepEqual(model.graph().opinions.map((opinion) => opinion.id), ["brown-i", "brown-ii", "cooper", "griffin", "green"]);
  assert.equal(model.graph().citations.length, 10);
  assert.deepEqual(model.graph().excludedFutureOpinionIds, ["alexander", "swann"]);
});

test("full record and counterfactual views cannot mutate the source graph", async () => {
  const model = createLegalPrecedentModel(await load());
  assert.deepEqual([model.graph({ fullRecord: true }).opinions.length, model.graph({ fullRecord: true }).citations.length], [7, 16]);
  const counterfactual = model.graph({ withholdBrownII: true });
  assert.deepEqual([counterfactual.opinions.length, counterfactual.citations.length], [4, 6]);
  assert.deepEqual([counterfactual.sourceOpinionCount, counterfactual.sourceCitationCount, counterfactual.sourceGraphMutated], [7, 16, false]);
});

test("the approved browser model is detached and deeply immutable", async () => {
  const artifact = await load();
  const model = createLegalPrecedentModel(artifact);
  artifact.opinions[0].shortName = "mutated input";
  assert.equal(model.opinion("brown-i").shortName, "Brown I");
  assert.throws(() => model.opinions.push({}), TypeError);
  assert.throws(() => model.graph().citations.pop(), TypeError);
  assert.throws(() => model.greenMatrix()[0].bindingStatus = "binding", TypeError);
});

test("citation matrix keeps treatment and binding status separate", async () => {
  const model = createLegalPrecedentModel(await load());
  assert.equal(model.greenMatrix().length, 4);
  assert.ok(model.greenMatrix().every((row) => row.citationRecorded && row.claim && row.bindingStatus === "unknown" && row.authorityFromCitationCount === false));
});

test("the browser model rejects future input and citation authority promotion", async () => {
  const future = await load();
  future.availability.futureInputEdgeCount = 1;
  assert.throws(() => createLegalPrecedentModel(future), /Green time slice differs/);
  const authority = await load();
  authority.citations[0].createsAuthority = true;
  assert.throws(() => createLegalPrecedentModel(authority), /citation chronology or semantics differ/);
});

test("the browser model rejects alternate releases and legal claims", async () => {
  const release = await load();
  release.caseIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => createLegalPrecedentModel(release), /case, source, or context release differs/);
  const advice = await load();
  advice.audit.legalAdviceGenerated = true;
  assert.throws(() => createLegalPrecedentModel(advice), /legal safety boundary differs/);
});
