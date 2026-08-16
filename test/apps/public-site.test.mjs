import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
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
const modelPackWorker = read("assets/js/model-pack-worker.js");
const siteServer = read("apps/historical-load-explorer/serve.mjs");
const documentLifecycle = read("assets/js/document-state-reset.js");
const iconSprite = read("assets/icons/ui-symbols.svg");
const publicDirectories = [
  "apps/historical-load-explorer",
  "apps/three-node-motif-explorer",
  "apps/canonical-identity-lab",
  "apps/level-zero-validation",
  "apps/model-studio"
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
  "assets/js/document-state-reset.js",
  "assets/js/model-pack-worker.js",
  "assets/icons/ui-symbols.svg",
  "assets/icons/onto2d-mark.svg",
  "models/registry.json",
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

test("the root is a no-scroll project landing page with exactly three study entries", () => {
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
  assert.match(landing, /Make complex-system claims/);
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
  assert.match(studioApp, /resolveModelPackRegistryHttp/);
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
  assert.match(studioApp, /sha256:11a8245635b36395d814f37ca35d2a35e28ce8d78eb19fa89c6b3da8d73759a6/);
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
  assert.match(studioApp, /Model verified/);
  assert.match(studioMarkup, /"@onto2d\/kernel\/canonical":"\.\.\/\.\.\/packages\/kernel\/src\/canonical-entry\.js\?v=/);
  assert.match(studioMarkup, /"@onto2d\/view\/lazy":"\.\.\/\.\.\/packages\/view\/src\/lazy\.js\?v=/);
  assert.match(studioApp, /layoutNeighborhood\(projection/);
  assert.match(studioApp, /addEventListener\("click", \(\) => inspectNode\(node\.id\)\)/);
  assert.match(studioApp, /addEventListener\("dblclick", \(\) => focusNode\(node\.id\)\)/);
  assert.match(studioApp, /graphHighlight\(activeGraphProjection, target\)/);
  assert.match(studioApp, /policy\.inputs\.dataSourceId/);
  assert.match(studioApp, /policy\.inputs\.shapesSourceId/);
  assert.match(studioApp, /buildRdfMappedModelPack\(data, shapes, report, policy/);
  assert.match(studioMarkup, /not reviewed generative causation/i);
  assert.match(studioMarkup, /There is only one real Model Pack release/i);
  assert.doesNotMatch(studioMarkup, /class="activity-bar"/);
  assert.doesNotMatch(studioMarkup, /class="breadcrumbs"/);
  assert.doesNotMatch(studioMarkup, /class="statusbar"/);
  for (const id of [
    "catalog-search",
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
  assert.match(levelZeroApp, /artifacts\/level-zero-validation-v1\.json/);
  assert.match(levelZeroApp, /artifacts\/level-zero-validation-v2\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-objecthood-v1\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-dynamics-v1\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-expanded-search-v1\.json/);
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
