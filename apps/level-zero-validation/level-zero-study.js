import {
  buildVisualStudy,
  buildDynamicsView,
  formatMetric,
  normalizedDifferenceProfile,
  profilePath,
  sampleProfile,
  seriesPath
} from "./level-zero-visual-model.js?v=20260816.10";

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
  phaseDState: $("#phase-d-state"),
  dynamicsStatus: $("#dynamics-status"),
  dynamicsHash: $("#dynamics-hash"),
  dynamicsSlider: $("#dynamics-time-slider"),
  dynamicsTime: $("#dynamics-time"),
  dynamicsAmplification: $("#dynamics-amplification"),
  dynamicsGammaChange: $("#dynamics-gamma-change"),
  dynamicsProfileControl: $("#dynamics-profile-control"),
  dynamicsProfilePerturbed: $("#dynamics-profile-perturbed"),
  dynamicsProfileDifference: $("#dynamics-profile-difference"),
  dynamicsPointwiseDifference: $("#dynamics-pointwise-difference"),
  dynamicsAmplificationSymmetric: $("#dynamics-amplification-symmetric"),
  dynamicsAmplificationAntisymmetric: $("#dynamics-amplification-antisymmetric"),
  dynamicsThresholdLine: $("#dynamics-threshold-line"),
  dynamicsThresholdLabel: $("#dynamics-threshold-label"),
  dynamicsPlayhead: $("#dynamics-playhead"),
  dynamicsSymmetricMarker: $("#dynamics-symmetric-marker"),
  dynamicsAntisymmetricMarker: $("#dynamics-antisymmetric-marker"),
  dynamicsMaximum: $("#dynamics-maximum"),
  dynamicsAntisymmetricMaximum: $("#dynamics-antisymmetric-maximum"),
  dynamicsDeparture: $("#dynamics-departure"),
  dynamicsEnergyDrift: $("#dynamics-energy-drift"),
  dynamicsResolution: $("#dynamics-resolution")
};

let study;
let dynamicsView;
let activeBranchId = "localized-pulse";

