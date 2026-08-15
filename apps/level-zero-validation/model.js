const BRANCH_COPY = Object.freeze({
  "localized-pulse": {
    shortName: "Localized pulse",
    verdict: "Intrinsic localization passes; amplitude stability fails.",
    interpretation: "The symmetric perturbation sector contains a negative energy direction.",
    shapeNote: "The curve is the independently checked continuum reference profile."
  },
  "stable-plateau": {
    shortName: "Stable plateau",
    verdict: "Amplitude stability passes; intrinsic localization fails.",
    interpretation: "Gamma and the 90% support radius grow when the numerical domain is extended.",
    shapeNote: "The curve is a disclosed guide to the box-filling numerical branch."
  },
  "uncoupled-vacuum": {
    shortName: "Empty vacuum",
    verdict: "Stationarity and stability pass; non-triviality fails.",
    interpretation: "Gamma is exactly zero, so the branch supplies no candidate object.",
    shapeNote: "The zero line is exact for the uncoupled vacuum branch."
  }
});

const GATE_LABELS = Object.freeze({
  amplitudeStabilityPassed: "amplitude stability",
  intrinsicLocalizationPassed: "intrinsic localization",
  nontrivialGamma: "non-trivial Gamma"
});

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

export function buildVisualStudy(integratedArtifact, objecthoodArtifact) {
  const integrated = requireObject(integratedArtifact, "integratedArtifact");
  const objecthood = requireObject(objecthoodArtifact, "objecthoodArtifact");
  const dependency = integrated.dependencies?.find(
    (entry) => entry.id === "phase-c-objecthood-search-v1"
  );
  if (!dependency || dependency.analysisHash !== objecthood.analysisHash) {
    throw new TypeError("The visual artifacts do not share the frozen Phase-C identity.");
  }
  if (
    integrated.status !== "complete-negative-result-within-declared-model" ||
    integrated.conclusion?.declaredCaseExecutionComplete !== true ||
    integrated.conclusion?.declaredModelLevelZeroValidated !== false
  ) {
    throw new TypeError("The integrated artifact has an unsupported scientific disposition.");
  }
  const branches = objecthood.scenarios.map((scenario) => {
    const copy = BRANCH_COPY[scenario.id];
    if (!copy) throw new TypeError(`Unsupported visual branch: ${scenario.id}`);
    const result = scenario.scientificResult;
    return {
      id: scenario.id,
      ...copy,
      gammaBase: result.values.gamma_fine,
      gammaExtended: result.values.gamma_extended,
      domainChange: result.values.gamma_domain_relative_change,
      supportBase: result.values.support_radius_90_fine,
      supportExtended: result.values.support_radius_90_extended,
      rayleigh: result.values.symmetric_profile_rayleigh_quotient,
      peak: result.values.peak_amplitude_fine,
      localized: result.intrinsicLocalizationPassed,
      nontrivial: result.nontrivialGamma,
      stable: result.amplitudeStabilityPassed,
      passed: result.trialObjecthoodPassed,
      failedGates: result.failedNecessaryGates.map(
        (gate) => GATE_LABELS[gate] ?? gate
      )
    };
  });
  return {
    analysisHash: integrated.analysisHash,
    sourceDoi: integrated.source.doi,
    reviewStatus: integrated.review.status,
    phaseBPassed: integrated.phases.phaseB?.status === "passed-declared-gate",
    cubicRejected: integrated.phases.phaseCPreflight?.status === "rejected-unbounded-potential",
    phaseDStopped: integrated.phases.phaseD?.status === "not-run-no-object-qualified-nodes",
    levelZeroValidated: integrated.conclusion.declaredModelLevelZeroValidated,
    branches
  };
}

function pulseValue(x) {
  return 2 / (8 / 3 + Math.sqrt(37 / 9) * Math.cosh(x));
}

function plateauValue(x, halfWidth) {
  if (Math.abs(x) >= halfWidth) return 0;
  const upperRoot = (4 + Math.sqrt(10)) / 3;
  return upperRoot * Math.tanh(x + halfWidth) * Math.tanh(halfWidth - x);
}

export function sampleProfile(branchId, halfWidth, count = 241) {
  if (!BRANCH_COPY[branchId]) throw new TypeError(`Unsupported profile branch: ${branchId}`);
  if (!Number.isFinite(halfWidth) || halfWidth <= 0) {
    throw new TypeError("halfWidth must be positive and finite.");
  }
  if (!Number.isInteger(count) || count < 3) {
    throw new TypeError("count must be an integer of at least three.");
  }
  return Array.from({ length: count }, (_, index) => {
    const x = -12 + 24 * index / (count - 1);
    const inside = Math.abs(x) <= halfWidth;
    let y = 0;
    if (branchId === "localized-pulse") y = inside ? pulseValue(x) : null;
    else if (branchId === "stable-plateau") y = inside ? plateauValue(x, halfWidth) : null;
    else y = inside ? 0 : null;
    return { x, y };
  });
}

export function profilePath(samples, width, height, maximumY) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new TypeError("samples must contain at least two points.");
  }
  if (![width, height, maximumY].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("profile dimensions and maximumY must be positive and finite.");
  }
  const margin = { left: 44, right: 18, top: 20, bottom: 38 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xScale = (x) => margin.left + (x + 12) / 24 * plotWidth;
  const yScale = (y) => margin.top + plotHeight - y / maximumY * plotHeight;
  let drawing = "";
  let open = false;
  for (const sample of samples) {
    if (sample.y === null) {
      open = false;
      continue;
    }
    const command = open ? "L" : "M";
    drawing += `${command}${xScale(sample.x).toFixed(2)} ${yScale(sample.y).toFixed(2)}`;
    open = true;
  }
  return drawing;
}

export function formatMetric(value, digits = 4) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 10000) return value.toExponential(2);
  return Number.parseFloat(value.toPrecision(digits)).toString();
}
