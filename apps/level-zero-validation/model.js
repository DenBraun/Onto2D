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

export function buildDynamicsView(objecthoodArtifact, dynamicsArtifact) {
  const objecthood = requireObject(objecthoodArtifact, "objecthoodArtifact");
  const dynamics = requireObject(dynamicsArtifact, "dynamicsArtifact");
  const pulse = objecthood.scenarios?.find((scenario) => scenario.id === "localized-pulse");
  if (
    !pulse ||
    dynamics.dependency?.analysisHash !== objecthood.analysisHash ||
    dynamics.dependency?.requiredCandidateId !== pulse.candidateId
  ) {
    throw new TypeError("The dynamics view is not bound to the frozen localized pulse.");
  }
  if (
    dynamics.status !== "bounded-real-time-persistence-probe" ||
    dynamics.scientificResult?.status !== "symmetric-dynamical-instability-confirmed" ||
    dynamics.conclusion?.priorNegativeObjecthoodDispositionChanged !== false
  ) {
    throw new TypeError("The dynamics artifact has an unsupported scientific disposition.");
  }
  const frames = dynamics.visualization?.frames;
  const antisymmetricFrames = dynamics.visualization?.antisymmetricAmplificationFrames;
  if (
    !Array.isArray(frames) ||
    frames.length < 2 ||
    !Array.isArray(antisymmetricFrames) ||
    antisymmetricFrames.length !== frames.length
  ) {
    throw new TypeError("The dynamics artifact has an incomplete visual trace.");
  }
  for (const frame of frames) {
    if (
      !Array.isArray(frame.x) ||
      frame.x.length < 2 ||
      frame.controlComposite?.length !== frame.x.length ||
      frame.perturbedComposite?.length !== frame.x.length
    ) {
      throw new TypeError("The dynamics artifact has a malformed profile frame.");
    }
  }
  const initialPointwiseDifferenceMaximum = Math.max(...frames[0].x.map((_, index) => (
    Math.abs(frames[0].perturbedComposite[index] - frames[0].controlComposite[index])
  )));
  if (!Number.isFinite(initialPointwiseDifferenceMaximum) || initialPointwiseDifferenceMaximum <= 0) {
    throw new TypeError("The dynamics artifact has no finite initial profile difference.");
  }
  const values = dynamics.scientificResult.values;
  return {
    analysisHash: dynamics.analysisHash,
    status: dynamics.scientificResult.status,
    frames,
    antisymmetricFrames,
    maximumAmplification: values.symmetric_max_deviation_amplification_refined,
    antisymmetricMaximum: values.antisymmetric_max_deviation_amplification_refined,
    departureTime: values.symmetric_departure_time_refined,
    energyDrift: values.symmetric_max_energy_relative_drift_refined,
    timeResolutionChange: values.symmetric_amplification_time_relative_change,
    spaceResolutionChange: values.symmetric_amplification_space_relative_change,
    persistencePassed: dynamics.scientificResult.realTimePersistencePassed,
    priorDispositionChanged: dynamics.scientificResult.priorObjecthoodDispositionChanged,
    initialPointwiseDifferenceMaximum,
    profileMaximum: Math.max(...frames.flatMap(
      (frame) => [...frame.controlComposite, ...frame.perturbedComposite]
    ))
  };
}

export function normalizedDifferenceProfile(frame, initialMaximum) {
  const value = requireObject(frame, "frame");
  if (
    !Array.isArray(value.x) ||
    !Array.isArray(value.controlComposite) ||
    !Array.isArray(value.perturbedComposite) ||
    value.x.length < 2 ||
    value.controlComposite.length !== value.x.length ||
    value.perturbedComposite.length !== value.x.length ||
    !value.controlComposite.every(Number.isFinite) ||
    !value.perturbedComposite.every(Number.isFinite) ||
    !Number.isFinite(initialMaximum) ||
    initialMaximum <= 0
  ) {
    throw new TypeError("A complete profile frame and positive initial maximum are required.");
  }
  return value.perturbedComposite.map((sample, index) => (
    Math.abs(sample - value.controlComposite[index]) / initialMaximum
  ));
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

export function seriesPath(xValues, yValues, width, height, bounds) {
  if (
    !Array.isArray(xValues) ||
    !Array.isArray(yValues) ||
    xValues.length < 2 ||
    xValues.length !== yValues.length ||
    !xValues.every(Number.isFinite) ||
    !yValues.every(Number.isFinite)
  ) {
    throw new TypeError("series values must be equal-length finite arrays.");
  }
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("series dimensions must be positive and finite.");
  }
  const { xMin, xMax, yMin, yMax } = requireObject(bounds, "bounds");
  if (
    ![xMin, xMax, yMin, yMax].every(Number.isFinite) ||
    xMax <= xMin ||
    yMax <= yMin
  ) {
    throw new TypeError("series bounds must be finite increasing intervals.");
  }
  const margin = { left: 48, right: 18, top: 22, bottom: 38 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  return xValues.map((x, index) => {
    const px = margin.left + (x - xMin) / (xMax - xMin) * plotWidth;
    const py = margin.top + plotHeight - (yValues[index] - yMin) / (yMax - yMin) * plotHeight;
    return `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
  }).join("");
}

export function formatMetric(value, digits = 4) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 10000) return value.toExponential(2);
  return Number.parseFloat(value.toPrecision(digits)).toString();
}
