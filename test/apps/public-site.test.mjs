import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
const assertReadableInterfaceText = (styles, label) => {
  assert.doesNotMatch(styles, /font-size:\s*(?:[1-9]|1[01])px/, `${label} contains text below 12px`);
  assert.doesNotMatch(styles, /font\s*:[^;{}]*\b(?:[1-9]|1[01])px(?:\/|\s|;)/, `${label} contains shorthand text below 12px`);
};
const landing = read("index.html");
const landingStyles = read("assets/css/project-home.css");
const iconStyles = read("assets/css/ui-icons.css");
const motifMarkup = read("apps/three-node-motif-explorer/index.html");
const motifApp = read("apps/three-node-motif-explorer/network-motif-study.js");
const motifStyles = read("assets/css/study-network-motifs.css");
const identityMarkup = read("apps/canonical-identity-lab/index.html");
const identityApp = read("apps/canonical-identity-lab/identity-lab.js");
const levelZeroMarkup = read("apps/level-zero-validation/index.html");
const levelZeroApp = read("apps/level-zero-validation/level-zero-study.js");
const levelZeroStyles = read("assets/css/study-level-zero.css");
const studioMarkup = read("apps/model-studio/index.html");
const studioApp = read("apps/model-studio/model-studio.js");
const studioStyles = read("assets/css/model-studio-workbench.css");
const bootstrapMarkup = read("apps/bootstrap-provenance-explorer/index.html");
const bootstrapApp = read("apps/bootstrap-provenance-explorer/bootstrap-provenance-explorer.js");
const bootstrapModel = read("apps/bootstrap-provenance-explorer/bootstrap-provenance-model.js");
const bootstrapStyles = read("assets/css/study-bootstrap-provenance.css");
const externalCasesMarkup = read("apps/external-cases/index.html");
const externalCasesApp = read("apps/external-cases/external-cases.js");
const externalCasesCatalog = read("apps/external-cases/external-cases-catalog.js");
const externalCasesStyles = read("assets/css/external-cases.css");
const historyCaseHeaderStyles = read("assets/css/history-case-header.css");
const historyAtlasMarkup = read("apps/history-atlas/index.html");
const historyAtlasApp = read("apps/history-atlas/history-atlas.js");
const historyAtlasStyles = read("assets/css/history-atlas.css");
const historyCaseRegistry = JSON.parse(read("cases/history-case-registry.json"));
const gitHistoryMarkup = read("apps/git-history-identity-lab/index.html");
const gitHistoryApp = read("apps/git-history-identity-lab/git-history-lab.js");
const gitHistoryModel = read("apps/git-history-identity-lab/git-history-model.js");
const gitHistoryStyles = read("assets/css/study-git-history.css");
const gitHistoryArtifact = read("cases/git-history-identity/artifacts/history-identity.json");
const nixMarkup = read("apps/nix-derivation-explorer/index.html");
const nixApp = read("apps/nix-derivation-explorer/nix-derivation-lab.js");
const nixModel = read("apps/nix-derivation-explorer/nix-derivation-model.js");
const nixStyles = read("assets/css/study-nix-derivation.css");
const nixArtifact = read("cases/nix-derivation-identity/artifacts/nix-derivation-identity.json");
const ociMarkup = read("apps/oci-layer-history-lab/index.html");
const ociApp = read("apps/oci-layer-history-lab/oci-layer-history-lab.js");
const ociModel = read("apps/oci-layer-history-lab/oci-layer-history-model.js");
const ociStyles = read("assets/css/study-oci-layer-history.css");
const ociArtifact = read("cases/oci-layer-history/artifacts/oci-layer-history.json");
const inTotoMarkup = read("apps/in-toto-admissibility-explorer/index.html");
const inTotoApp = read("apps/in-toto-admissibility-explorer/in-toto-admissibility-explorer.js");
const inTotoModel = read("apps/in-toto-admissibility-explorer/in-toto-admissibility-model.js");
const inTotoStyles = read("assets/css/study-in-toto-admissibility.css");
const inTotoArtifact = read("cases/in-toto-admissibility/artifacts/in-toto-admissibility.json");
const chemicalMarkup = read("apps/synthesis-route-explorer/index.html");
const chemicalApp = read("apps/synthesis-route-explorer/synthesis-route-explorer.js");
const chemicalModel = read("apps/synthesis-route-explorer/chemical-synthesis-model.js");
const chemicalStyles = read("assets/css/study-chemical-synthesis.css");
const chemicalArtifact = read("cases/chemical-synthesis-history/artifacts/chemical-synthesis-history.json");
const buildEquivalenceMarkup = read("apps/history-equivalence-lab/index.html");
const buildEquivalenceApp = read("apps/history-equivalence-lab/history-equivalence-lab.js");
const buildEquivalenceModel = read("apps/history-equivalence-lab/history-equivalence-model.js");
const buildEquivalenceStyles = read("assets/css/study-history-equivalence.css");
const buildEquivalenceArtifact = read("cases/reproducible-build-equivalence/artifacts/reproducible-build-equivalence.json");
const artworkMarkup = read("apps/artwork-provenance-identity-lab/index.html");
const artworkApp = read("apps/artwork-provenance-identity-lab/artwork-provenance-explorer.js");
const artworkModel = read("apps/artwork-provenance-identity-lab/artwork-provenance-model.js");
const artworkStyles = read("assets/css/study-artwork-provenance.css");
const artworkArtifact = read("cases/getty-artwork-provenance/artifacts/getty-artwork-provenance.json");
const languageMarkup = read("apps/language-lineage-borrowing-lab/index.html");
const languageApp = read("apps/language-lineage-borrowing-lab/language-lineage-borrowing-lab.js");
const languageModel = read("apps/language-lineage-borrowing-lab/language-transmission-model.js");
const languageStyles = read("assets/css/study-language-transmission.css");
const languageArtifact = read("cases/historical-linguistics/artifacts/historical-linguistics.json");
const manuscriptMarkup = read("apps/textual-transmission-lab/index.html");
const manuscriptApp = read("apps/textual-transmission-lab/textual-transmission-lab.js");
const manuscriptModel = read("apps/textual-transmission-lab/manuscript-transmission-model.js");
const manuscriptStyles = read("assets/css/study-manuscript-transmission.css");
const manuscriptArtifact = read("cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json");
const operationalMarkup = read("apps/operational-aging-lab/index.html");
const operationalApp = read("apps/operational-aging-lab/operational-aging-lab.js");
const operationalModel = read("apps/operational-aging-lab/operational-aging-model.js");
const operationalStyles = read("assets/css/study-operational-aging.css");
const operationalArtifact = read("cases/operational-aging/artifacts/operational-aging.json");
const ecologicalMarkup = read("apps/ecological-memory-lab/index.html");
const ecologicalApp = read("apps/ecological-memory-lab/ecological-memory-lab.js");
const ecologicalModel = read("apps/ecological-memory-lab/ecological-memory-model.js");
const ecologicalStyles = read("assets/css/study-ecological-memory.css");
const ecologicalArtifact = read("cases/ecological-memory/artifacts/ecological-memory.json");
const legalMarkup = read("apps/legal-precedent-history-lab/index.html");
const legalApp = read("apps/legal-precedent-history-lab/legal-precedent-history-lab.js");
const legalModel = read("apps/legal-precedent-history-lab/legal-precedent-model.js");
const legalStyles = read("assets/css/study-legal-precedent.css");
const legalArtifact = read("cases/legal-precedent-history/artifacts/legal-precedent-history.json");
const historyCasePageMarkups = historyCaseRegistry.cases.map((entry) => read(`${entry.casePagePath}index.html`));
const modelPackWorker = read("assets/js/model-pack-worker.js");
const siteServer = read("apps/historical-load-explorer/serve.mjs");
const documentLifecycle = read("assets/js/document-state-reset.js");
const caseMenuScript = read("assets/js/case-menu.js");
const iconSprite = read("assets/icons/ui-symbols.svg");
const publicDirectories = [
  "apps/historical-load-explorer",
  "apps/three-node-motif-explorer",
  "apps/canonical-identity-lab",
  "apps/level-zero-validation",
  "apps/model-studio",
  "apps/bootstrap-provenance-explorer",
  "apps/git-history-identity-lab",
  "apps/nix-derivation-explorer",
  "apps/oci-layer-history-lab",
  "apps/in-toto-admissibility-explorer",
  "apps/synthesis-route-explorer",
  "apps/history-equivalence-lab",
  "apps/artwork-provenance-identity-lab",
  "apps/language-lineage-borrowing-lab",
  "apps/textual-transmission-lab",
  "apps/operational-aging-lab",
  "apps/ecological-memory-lab",
  "apps/legal-precedent-history-lab",
  "apps/history-atlas",
  "apps/external-cases",
  ...historyCaseRegistry.cases.map((entry) => entry.casePagePath.replace(/\/$/, ""))
];
const publicFiles = [
  "index.html",
  "assets/css/ui-icons.css",
  "assets/css/project-home.css",
  "assets/css/study-historical-load.css",
  "assets/css/study-network-motifs.css",
  "assets/css/study-canonical-identity.css",
  "assets/css/study-level-zero.css",
  "assets/css/model-studio-workbench.css",
  "assets/css/study-bootstrap-provenance.css",
  "assets/css/study-git-history.css",
  "assets/css/study-nix-derivation.css",
  "assets/css/study-oci-layer-history.css",
  "assets/css/study-in-toto-admissibility.css",
  "assets/css/study-chemical-synthesis.css",
  "assets/css/study-history-equivalence.css",
  "assets/css/study-artwork-provenance.css",
  "assets/css/study-language-transmission.css",
  "assets/css/study-manuscript-transmission.css",
  "assets/css/study-operational-aging.css",
  "assets/css/study-ecological-memory.css",
  "assets/css/study-legal-precedent.css",
  "assets/css/external-cases.css",
  "assets/css/history-case-header.css",
  "assets/css/history-atlas.css",
  "assets/js/document-state-reset.js",
  "assets/js/case-menu.js",
  "assets/js/model-pack-worker.js",
  "assets/icons/ui-symbols.svg",
  "assets/icons/onto2d-mark.svg",
  "models/registry.json",
  "cases/history-case-registry.json",
  "cases/history-case-registry.schema.json",
  "cases/nix-derivation-identity/artifacts/nix-derivation-identity.json",
  "cases/oci-layer-history/artifacts/oci-layer-history.json",
  "cases/in-toto-admissibility/artifacts/in-toto-admissibility.json",
  "cases/chemical-synthesis-history/artifacts/chemical-synthesis-history.json",
  "cases/reproducible-build-equivalence/artifacts/reproducible-build-equivalence.json",
  "cases/getty-artwork-provenance/artifacts/getty-artwork-provenance.json",
  "cases/historical-linguistics/artifacts/historical-linguistics.json",
  "cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json",
  "cases/operational-aging/artifacts/operational-aging.json",
  "cases/ecological-memory/artifacts/ecological-memory.json",
  "cases/legal-precedent-history/artifacts/legal-precedent-history.json",
  ...publicDirectories.flatMap((directory) => readdirSync(
    new URL(`../../${directory}/`, import.meta.url)
  ).filter((name) => /\.(?:css|html|js|json|md|mjs)$/.test(name)).map((name) => `${directory}/${name}`))
];

