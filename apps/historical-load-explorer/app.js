import {
  CONSTRAINTS,
  EXAMPLES,
  PRESETS,
  analyzeCase,
  constraintsForStrictness,
  matchingPreset
} from "./model.js?v=20260814.2";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  caseSelect: $("#case-select"),
  constraintList: $("#constraint-list"),
  contributionList: $("#contribution-list"),
  strictness: $("#strictness"),
  strictnessValue: $("#strictness-value"),
  phaseCopy: $("#phase-copy"),
  resultBlock: $("#result-block"),
  loadValue: $("#load-value"),
  resultMeaning: $("#result-meaning"),
  resultContext: $("#result-context"),
  freeValue: $("#free-value"),
  admissibleValue: $("#admissible-value"),
  freePathLength: $("#free-path-length"),
  admissiblePathLength: $("#admissible-path-length"),
  freePathName: $("#free-path-name"),
  admissiblePathName: $("#admissible-path-name"),
  freePathGraph: $("#free-path-graph"),
  admissiblePathGraph: $("#admissible-path-graph"),
  freePathDrawing: $("#free-path-drawing"),
  admissiblePathDrawing: $("#admissible-path-drawing"),
  pathPair: $("#path-pair"),
  pathView: $("#path-view"),
  objectView: $("#object-view"),
  objectFreeValue: $("#object-free-value"),
  objectAdmissibleValue: $("#object-admissible-value"),
  explainButton: $("#explain-button"),
  divergenceButton: $("#divergence-button"),
  resultExplanation: $("#result-explanation"),
  explanationTitle: $("#explanation-title"),
  explanationCopy: $("#explanation-copy"),
  traceRejectedName: $("#trace-rejected-name"),
  traceAcceptedName: $("#trace-accepted-name"),
  traceReason: $("#trace-reason"),
  findingCard: $("#finding-card"),
  rejectedCount: $("#rejected-count"),
  findingCopy: $("#finding-copy"),
  firstFailureCode: $("#first-failure-code"),
  firstFailureLabel: $(".first-failure span"),
  noveltyValue: $("#novelty-value"),
  irreducibleValue: $("#irreducible-value"),
  degeneracyValue: $("#degeneracy-value"),
  cohortValue: $("#cohort-value"),
  exampleList: $("#example-list"),
  methodsDialog: $("#methods-dialog")
};

const missingElements = Object.entries(elements)
  .filter(([, element]) => element === null)
  .map(([name]) => name);

if (missingElements.length > 0) {
  throw new Error(`Explorer markup/script mismatch. Reload the page. Missing: ${missingElements.join(", ")}`);
}

const presetStrictness = Object.freeze({
  free: 12,
  minimal: 43,
  physical: 67,
  soma: 75
});

const state = {
  caseId: "constitutive-bridge",
  activeConstraintIds: new Set(PRESETS.physical),
  strictnessValue: 67,
  view: "path",
  explanationOpen: false,
  divergenceVisible: false
};

function formatLoad(value, includePlus = true) {
  if (!Number.isFinite(value)) return "∞";
  if (value === 0) return "0";
  return includePlus ? `+${value}` : String(value);
}

function formatContribution(value) {
  if (value === null) return "—";
  if (value === Number.POSITIVE_INFINITY) return "Δ ∞";
  if (value === Number.NEGATIVE_INFINITY) return "Δ −∞";
  if (value > 0) return `Δ +${value}`;
  return `Δ ${value}`;
}

function constraintById(id) {
  return CONSTRAINTS.find((constraint) => constraint.id === id);
}

function toSubscript(value) {
  return String(value).replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
}

function failureCode(result) {
  if (!result.firstDivergence) return "all(F) = true";
  const constraint = constraintById(result.firstDivergence.constraintId);
  const stateName = `S${toSubscript(result.firstDivergence.atStep)}`;
  return `${constraint.notation.replace("(s)", `(${stateName})`)} = false`;
}

