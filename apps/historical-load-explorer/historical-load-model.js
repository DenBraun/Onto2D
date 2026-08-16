export const CONSTRAINTS = Object.freeze([
  {
    id: "connectivity",
    label: "Structural connectivity",
    shortLabel: "Connectivity",
    notation: "connected(s)",
    description: "Every intermediate must remain structurally connected."
  },
  {
    id: "closure",
    label: "Constitutive closure",
    shortLabel: "Closure",
    notation: "closed(s)",
    description: "Required constituents must be present before a state can be used."
  },
  {
    id: "stability",
    label: "Stable intermediate",
    shortLabel: "Stability",
    notation: "stable(s)",
    description: "Unstable intermediate states are removed from the path space."
  },
  {
    id: "dependency",
    label: "Dependency satisfied",
    shortLabel: "Dependency",
    notation: "depends(s)",
    description: "A state may appear only after all of its declared dependencies."
  },
  {
    id: "temporal",
    label: "Temporal persistence",
    shortLabel: "Persistence",
    notation: "persists(s)",
    description: "Every intermediate must persist across the observation window."
  },
  {
    id: "custom",
    label: "Custom predicate",
    shortLabel: "Custom",
    notation: "P5(s)",
    description: "Illustrative user rule: exclude the known intermediate motifs."
  }
]);

const CASES = [
  {
    id: "simple-chain",
    number: "01",
    title: "Simple chain",
    target: "Linear target X",
    summary: "The shortest construction already satisfies the selected regime.",
    novelty: false,
    irreducible: "1 / 4",
    degeneracy: 1,
    cohortSize: 2,
    paths: [
      { id: "direct", name: "Direct chain", length: 4, violations: ["temporal", "custom"] },
      { id: "persistent", name: "Persistent chain", length: 5, violations: ["custom"] },
      { id: "reviewed", name: "Reviewed chain", length: 6, violations: ["temporal"] }
    ]
  },
  {
    id: "symmetric-triad",
    number: "02",
    title: "Symmetric triad",
    target: "Triadic target X",
    summary: "Symmetry leaves an equally short admissible realization available.",
    novelty: true,
    irreducible: "0 / 6",
    degeneracy: 3,
    cohortSize: 4,
    paths: [
      { id: "left", name: "Left realization", length: 5, violations: ["stability", "temporal", "custom"] },
      { id: "right", name: "Symmetric realization", length: 5, violations: ["temporal", "custom"] },
      { id: "persistent", name: "Persistent realization", length: 7, violations: ["custom"] },
      { id: "reviewed", name: "Reviewed realization", length: 8, violations: ["temporal"] }
    ]
  },
  {
    id: "constitutive-bridge",
    number: "03",
    title: "Constitutive bridge",
    target: "Bridged target X",
    summary: "Closure and stability eliminate both shorter construction histories.",
    novelty: true,
    irreducible: "2 / 7",
    degeneracy: 3,
    cohortSize: 4,
    paths: [
      { id: "shortcut", name: "Constitutive shortcut", length: 5, violations: ["closure", "stability", "temporal", "custom"] },
      { id: "open-bridge", name: "Open bridge", length: 6, violations: ["stability", "temporal", "custom"] },
      { id: "unstable-bridge", name: "Unstable bridge", length: 7, violations: ["closure", "temporal", "custom"] },
      { id: "stable-bridge", name: "Stable bridge", length: 8, violations: ["temporal", "custom"] },
      { id: "reviewed-bridge", name: "Reviewed bridge", length: 9, violations: ["temporal"] }
    ]
  },
  {
    id: "restricted-cycle",
    number: "04",
    title: "Restricted cycle",
    target: "Cyclic target X",
    summary: "The free optimum relies on an unstable cycle that the filter removes.",
    novelty: true,
    irreducible: "3 / 8",
    degeneracy: 2,
    cohortSize: 5,
    paths: [
      { id: "cycle", name: "Unstable cycle", length: 6, violations: ["stability", "temporal", "custom"] },
      { id: "closed-cycle", name: "Closed detour", length: 10, violations: ["temporal", "custom"] },
      { id: "persistent-cycle", name: "Persistent detour", length: 12, violations: ["custom"] },
      { id: "reviewed-cycle", name: "Reviewed detour", length: 13, violations: ["temporal"] }
    ]
  }
];

