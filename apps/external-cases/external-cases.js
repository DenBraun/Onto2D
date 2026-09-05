import {
  HISTORY_MODES,
  caseNavigationDetail,
  createHistoryCases,
  historyCaseById,
  historyEffectLabel,
  historyModeLabel,
  loadHistoryRegistry,
  modelStudioHref
} from "./external-cases-catalog.js?v=20260905.1";

const PROJECT_ROOT = new URL("../../", import.meta.url);
const GITHUB_BLOB_ROOT = "https://github.com/DenBraun/Onto2D/blob/main/";

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function projectUrl(path) {
  return new URL(path, PROJECT_ROOT).href;
}

function githubDocumentUrl(path) {
  if (typeof path !== "string" || path.includes("..") || !/^(?:cases|docs)\/[A-Za-z0-9_./-]+\.md$/.test(path)) {
    throw new Error(`Unsafe repository document path: ${path}`);
  }
  return `${GITHUB_BLOB_ROOT}${path.split("/").map(encodeURIComponent).join("/")}`;
}

function externalLinkIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("ui-icon");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", projectUrl("assets/icons/ui-symbols.svg#external-link"));
  icon.append(use);
  return icon;
}

function caseLink(entry, selected) {
  const link = element("a", "sequence-link");
  const detail = caseNavigationDetail(entry);
  const secondary = element("small", "", detail.label);
  secondary.dataset.kind = detail.kind;
  secondary.dataset.value = detail.value;
  link.href = projectUrl(entry.casePagePath);
  link.dataset.caseId = entry.caseId;
  link.dataset.status = entry.statusKind;
  link.setAttribute("aria-current", entry.caseId === selected.caseId ? "page" : "false");
  link.setAttribute("aria-label", detail.kind === "status"
    ? `${entry.shortTitle}. Planned case.`
    : `${entry.shortTitle}. Primary history effect: ${detail.label}.`);
  link.append(
    element("strong", "", entry.shortTitle),
    secondary
  );
  return link;
}

function fillList(id, values) {
  const list = document.getElementById(id);
  if (!list) throw new Error(`History case markup is missing #${id}.`);
  list.replaceChildren(...values.map((value) => element("li", "", value)));
}

function fillTags(id, values, labeler = (value) => value) {
  const list = document.getElementById(id);
  if (!list) throw new Error(`History case markup is missing #${id}.`);
  list.replaceChildren(...values.map((value) => {
    const tag = element("span", "taxonomy-tag", labeler(value));
    tag.dataset.value = value;
    return tag;
  }));
}

function renderNavigation(cases, selected) {
  const navigation = document.getElementById("case-sequence");
  navigation.replaceChildren(...HISTORY_MODES.map((mode) => {
    const group = element("section", "sequence-group");
    const heading = element("h3", "", mode.label);
    const links = element("div", "sequence-links");
    links.replaceChildren(...cases
      .filter((entry) => entry.primaryHistoryMode === mode.id)
      .map((entry) => caseLink(entry, selected)));
    group.append(heading, links);
    return group;
  }));
}

function updateNavigationSelection(selected) {
  for (const link of document.querySelectorAll(".sequence-link[data-case-id]")) {
    link.setAttribute("aria-current", link.dataset.caseId === selected.caseId ? "page" : "false");
  }
}

function renderActions(entry) {
  const actions = document.getElementById("case-actions");
  const links = [];
  if (entry.explorerPath !== null) {
    const explorer = element("a", "action-link primary", "Open Explorer");
    explorer.href = projectUrl(entry.explorerPath);
    links.push(explorer);
  }
  if (entry.modelPackPath !== null) {
    const studio = element("a", "action-link", "Open Model Studio");
    studio.href = modelStudioHref(entry, PROJECT_ROOT);
    links.push(studio);
  }
  const documentLink = element("a", "action-link", "Implementation plan on GitHub");
  documentLink.href = githubDocumentUrl(entry.implementationDoc);
  documentLink.target = "_blank";
  documentLink.rel = "noopener noreferrer";
  documentLink.append(externalLinkIcon());
  links.push(documentLink);
  actions.replaceChildren(...links);
}

function renderAnalysis(entry) {
  const labels = {
    historicalLoad: "Historical Load",
    historyEquivalence: "History Equivalence",
    reachability: "Reachability",
    reconstruction: "Reconstruction"
  };
  const list = document.getElementById("case-analyses");
  list.replaceChildren(...Object.entries(entry.analyses).map(([analysis, value]) => {
    const item = element("div", "analysis-row");
    item.append(element("dt", "", labels[analysis]), element("dd", "", value.replaceAll("-", " ")));
    item.dataset.level = value;
    return item;
  }));
}

