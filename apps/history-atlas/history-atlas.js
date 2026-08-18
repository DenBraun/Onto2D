import {
  HISTORY_EFFECTS,
  HISTORY_MODES,
  createHistoryCases,
  historyEffectLabel,
  historyModeLabel,
  loadHistoryRegistry
} from "../external-cases/external-cases-catalog.js?v=20260818.4";

const PROJECT_ROOT = new URL("../../", import.meta.url);
const filterIds = Object.freeze(["mode", "effect", "domain", "evidence", "status", "load", "model"]);
const state = Object.fromEntries(filterIds.map((key) => [key, ""]));
let allCases = Object.freeze([]);

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function projectUrl(path) {
  return new URL(path, PROJECT_ROOT).href;
}

function option(value, label) {
  const node = element("option", "", label);
  node.value = value;
  return node;
}

function appendOptions(id, values) {
  document.getElementById(id).append(...values.map(([value, label]) => option(value, label)));
}

function configureFilters(cases) {
  appendOptions("filter-mode", HISTORY_MODES.map(({ id, label }) => [id, label]));
  appendOptions("filter-effect", HISTORY_EFFECTS.map(({ id, label }) => [id, label]));
  appendOptions("filter-domain", [...new Map(cases.map((entry) => [entry.domain, entry.domainLabel]))]
    .sort((left, right) => left[1].localeCompare(right[1])));
  appendOptions("filter-evidence", [...new Set(cases.flatMap((entry) => entry.evidenceProfile))]
    .sort().map((value) => [value, value.replaceAll("-", " ")]));
  appendOptions("filter-status", [...new Set(cases.map((entry) => entry.status))]
    .map((value) => [value, value.replaceAll("_", " ")]));

  for (const key of filterIds) {
    document.getElementById(`filter-${key}`).addEventListener("change", (event) => {
      state[key] = event.currentTarget.value;
      render();
    });
  }
  document.getElementById("atlas-filter-reset").addEventListener("click", () => {
    for (const key of filterIds) {
      state[key] = "";
      document.getElementById(`filter-${key}`).value = "";
    }
    render();
  });
}

function matches(entry) {
  if (state.mode && !entry.historyModes.includes(state.mode)) return false;
  const effects = [...entry.primaryEffects, ...entry.secondaryEffects];
  if (state.effect && !effects.includes(state.effect)) return false;
  if (state.mode && state.effect
    && !entry.matrixPlacements.some((placement) => placement.mode === state.mode && placement.effect === state.effect)) return false;
  if (state.domain && entry.domain !== state.domain) return false;
  if (state.evidence && !entry.evidenceProfile.includes(state.evidence)) return false;
  if (state.status && entry.status !== state.status) return false;
  if (state.load && entry.analyses.historicalLoad !== state.load) return false;
  if (state.model === "available" && entry.modelPackPath === null) return false;
  if (state.model === "planned" && entry.modelPackPath !== null) return false;
  return true;
}

function tag(value, kind, label) {
  const node = element("span", `atlas-tag ${kind}`, label);
  node.dataset.value = value;
  return node;
}

function matrixCase(entry, mode, effect) {
  const placement = entry.matrixPlacements.find((candidate) => candidate.mode === mode && candidate.effect === effect);
  const primary = placement?.role === "primary";
  const link = element("a", primary ? "matrix-case primary" : "matrix-case");
  link.href = projectUrl(entry.casePagePath);
  link.dataset.status = entry.statusKind;
  link.append(
    element("strong", "", entry.shortTitle),
    element("small", "", primary ? "Primary placement" : "Secondary reference")
  );
  return link;
}