function renderCaseOptions() {
  elements.caseSelect.innerHTML = EXAMPLES.map((example) => (
    `<option value="${example.id}">${example.number} — ${example.title}</option>`
  )).join("");
}

function renderConstraints(result) {
  elements.constraintList.innerHTML = CONSTRAINTS.map((constraint) => {
    const checked = state.activeConstraintIds.has(constraint.id);
    const contribution = result.contributions[constraint.id];
    const impactClass = contribution > 0 || contribution === Number.POSITIVE_INFINITY ? " is-positive" : "";
    const disabled = checked ? "" : " disabled";
    const ablationLabel = checked
      ? `Ablate ${constraint.label}; current contribution ${formatContribution(contribution)}`
      : `${constraint.label} is inactive`;

    return `
      <div class="constraint-row" title="${constraint.description}">
        <input id="constraint-${constraint.id}" type="checkbox" data-constraint="${constraint.id}"${checked ? " checked" : ""}>
        <label class="checkmark" for="constraint-${constraint.id}" aria-hidden="true"></label>
        <label class="constraint-copy" for="constraint-${constraint.id}">
          <strong>${constraint.label}</strong>
          <small>${constraint.notation}</small>
        </label>
        <button class="constraint-impact${impactClass}" type="button" data-ablate="${constraint.id}" aria-label="${ablationLabel}"${disabled}>${formatContribution(contribution)}</button>
      </div>`;
  }).join("");
}

function renderContributions(result) {
  const activeConstraints = CONSTRAINTS.filter((constraint) => state.activeConstraintIds.has(constraint.id));
  if (activeConstraints.length === 0) {
    elements.contributionList.innerHTML = '<p class="empty-contributions">No active rules to ablate.</p>';
    return;
  }

  elements.contributionList.innerHTML = activeConstraints.map((constraint) => {
    const contribution = result.contributions[constraint.id];
    const positive = contribution > 0 || contribution === Number.POSITIVE_INFINITY;
    return `
      <button class="contribution-item${positive ? " is-positive" : ""}" type="button" data-ablate="${constraint.id}" title="Remove ${constraint.label} and recompute">
        <span>${constraint.shortLabel}</span>
        <span>${formatContribution(contribution)}</span>
      </button>`;
  }).join("");
}