function gate(element, passed) {
  element.dataset.state = passed ? "pass" : "fail";
  element.querySelector("b").textContent = passed ? "YES" : "NO";
  element.querySelector("svg use").setAttribute(
    "href",
    `../../assets/icons/ui-symbols.svg#${passed ? "check" : "reject"}`
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

function renderDynamicsFrame(index) {
  const frame = dynamicsView.frames[index];
  const maximumY = dynamicsView.profileMaximum * 1.08;
  const bounds = { xMin: -8, xMax: 8, yMin: 0, yMax: maximumY };
  elements.dynamicsProfileControl.setAttribute(
    "d",
    seriesPath(frame.x, frame.controlComposite, 720, 300, bounds)
  );
  elements.dynamicsProfilePerturbed.setAttribute(
    "d",
    seriesPath(frame.x, frame.perturbedComposite, 720, 300, bounds)
  );
  const difference = normalizedDifferenceProfile(
    frame,
    dynamicsView.initialPointwiseDifferenceMaximum
  );
  const pointwiseMaximum = Math.max(...difference);
  elements.dynamicsProfileDifference.setAttribute(
    "d",
    seriesPath(frame.x, difference, 720, 170, {
      xMin: -8,
      xMax: 8,
      yMin: 0,
      yMax: 32
    })
  );
  elements.dynamicsPointwiseDifference.textContent = `${formatMetric(pointwiseMaximum, 5)}x initial`;

  const times = dynamicsView.frames.map((item) => item.time);
  const maximumGrowthY = Math.max(30, dynamicsView.maximumAmplification * 1.08);
  const playheadX = 48 + (frame.time - times[0]) / (times.at(-1) - times[0]) * 654;
  const symmetricY = 22 + 240 - frame.amplification / maximumGrowthY * 240;
  const antisymmetricY = 22 + 240 - (
    dynamicsView.antisymmetricFrames[index].amplification / maximumGrowthY * 240
  );
  elements.dynamicsPlayhead.setAttribute("d", `M${playheadX.toFixed(2)} 22V262`);
  elements.dynamicsSymmetricMarker.setAttribute("cx", playheadX.toFixed(2));
  elements.dynamicsSymmetricMarker.setAttribute("cy", symmetricY.toFixed(2));
  elements.dynamicsAntisymmetricMarker.setAttribute("cx", playheadX.toFixed(2));
  elements.dynamicsAntisymmetricMarker.setAttribute("cy", antisymmetricY.toFixed(2));
  elements.dynamicsTime.textContent = formatMetric(frame.time, 4);
  elements.dynamicsAmplification.textContent = `${formatMetric(frame.amplification, 5)}x`;
  elements.dynamicsGammaChange.textContent = `${formatMetric(100 * frame.gammaRelativeChange, 4)}%`;
  elements.dynamicsSlider.value = String(index);
  elements.dynamicsSlider.setAttribute("aria-valuetext", `time ${formatMetric(frame.time, 4)}`);
}

function renderDynamics() {
  const times = dynamicsView.frames.map((frame) => frame.time);
  const symmetric = dynamicsView.frames.map((frame) => frame.amplification);
  const antisymmetric = dynamicsView.antisymmetricFrames.map((frame) => frame.amplification);
  const maximumY = Math.max(30, dynamicsView.maximumAmplification * 1.08);
  const bounds = {
    xMin: times[0],
    xMax: times.at(-1),
    yMin: 0,
    yMax: maximumY
  };
  elements.dynamicsAmplificationSymmetric.setAttribute(
    "d",
    seriesPath(times, symmetric, 720, 300, bounds)
  );
  elements.dynamicsAmplificationAntisymmetric.setAttribute(
    "d",
    seriesPath(times, antisymmetric, 720, 300, bounds)
  );
  const thresholdY = 22 + 240 - 10 / maximumY * 240;
  elements.dynamicsThresholdLine.setAttribute("d", `M48 ${thresholdY.toFixed(2)}H702`);
  elements.dynamicsThresholdLabel.setAttribute("y", (thresholdY - 7).toFixed(2));
  elements.dynamicsSlider.max = String(dynamicsView.frames.length - 1);
  elements.dynamicsMaximum.textContent = `${formatMetric(dynamicsView.maximumAmplification, 6)}x`;
  elements.dynamicsAntisymmetricMaximum.textContent = `${formatMetric(
    dynamicsView.antisymmetricMaximum,
    5
  )}x`;
  elements.dynamicsDeparture.textContent = `t = ${formatMetric(dynamicsView.departureTime, 5)}`;
  elements.dynamicsEnergyDrift.textContent = formatMetric(dynamicsView.energyDrift, 4);
  elements.dynamicsResolution.textContent = `${formatMetric(
    100 * Math.max(dynamicsView.timeResolutionChange, dynamicsView.spaceResolutionChange),
    3
  )}%`;
  elements.dynamicsStatus.textContent = "INSTABILITY CONFIRMED";
  elements.dynamicsHash.textContent = dynamicsView.analysisHash;
  renderDynamicsFrame(dynamicsView.frames.length - 1);
}

async function loadStudy() {
  const [integratedResponse, objecthoodResponse, dynamicsResponse] = await Promise.all([
    fetch("../../cases/level-0-oscillator/artifacts/level-zero-validation-v1.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-objecthood-v1.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-dynamics-v1.json", { cache: "no-store" })
  ]);
  if (!integratedResponse.ok || !objecthoodResponse.ok || !dynamicsResponse.ok) {
    throw new Error("Frozen Level-0 artifacts could not be loaded.");
  }
  const objecthoodArtifact = await objecthoodResponse.json();
  study = buildVisualStudy(
    await integratedResponse.json(),
    objecthoodArtifact
  );
  dynamicsView = buildDynamicsView(objecthoodArtifact, await dynamicsResponse.json());
  elements.analysisHash.textContent = study.analysisHash;
  elements.sourceDoi.textContent = study.sourceDoi;
  elements.phaseBState.textContent = study.phaseBPassed ? "PASS" : "FAIL";
  elements.cubicState.textContent = study.cubicRejected ? "REJECTED" : "UNRESOLVED";
  elements.objectState.textContent = study.levelZeroValidated ? "QUALIFIED" : "NO NODE";
  elements.phaseDState.textContent = study.phaseDStopped ? "NOT RUN" : "AVAILABLE";
  elements.status.textContent = "Three frozen artifacts loaded";
  elements.status.dataset.state = "ready";
  renderBranch();
  renderDynamics();
}

document.querySelectorAll("[data-branch]").forEach((button) => {
  button.addEventListener("click", () => {
    activeBranchId = button.dataset.branch;
    renderBranch();
  });
});

elements.dynamicsSlider.addEventListener("input", () => {
  renderDynamicsFrame(Number.parseInt(elements.dynamicsSlider.value, 10));
});

loadStudy().catch((error) => {
  elements.status.textContent = error.message;
  elements.status.dataset.state = "error";
  elements.dynamicsStatus.textContent = "DYNAMICS UNAVAILABLE";
  elements.dynamicsStatus.dataset.state = "error";
});
