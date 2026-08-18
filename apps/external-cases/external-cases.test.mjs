import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  HISTORY_EFFECTS,
  HISTORY_MODES,
  createHistoryCases,
  historyCaseById,
  modelStudioHref,
  validateHistoryRegistry
} from "./external-cases-catalog.js";

const appRoot = new URL("./", import.meta.url);
const repositoryRoot = new URL("../../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("../../cases/history-case-registry.json", import.meta.url), "utf8"));
const cases = createHistoryCases(registry);

test("the history portfolio is complete, stable, and status-honest", async () => {
  assert.equal(cases.length, 22);
  assert.deepEqual(HISTORY_MODES.map((entry) => entry.id), ["recorded", "embodied", "reconstructed"]);
  assert.deepEqual(HISTORY_EFFECTS.map((entry) => entry.id), ["identity", "present-state", "future"]);
  assert.equal(new Set(cases.map((entry) => entry.caseId)).size, cases.length);
  assert.equal(cases.filter((entry) => entry.statusKind === "implemented").length, 5);
  assert.equal(cases.filter((entry) => entry.statusKind === "next").length, 1);
  assert.equal(historyCaseById(cases, "oci-layer-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "in-toto-admissibility").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "reproducible-build-equivalence").statusKind, "next");
  assert.equal(historyCaseById(cases, "slsa-provenance-evidence").caseId, "slsa-provenance-evidence");
  assert.equal(historyCaseById(cases, "missing"), null);

  for (const entry of cases) {
    await access(new URL(`${entry.caseId}/index.html`, appRoot));
    await access(new URL(entry.implementationDoc, repositoryRoot));
    assert.ok(entry.question.endsWith("?"));
    assert.ok(entry.boundaries.length >= 4);
    assert.ok(entry.outputs.length >= 4);
    assert.ok(entry.historyModes.includes(entry.primaryHistoryMode));
  }
});

test("hybrid cases retain multiple modes and effects", () => {
  const ltee = historyCaseById(cases, "ltee-evolutionary-contingency");
  assert.deepEqual(ltee.historyModes, ["embodied", "recorded", "reconstructed"]);
  assert.deepEqual(ltee.primaryEffects, ["future"]);
  assert.deepEqual(ltee.secondaryEffects, ["present-state", "identity"]);
  assert.equal(ltee.analyses.reachability, "primary");

  const clinical = historyCaseById(cases, "clinical-trajectories");
  assert.deepEqual(clinical.primaryEffects, ["present-state", "future"]);
  assert.equal(clinical.analyses.reachability, "descriptive-only");

  const gapMembers = cases.filter((entry) => entry.historyModes.includes("reconstructed")
    && entry.matrixPlacements.some((placement) => placement.mode === "reconstructed" && placement.effect === "future"));
  assert.deepEqual(gapMembers, []);
  assert.ok(ltee.historyModes.includes("reconstructed"));
});

test("implemented case links select one exact registered Model Studio release", () => {
  const expected = new Map([
    ["live-bootstrap-provenance", ["live-bootstrap-provenance", "v2-e4fc1639ab73d7c7"]],
    ["nix-derivation-identity", ["nix-derivations", "v1-2d5b844afa08e0ed"]],
    ["oci-layer-history", ["oci-layer-provenance", "v1-5a869be659e73799"]],
    ["in-toto-admissibility", ["in-toto-provenance", "v1-647b20b320a109cc"]]
  ]);
  for (const entry of cases) {
    const url = new URL(modelStudioHref(entry, "https://onto2d.dev/project/"));
    assert.equal(url.pathname, "/project/apps/model-studio/");
    const selection = expected.get(entry.caseId);
    if (selection) {
      const parameters = new URLSearchParams(url.hash.slice(1));
      assert.deepEqual([parameters.get("model"), parameters.get("version")], selection);
    } else {
      assert.equal(url.hash, "");
    }
  }
});

test("case pages use the shared registry renderer and expose taxonomy hooks", async () => {
  const rendererSources = new Set();
  for (const entry of cases) {
    const markup = await readFile(new URL(`${entry.caseId}/index.html`, appRoot), "utf8");
    assert.match(markup, new RegExp(`<body[^>]+data-case-id=["']${entry.caseId}["']`));
    const renderer = markup.match(/<script type="module" src="(\.\.\/external-cases\.js\?v=\d{8}\.\d+)"><\/script>/)?.[1];
    assert.ok(renderer, `${entry.caseId} is missing the cache-versioned shared renderer`);
    rendererSources.add(renderer);
    for (const id of [
      "case-history-modes",
      "case-effects",
      "case-evidence",
      "case-analyses",
      "case-contribution",
      "case-boundaries",
      "case-outputs",
      "case-sequence"
    ]) {
      assert.match(markup, new RegExp(`id=["']${id}["']`), `${entry.caseId} missing #${id}`);
    }
  }
  assert.equal(rendererSources.size, 1, "case pages use different shared-renderer revisions");
});

test("browser validation enforces the complete render-sensitive registry contract", () => {
  assert.equal(validateHistoryRegistry(registry), registry);
  const duplicate = structuredClone(registry);
  duplicate.cases.push(structuredClone(duplicate.cases[0]));
  assert.throws(() => validateHistoryRegistry(duplicate), /duplicate caseId/);
  const unknown = structuredClone(registry);
  unknown.cases[0].caseId = "not-presented";
  assert.throws(() => validateHistoryRegistry(unknown), /missing presentation/);

  const extraField = structuredClone(registry);
  extraField.cases[0].unexpected = true;
  assert.throws(() => validateHistoryRegistry(extraField), /fields must be exactly/);

  const unsafeCasePath = structuredClone(registry);
  unsafeCasePath.cases[0].casePagePath = "javascript:alert(1)";
  assert.throws(() => validateHistoryRegistry(unsafeCasePath), /casePagePath is unsafe/);

  const unsafeExplorerPath = structuredClone(registry);
  unsafeExplorerPath.cases[0].explorerPath = "javascript:alert(1)";
  assert.throws(() => validateHistoryRegistry(unsafeExplorerPath), /explorerPath is not a safe apps directory/);

  const invalidStatus = structuredClone(registry);
  invalidStatus.cases[0].status = "DONE";
  assert.throws(() => validateHistoryRegistry(invalidStatus), /status is invalid/);

  const unsupportedMaturityClaim = structuredClone(registry);
  unsupportedMaturityClaim.cases.find((entry) => entry.caseId === "reproducible-build-equivalence").status = "MODEL_PACK";
  assert.throws(() => validateHistoryRegistry(unsupportedMaturityClaim), /claims MODEL_PACK without modelPackPath/);

  const incompleteModelSelection = structuredClone(registry);
  incompleteModelSelection.cases[0].modelVersion = null;
  assert.throws(() => validateHistoryRegistry(incompleteModelSelection), /without an exact model selection/);

  const detachedModelVersion = structuredClone(registry);
  detachedModelVersion.cases[1].modelVersion = "v1-unregistered";
  assert.throws(() => validateHistoryRegistry(detachedModelVersion), /modelVersion without modelPackPath/);

  const invalidPlacement = structuredClone(registry);
  invalidPlacement.cases[0].matrixPlacements[0].mode = "not-a-mode";
  assert.throws(() => validateHistoryRegistry(invalidPlacement), /matrixPlacements\.mode is invalid/);

  const inconsistentPlacement = structuredClone(registry);
  inconsistentPlacement.cases[0].matrixPlacements[0].role = "secondary";
  assert.throws(() => validateHistoryRegistry(inconsistentPlacement), /missing its primary matrix placement/);
});
