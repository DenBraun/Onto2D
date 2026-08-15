import {
  buildVisualStudy,
  formatMetric,
  profilePath,
  sampleProfile
} from "./model.js?v=20260815.1";

const $ = (selector) => document.querySelector(selector);
const elements = {
  status: $("#load-status"),
  analysisHash: $("#analysis-hash"),
  sourceDoi: $("#source-doi"),
  branchTitle: $("#branch-title"),
  branchVerdict: $("#branch-verdict"),
  branchInterpretation: $("#branch-interpretation"),
  shapeNote: $("#shape-note"),
  gammaBase: $("#gamma-base"),
  gammaExtended: $("#gamma-extended"),
  domainChange: $("#domain-change"),
  rayleigh: $("#rayleigh-value"),
  basePath: $("#base-profile"),
  extendedPath: $("#extended-profile"),
  plotTitle: $("#plot-title"),
  plotDescription: $("#plot-description"),
  gateLocalization: $("#gate-localization"),
  gateGamma: $("#gate-gamma"),
  gateStability: $("#gate-stability"),
  branchDecision: $("#branch-decision"),
  phaseBState: $("#phase-b-state"),
  cubicState: $("#cubic-state"),
  objectState: $("#object-state"),
  phaseDState: $("#phase-d-state")
};

let study;
let activeBranchId = "localized-pulse";

function gate(element, passed) {
  element.dataset.state = passed ? "pass" : "fail";
  element.querySelector("b").textContent = passed ? "YES" : "NO";
  element.querySelector("svg use").setAttribute(
    "href",
    `../../assets/icons/icons.svg#${passed ? "check" : "reject"}`
  );
}

function drawBranch(branch) {
  const maximumY = Math.max(0.55, branch.peak * 1.15);
  elements.basePath.setAttribute(
    "d",
    profilePath(sampleProfile(branch.id, 8), 760, 330, maximumY)
  );
  elements.extendedPath.setAttribute(
    "d",
    profilePath(sampleProfile(branch.id, 12), 760, 330, maximumY)
  );
  elements.plotTitle.textContent = `${branch.shortName}: base and extended domains`;
  elements.plotDescription.textContent = branch.shapeNote;
}

function renderBranch() {
  const branch = study.branches.find((entry) => entry.id === activeBranchId);
  elements.branchTitle.textContent = branch.shortName;
  elements.branchVerdict.textContent = branch.verdict;
  elements.branchInterpretation.textContent = branch.interpretation;
  elements.shapeNote.textContent = branch.shapeNote;
  elements.gammaBase.textContent = formatMetric(branch.gammaBase, 6);
  elements.gammaExtended.textContent = formatMetric(branch.gammaExtended, 6);
  elements.domainChange.textContent = `${formatMetric(100 * branch.domainChange, 4)}%`;
  elements.rayleigh.textContent = formatMetric(branch.rayleigh, 5);
  gate(elements.gateLocalization, branch.localized);
  gate(elements.gateGamma, branch.nontrivial);
  gate(elements.gateStability, branch.stable);
  elements.branchDecision.dataset.state = branch.passed ? "pass" : "fail";
  elements.branchDecision.querySelector("strong").textContent = branch.passed
    ? "QUALIFIES AS A TRIAL OBJECT"
    : "STOP: NOT AN OBJECT";
  elements.branchDecision.querySelector("span").textContent = branch.passed
    ? "All three necessary checks passed."
    : `Failed gate: ${branch.failedGates.join(", ")}`;
  drawBranch(branch);
  document.querySelectorAll("[data-branch]").forEach((button) => {
    const active = button.dataset.branch === activeBranchId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

async function loadStudy() {
  const [integratedResponse, objecthoodResponse] = await Promise.all([
    fetch("../../cases/level-0-oscillator/artifacts/level-zero-validation-v1.json"),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-objecthood-v1.json")
  ]);
  if (!integratedResponse.ok || !objecthoodResponse.ok) {
    throw new Error("Frozen Level-0 artifacts could not be loaded.");
  }
  study = buildVisualStudy(
    await integratedResponse.json(),
    await objecthoodResponse.json()
  );
  elements.analysisHash.textContent = study.analysisHash;
  elements.sourceDoi.textContent = study.sourceDoi;
  elements.phaseBState.textContent = study.phaseBPassed ? "PASS" : "FAIL";
  elements.cubicState.textContent = study.cubicRejected ? "REJECTED" : "UNRESOLVED";
  elements.objectState.textContent = study.levelZeroValidated ? "QUALIFIED" : "NO NODE";
  elements.phaseDState.textContent = study.phaseDStopped ? "NOT RUN" : "AVAILABLE";
  elements.status.textContent = "Frozen artifact loaded";
  elements.status.dataset.state = "ready";
  renderBranch();
}

document.querySelectorAll("[data-branch]").forEach((button) => {
  button.addEventListener("click", () => {
    activeBranchId = button.dataset.branch;
    renderBranch();
  });
});

loadStudy().catch((error) => {
  elements.status.textContent = error.message;
  elements.status.dataset.state = "error";
});
