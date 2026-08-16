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
const siteServer = read("apps/historical-load-explorer/serve.mjs");
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
  "assets/icons/ui-symbols.svg",
  "assets/icons/onto2d-mark.svg",
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

test("Model Studio reads the real pack through the shared deterministic view layer", () => {
  assert.match(studioApp, /models\/causal-emergence\/releases\/2026\.08\.15/);
  assert.match(studioApp, /packages\/view\/src\/index\.js/);
  assert.match(studioApp, /fetchJson\("manifest\.json"\)/);
  assert.match(studioApp, /fetchJson\("model\/nodes\.json"\)/);
  assert.match(studioApp, /fetchJson\("model\/edges\.json"\)/);
  assert.match(studioApp, /layoutNeighborhood\(projection/);
  assert.match(studioApp, /addEventListener\("click", \(\) => inspectNode\(node\.id\)\)/);
  assert.match(studioApp, /addEventListener\("dblclick", \(\) => focusNode\(node\.id\)\)/);
  assert.match(studioApp, /graphHighlight\(activeGraphProjection, target\)/);
  assert.match(studioMarkup, /not reviewed generative causation/i);
  assert.match(studioMarkup, /There is only one real Model Pack release/i);
  assert.doesNotMatch(studioMarkup, /class="activity-bar"/);
  assert.doesNotMatch(studioMarkup, /class="breadcrumbs"/);
  assert.doesNotMatch(studioMarkup, /class="statusbar"/);
  for (const id of [
    "catalog-search",
    "catalog-list",
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
  const viewRevision = studioApp.match(/packages\/view\/src\/index\.js\?v=([^"']+)/)?.[1];
  const interactionRevision = studioApp.match(/graph-interactions\.js\?v=([^"']+)/)?.[1];
  assert.equal(viewRevision, appRevision);
  assert.equal(interactionRevision, appRevision);
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
  assert.match(levelZeroMarkup, /A visual explanation, not a new calculation/i);
  assert.match(levelZeroApp, /artifacts\/level-zero-validation-v1\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-objecthood-v1\.json/);
  assert.match(levelZeroApp, /artifacts\/phase-c-dynamics-v1\.json/);
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
