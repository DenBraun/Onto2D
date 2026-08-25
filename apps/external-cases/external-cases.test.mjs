import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  HISTORY_EFFECTS,
  HISTORY_MODES,
  caseNavigationDetail,
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
  assert.equal(cases.length, 24);
  assert.deepEqual(HISTORY_MODES.map((entry) => entry.id), ["recorded", "embodied", "reconstructed"]);
  assert.deepEqual(HISTORY_EFFECTS.map((entry) => entry.id), ["identity", "present-state", "future"]);
  assert.equal(new Set(cases.map((entry) => entry.caseId)).size, cases.length);
  assert.equal(cases.filter((entry) => entry.statusKind === "implemented").length, 21);
  assert.equal(cases.filter((entry) => entry.statusKind === "next").length, 0);
  assert.equal(historyCaseById(cases, "oci-layer-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "in-toto-admissibility").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "chemical-synthesis-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "reproducible-build-equivalence").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "artwork-provenance").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "historical-linguistics").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "manuscript-stemmatics").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "operational-aging").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "ecological-memory").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "legal-precedent-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "clinical-trajectories").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "galactic-archaeology").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "seshat-epistemic-provenance").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "material-process-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "mineral-formation-history").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "cell-lineage-identity").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "ltee-evolutionary-contingency").statusKind, "implemented");
  assert.equal(historyCaseById(cases, "airflow-dependency-constraints").statusKind, "implemented");
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

test("case navigation reserves maturity status for planned work and labels available cases by effect", () => {
  for (const entry of cases) {
    const detail = caseNavigationDetail(entry);
    if (entry.status === "PLANNED") {
      assert.deepEqual(detail, { kind: "status", label: "Planned", value: "planned" });
      continue;
    }
    assert.deepEqual(detail, {
      kind: "effect",
      label: HISTORY_EFFECTS.find(({ id }) => id === entry.primaryEffects[0]).label,
      value: entry.primaryEffects[0]
    });
    assert.notEqual(detail.label.toUpperCase(), entry.statusLabel);
  }
  assert.throws(() => caseNavigationDetail(null), /must be an object/);
  assert.throws(() => caseNavigationDetail({ ...cases[0], primaryEffects: [] }), /primary effect is invalid/);
});

test("hybrid cases retain multiple modes and effects", () => {
  const ltee = historyCaseById(cases, "ltee-evolutionary-contingency");
  assert.deepEqual(ltee.historyModes, ["embodied", "recorded", "reconstructed"]);
  assert.deepEqual(ltee.primaryEffects, ["future"]);
  assert.deepEqual(ltee.secondaryEffects, ["present-state", "identity"]);
  assert.equal(ltee.analyses.historicalLoad, "candidate");
  assert.equal(ltee.analyses.reachability, "primary");

  const airflow = historyCaseById(cases, "airflow-dependency-constraints");
  assert.deepEqual(airflow.historyModes, ["recorded"]);
  assert.deepEqual(airflow.primaryEffects, ["future"]);
  assert.deepEqual(airflow.secondaryEffects, ["identity"]);
  assert.equal(airflow.analyses.historicalLoad, "primary");
  assert.equal(airflow.analyses.reachability, "secondary");

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
    ["in-toto-admissibility", ["in-toto-provenance", "v1-647b20b320a109cc"]],
    ["chemical-synthesis-history", ["chemical-reaction-provenance", "v1-47225e07891b6f70"]],
    ["reproducible-build-equivalence", ["reproducible-build-equivalence", "v1-78148e4e627d2c9f"]],
    ["artwork-provenance", ["artwork-provenance", "v1-ca697f7318c611a9"]],
    ["historical-linguistics", ["language-transmission", "v1-557580b2872e9d7e"]],
    ["manuscript-stemmatics", ["manuscript-transmission", "v1-4581c6819fd2ab28"]],
    ["operational-aging", ["operational-aging", "v1-6b1c3008c8edc901"]],
    ["ecological-memory", ["ecological-memory", "v1-f4d78af8ab98228a"]],
    ["legal-precedent-history", ["legal-precedent-history", "v1-05958887a4ffef41"]],
    ["clinical-trajectories", ["clinical-trajectories", "v1-2360048548115b14"]],
    ["galactic-archaeology", ["galactic-archaeology", "v1-2f109fd8c5475426"]],
    ["material-process-history", ["material-process-history", "v1-0ea3ee56fe462eea"]],
    ["mineral-formation-history", ["mineral-formation-history", "v1-cefaa83457ac222c"]],
    ["cell-lineage-identity", ["cell-lineage-history", "v1-6e6ea7be0f576db7"]],
    ["ltee-evolutionary-contingency", ["ltee-lineage-history", "v1-e4ff96341b402b13"]],
    ["airflow-dependency-constraints", ["airflow-dependency-constraints", "v1-e702da2bbcc24ac5"]]
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
    assert.match(markup, /<strong>Mode \/ primary effect<\/strong>/);
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
  unsupportedMaturityClaim.cases.find((entry) => entry.caseId === "slsa-provenance-evidence").status = "MODEL_PACK";
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