function renderCase(cases, caseId = document.body.dataset.caseId) {
  const entry = historyCaseById(cases, caseId);
  if (!entry) throw new Error(`Unknown history case: ${caseId}`);

  document.body.dataset.caseId = entry.caseId;
  document.title = `${entry.title} - Onto2D History Case`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = `${entry.title}: ${entry.question}`;
  document.getElementById("case-header-title").textContent = entry.shortTitle;
  document.getElementById("case-domain").textContent = entry.domainLabel;
  const studioNavigation = document.querySelector('.history-case-nav a[href*="model-studio/"]');
  if (!studioNavigation) throw new Error("History case markup is missing its Model Studio navigation link.");
  studioNavigation.href = modelStudioHref(entry, PROJECT_ROOT);
  const status = document.getElementById("case-status");
  const planned = entry.status === "PLANNED";
  status.hidden = !planned;
  status.textContent = planned ? "Planned" : "";
  status.dataset.status = planned ? "planned" : "";
  document.getElementById("case-title").textContent = entry.title;
  document.getElementById("case-question").textContent = entry.question;
  document.getElementById("case-distinction").textContent = entry.distinction;
  document.getElementById("case-summary").textContent = entry.summary;
  document.getElementById("case-flagship").textContent = entry.flagship;
  document.getElementById("case-contribution").textContent = entry.contribution;
  document.getElementById("case-primary-mode").textContent = historyModeLabel(entry.primaryHistoryMode);
  fillTags("case-history-modes", entry.historyModes, historyModeLabel);
  fillTags("case-effects", [...entry.primaryEffects, ...entry.secondaryEffects], historyEffectLabel);
  fillTags("case-evidence", entry.evidenceProfile, (value) => value.replaceAll("-", " "));
  renderAnalysis(entry);

  const implemented = entry.statusKind === "implemented";
  document.getElementById("case-stage-title").textContent = implemented
    ? "Repository result"
    : entry.statusKind === "next" ? "Next implementation" : "Planned contribution";
  document.getElementById("case-stage-note").textContent = implemented
    ? "The linked repository artifacts define this result. The boundaries below state exactly what is verified and what remains outside the claim."
    : "This page describes a bounded research design. It does not claim that source extraction, experiments, or results already exist.";
  fillList("case-boundaries", entry.boundaries);
  fillList("case-outputs", entry.outputs);
  renderActions(entry);
  const navigation = document.getElementById("case-sequence");
  if (!navigation.hasChildNodes()) renderNavigation(cases, entry);
  updateNavigationSelection(entry);
  document.body.dataset.ready = "true";
  return entry;
}

function caseAtLocation(cases) {
  const pathname = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return cases.find((entry) => new URL(entry.casePagePath, PROJECT_ROOT).pathname === pathname) ?? null;
}

function announceCaseSwitch(entry) {
  let status = document.getElementById("case-switch-status");
  if (!status) {
    status = element("p", "case-switch-status");
    status.id = "case-switch-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    document.body.append(status);
  }
  status.textContent = `${entry.title} loaded.`;
}

function renderWithoutScrollJump(cases, entry, announce = true) {
  const navigation = document.getElementById("case-sequence");
  const viewport = Object.freeze({ x: window.scrollX, y: window.scrollY, navigation: navigation.scrollTop });
  const rendered = renderCase(cases, entry.caseId);
  navigation.scrollTop = viewport.navigation;
  window.scrollTo(viewport.x, viewport.y);
  if (announce) announceCaseSwitch(rendered);
  return rendered;
}

function installCaseNavigation(cases, initialEntry) {
  const navigation = document.getElementById("case-sequence");
  const initialState = history.state && typeof history.state === "object" ? history.state : {};
  history.replaceState({ ...initialState, historyCaseId: initialEntry.caseId }, "", window.location.href);

  navigation.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest(".sequence-link[data-case-id]") : null;
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const entry = historyCaseById(cases, link.dataset.caseId);
    if (!entry) return;
    event.preventDefault();
    if (entry.caseId === document.body.dataset.caseId) return;
    renderWithoutScrollJump(cases, entry);
    history.pushState({ historyCaseId: entry.caseId }, "", link.href);
  });

  window.addEventListener("popstate", () => {
    const entry = caseAtLocation(cases);
    if (entry) renderWithoutScrollJump(cases, entry, false);
  });
}

function renderFailure(error) {
  const message = document.getElementById("case-load-error");
  if (message) {
    message.hidden = false;
    message.textContent = `The case registry could not be loaded. ${error.message}`;
  }
  document.body.dataset.ready = "error";
}

if (document.body.dataset.page === "case") {
  loadHistoryRegistry()
    .then(createHistoryCases)
    .then((cases) => {
      const entry = renderCase(cases);
      installCaseNavigation(cases, entry);
    })
    .catch(renderFailure);
}