function assertScriptIdsExist(script, markup) {
  const ids = [...script.matchAll(/\$\("#([^"']+)"\)/g)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    assert.match(markup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
}

test("the root keeps three study lenses and exposes the registry-backed Case Studies menu", () => {
  assert.doesNotMatch(landing, /http-equiv="refresh"/i);
  assert.match(landingStyles, /html,body\s*\{[^}]*overflow:hidden/s);
  const studyLinks = [...landing.matchAll(/class="study-card[^"']*" href="([^"]+)"/g)]
    .map((match) => match[1].split("?")[0]);
  assert.deepEqual(studyLinks, [
    "./apps/historical-load-explorer/",
    "./apps/three-node-motif-explorer/",
    "./apps/canonical-identity-lab/"
  ]);
  assert.match(landing, /href="\.\/apps\/level-zero-validation\/(?:\?v=[^"]+)?"/);
  assert.match(landing, /href="\.\/apps\/model-studio\/(?:\?v=[^"]+)?"/);
  assert.match(landing, /<details class="cases-menu">/);
  assert.match(landing, /type="module" src="\.\/assets\/js\/case-menu\.js\?v=20260818\.3"/);
  assert.match(landing, /href="\.\/apps\/history-atlas\/"/);
  assert.match(landing, /id="history-case-menu-groups"/);
  assert.match(landing, />Case Studies <svg/);
  assert.match(landingStyles, /\.cases-menu-panel>\.cases-menu-overview\s*\{[^}]*padding:15px 18px/s);
  assert.match(landing, /Make complex-system claims/);
  assert.match(caseMenuScript, /loadHistoryRegistry\(\)/);
  assert.match(caseMenuScript, /createHistoryCases/);
  assert.match(caseMenuScript, /entry\.primaryHistoryMode === mode\.id/);
  assert.match(caseMenuScript, /!caseMenu\.contains\(event\.target\)/);
  assert.match(caseMenuScript, /event\.key !== "Escape"/);
});

test("the History Atlas exposes the validated 3 x 3 portfolio and honest availability", () => {
  assert.equal(historyCaseRegistry.cases.length, 22);
  assert.deepEqual(historyCaseRegistry.historyModes, ["recorded", "embodied", "reconstructed"]);
  assert.deepEqual(historyCaseRegistry.effects, ["identity", "present-state", "future"]);
  assert.match(historyAtlasMarkup, /id="history-matrix"/);
  assert.match(historyAtlasMarkup, /id="history-portfolio"/);
  assert.match(historyAtlasMarkup, /id="filter-evidence"/);
  assert.match(historyAtlasMarkup, /id="filter-load"/);
  assert.match(historyAtlasMarkup, /id="filter-model"/);
  assert.match(historyAtlasApp, /HISTORY_MODES\.map/);
  assert.match(historyAtlasApp, /HISTORY_EFFECTS/);
  assert.match(historyAtlasApp, /entry\.modelPackPath !== null/);
  assert.match(historyAtlasApp, /Explicit research gap/);
  assert.match(externalCasesMarkup, /rel="canonical" href="\.\.\/history-atlas\/"/);
  assert.match(externalCasesApp, /loadHistoryRegistry\(\)/);
  assert.match(externalCasesApp, /This page describes a bounded research design/);
  assert.match(externalCasesCatalog, /MAX_REGISTRY_BYTES/);
  assert.match(externalCasesStyles, /\.case-sequence/);
  assert.match(externalCasesStyles, /\.taxonomy-panel/);
  assert.match(externalCasesStyles, /max-height:calc\(100vh - 108px\)/);
  assert.match(historyAtlasStyles, /\.history-matrix/);
  assert.match(historyAtlasStyles, /\.history-portfolio/);
  assert.doesNotMatch(historyAtlasStyles, /font(?:-size)?:\s*(?:[0-9]|1[01])px/);
  assert.match(externalCasesStyles, /@media \(max-width:760px\)/);
});

test("all History case surfaces share one header component and navigation layout", () => {
  const surfaces = [
    historyAtlasMarkup,
    externalCasesMarkup,
    bootstrapMarkup,
    gitHistoryMarkup,
    nixMarkup,
    ociMarkup,
    inTotoMarkup,
    chemicalMarkup,
    buildEquivalenceMarkup,
    artworkMarkup,
    languageMarkup,
    manuscriptMarkup,
    operationalMarkup,
    ecologicalMarkup,
    legalMarkup,
    ...historyCasePageMarkups
  ];
  for (const markup of surfaces) {
    assert.match(markup, /<header class="history-case-header">/);
    assert.match(markup, /class="history-case-brand"/);
    assert.match(markup, /class="history-case-nav" aria-label="History navigation"/);
    assert.match(markup, /class="history-case-context"/);
    assert.match(markup, />History Atlas<\/a>/);
    assert.match(markup, />Model Studio<\/a>/);
    assert.match(markup, />History model <svg class="ui-icon" aria-hidden="true">/);
    assert.doesNotMatch(markup, /<header class="(?:case-site-header|site-header)">/);
  }
  assert.match(historyCaseHeaderStyles, /grid-template-columns:\s*minmax\(190px, 1fr\) auto minmax\(190px, 1fr\)/);
  assert.match(historyCaseHeaderStyles, /@media \(max-width: 700px\)/);
  for (const styles of [externalCasesStyles, bootstrapStyles, gitHistoryStyles, nixStyles, ociStyles, inTotoStyles, chemicalStyles, buildEquivalenceStyles, artworkStyles, languageStyles, manuscriptStyles, operationalStyles, ecologicalStyles, legalStyles]) {
    assert.match(styles, /@import url\("\.\/history-case-header\.css\?v=20260818\.2"\);/);
  }
  for (const markup of [chemicalMarkup, buildEquivalenceMarkup, artworkMarkup, languageMarkup, manuscriptMarkup, operationalMarkup, ecologicalMarkup, legalMarkup]) {
    assert.match(markup, /<div class="history-case-context"><span>[^<]+<\/span><strong class="history-case-state"><i><\/i><span id="load-state" role="status" aria-live="polite">Verifying artifact<\/span><\/strong><\/div>/);
  }
});

test("case-aware Model Studio links select the exact registered release", () => {
  assert.match(bootstrapMarkup, /model-studio\/#model=live-bootstrap-provenance&amp;version=v2-e4fc1639ab73d7c7/);
  assert.match(nixMarkup, /model-studio\/#model=nix-derivations&amp;version=v1-2d5b844afa08e0ed/);
  assert.match(ociMarkup, /model-studio\/#model=oci-layer-provenance&amp;version=v1-5a869be659e73799/);
  assert.match(inTotoMarkup, /model-studio\/#model=in-toto-provenance&amp;version=v1-647b20b320a109cc/);
  assert.match(chemicalMarkup, /model-studio\/#model=chemical-reaction-provenance&amp;version=v1-47225e07891b6f70/);
  assert.match(buildEquivalenceMarkup, /model-studio\/#model=reproducible-build-equivalence&amp;version=v1-78148e4e627d2c9f/);
  assert.match(artworkMarkup, /model-studio\/#model=artwork-provenance&amp;version=v1-ca697f7318c611a9/);
  assert.match(languageMarkup, /model-studio\/#model=language-transmission&amp;version=v1-557580b2872e9d7e/);
  assert.match(manuscriptMarkup, /model-studio\/#model=manuscript-transmission&amp;version=v1-4581c6819fd2ab28/);
  assert.match(operationalMarkup, /model-studio\/#model=operational-aging&amp;version=v1-6b1c3008c8edc901/);
  assert.match(ecologicalMarkup, /model-studio\/#model=ecological-memory&amp;version=v1-f4d78af8ab98228a/);
  assert.match(legalMarkup, /model-studio\/#model=legal-precedent-history&amp;version=v1-05958887a4ffef41/);
  assert.match(externalCasesApp, /studio\.href = modelStudioHref\(entry, PROJECT_ROOT\)/);
  assert.match(externalCasesApp, /studioNavigation\.href = modelStudioHref\(entry, PROJECT_ROOT\)/);
  assert.match(externalCasesCatalog, /url\.hash = new URLSearchParams\(\{ model: entry\.modelId, version: entry\.modelVersion \}\)\.toString\(\)/);
});

test("public Markdown actions open rendered GitHub documents instead of local downloads", () => {
  for (const file of publicFiles.filter((entry) => entry.endsWith(".html"))) {
    const markup = read(file);
    for (const match of markup.matchAll(/<a\b[^>]*href="([^"]+\.md)"[^>]*>[\s\S]*?<\/a>/g)) {
      assert.match(match[1], /^https:\/\/github\.com\/DenBraun\/Onto2D\/blob\/main\//, `${file} keeps a local Markdown link`);
      assert.match(match[0], /target="_blank"/);
      assert.match(match[0], /rel="noopener noreferrer"/);
      assert.match(match[0], /ui-symbols\.svg#external-link/);
    }
  }
  assert.match(externalCasesApp, /GITHUB_BLOB_ROOT/);
  assert.match(externalCasesApp, /documentLink\.target = "_blank"/);
  assert.match(externalCasesApp, /documentLink\.append\(externalLinkIcon\(\)\)/);
  assert.match(siteServer, /"\.md": "text\/markdown; charset=utf-8"/);
});

test("case navigation switches content without resetting page or sidebar scroll", () => {
  assert.match(externalCasesApp, /link\.dataset\.caseId = entry\.caseId/);
  assert.match(externalCasesApp, /if \(!navigation\.hasChildNodes\(\)\) renderNavigation\(cases, entry\)/);
  assert.match(externalCasesApp, /x: window\.scrollX, y: window\.scrollY, navigation: navigation\.scrollTop/);
  assert.match(externalCasesApp, /navigation\.scrollTop = viewport\.navigation/);
  assert.match(externalCasesApp, /window\.scrollTo\(viewport\.x, viewport\.y\)/);
  assert.match(externalCasesApp, /history\.pushState\(\{ historyCaseId: entry\.caseId \}, "", link\.href\)/);
  assert.match(externalCasesApp, /addEventListener\("popstate"/);
  assert.doesNotMatch(externalCasesApp, /location\.(?:assign|replace)\(link\.href\)/);
});

test("Nix Derivation Identity Lab preserves content, construction, and evidence boundaries", () => {
  assert.match(nixApp, /cases\/nix-derivation-identity\/artifacts\/nix-derivation-identity\.json/);
  assert.match(nixApp, /createNixDerivationModel/);
  assert.match(nixApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(nixApp, /cache: "no-store"/);
  assert.match(nixApp, /redirect: "error"/);
  assert.match(nixApp, /MAX_ARTIFACT_BYTES/);
  assert.match(nixModel, /direct graph contains a non-native/);
  assert.match(nixModel, /closure graph contains a non-derived/);
  assert.match(nixModel, /unresolved result is contradictory/);
  assert.match(nixMarkup, /Same bytes\./);
  assert.match(nixMarkup, /Different recipe\./);
  assert.match(nixMarkup, /Builders were not executed/);
  assert.match(nixMarkup, /Historical Load is intentionally undefined/);
  assert.match(nixStyles, /\.path\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  assert.match(nixStyles, /\.map-arrow\.declared i\s*\{[^}]*border-top:\s*2px dashed/s);
  for (const id of [
    "experiment-list",
    "regime-list",
    "construction-lanes",
    "identity-result",
    "regime-matrix",
    "inspector-drv",
    "environment-entries"
  ]) {
    assert.match(nixMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  const pinnedDigest = nixApp.match(/EXPECTED_ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(nixArtifact).digest("hex"));
  const appRevision = nixMarkup.match(/nix-derivation-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = nixApp.match(/nix-derivation-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("OCI Layer History Lab preserves ancestry behind flattened equality", () => {
  assert.match(ociApp, /cases\/oci-layer-history\/artifacts\/oci-layer-history\.json/);
  assert.match(ociApp, /createOciLayerHistoryModel/);
  assert.match(ociApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(ociApp, /cache: "no-store"/);
  assert.match(ociApp, /redirect: "error"/);
  assert.match(ociModel, /native histories do not converge to one rootfs/);
  assert.match(ociModel, /native history identities were collapsed/);
  assert.match(ociModel, /Historical Load is substituted/);
  assert.match(ociMarkup, /Same filesystem\./);
  assert.match(ociMarkup, /Different past\./);
  assert.match(ociMarkup, /Deleted \/ hidden history/);
  assert.match(ociMarkup, /Historical Load \/ declared finite space/);
  assert.match(ociMarkup, /not a registry client, image signature verifier, or general container runtime/);
  for (const id of [
    "comparison-controls",
    "left-timeline",
    "right-timeline",
    "rootfs-files",
    "identity-regimes",
    "hidden-records",
    "cost-controls",
    "candidate-costs",
    "inspector-digest"
  ]) {
    assert.match(ociMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  const pinnedDigest = ociApp.match(/EXPECTED_ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(ociArtifact).digest("hex"));
  const appRevision = ociMarkup.match(/oci-layer-history-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = ociApp.match(/oci-layer-history-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("in-toto Admissibility Explorer separates native verdicts, optional policy, and counterfactual cost", () => {
  assert.match(inTotoApp, /cases\/in-toto-admissibility\/artifacts\/in-toto-admissibility\.json/);
  assert.match(inTotoApp, /createInTotoAdmissibilityModel/);
  assert.match(inTotoApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(inTotoApp, /cache: "no-store"/);
  assert.match(inTotoApp, /redirect: "error"/);
  assert.match(inTotoModel, /commandMismatchSemantics !== "warning-only"/);
  assert.match(inTotoModel, /counterfactual && route\.actual/);
  assert.match(inTotoModel, /load equation is inconsistent/);
  assert.match(inTotoMarkup, /Same bytes\./);
  assert.match(inTotoMarkup, /Different permission to trust\./);
  assert.match(inTotoMarkup, /expected_command.*mismatch produces a warning/);
  assert.match(inTotoApp, /neither a risk score nor an in-toto metric/);
  for (const id of ["step-flow", "scenario-controls", "link-list", "check-list", "warning-box", "route-list", "cost-controls", "load-equation"]) assert.match(inTotoMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = inTotoApp.match(/EXPECTED_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(inTotoArtifact).digest("hex"));
  const appRevision = inTotoMarkup.match(/in-toto-admissibility-explorer\.js\?v=([^"']+)/)?.[1];
  const modelRevision = inTotoApp.match(/in-toto-admissibility-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Chemical Synthesis History separates target identity, route identity, and native continuity", () => {
  assert.match(chemicalApp, /cases\/chemical-synthesis-history\/artifacts\/chemical-synthesis-history\.json/);
  assert.match(chemicalApp, /createChemicalSynthesisModel/);
  assert.match(chemicalApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(chemicalApp, /cache: "no-store"/);
  assert.match(chemicalApp, /redirect: "error"/);
  assert.match(chemicalModel, /exact product identifier/);
  assert.match(chemicalModel, /native cascade continuity is missing/);
  assert.match(chemicalModel, /counterfactual && route\.actual/);
  assert.match(chemicalMarkup, /Same molecule\./);
  assert.match(chemicalMarkup, /Different history\./);
  assert.match(chemicalMarkup, /matching compound text alone does not/);
  assert.match(chemicalApp, /says nothing about yield, safety, cost, difficulty, or shortcut feasibility/);
  for (const id of ["target-controls", "target-smiles", "route-left", "route-right", "cascade-flow", "route-space", "cost-controls", "load-equation"]) assert.match(chemicalMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = chemicalApp.match(/EXPECTED_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(chemicalArtifact).digest("hex"));
  const appRevision = chemicalMarkup.match(/synthesis-route-explorer\.js\?v=([^"']+)/)?.[1];
  const modelRevision = chemicalApp.match(/chemical-synthesis-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("History Equivalence Lab keeps execution identity separate from regime verdicts", () => {
  assert.match(buildEquivalenceApp, /cases\/reproducible-build-equivalence\/artifacts\/reproducible-build-equivalence\.json/);
  assert.match(buildEquivalenceApp, /createHistoryEquivalenceModel/);
  assert.match(buildEquivalenceApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(buildEquivalenceApp, /cache: "no-store"/);
  assert.match(buildEquivalenceApp, /redirect: "error"/);
  assert.match(buildEquivalenceModel, /distinct histories collapsed/);
  assert.match(buildEquivalenceModel, /Historical Load boundary differs/);
  assert.match(buildEquivalenceMarkup, /Same bytes\./);
  assert.match(buildEquivalenceMarkup, /Different histories\./);
  assert.match(buildEquivalenceMarkup, /undefined <span>!=<\/span> zero/);
  for (const id of ["pair-controls", "history-left", "history-right", "regime-controls", "verdict-word", "differing-fields", "matrix-body", "historical-load-reason"]) assert.match(buildEquivalenceMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = buildEquivalenceApp.match(/EXPECTED_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(buildEquivalenceArtifact).digest("hex"));
  const appRevision = buildEquivalenceMarkup.match(/history-equivalence-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = buildEquivalenceApp.match(/history-equivalence-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Artwork Provenance Identity Lab keeps source relations, gaps, and identity regimes separate", () => {
  assert.match(artworkApp, /cases\/getty-artwork-provenance\/artifacts\/getty-artwork-provenance\.json/);
  assert.match(artworkApp, /createArtworkProvenanceModel/);
  assert.match(artworkApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(artworkApp, /cache: "no-store"/);
  assert.match(artworkApp, /redirect: "error"/);
  assert.match(artworkApp, /const ARTIFACT_URL = new URL\(/);
  assert.doesNotMatch(artworkApp, /const URL = new URL\(/);
  assert.doesNotMatch(artworkApp, /\["load-state"\]\.lastChild/);
  assert.match(artworkModel, /legal-title boundary differs/);
  assert.match(artworkModel, /unknown interval was promoted/);
  assert.match(artworkModel, /Historical Load boundary differs/);
  assert.match(artworkMarkup, /A record can name a transfer\./);
  assert.match(artworkMarkup, /It cannot close every gap\./);
  assert.match(artworkMarkup, /SOURCE RELATION &ne; LEGAL TITLE FINDING/);
  assert.match(artworkMarkup, /No honest number yet/);
  for (const id of ["object-controls", "object-detail", "timeline", "event-list", "source-records", "regime-controls", "regime-result", "load-reason"]) assert.match(artworkMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = artworkApp.match(/SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(artworkArtifact).digest("hex"));
  const appRevision = artworkMarkup.match(/artwork-provenance-explorer\.js\?v=([^"']+)/)?.[1];
  const modelRevision = artworkApp.match(/artwork-provenance-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Language Lineage & Borrowing Lab keeps genealogy, borrowing, similarity, and uncertainty separate", () => {
  assert.match(languageApp, /cases\/historical-linguistics\/artifacts\/historical-linguistics\.json/);
  assert.match(languageApp, /createLanguageTransmissionModel/);
  assert.match(languageApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(languageApp, /cache: "no-store"/);
  assert.match(languageApp, /redirect: "error"/);
  assert.match(languageApp, /marker-end.*borrowing-arrow/);
  assert.match(languageModel, /borrowing boundary differs/);
  assert.match(languageModel, /surface-similarity boundary differs/);
  assert.match(languageModel, /equivalence matrix differs/);
  assert.match(languageMarkup, /A family tree is not/);
  assert.match(languageMarkup, /Horizontal evidence breaks the pure-tree view/);
  assert.match(languageMarkup, /No honest load number here/);
  for (const id of ["cohort-metrics", "family-trees", "transmission-graph", "form-list", "borrowing-controls", "borrowing-detail", "pair-controls", "comparison-result", "load-reason"]) assert.match(languageMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = languageApp.match(/ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(languageArtifact).digest("hex"));
  const appRevision = languageMarkup.match(/language-lineage-borrowing-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = languageApp.match(/language-transmission-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Textual Transmission Lab preserves readings, attributed reconstruction, and contamination", () => {
  assert.match(manuscriptApp, /cases\/manuscript-stemmatics\/artifacts\/manuscript-stemmatics\.json/);
  assert.match(manuscriptApp, /createManuscriptTransmissionModel/);
  assert.match(manuscriptApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(manuscriptApp, /cache: "no-store"/);
  assert.match(manuscriptApp, /redirect: "error"/);
  assert.match(manuscriptApp, /marker-end.*contamination-arrow/);
  assert.match(manuscriptModel, /contamination boundary differs/);
  assert.match(manuscriptModel, /agreement boundary differs/);
  assert.match(manuscriptModel, /Historical Load boundary differs/);
  assert.match(manuscriptMarkup, /One text\./);
  assert.match(manuscriptMarkup, /Cx2 cannot be represented by one clean tree edge/);
  assert.match(manuscriptMarkup, /What the number 207 actually says/);
  assert.match(manuscriptMarkup, /Undefined is the result/);
  for (const id of ["corpus-metrics", "transmission-graph", "reading-matrix", "profile-bars", "agreement-controls", "agreement-detail", "ablation-controls", "ablation-detail", "pair-controls", "comparison-result", "load-reason"]) assert.match(manuscriptMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = manuscriptApp.match(/ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(manuscriptArtifact).digest("hex"));
  const appRevision = manuscriptMarkup.match(/textual-transmission-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = manuscriptApp.match(/manuscript-transmission-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Operational Aging Lab separates snapshot, history, latent state, and outcome", () => {
  assert.match(operationalApp, /cases\/operational-aging\/artifacts\/operational-aging\.json/);
  assert.match(operationalApp, /createOperationalAgingModel/);
  assert.match(operationalApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(operationalApp, /cache: "no-store"/);
  assert.match(operationalApp, /redirect: "error"/);
  assert.doesNotMatch(operationalApp, /const URL = new URL\(/);
  assert.match(operationalModel, /input boundary differs/);
  assert.match(operationalModel, /trajectory .* boundary differs/);
  assert.match(operationalModel, /non-primary boundary differs/);
  assert.match(operationalMarkup, /Looks close now\.[\s\S]*Has a different horizon\./);
  assert.match(operationalMarkup, /The pair stops looking exceptional when the window grows/);
  assert.match(operationalMarkup, /Provided outcome, not prediction/);
  assert.match(operationalMarkup, /Undefined is the honest result/);
  for (const id of ["corpus-metrics", "endpoint-comparison", "rank-controls", "rank-detail", "rank-map", "sensor-controls", "trajectory-chart", "outcome-diagram", "context-control", "load-reason"]) assert.match(operationalMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = operationalApp.match(/ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(operationalArtifact).digest("hex"));
  const appRevision = operationalMarkup.match(/operational-aging-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = operationalApp.match(/operational-aging-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Ecological Memory Lab separates projected state, event context, and causality", () => {
  assert.match(ecologicalApp, /cases\/ecological-memory\/artifacts\/ecological-memory\.json/);
  assert.match(ecologicalApp, /createEcologicalMemoryModel/);
  assert.match(ecologicalApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(ecologicalApp, /cache: "no-store"/);
  assert.match(ecologicalApp, /redirect: "error"/);
  assert.doesNotMatch(ecologicalApp, /const URL = new URL\(/);
  assert.match(ecologicalModel, /event boundary differs/);
  assert.match(ecologicalModel, /flagship snapshot differs/);
  assert.match(ecologicalModel, /future or Historical Load boundary differs/);
  assert.match(ecologicalMarkup, /Looks the same at 0\.1 m\.[\s\S]*Carries a different history\./);
  assert.match(ecologicalMarkup, /Equal after rounding is not equal in full/);
  assert.match(ecologicalMarkup, /An after-state is observed\. A recovery path is not\./);
  assert.match(ecologicalMarkup, /Undefined is the result/);
  for (const id of ["metric-grid", "timeline", "snapshot-comparison", "signature-values", "state-bars", "grid-controls", "grid-canvas", "change-metrics", "equivalence-grid", "history-windows", "load-reason"]) assert.match(ecologicalMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = ecologicalApp.match(/ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(ecologicalArtifact).digest("hex"));
  const appRevision = ecologicalMarkup.match(/ecological-memory-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = ecologicalApp.match(/ecological-memory-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Legal Precedent History Lab separates citation, attributed treatment, and authority", () => {
  assert.match(legalApp, /cases\/legal-precedent-history\/artifacts\/legal-precedent-history\.json/);
  assert.match(legalApp, /createLegalPrecedentModel/);
  assert.match(legalApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(legalApp, /cache: "no-store"/);
  assert.match(legalApp, /redirect: "error"/);
  assert.doesNotMatch(legalApp, /const URL = new URL\(/);
  assert.match(legalStyles, /marker-end:url\(#citation-arrow\)/);
  assert.match(legalModel, /citation chronology or semantics differ/);
  assert.match(legalModel, /attributed treatment layer differs/);
  assert.match(legalModel, /legal safety boundary differs/);
  assert.match(legalMarkup, /A citation is a record\.[\s\S]*Authority is another claim\./);
  assert.match(legalMarkup, /Four citations; zero inferred binding claims/);
  assert.match(legalMarkup, /Withhold Brown II without rewriting history/);
  assert.match(legalMarkup, /Undefined is the correct result here/);
  assert.match(legalMarkup, /RESEARCH VIEW \/ NOT LEGAL ADVICE/);
  for (const id of ["cohort-metrics", "opinion-timeline", "scope-controls", "citation-graph", "graph-readout", "opinion-inspector", "status-matrix", "counterfactual-toggle", "date-disagreements", "load-reason"]) assert.match(legalMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  const pinnedDigest = legalApp.match(/ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(legalArtifact).digest("hex"));
  const appRevision = legalMarkup.match(/legal-precedent-history-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = legalApp.match(/legal-precedent-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Git History Identity Lab verifies one immutable artifact across four regimes", () => {
  assert.match(gitHistoryApp, /cases\/git-history-identity\/artifacts\/history-identity\.json/);
  assert.match(gitHistoryApp, /createGitHistoryModel/);
  assert.match(gitHistoryApp, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(gitHistoryApp, /cache: "no-store"/);
  assert.match(gitHistoryApp, /redirect: "error"/);
  assert.match(gitHistoryApp, /MAX_ARTIFACT_BYTES/);
  assert.match(gitHistoryModel, /Object\.freeze/);
  assert.match(gitHistoryModel, /identities are inconsistent/);
  assert.match(gitHistoryModel, /history class is not bound to tree-state-v1/);
  assert.match(gitHistoryMarkup, /Same tree\./);
  assert.match(gitHistoryMarkup, /Different past\./);
  assert.match(gitHistoryMarkup, /does not claim that commit ancestry is causality/i);
  assert.match(gitHistoryMarkup, /introduces no Historical Load value/i);
  for (const id of [
    "experiment-list",
    "regime-list",
    "left-timeline",
    "right-timeline",
    "identity-result",
    "regime-matrix",
    "inspector-oid",
    "tree-entries"
  ]) {
    assert.match(gitHistoryMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  const pinnedDigest = gitHistoryApp.match(/EXPECTED_ARTIFACT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  assert.equal(pinnedDigest, createHash("sha256").update(gitHistoryArtifact).digest("hex"));
  assertScriptIdsExist(gitHistoryApp, gitHistoryMarkup);
  const appRevision = gitHistoryMarkup.match(/git-history-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = gitHistoryApp.match(/git-history-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("Bootstrap Provenance Explorer keeps evidence and analysis visibly separate", () => {
  assert.match(bootstrapApp, /generated\/upstream-trace\.json/);
  assert.match(bootstrapApp, /generated\/state-transitions\.json/);
  assert.match(bootstrapApp, /generated\/evidence\.json/);
  assert.match(bootstrapApp, /generated\/graph\.json/);
  assert.match(bootstrapApp, /analysis\/construction-space\.json/);
  assert.match(bootstrapApp, /analysis\/regimes\.json/);
  assert.match(bootstrapApp, /analysis\/historical-load\.json/);
  assert.match(bootstrapApp, /createBootstrapProvenanceModel/);
  assert.match(bootstrapApp, /createModelView/);
  assert.match(bootstrapApp, /layoutNeighborhood/);
  assert.match(bootstrapApp, /wrapGraphNodeLabel/);
  assert.match(bootstrapApp, /svgElement\("rect"/);
  assert.match(bootstrapStyles, /\.empty-state\[hidden\]\s*\{\s*display:none/);
  assert.match(bootstrapStyles, /\.evidence-node rect/);
  assert.match(bootstrapMarkup, /id=["']evidence-arrow-derived["']/);
  assert.match(bootstrapMarkup, /markerUnits=["']userSpaceOnUse["']/);
  assert.match(bootstrapStyles, /--edge:\s*#647873/);
  assert.match(bootstrapStyles, /#evidence-arrow path\s*\{\s*fill:var\(--edge\)/);
  assert.match(bootstrapStyles, /marker-end:url\(#evidence-arrow-derived\)/);
  assert.match(bootstrapStyles, /marker-end:url\(#evidence-arrow-focus\)/);
  assert.match(bootstrapStyles, /\.load-readout\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*grid-template-rows:auto minmax\(0,1fr\) auto[^}]*overflow:hidden/s);
  assert.match(bootstrapStyles, /\.load-readout strong\s*\{[^}]*white-space:nowrap/s);
  assert.match(bootstrapModel, /counterfactual edge .* leaked into extracted evidence/);
  assert.match(bootstrapModel, /edge\.layer === "upstream-fact"/);
  assert.match(bootstrapMarkup, /Bootstrap Trace/);
  assert.match(bootstrapMarkup, /Provenance Graph/);
  assert.match(bootstrapMarkup, /Trust Boundary/);
  assert.match(bootstrapMarkup, /Counterfactual Paths/);
  assert.match(bootstrapMarkup, /Historical Load/);
  assert.match(bootstrapMarkup, /What this number says here/);
  assert.match(bootstrapMarkup, /Evidence Inspector/);
  assert.match(bootstrapMarkup, /Counterfactual construction edges are never merged/i);
  assert.match(bootstrapMarkup, /No "zero trust" claim is made/i);
  for (const id of [
    "trace-list",
    "directive-filter",
    "activity-filter",
    "evidence-mode",
    "provenance-graph",
    "trust-roots",
    "path-cards",
    "cost-function",
    "regime-select",
    "path-comparison",
    "inspector-record"
  ]) {
    assert.match(bootstrapMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  const appRevision = bootstrapMarkup.match(/bootstrap-provenance-explorer\.js\?v=([^"']+)/)?.[1];
  const modelRevision = bootstrapApp.match(/bootstrap-provenance-model\.js\?v=([^"']+)/)?.[1];
  const viewRevision = bootstrapMarkup.match(/packages\/view\/src\/index\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
  assert.equal(viewRevision, appRevision);
});

test("Model Studio fully verifies the real pack before using the shared view layer", () => {
  assert.match(studioApp, /models\/registry\.json/);
  assert.match(studioApp, /packages\/model-pack\/src\/browser\.js/);
  assert.match(studioApp, /packages\/model-pack\/src\/cache\.js/);
  assert.match(studioApp, /packages\/model-pack\/src\/registry\.js/);
  assert.match(studioApp, /packages\/model-pack\/src\/worker\.js/);
  assert.match(studioApp, /packages\/engine\/src\/presentation\.js/);
  assert.match(studioApp, /packages\/rdf-import\/src\/index\.js/);
  assert.match(studioApp, /packages\/rdf-mapping\/src\/index\.js/);
  assert.match(studioApp, /packages\/shacl-validation\/src\/index\.js/);
  assert.match(studioApp, /packages\/view\/src\/index\.js/);
  assert.match(studioApp, /loadModelPackRegistryHttp/);
  assert.match(studioApp, /resolveModelPackRegistry/);
  assert.match(studioApp, /expectedRegistryHash: EXPECTED_REGISTRY_HASH/);
  assert.match(studioApp, /matchModelPackRegistryResolution/);
  assert.match(studioApp, /client\.loadHttpDirectory\(resolution\.baseUrl\)/);
  assert.match(studioApp, /client\.loadBundle\(source, \{ transfer: "move" \}\)/);
  assert.match(studioApp, /createIndexedDbModelPackCacheStorage/);
  assert.match(studioApp, /createVerifiedModelPackCache/);
  assert.match(studioApp, /cache\.load\(identity, loadBoundPack\)/);
  assert.match(studioApp, /MODEL_PACK_CACHE_STORAGE_/);
  assert.match(studioApp, /dataset\.cache = "unavailable"/);
  assert.match(studioApp, /"Cached model verified"/);
  assert.match(studioApp, /sha256:9efdefe85d888b4da148d9b95d6fc6706e4f88bd99913e71ba53dc7b5355e45e/);
  assert.match(studioApp, /new Worker\(MODEL_PACK_WORKER_URL, \{/);
  assert.match(studioApp, /type: "module"/);
  assert.match(studioApp, /ownsWorker: true/);
  assert.match(studioApp, /error\.code\.startsWith\("MODEL_PACK_WORKER_"\)/);
  assert.match(studioApp, /loadModelPackHttpDirectory\(resolution\.baseUrl\)/);
  assert.match(studioApp, /dataset\.registry = resolution\.registryTrust/);
  assert.match(studioApp, /dataset\.verifier = "worker"/);
  assert.match(studioApp, /dataset\.verifier = "main-thread-fallback"/);
  assert.match(studioApp, /createVerifiedModelPresentation\(pack, presentationOptions\)/);
  assert.match(studioApp, /state\.presentation\.catalog\(/);
  assert.match(studioApp, /state\.presentation\.inspect\(/);
  assert.match(studioApp, /state\.presentation\.neighborhood\(/);
  assert.match(studioApp, /dataset\.presentation = "lazy"/);
  assert.doesNotMatch(studioApp, /pack\.files\["model\/(?:nodes|edges)\.json"\]/);
  assert.doesNotMatch(studioApp, /function fetchJson/);
  assert.doesNotMatch(studioApp, /if\s*\([^)]*modelId\s*===\s*["']/);
  assert.match(studioApp, /Model verified/);
  assert.match(studioMarkup, /"@onto2d\/kernel\/canonical":"\.\.\/\.\.\/packages\/kernel\/src\/canonical-entry\.js\?v=/);
  assert.match(studioMarkup, /"@onto2d\/view\/lazy":"\.\.\/\.\.\/packages\/view\/src\/lazy\.js\?v=/);
  assert.match(studioApp, /layoutNeighborhood\(projection/);
  assert.match(studioApp, /wrapGraphNodeLabel/);
  assert.match(studioApp, /svgElement\("rect"/);
  assert.match(studioStyles, /\.graph-node rect/);
  assert.match(studioApp, /addEventListener\("click", \(\) => inspectNode\(node\.id\)\)/);
  assert.match(studioApp, /addEventListener\("dblclick", \(\) => focusNode\(node\.id\)\)/);
  assert.match(studioApp, /graphHighlight\(activeGraphProjection, target\)/);
  assert.match(studioApp, /policy\.inputs\.dataSourceId/);
  assert.match(studioApp, /policy\.inputs\.shapesSourceId/);
  assert.match(studioApp, /buildRdfMappedModelPack\(data, shapes, report, policy/);
  assert.match(studioMarkup, /Registered release/i);
  assert.match(studioMarkup, /does not add dependency or causal meaning/i);
  assert.doesNotMatch(studioMarkup, /class="activity-bar"/);
  assert.doesNotMatch(studioMarkup, /class="breadcrumbs"/);
  assert.doesNotMatch(studioMarkup, /class="statusbar"/);
  for (const id of [
    "catalog-search",
    "model-selector",
    "catalog-list",
    "catalog-more",
    "rdf-import-open",
    "rdf-import-dialog",
    "rdf-data-file",
    "rdf-shapes-file",
    "rdf-policy-file",
    "direction-controls",
    "depth-controls",
    "neighborhood-graph",
    "graph-edges",
    "graph-nodes",
    "selected-record"
  ]) {
    assert.match(studioMarkup, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  const appRevision = studioMarkup.match(/model-studio\.js\?v=([^"']+)/)?.[1];
  const browserRevision = studioApp.match(/packages\/model-pack\/src\/browser\.js\?v=([^"']+)/)?.[1];
  const cacheRevision = studioApp.match(/packages\/model-pack\/src\/cache\.js\?v=([^"']+)/)?.[1];
  const registryRevision = studioApp.match(/packages\/model-pack\/src\/registry\.js\?v=([^"']+)/)?.[1];
  const workerClientRevision = studioApp.match(/packages\/model-pack\/src\/worker\.js\?v=([^"']+)/)?.[1];
  const workerBundleRevision = studioApp.match(/assets\/js\/model-pack-worker\.js\?v=([^"']+)/)?.[1];
  const presentationRevision = studioApp.match(/packages\/engine\/src\/presentation\.js\?v=([^"']+)/)?.[1];
  const rdfImportRevision = studioApp.match(/packages\/rdf-import\/src\/index\.js\?v=([^"']+)/)?.[1];
  const rdfMappingRevision = studioApp.match(/packages\/rdf-mapping\/src\/index\.js\?v=([^"']+)/)?.[1];
  const shaclRevision = studioApp.match(/packages\/shacl-validation\/src\/index\.js\?v=([^"']+)/)?.[1];
  const viewRevision = studioApp.match(/packages\/view\/src\/index\.js\?v=([^"']+)/)?.[1];
  const interactionRevision = studioApp.match(/graph-interactions\.js\?v=([^"']+)/)?.[1];
  const selectionRevision = studioApp.match(/model-selection\.js\?v=([^"']+)/)?.[1];
  const kernelRevision = studioMarkup.match(/packages\/kernel\/src\/canonical-entry\.js\?v=([^"']+)/)?.[1];
  assert.equal(browserRevision, appRevision);
  assert.equal(cacheRevision, appRevision);
  assert.equal(registryRevision, appRevision);
  assert.equal(workerClientRevision, appRevision);
  assert.equal(workerBundleRevision, appRevision);
  assert.equal(presentationRevision, appRevision);
  assert.equal(rdfImportRevision, appRevision);
  assert.equal(rdfMappingRevision, appRevision);
  assert.equal(shaclRevision, appRevision);
  assert.equal(viewRevision, appRevision);
  assert.equal(interactionRevision, appRevision);
  assert.equal(selectionRevision, appRevision);
  assert.equal(kernelRevision, appRevision);
});

test("the committed Model Pack worker is a self-contained generated browser asset", () => {
  assert.match(modelPackWorker, /^\/\/ Generated by npm run build:worker\. Do not edit directly\./);
  assert.doesNotMatch(modelPackWorker, /^\s*import\s/m);
  assert.match(modelPackWorker, /onto2d-model-pack-worker/);
  assert.match(modelPackWorker, /installModelPackWorkerEndpoint/);
});

test("the Level-0 view projects frozen evidence into interactive branches", () => {
  assert.match(levelZeroMarkup, /id="branches"/);
  assert.match(levelZeroMarkup, /data-branch="localized-pulse"/);
  assert.match(levelZeroMarkup, /data-branch="stable-plateau"/);
  assert.match(levelZeroMarkup, /data-branch="uncoupled-vacuum"/);
  assert.match(levelZeroMarkup, /id="base-profile"/);
  assert.match(levelZeroMarkup, /id="extended-profile"/);
  assert.match(levelZeroMarkup, /id="dynamics"/);
  assert.match(levelZeroMarkup, /id="dynamics-time-slider"/);
  assert.match(levelZeroMarkup, /id="dynamics-profile-perturbed"/);
  assert.match(levelZeroMarkup, /id="dynamics-profile-difference"/);
  assert.match(levelZeroMarkup, /id="dynamics-amplification-symmetric"/);
  assert.match(levelZeroMarkup, /id="dynamics-playhead"/);
  assert.match(levelZeroMarkup, /id="expanded"/);
  assert.match(levelZeroMarkup, /id="expanded-scenario-tabs"/);
  assert.match(levelZeroMarkup, /id="expanded-component-1"/);
  assert.match(levelZeroMarkup, /id="expanded-trace-off-center"/);
  assert.match(levelZeroMarkup, /id="expanded-failed-gates"/);
  assert.match(levelZeroMarkup, /A visual explanation, not a new calculation/i);
  assert.match(levelZeroApp, /artifacts\/level-zero-validation-v3\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-objecthood-v2\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-dynamics-v2\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-expanded-search-v2\.json/);
  assertScriptIdsExist(levelZeroApp, levelZeroMarkup);
  const appRevision = levelZeroMarkup.match(/level-zero-study\.js\?v=([^"']+)/)?.[1];
  const modelRevision = levelZeroApp.match(/level-zero-visual-model\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
});

test("the dedicated motif Explorer has complete interactive hooks", () => {
  assert.match(motifMarkup, /id="catalogue"/);
  assert.match(motifMarkup, /id="method"/);
  assert.match(motifMarkup, /id="onto2d-reading"/);
  assert.match(motifMarkup, /not an evolutionary reconstruction/i);
  assert.match(motifMarkup, /Frozen empirical case/i);
  assertScriptIdsExist(motifApp, motifMarkup);
  const appRevision = motifMarkup.match(/network-motif-study\.js\?v=([^"']+)/)?.[1];
  const dataRevision = motifApp.match(/network-motif-data\.js\?v=([^"']+)/)?.[1];
  const readingModelRevision = motifApp.match(/motif-reading\.js\?v=([^"']+)/)?.[1];
  assert.equal(dataRevision, appRevision);
  assert.equal(readingModelRevision, appRevision);
});

test("the identity lab discloses its frozen-fixture boundary and all hooks exist", () => {
  assert.match(identityMarkup, /browser does not reimplement the canonicalizer/i);
  assert.match(identityMarkup, /data-action="permute"/);
  assert.match(identityMarkup, /data-action="reverse"/);
  assert.match(identityMarkup, /data-action="role"/);
  assertScriptIdsExist(identityApp, identityMarkup);
  const appRevision = identityMarkup.match(/identity-lab\.js\?v=([^"']+)/)?.[1];
  const modelRevision = identityApp.match(/identity-model\.js\?v=([^"']+)/)?.[1];
  const graphViewRevision = identityApp.match(/identity-graph-renderer\.js\?v=([^"']+)/)?.[1];
  assert.equal(modelRevision, appRevision);
  assert.equal(graphViewRevision, appRevision);
});

test("the local site server resolves directory URLs to their index pages", () => {
  assert.match(siteServer, /pathname\.endsWith\("\/"\)/);
  assert.match(siteServer, /`\$\{pathname\}index\.html`/);
  assert.match(siteServer, /path\.resolve\(applicationRoot/);
  assert.match(siteServer, /documentRequest && requestUrl\.searchParams\.has\("v"\)/);
  assert.match(siteServer, /"Location": `\$\{pathname\}\$\{requestUrl\.search\}`/);
});

test("document navigation has one canonical URL and rejects stale bfcache restores", () => {
  const pages = [
    landing,
    motifMarkup,
    identityMarkup,
    levelZeroMarkup,
    studioMarkup,
    gitHistoryMarkup,
    nixMarkup,
    ociMarkup,
    inTotoMarkup,
    languageMarkup,
    manuscriptMarkup,
    operationalMarkup,
    read("apps/historical-load-explorer/index.html")
  ];
  for (const markup of pages) {
    assert.match(markup, /assets\/js\/document-state-reset\.js/);
    const navigationLinks = [...markup.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
      .map((match) => match[1]);
    for (const href of navigationLinks) {
      assert.doesNotMatch(href, /[?&]v=/, `versioned document navigation remains: ${href}`);
    }
  }
  assert.match(documentLifecycle, /searchParams\.has\("v"\)/);
  assert.match(documentLifecycle, /location\.replace\(currentUrl\.href\)/);
  assert.match(documentLifecycle, /event\.persisted/);
  assert.match(documentLifecycle, /location\.reload\(\)/);
  assert.match(documentLifecycle, /serviceWorker\.getRegistration\(\)/);
  assert.match(documentLifecycle, /registration\.unregister\(\)/);
  assert.match(documentLifecycle, /window\.caches\.delete\(name\)/);
  assert.match(documentLifecycle, /localHostnames\.has\(window\.location\.hostname\)/);
});

test("the complete public site surface is ASCII-only", () => {
  for (const file of publicFiles) {
    const contents = read(file);
    const match = contents.match(/[^\x00-\x7f]/);
    assert.equal(match, null, `${file} contains non-ASCII code point ${match?.[0]}`);
  }
});

test("all shared vector icon references resolve to the local SVG sprite", () => {
  const symbolIds = new Set([...iconSprite.matchAll(/<symbol id="([a-z-]+)"/g)].map((match) => match[1]));
  assert.equal(symbolIds.size, 16);

  const markupReferences = publicFiles.flatMap((file) => [
    ...read(file).matchAll(/ui-symbols\.svg#([a-z-]+)/g)
  ].map((match) => match[1]));
  const dynamicReferences = [...read("apps/historical-load-explorer/historical-load-study.js").matchAll(/iconMarkup\("([a-z-]+)"\)/g)]
    .map((match) => match[1]);
  for (const iconId of [...markupReferences, ...dynamicReferences]) {
    assert.ok(symbolIds.has(iconId), `missing vector icon #${iconId}`);
  }
  assert.ok(markupReferences.length >= 20);
});

test("shared interface icons use a bounded pixel scale", () => {
  assert.match(iconStyles, /--icon-size-default:\s*14px/);
  assert.match(iconStyles, /--icon-size-action:\s*16px/);
  assert.match(iconStyles, /--icon-size-brand:\s*28px/);
  assert.doesNotMatch(iconStyles, /(?:width|height):\s*[\d.]+em/);
});

test("motif Explorer text never drops below the readable interface minimum", () => {
  assert.doesNotMatch(motifStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("the Level-0 view text never drops below the readable interface minimum", () => {
  assert.doesNotMatch(levelZeroStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("Model Studio text never drops below the readable interface minimum", () => {
  assert.doesNotMatch(studioStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("Bootstrap Provenance Explorer text never drops below the readable interface minimum", () => {
  assert.doesNotMatch(bootstrapStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("External case pages keep interface text at the readable minimum", () => {
  assert.doesNotMatch(externalCasesStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("Git History Identity Lab keeps interface text at the readable minimum", () => {
  assert.doesNotMatch(gitHistoryStyles, /font-size:\s*(?:[1-9]|1[01])px/);
});

test("Nix Derivation Identity Lab keeps interface text at the readable minimum", () => {
  assert.doesNotMatch(nixStyles, /font-size:\s*(?:[1-9]|1[01])px/);
  const remSizes = [...nixStyles.matchAll(/font-size:\s*([0-9]*\.?[0-9]+)rem/g)]
    .map((match) => Number(match[1]));
  assert.equal(remSizes.every((size) => size >= 0.75), true);
  assert.doesNotMatch(nixStyles, /https?:\/\//);
});

test("OCI Layer History Lab keeps interface text at the readable minimum", () => {
  assert.doesNotMatch(ociStyles, /font-size:\s*(?:[1-9]|1[01])px/);
  assert.doesNotMatch(ociStyles, /https?:\/\//);
});

test("History Equivalence Lab keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(buildEquivalenceStyles, "History Equivalence Lab");
  assert.doesNotMatch(buildEquivalenceStyles, /https?:\/\//);
});

test("Chemical Synthesis and Artwork Provenance keep interface text at the readable minimum", () => {
  assertReadableInterfaceText(chemicalStyles, "Chemical Synthesis History");
  assertReadableInterfaceText(artworkStyles, "Artwork Provenance Identity Lab");
  assert.doesNotMatch(chemicalStyles, /https?:\/\//);
  assert.doesNotMatch(artworkStyles, /https?:\/\//);
});

test("Language Lineage & Borrowing keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(languageStyles, "Language Lineage & Borrowing Lab");
  assert.doesNotMatch(languageStyles, /https?:\/\//);
});

test("Textual Transmission Lab keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(manuscriptStyles, "Textual Transmission Lab");
  assert.doesNotMatch(manuscriptStyles, /https?:\/\//);
});

test("Operational Aging Lab keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(operationalStyles, "Operational Aging Lab");
  assert.doesNotMatch(operationalStyles, /https?:\/\//);
});

test("Ecological Memory Lab keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(ecologicalStyles, "Ecological Memory Lab");
  assert.doesNotMatch(ecologicalStyles, /https?:\/\//);
});

test("Legal Precedent History Lab keeps interface text at the readable minimum", () => {
  assertReadableInterfaceText(legalStyles, "Legal Precedent History Lab");
  assert.doesNotMatch(legalStyles, /https?:\/\//);
});

test("graph sidebars keep machine fields on bounded single lines", () => {
  assert.match(studioApp, /compactCoordinateText/);
  assert.match(studioStyles, /\.catalog-coordinate\s*\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);
  assert.match(studioStyles, /\.relation-list\s*\{[^}]*overflow-x:hidden[^}]*overflow-y:auto/s);
  assert.match(studioStyles, /\.relation-item\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*overflow:hidden/s);
  assert.match(studioStyles, /\.relation-item code,\.relation-item span\s*\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);
  assert.match(studioApp, /button\.title = `\$\{node\.id\} \| \$\{node\.name\}`/);
  assert.match(bootstrapStyles, /\.trace-item code\s*\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);
  assert.match(read("assets/css/study-historical-load.css"), /\.constraint-copy small\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  assert.match(motifStyles, /\.edge-list code,\.identity code\s*\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);
});
