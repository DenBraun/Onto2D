import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHistoryCases, HISTORY_MODES } from "../apps/external-cases/external-cases-catalog.js";

const root = fileURLToPath(new URL("../", import.meta.url));
export const revision = "20260909.3";
const repository = "https://github.com/DenBraun/Onto2D";
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const mark = '<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="7" cy="17" r="3"/><circle cx="27" cy="8" r="3"/><circle cx="27" cy="26" r="3"/><path d="M10 17h7m2-3 5-4m-5 10 5 4"/></svg>';
const research = [
  ["", "Research map", "All directions and their connections"],
  ["apps/structural-geometry-lab/#distinctions", "Distinguishability", "Declare which differences count"],
  ["apps/canonical-identity-lab/", "Canonical Identity", "Compare structure independently of names"],
  ["apps/three-node-motif-explorer/", "Network Motifs", "Compare recurring patterns with null graphs"],
  ["apps/historical-load-explorer/", "Historical Load", "Measure the cost of admissibility rules"],
  ["apps/structural-geometry-lab/", "Structural Geometry", "Explore curvature, flow and response signatures"],
  ["apps/level-zero-validation/", "Level-0 Validation", "Inspect the bounded numerical result"]
];

export async function publicPages(directory = "apps") {
  const pages = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    if (name === "apps/model-studio") continue;
    if (entry.isDirectory()) pages.push(...await publicPages(name));
    else if (entry.name.endsWith(".html")) pages.push(name);
  }
  return directory === "apps" ? ["index.html", ...pages.sort()] : pages;
}

export function renderShell(page, subtitle, cases) {
  const prefix = page === "index.html" ? "./" : "../".repeat(page.split("/").length - 1);
  const current = page.replace(/index\.html$/, "");
  const link = (target, label, detail = "", className = "") => {
    const external = target.startsWith("https://");
    const href = external ? target : prefix + target;
    return `<a${className ? ` class="${className}"` : ""} href="${escape(href)}"${!external && target === current ? ' aria-current="page"' : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${detail ? `<strong>${escape(label)}</strong><small>${escape(detail)}</small>` : escape(label)}${external ? ' <span aria-hidden="true">&#8599;</span>' : ""}</a>`;
  };
  const groups = HISTORY_MODES.map(mode => `<section class="project-case-group" data-case-group><h3>${escape(mode.label)}</h3><ul>${cases.filter(entry => entry.primaryHistoryMode === mode.id).map(entry => `<li data-case-search="${escape(`${entry.title} ${entry.shortTitle} ${entry.domainLabel}`.toLowerCase())}">${link(entry.casePagePath, entry.shortTitle, "", "project-case-link")}${entry.explorerPath ? link(entry.explorerPath, "Lab", "", "project-lab-link").replace("<a ", `<a aria-label="${escape(`Open ${entry.title} laboratory`)}" `) : `<small class="project-case-status">${escape(entry.statusLabel)}</small>`}</li>`).join("")}</ul></section>`).join("");
  const header = `<header class="project-header"><div class="project-header-inner">
<a class="project-brand" href="${prefix}" aria-label="Onto2D home">${mark}<span><strong>Onto2D</strong><small>${subtitle}</small></span></a>
<nav class="project-nav" aria-label="Main navigation">
<details class="project-menu" name="project-menu"><summary>Research ${chevron}</summary><div class="project-menu-panel project-research-panel">${research.map(entry => link(...entry)).join("\n")}</div></details>
${link("apps/history-matters-benchmark/", "History Matters")}
<details class="project-menu" name="project-menu"><summary>Case Studies ${chevron}</summary><div class="project-menu-panel project-cases-panel"><div class="project-cases-heading">${link("apps/history-atlas/", "History Atlas", `${cases.length} cases by history access and effect`)}<label class="project-case-search" hidden>Find a case<input type="search" data-case-filter placeholder="Name or subject" autocomplete="off"></label></div><p class="project-filter-count" data-case-count role="status">${cases.length} cases shown</p><div class="project-case-groups">${groups}</div><p class="project-menu-empty" data-case-empty hidden>No matching cases. Try another name or subject.</p></div></details>
${link("apps/model-studio/", "Model Studio", "", "project-studio-link")}
</nav></div></header>`;
  const footer = `<footer class="project-footer"><div class="project-footer-inner">
<div class="project-footer-about"><a href="${prefix}">Onto2D</a><p>Tools for comparing graph structure,<br>construction histories and geometry.</p></div>
<nav aria-label="Documentation"><h2>Documentation</h2>${link(`${repository}/blob/main/docs/README.md`, "Project guide")}${link(`${repository}/blob/main/docs/DEVELOPMENT.md`, "Development")}</nav>
<nav aria-label="Evidence and data"><h2>Evidence &amp; data</h2>${link(`${repository}/blob/main/docs/structural-geometry/EVIDENCE.md`, "Geometry evidence")}${link(`${repository}/blob/main/docs/history/README.md`, "History methods")}${link(`${repository}/tree/main/cases`, "Datasets & source terms")}</nav>
<nav aria-label="Project resources"><h2>Project</h2>${link(repository, "GitHub")}${link(`${repository}/issues`, "Report an issue")}${link(`${repository}/blob/main/LICENSE`, "MIT license")}</nav>
</div></footer>`;
  const assets = `<link rel="stylesheet" href="${prefix}assets/css/project-shell.css?v=${revision}">\n<script type="module" src="${prefix}assets/js/project-navigation.js?v=${revision}"></script>`;
  return { assets, header, footer };
}

export async function run({ write = false } = {}) {
  const cases = createHistoryCases(JSON.parse(await readFile(path.join(root, "cases/history-case-registry.json"), "utf8")));
  const pages = await publicPages();
  for (const page of pages) {
    const file = path.join(root, page);
    const original = await readFile(file, "utf8");
    const subtitle = original.match(/data-project-subtitle="([^"]+)"/)?.[1];
    assert.ok(subtitle, `${page}: missing page subtitle`);
    let updated = original;
    for (const [part, content] of Object.entries(renderShell(page, subtitle, cases))) {
      const pattern = new RegExp(`<!-- project:${part} -->[\\s\\S]*?<!-- /project:${part} -->`, "g");
      assert.equal([...original.matchAll(pattern)].length, 1, `${page}: expected one ${part} region`);
      updated = updated.replace(pattern, `<!-- project:${part} -->\n${content}\n<!-- /project:${part} -->`);
    }
    if (write) await writeFile(file, updated);
    else assert.equal(original, updated, `${page}: shared layout is stale; run npm run site:shell:build`);
  }
  console.log(`Shared site layout ${write ? "generated" : "verified"}: ${pages.length} pages; Model Studio excluded.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ write: process.argv.includes("--write") }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