function renderPresets() {
  const preset = matchingPreset(state.activeConstraintIds);
  $$('[data-preset]').forEach((button) => {
    const active = button.dataset.preset === preset;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (state.strictnessValue !== null) elements.strictness.value = String(state.strictnessValue);
  elements.strictnessValue.textContent = state.strictnessValue === null
    ? "custom"
    : (state.strictnessValue / 100).toFixed(2);
}

function renderReadout(result) {
  const load = result.historicalLoad;
  const stateName = !Number.isFinite(load) ? "unreachable" : load === 0 ? "neutral" : "positive";
  elements.resultBlock.dataset.state = stateName;
  elements.loadValue.textContent = formatLoad(load);
  elements.loadValue.classList.remove("is-changing");
  requestAnimationFrame(() => elements.loadValue.classList.add("is-changing"));

  if (!Number.isFinite(load)) {
    elements.resultMeaning.textContent = "The target is unreachable under this regime.";
    elements.resultContext.textContent = "It remains constructible in the free path space.";
    elements.phaseCopy.textContent = "Current phase: unreachable";
  } else if (load === 0) {
    elements.resultMeaning.textContent = "Admissibility adds no assembly steps.";
    elements.resultContext.textContent = result.firstDivergence
      ? "A free optimum is removed, but an equally short history survives."
      : "The free optimum already satisfies every active predicate.";
    elements.phaseCopy.textContent = "Current phase: no historical burden";
  } else {
    elements.resultMeaning.textContent = `Admissibility adds ${load} assembly ${load === 1 ? "step" : "steps"}.`;
    elements.resultContext.textContent = "Added formation burden—not downstream generative capacity.";
    elements.phaseCopy.textContent = "Current phase: finite historical load";
  }

  const admissibleLength = result.admissiblePath?.length ?? "∞";
  elements.freeValue.textContent = String(result.freePath.length);
  elements.admissibleValue.textContent = String(admissibleLength);
  elements.freePathLength.textContent = String(result.freePath.length);
  elements.admissiblePathLength.textContent = String(admissibleLength);
  elements.objectFreeValue.textContent = String(result.freePath.length);
  elements.objectAdmissibleValue.textContent = String(admissibleLength);
  elements.freePathName.textContent = result.freePath.name;
  elements.admissiblePathName.textContent = result.admissiblePath?.name ?? "No surviving path";
}

function sequencePoints(length) {
  const left = 28;
  const right = 362;
  const middleY = 102;
  const offsets = [-13, 10, -7, 14, 2];
  return Array.from({ length: length + 1 }, (_, step) => ({
    step,
    x: left + ((right - left) * step / length),
    y: step === 0 || step === length ? middleY : middleY + offsets[(step - 1) % offsets.length]
  }));
}

function shouldLabelState(step, length, blockedStep) {
  if (step === 0 || step === length) return true;
  if (length <= 8) return true;
  return step === blockedStep || step === 1 || step === length - 1 || step % 3 === 0;
}

function renderSequenceGraph({ graph, drawing, length, mode, blockedStep = null, rule = null }) {
  const isFree = mode === "free";
  const points = sequencePoints(length);
  const pathData = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y}`).join(" ");
  const radius = length > 10 ? 4.25 : 5.5;

  const grid = points.map((point) => (
    `<path class="sequence-grid-line" d="M${point.x.toFixed(2)} 68V142"></path>`
  )).join("");

  const nodes = points.map((point) => {
    if (point.step === length) {
      return `<g class="sequence-target" data-step="${point.step}" transform="translate(${point.x.toFixed(2)} ${point.y})"><circle r="12"></circle><text y="4">X</text></g>`;
    }

    const isBlocked = point.step === blockedStep;
    const labelVisible = shouldLabelState(point.step, length, blockedStep);
    const labelY = point.y <= 102 ? point.y - 13 : point.y + 19;
    const label = point.step === 0 ? "START" : `S${toSubscript(point.step)}`;
    const nodeMarkup = isBlocked
      ? `<g class="sequence-node blocked-point" data-step="${point.step}" transform="translate(${point.x.toFixed(2)} ${point.y})"><circle r="9"></circle><path d="m-4 -4 8 8m0-8-8 8"></path></g>`
      : `<circle class="sequence-node" data-step="${point.step}" cx="${point.x.toFixed(2)}" cy="${point.y}" r="${radius}"></circle>`;
    const labelMarkup = labelVisible
      ? `<text class="sequence-state-label" x="${point.x.toFixed(2)}" y="${point.step === 0 ? 159 : labelY}" text-anchor="middle">${label}</text>`
      : "";
    return `${nodeMarkup}${labelMarkup}`;
  }).join("");

  let callout = "";
  if (blockedStep !== null && rule) {
    const blockedPoint = points[blockedStep];
    const placeRight = blockedPoint.x < 210;
    const textX = blockedPoint.x + (placeRight ? 12 : -12);
    const lineEnd = textX + (placeRight ? -5 : 5);
    const anchor = placeRight ? "start" : "end";
    callout = `
      <g class="invalid-callout">
        <path d="M${blockedPoint.x.toFixed(2)} ${blockedPoint.y - 11}V48H${lineEnd.toFixed(2)}"></path>
        <text x="${textX.toFixed(2)}" y="31" text-anchor="${anchor}">FIRST REJECTED STATE</text>
        <text class="callout-rule" x="${textX.toFixed(2)}" y="44" text-anchor="${anchor}">${rule}</text>
      </g>`;
  }

  drawing.innerHTML = `
    <path class="sequence-axis-line" d="M28 176H362"></path>
    ${grid}
    <path class="sequence-route ${isFree ? "free-route" : "allowed-route"}" d="${pathData}"></path>
    ${nodes}
    ${callout}
    <text class="sequence-axis-label" x="195" y="193" text-anchor="middle">CONSTRUCTION STEP →</text>`;

  const title = graph.querySelector("title");
  const description = graph.querySelector("desc");
  title.textContent = isFree ? `Free optimum: ${length} construction steps` : `Admissible optimum: ${length} construction steps`;
  description.textContent = blockedStep === null
    ? `A ${length}-step sequence reaches target X and survives the displayed regime.`
    : `A ${length}-step sequence reaches target X, but state S${blockedStep} is rejected because ${rule}.`;
}

function renderUnreachableGraph() {
  elements.admissiblePathDrawing.innerHTML = `
    <path class="sequence-axis-line" d="M28 176H362"></path>
    <path class="sequence-route unreachable-route" d="M28 102H225"></path>
    <circle class="sequence-node" cx="28" cy="102" r="5.5"></circle>
    <text class="sequence-state-label" x="28" y="159" text-anchor="middle">START</text>
    <g class="unreachable-stop" transform="translate(225 102)"><circle r="11"></circle><path d="m-5 -5 10 10m0-10-10 10"></path></g>
    <text class="unreachable-title" x="246" y="96">NO SURVIVING PATH</text>
    <text class="unreachable-copy" x="246" y="113">F removes every candidate</text>
    <text class="sequence-axis-label" x="195" y="193" text-anchor="middle">CONSTRUCTION STEP →</text>`;
  elements.admissiblePathGraph.querySelector("title").textContent = "Target unreachable under active filter";
  elements.admissiblePathGraph.querySelector("desc").textContent = "Every disclosed construction path is removed by the active admissibility filter.";
}

function renderPaths(result) {
  const freeEvaluation = result.evaluatedPaths.find((path) => path.id === result.freePath.id);
  const freeIsValid = freeEvaluation?.admissible ?? false;
  const code = failureCode(result);
  const freeStatus = $(".free-path-card > p > span:first-child");
  const admissibleCard = $(".admissible-path-card");

  elements.pathPair.classList.toggle("is-free-valid", freeIsValid);
  elements.pathPair.classList.toggle("is-divergence", state.divergenceVisible && Boolean(result.firstDivergence));
  freeStatus.className = freeIsValid ? "valid-tag" : "invalid-tag";
  freeStatus.textContent = freeIsValid ? "Valid under F" : "Invalid under F";
  admissibleCard.classList.toggle("is-unreachable", !result.admissiblePath);

  const freeBlockedStep = !freeIsValid && result.firstDivergence?.pathId === result.freePath.id
    ? result.firstDivergence.atStep
    : null;
  renderSequenceGraph({
    graph: elements.freePathGraph,
    drawing: elements.freePathDrawing,
    length: result.freePath.length,
    mode: "free",
    blockedStep: freeBlockedStep,
    rule: freeBlockedStep === null ? null : code
  });

  if (result.admissiblePath) {
    renderSequenceGraph({
      graph: elements.admissiblePathGraph,
      drawing: elements.admissiblePathDrawing,
      length: result.admissiblePath.length,
      mode: "admissible"
    });
    elements.admissiblePathName.textContent = `${result.admissiblePath.name} · ${result.admissiblePath.length} steps survive F`;
  } else {
    renderUnreachableGraph();
    elements.admissiblePathName.textContent = "Every disclosed history is filtered out";
  }
  elements.freePathName.textContent = freeBlockedStep === null
    ? `${result.freePath.name} · survives F`
    : `${result.freePath.name} · rejected at S${toSubscript(freeBlockedStep)}`;

  elements.divergenceButton.disabled = !result.firstDivergence;
  elements.divergenceButton.setAttribute("aria-pressed", String(state.divergenceVisible && Boolean(result.firstDivergence)));
  elements.divergenceButton.textContent = result.firstDivergence && state.divergenceVisible
    ? "Hide first divergence"
    : "Show first divergence";
  const divergenceDot = document.createElement("i");
  elements.divergenceButton.prepend(divergenceDot);
}

function renderFinding(result) {
  const load = result.historicalLoad;
  const rejectedBeforeOptimum = result.evaluatedPaths.filter((path) => (
    !path.admissible && (!result.admissiblePath || path.length < result.admissiblePath.length)
  )).length;
  const code = failureCode(result);
  const title = $(".finding-card .overline");

  if (!Number.isFinite(load)) {
    title.textContent = "Why ΔH = ∞";
    elements.rejectedCount.textContent = "No path survives";
    elements.findingCopy.textContent = "Every disclosed candidate violates at least one active predicate.";
  } else if (load === 0) {
    title.textContent = "Why ΔH = 0";
    elements.rejectedCount.textContent = result.firstDivergence ? "An equal optimum survives" : "The optimum survives";
    elements.findingCopy.textContent = result.firstDivergence
      ? "Filtering removes a path, but not the minimum assembly length."
      : "No active predicate removes the shortest construction.";
  } else {
    title.textContent = "Why ΔH > 0";
    elements.rejectedCount.textContent = `${rejectedBeforeOptimum} shorter ${rejectedBeforeOptimum === 1 ? "path" : "paths"}`;
    elements.findingCopy.textContent = "were eliminated by the active admissibility predicates.";
  }
  elements.firstFailureCode.textContent = code;
  elements.firstFailureLabel.textContent = result.firstDivergence ? "First failed test" : "Filter status";
}

function renderProperties(result) {
  elements.noveltyValue.textContent = String(result.example.novelty);
  elements.irreducibleValue.textContent = result.example.irreducible;
  elements.degeneracyValue.textContent = String(result.example.degeneracy);
  elements.cohortValue.textContent = String(result.example.cohortSize);
}

function renderExplanation(result) {
  elements.resultExplanation.hidden = !state.explanationOpen;
  elements.explainButton.setAttribute("aria-expanded", String(state.explanationOpen));
  elements.explainButton.firstChild.textContent = state.explanationOpen ? "Hide explanation " : "Explain this result ";
  $("#explain-button span").textContent = state.explanationOpen ? "↑" : "↓";

  const code = failureCode(result);
  if (!result.firstDivergence) {
    elements.explanationTitle.textContent = "No divergence in the optimum";
    elements.traceRejectedName.textContent = "No rejected optimum";
    elements.traceAcceptedName.textContent = result.admissiblePath?.name ?? "No surviving path";
    elements.traceReason.textContent = "all(F) = true";
    elements.explanationCopy.textContent = `The free construction already satisfies the active filter, so both optima remain ${result.freePath.length} steps.`;
    return;
  }

  elements.explanationTitle.textContent = "Where history becomes more expensive";
  elements.traceRejectedName.textContent = result.firstDivergence.pathName;
  elements.traceAcceptedName.textContent = result.admissiblePath?.name ?? "No surviving path";
  elements.traceReason.textContent = code;
  elements.explanationCopy.textContent = result.admissiblePath
    ? `The free optimum fails at step ${result.firstDivergence.atStep}. The shortest surviving construction reaches the same target in ${result.admissiblePath.length} rather than ${result.freePath.length} steps.`
    : `The first candidate fails at step ${result.firstDivergence.atStep}, and no disclosed construction survives the complete filter.`;
}

function renderView() {
  const pathActive = state.view === "path";
  elements.pathView.hidden = !pathActive;
  elements.objectView.hidden = pathActive;
  $$('[data-view]').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderExamples() {
  elements.exampleList.innerHTML = EXAMPLES.map((example) => {
    const result = analyzeCase(example.id, PRESETS.physical);
    return `
      <button class="example-row${example.id === state.caseId ? " is-active" : ""}" type="button" data-example="${example.id}" aria-label="Load ${example.title}, historical load ${formatLoad(result.historicalLoad)}">
        <span>${example.number}</span>
        <strong>${example.title}</strong>
        <small>${example.summary}</small>
        <span class="example-result"><span>ΔH</span><b>${formatLoad(result.historicalLoad)}</b></span>
        <i>→</i>
      </button>`;
  }).join("");
}

function render() {
  const result = analyzeCase(state.caseId, [...state.activeConstraintIds]);
  elements.caseSelect.value = state.caseId;
  renderConstraints(result);
  renderContributions(result);
  renderPresets();
  renderReadout(result);
  renderPaths(result);
  renderFinding(result);
  renderProperties(result);
  renderExplanation(result);
  renderView();
  renderExamples();
}

function setPreset(presetName) {
  state.activeConstraintIds = new Set(PRESETS[presetName]);
  state.strictnessValue = presetStrictness[presetName];
  state.divergenceVisible = false;
  render();
}

function ablate(constraintId) {
  if (!state.activeConstraintIds.has(constraintId)) return;
  state.activeConstraintIds.delete(constraintId);
  state.strictnessValue = null;
  state.divergenceVisible = false;
  render();
}

function loadExample(caseId, shouldScroll = false) {
  state.caseId = caseId;
  state.activeConstraintIds = new Set(PRESETS.physical);
  state.strictnessValue = presetStrictness.physical;
  state.divergenceVisible = false;
  render();
  if (shouldScroll) $("#experiment").scrollIntoView({ behavior: "smooth", block: "start" });
}

renderCaseOptions();

elements.caseSelect.addEventListener("change", (event) => {
  state.caseId = event.target.value;
  state.divergenceVisible = false;
  render();
});

elements.constraintList.addEventListener("change", (event) => {
  const constraintId = event.target.dataset.constraint;
  if (!constraintId) return;
  if (event.target.checked) state.activeConstraintIds.add(constraintId);
  else state.activeConstraintIds.delete(constraintId);
  state.strictnessValue = null;
  state.divergenceVisible = false;
  render();
});

document.addEventListener("click", (event) => {
  const ablationButton = event.target.closest("[data-ablate]");
  if (ablationButton) ablate(ablationButton.dataset.ablate);

  const presetButton = event.target.closest("[data-preset]");
  if (presetButton) setPreset(presetButton.dataset.preset);

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    renderView();
  }

  const exampleButton = event.target.closest("[data-example]");
  if (exampleButton) loadExample(exampleButton.dataset.example, true);
});

elements.strictness.addEventListener("input", (event) => {
  state.strictnessValue = Number(event.target.value);
  state.activeConstraintIds = new Set(constraintsForStrictness(state.strictnessValue));
  state.divergenceVisible = false;
  render();
});

elements.explainButton.addEventListener("click", () => {
  state.explanationOpen = !state.explanationOpen;
  const result = analyzeCase(state.caseId, [...state.activeConstraintIds]);
  renderExplanation(result);
  if (state.explanationOpen) elements.resultExplanation.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

elements.divergenceButton.addEventListener("click", () => {
  state.divergenceVisible = !state.divergenceVisible;
  const result = analyzeCase(state.caseId, [...state.activeConstraintIds]);
  renderPaths(result);
});

$("#load-zero-example").addEventListener("click", () => loadExample("symmetric-triad", true));

function openMethods() {
  if (typeof elements.methodsDialog.showModal === "function") elements.methodsDialog.showModal();
  else elements.methodsDialog.setAttribute("open", "");
}

$("#methods-button").addEventListener("click", openMethods);
$("#disclosure-button").addEventListener("click", openMethods);
$(".dialog-close").addEventListener("click", () => elements.methodsDialog.close());
elements.methodsDialog.addEventListener("click", (event) => {
  if (event.target === elements.methodsDialog) elements.methodsDialog.close();
});

render();
