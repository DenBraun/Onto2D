import {
  HISTORY_MODES,
  createHistoryCases,
  loadHistoryRegistry
} from "../../apps/external-cases/external-cases-catalog.js?v=20260825.2";

const caseMenu = document.querySelector(".cases-menu");

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCaseMenu(cases) {
  const groups = document.getElementById("history-case-menu-groups");
  groups.replaceChildren(...HISTORY_MODES.map((mode) => {
    const section = element("section", "cases-menu-group");
    const heading = element("h3", "", mode.label);
    const list = element("ol");
    list.append(...cases.filter((entry) => entry.primaryHistoryMode === mode.id).map((entry) => {
      const item = element("li");
      const link = element("a");
      link.href = `./${entry.casePagePath}`;
      const status = element("small", "", entry.statusLabel);
      status.dataset.status = entry.statusKind;
      link.append(element("strong", "", entry.shortTitle), status);
      item.append(link);
      return item;
    }));
    section.append(heading, list);
    return section;
  }));
}

function renderCaseMenuFailure() {
  const groups = document.getElementById("history-case-menu-groups");
  groups.replaceChildren(element("p", "cases-menu-error", "Case registry unavailable. Open the History Atlas to retry."));
}

if (caseMenu) {
  const summary = caseMenu.querySelector("summary");

  document.addEventListener("click", (event) => {
    if (caseMenu.open && !caseMenu.contains(event.target)) caseMenu.open = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !caseMenu.open) return;
    caseMenu.open = false;
    summary.focus();
  });

  loadHistoryRegistry().then(createHistoryCases).then(renderCaseMenu).catch(renderCaseMenuFailure);
}
