import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalize } from "@onto2d/kernel";
import { loadModelPackDirectory } from "@onto2d/model-pack/node";
import { Onto2D, bundledCausalEmergenceModelPack } from "onto2d";
import {
  IDENTITY_SCENARIOS,
  TRIANGLE_SKELETON_ID,
  inputView
} from "../../apps/canonical-identity-lab/identity-model.js";
import { buildCausalEmergenceRelease } from "../../models/causal-emergence/build.mjs";
import { buildCanonicalRelease } from "../../models/causal-emergence/canonical/build.mjs";

test("the root facade loads the exact bundled Causal Emergence Model Pack", async () => {
  const onto = await Onto2D.create();
  assert.equal(onto.model.name, "Causal Emergence — Canonical Reconstruction");
  assert.equal(onto.model.version, "2026.09.12.4");
  assert.equal(onto.modelResolution.requested, "causal-emergence@stable");
  assert.equal(onto.modelResolution.exact, "causal-emergence@2026.09.12.4");
  assert.equal(onto.model.nodes().length, 56);
  assert.equal(onto.model.edges().length, 60);
  assert.equal(onto.model.get("l0:crt-node").name, "CRT carrier class — no admitted instance");
  assert.equal(onto.model.get("R-object").parents().length, 5);
  assert.equal(onto.model.edges({ relationLayer: "descriptive" }).length, 48);
  assert.ok(onto.model.query({ level: 0, typeRole: "construction-rule" }).length > 0);
  assert.ok(onto.model.paths({ from: "l0:oscillatory-mode", to: "l0:crt-node" }).length > 0);
  assert.equal(canonicalize(await buildCanonicalRelease()), canonicalize(bundledCausalEmergenceModelPack));
});

test("the historical exact version remains selectable with its original identity and semantics", async () => {
  const onto = await Onto2D.create({ model: "causal-emergence@2026.08.15" });
  assert.equal(onto.model.nodes().length, 249);
  assert.equal(onto.model.edges().length, 971);
  assert.equal(onto.model.get("0.8").name, "Resonant Localized Configuration (CRT-Node)");
  assert.equal(onto.model.get("0.8").parents().length, 7);
  assert.equal(onto.model.edges({ relationLayer: "source-parent" }).length, 971);
  assert.ok(onto.model.query({ level: 0, phase: "C", typeRole: "Object" }).length > 0);
  assert.ok(onto.model.paths({ from: "0.0", to: "0.8" }).length > 0);
});

test("the first canonical exact version remains selectable alongside the new default", async () => {
  const onto = await Onto2D.create({ model: "causal-emergence@2026.09.11" });
  assert.equal(onto.model.nodes().length, 33);
  assert.equal(onto.model.edges().length, 23);
  assert.equal(onto.model.get("R-object").parents().length, 4);
});

test("the Level-0 relation-review edition remains selectable after the retinal pilot", async () => {
  const onto = await Onto2D.create({ model: "causal-emergence@2026.09.12" });
  assert.equal(onto.model.nodes().length, 34);
  assert.equal(onto.model.edges().length, 42);
  assert.equal(onto.model.get("ret:photochemistry"), undefined);
});

test("both retinal pilot editions remain selectable after conditional routing", async () => {
  for (const version of ["2026.09.12.1", "2026.09.12.2"]) {
    const onto = await Onto2D.create({ model: `causal-emergence@${version}` });
    assert.equal(onto.model.nodes().length, 50);
    assert.equal(onto.model.edges().length, 57);
    assert.equal(onto.model.get("ret:primate-off-readout"), undefined);
  }
});

test("the historical release is an exact reproduction of preserved source bytes", async () => {
  const rebuilt = await buildCausalEmergenceRelease();
  const stored = JSON.parse(await readFile(new URL("../../models/causal-emergence/releases/2026.08.15/bundle.json", import.meta.url), "utf8"));
  assert.equal(canonicalize(rebuilt), canonicalize(stored));
  assert.equal(rebuilt.manifest.statistics.nodeCount, 249);
  assert.equal(rebuilt.manifest.statistics.edgeCount, 971);
  assert.equal(rebuilt.manifest.model.status, "source-snapshot-known-findings");

  const expectedAudit = JSON.parse(await readFile(
    new URL("../fixtures/catalogue-audit.expected.json", import.meta.url),
    "utf8"
  ));
  assert.equal(expectedAudit.summary.weightSumAnomalyCount, 3);
  assert.equal(expectedAudit.summary.nontrivialSccCount, 3);
});

test("the bounded Node loader accepts the committed split Causal Emergence release", async () => {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const loaded = await loadModelPackDirectory(
    path.join(repositoryRoot, "models", "causal-emergence", "releases", "2026.09.12.4")
  );
  assert.equal(loaded.manifest.rootHash, bundledCausalEmergenceModelPack.manifest.rootHash);
  assert.equal(loaded.manifest.manifestHash, bundledCausalEmergenceModelPack.manifest.manifestHash);
});

test("the default engine analysis replays the Canonical Identity Lab fixture", async () => {
  const onto = await Onto2D.create();
  assert.equal(onto.analyses()[0].id, "canonical-identity");
  const view = inputView("base", 4, true);
  const artifact = await onto.analyze("canonical-identity", {
    candidate: {
      domain: "single-candidate",
      nodes: view.nodes,
      edges: view.edges
    }
  });
  assert.equal(artifact.result.candidateId, IDENTITY_SCENARIOS.base.candidateId);
  assert.equal(artifact.result.skeletonId, TRIANGLE_SKELETON_ID);
  assert.equal(artifact.model.modelRootHash, bundledCausalEmergenceModelPack.manifest.rootHash);
});

test("the root facade rejects option accessors without invoking them", async () => {
  let reads = 0;
  const options = {};
  Object.defineProperty(options, "models", {
    enumerable: true,
    get() {
      reads += 1;
      return [];
    }
  });
  await assert.rejects(() => Onto2D.create(options), TypeError);
  assert.equal(reads, 0);
});
