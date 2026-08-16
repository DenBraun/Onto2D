import {
  buildExpandedSearchView,
  buildVisualStudy,
  buildDynamicsView,
  formatMetric,
  normalizedDifferenceProfile,
  profilePath,
  sampleProfile,
  seriesPath
} from "./level-zero-visual-model.js?v=20260816.11";

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
  dynamicsResolution: $("#dynamics-resolution"),
  expandedStatus: $("#expanded-status"),
  expandedHash: $("#expanded-hash"),
  expandedSummary: $("#expanded-summary"),
  expandedScenarioTabs: $("#expanded-scenario-tabs"),
  expandedTitle: $("#expanded-title"),
  expandedNote: $("#expanded-note"),
  expandedEligibility: $("#expanded-eligibility"),
  expandedDecision: $("#expanded-decision"),
  expandedFailedGates: $("#expanded-failed-gates"),
  expandedAsymmetry: $("#expanded-asymmetry"),
  expandedGamma: $("#expanded-gamma"),
  expandedRealHessian: $("#expanded-real-hessian"),
  expandedPhaseHessian: $("#expanded-phase-hessian"),
  expandedWorstDynamics: $("#expanded-worst-dynamics"),
  expandedComponent1: $("#expanded-component-1"),
  expandedComponent2: $("#expanded-component-2"),
  expandedComponent3: $("#expanded-component-3"),
  expandedTraceCommon: $("#expanded-trace-common"),
  expandedTraceRelative: $("#expanded-trace-relative"),
  expandedTraceOffCenter: $("#expanded-trace-off-center"),
  expandedTraceWave: $("#expanded-trace-wave")
};

let study;
let dynamicsView;
let expandedView;
let activeBranchId = "localized-pulse";
let activeExpandedScenarioId = "mild-mass-split";

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

const expandedTraceElements = Object.freeze({
  "complex-common-phase": elements.expandedTraceCommon,
  "complex-relative-phase": elements.expandedTraceRelative,
  "real-off-center": elements.expandedTraceOffCenter,
  "complex-wave-packet": elements.expandedTraceWave
});