export const EXAMPLES = Object.freeze(CASES.map((example) => Object.freeze({ ...example })));

export const PRESETS = Object.freeze({
  free: Object.freeze([]),
  minimal: Object.freeze(["connectivity", "closure"]),
  physical: Object.freeze(["connectivity", "closure", "stability", "dependency"]),
  soma: Object.freeze(["connectivity", "closure", "stability", "dependency", "custom"])
});

function assertCase(caseId) {
  const example = EXAMPLES.find((entry) => entry.id === caseId);
  if (!example) throw new Error(`Unknown explorer case: ${caseId}`);
  return example;
}

function normalizeConstraintIds(activeConstraintIds) {
  const knownIds = new Set(CONSTRAINTS.map((constraint) => constraint.id));
  const normalized = [...new Set(activeConstraintIds)];
  const unknown = normalized.find((id) => !knownIds.has(id));
  if (unknown) throw new Error(`Unknown admissibility constraint: ${unknown}`);
  return normalized;
}

function evaluate(example, activeConstraintIds) {
  const active = new Set(activeConstraintIds);
  const freePath = example.paths.reduce((best, path) => path.length < best.length ? path : best);
  const evaluatedPaths = example.paths.map((path) => {
    const activeViolations = path.violations.filter((id) => active.has(id));
    return { ...path, activeViolations, admissible: activeViolations.length === 0 };
  });
  const admissiblePath = evaluatedPaths
    .filter((path) => path.admissible)
    .reduce((best, path) => !best || path.length < best.length ? path : best, null);
  const historicalLoad = admissiblePath ? admissiblePath.length - freePath.length : Number.POSITIVE_INFINITY;

  return { freePath, admissiblePath, evaluatedPaths, historicalLoad };
}

function contributionFor(example, activeConstraintIds, constraintId, currentLoad) {
  if (!activeConstraintIds.includes(constraintId)) return null;
  const ablated = activeConstraintIds.filter((id) => id !== constraintId);
  const withoutConstraint = evaluate(example, ablated).historicalLoad;

  if (!Number.isFinite(currentLoad)) {
    return Number.isFinite(withoutConstraint) ? Number.POSITIVE_INFINITY : 0;
  }
  if (!Number.isFinite(withoutConstraint)) return Number.NEGATIVE_INFINITY;
  return currentLoad - withoutConstraint;
}

export function analyzeCase(caseId, activeConstraintIds = PRESETS.physical) {
  const example = assertCase(caseId);
  const active = normalizeConstraintIds(activeConstraintIds);
  const evaluated = evaluate(example, active);
  const firstRejectedPath = evaluated.evaluatedPaths.find((path) => !path.admissible) ?? null;
  const contributions = Object.fromEntries(CONSTRAINTS.map((constraint) => [
    constraint.id,
    contributionFor(example, active, constraint.id, evaluated.historicalLoad)
  ]));

  return Object.freeze({
    example,
    activeConstraintIds: Object.freeze(active),
    ...evaluated,
    firstDivergence: firstRejectedPath ? Object.freeze({
      pathId: firstRejectedPath.id,
      pathName: firstRejectedPath.name,
      atStep: Math.min(4, Math.max(2, firstRejectedPath.length - 1)),
      constraintId: firstRejectedPath.activeViolations[0],
      activeViolations: Object.freeze(firstRejectedPath.activeViolations)
    }) : null,
    contributions: Object.freeze(contributions)
  });
}

export function constraintsForStrictness(value) {
  const strictness = Number(value);
  if (!Number.isFinite(strictness) || strictness < 0 || strictness > 100) {
    throw new Error("Strictness must be a number from 0 to 100.");
  }
  if (strictness < 31) return [...PRESETS.free];
  if (strictness < 55) return [...PRESETS.minimal];
  if (strictness < 79) return [...PRESETS.physical];
  return [...PRESETS.physical, "temporal"];
}

export function matchingPreset(activeConstraintIds) {
  const active = [...activeConstraintIds].sort().join("|");
  return Object.entries(PRESETS).find(([, ids]) => [...ids].sort().join("|") === active)?.[0] ?? null;
}