function renderMatrix(cases) {
  const matrix = document.getElementById("history-matrix");
  const nodes = [element("div", "matrix-corner", "History access down / effect across")];
  for (const effect of HISTORY_EFFECTS) {
    const header = element("div", "matrix-column-header");
    header.append(element("strong", "", effect.label), element("small", "", effect.description));
    nodes.push(header);
  }

  for (const mode of HISTORY_MODES) {
    const header = element("div", "matrix-row-header");
    header.append(element("strong", "", mode.label), element("small", "", mode.description));
    nodes.push(header);
    for (const effect of HISTORY_EFFECTS) {
      const cell = element("section", "matrix-cell");
      cell.dataset.mode = mode.id;
      cell.dataset.effect = effect.id;
      const members = cases.filter((entry) => entry.matrixPlacements
        .some((placement) => placement.mode === mode.id && placement.effect === effect.id));
      const heading = element("div", "matrix-cell-heading");
      heading.append(element("span", "", `${mode.label} x ${effect.label}`), element("b", "", String(members.length)));
      const list = element("div", "matrix-case-list");
      if (members.length > 0) list.append(...members.map((entry) => matrixCase(entry, mode.id, effect.id)));
      else {
        const gap = element("p", "matrix-gap", mode.id === "reconstructed" && effect.id === "future"
          ? "Explicit research gap"
          : "No matching cases");
        list.append(gap);
      }
      cell.append(heading, list);
      nodes.push(cell);
    }
  }
  matrix.replaceChildren(...nodes);
}

function availability(label, available) {
  const badge = element("span", available ? "availability available" : "availability planned", `${label}: ${available ? "available" : "planned"}`);
  return badge;
}

function portfolioCard(entry) {
  const card = element("article", "atlas-case-card");
  card.dataset.status = entry.statusKind;
  const header = element("header");
  const identity = element("div");
  identity.append(element("span", "case-domain", entry.domainLabel), element("h3", "", entry.title));
  const status = element("span", "status-chip", entry.statusLabel);
  status.dataset.status = entry.statusKind;
  header.append(identity, status);

  const taxonomy = element("div", "card-taxonomy");
  const modeTags = element("div", "tag-row");
  modeTags.append(element("b", "", "History"), ...entry.historyModes.map((value) => tag(value, "mode", historyModeLabel(value))));
  const effectTags = element("div", "tag-row");
  effectTags.append(element("b", "", "Effect"), ...[...entry.primaryEffects, ...entry.secondaryEffects]
    .map((value) => tag(value, "effect", historyEffectLabel(value))));
  const evidenceTags = element("div", "tag-row evidence-tags");
  evidenceTags.append(element("b", "", "Evidence"), ...entry.evidenceProfile
    .map((value) => tag(value, "evidence", value.replaceAll("-", " "))));
  taxonomy.append(modeTags, effectTags, evidenceTags);

  const availabilityRow = element("div", "availability-row");
  availabilityRow.append(
    availability("Model Pack", entry.modelPackPath !== null),
    availability("Explorer", entry.explorerPath !== null),
    element("span", "analysis-badge", `Historical Load: ${entry.analyses.historicalLoad.replaceAll("-", " ")}`)
  );

  const footer = element("footer");
  const casePage = element("a", "case-open", "Open case");
  casePage.href = projectUrl(entry.casePagePath);
  const detail = element("span", "", entry.distinction);
  footer.append(detail, casePage);
  card.append(header, element("p", "card-summary", entry.summary), taxonomy, availabilityRow, footer);
  return card;
}

function renderPortfolio(cases) {
  const portfolio = document.getElementById("history-portfolio");
  if (cases.length === 0) {
    portfolio.replaceChildren(element("p", "portfolio-empty", "No cases match the current filters."));
    return;
  }
  portfolio.replaceChildren(...cases.map(portfolioCard));
}

function render() {
  const cases = allCases.filter(matches);
  renderMatrix(cases);
  renderPortfolio(cases);
  const activeFilters = Object.values(state).filter(Boolean).length;
  document.getElementById("atlas-filter-summary").textContent = `${cases.length} of ${allCases.length} cases shown${activeFilters ? ` / ${activeFilters} active filter${activeFilters === 1 ? "" : "s"}` : ""}.`;
}

function initialize(cases) {
  allCases = cases;
  document.getElementById("atlas-case-count").textContent = `${cases.length} registered cases`;
  document.getElementById("atlas-result-count").textContent = `${cases.filter((entry) => entry.statusKind === "implemented").length} available`;
  configureFilters(cases);
  render();
  document.body.dataset.ready = "true";
}

function renderFailure(error) {
  const message = document.getElementById("atlas-load-error");
  message.hidden = false;
  message.textContent = `The History Atlas could not load its registry. ${error.message}`;
  document.getElementById("atlas-filter-summary").textContent = "Registry unavailable.";
  document.body.dataset.ready = "error";
}

loadHistoryRegistry().then(createHistoryCases).then(initialize).catch(renderFailure);