function renderExpandedScenario() {
  const scenario = expandedView.scenarios.find(
    (entry) => entry.id === activeExpandedScenarioId
  );
  if (!scenario) throw new TypeError("The selected expanded scenario is unavailable.");

  const componentMaximum = Math.max(...scenario.stationary.components.flat());
  const profileBounds = {
    xMin: Math.min(...scenario.stationary.x),
    xMax: Math.max(...scenario.stationary.x),
    yMin: 0,
    yMax: Math.max(0.1, componentMaximum * 1.12)
  };
  [
    elements.expandedComponent1,
    elements.expandedComponent2,
    elements.expandedComponent3
  ].forEach((path, index) => {
    path.setAttribute(
      "d",
      seriesPath(
        scenario.stationary.x,
        scenario.stationary.components[index],
        720,
        300,
        profileBounds
      )
    );
  });

  for (const probe of scenario.dynamics) {
    expandedTraceElements[probe.id].setAttribute(
      "d",
      seriesPath(probe.times, probe.amplification, 720, 300, {
        xMin: probe.times[0],
        xMax: probe.times.at(-1),
        yMin: 0,
        yMax: 10.5
      })
    );
  }

  const values = scenario.values;
  elements.expandedTitle.textContent = scenario.name;
  elements.expandedNote.textContent = scenario.note;
  elements.expandedEligibility.textContent = scenario.eligible
    ? "PREREGISTERED TEST"
    : "DISCLOSED CONTROL";
  elements.expandedEligibility.dataset.state = scenario.eligible ? "test" : "control";
  elements.expandedDecision.textContent = scenario.passed ? "QUALIFIED" : "REJECTED";
  elements.expandedDecision.dataset.state = scenario.passed ? "pass" : "fail";
  elements.expandedFailedGates.textContent = scenario.failedGates.length > 0
    ? `Failed necessary gates: ${scenario.failedGates.join(", ")}.`
    : "Every declared necessary gate passed.";
  elements.expandedAsymmetry.textContent = formatMetric(
    values.component_asymmetry_index_fine,
    5
  );
  elements.expandedGamma.textContent = formatMetric(values.gamma_fine, 6);
  elements.expandedRealHessian.textContent = scenario.gates.realAmplitudeStabilityPassed
    ? "positive definite"
    : "not positive definite";
  elements.expandedPhaseHessian.textContent = scenario.gates.complexPhaseStabilityPassed
    ? "positive definite"
    : "not positive definite";
  elements.expandedWorstDynamics.textContent = `${formatMetric(
    values.dynamic_worst_amplification_space_refined,
    6
  )}x`;

  elements.expandedScenarioTabs.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.expandedScenario === activeExpandedScenarioId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function renderExpanded() {
  elements.expandedScenarioTabs.replaceChildren();
  expandedView.scenarios.forEach((scenario, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.expandedScenario = scenario.id;
    button.setAttribute("aria-pressed", "false");
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("strong");
    label.textContent = scenario.shortName;
    const result = document.createElement("small");
    result.textContent = scenario.eligible ? "tested / rejected" : "control";
    button.append(number, label, result);
    button.addEventListener("click", () => {
      activeExpandedScenarioId = scenario.id;
      renderExpandedScenario();
    });
    elements.expandedScenarioTabs.append(button);
  });
  elements.expandedSummary.textContent = `${expandedView.qualifiedCount} / ${expandedView.eligibleCount} qualified`;
  elements.expandedStatus.textContent = "BOUNDED NEGATIVE RESULT";
  elements.expandedHash.textContent = expandedView.expandedAnalysisHash;
  renderExpandedScenario();
}

async function loadStudy() {
  const [
    integratedV1Response,
    integratedV2Response,
    objecthoodResponse,
    dynamicsResponse,
    expandedResponse
  ] = await Promise.all([
    fetch("../../cases/level-0-oscillator/artifacts/level-zero-validation-v1.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/level-zero-validation-v2.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-objecthood-v1.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-dynamics-v1.json", { cache: "no-store" }),
    fetch("../../cases/level-0-oscillator/artifacts/phase-c-expanded-search-v1.json", { cache: "no-store" })
  ]);
  if (
    !integratedV1Response.ok ||
    !integratedV2Response.ok ||
    !objecthoodResponse.ok ||
    !dynamicsResponse.ok ||
    !expandedResponse.ok
  ) {
    throw new Error("Frozen Level-0 artifacts could not be loaded.");
  }
  const integratedV1Artifact = await integratedV1Response.json();
  const integratedV2Artifact = await integratedV2Response.json();
  const objecthoodArtifact = await objecthoodResponse.json();
  study = buildVisualStudy(
    integratedV1Artifact,
    objecthoodArtifact
  );
  dynamicsView = buildDynamicsView(objecthoodArtifact, await dynamicsResponse.json());
  expandedView = buildExpandedSearchView(
    integratedV2Artifact,
    await expandedResponse.json()
  );
  elements.analysisHash.textContent = expandedView.analysisHash;
  elements.sourceDoi.textContent = study.sourceDoi;
  elements.phaseBState.textContent = study.phaseBPassed ? "PASS" : "FAIL";
  elements.cubicState.textContent = study.cubicRejected ? "REJECTED" : "UNRESOLVED";
  elements.objectState.textContent = study.levelZeroValidated ? "QUALIFIED" : "NO NODE";
  elements.phaseDState.textContent = study.phaseDStopped ? "NOT RUN" : "AVAILABLE";
  elements.status.textContent = "Five frozen artifacts loaded";
  elements.status.dataset.state = "ready";
  renderBranch();
  renderDynamics();
  renderExpanded();
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
  elements.expandedStatus.textContent = "EXPANDED SEARCH UNAVAILABLE";
  elements.expandedStatus.dataset.state = "error";
});
