const CASE_IDENTITY = "sha256:2e2c15b6e1240f71e5b5a8938885fd1ef94b6efa940d51d1faf2e85ac4f81c2d";
const SOURCE_IDENTITY = "sha256:6c29dc66a658c6a6d88f71bbf007c1d1cf8933069995de33af9441ab967d50ca";
const COST_IDS = Object.freeze(["wheel-download-bytes", "environment-change-actions", "selected-wheel-count"]);

function fail(message) { throw new TypeError(`Airflow Constraint Resolution model rejected the artifact: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }

export function createAirflowConstraintModel(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail("artifact must be an object");
  if (artifact.format !== "onto2d-airflow-dependency-constraints-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "airflow-dependency-constraints-v1") fail("format or version differs");
  if (artifact.caseIdentity !== CASE_IDENTITY || artifact.source?.identity !== SOURCE_IDENTITY) fail("case or source release differs");
  if (!same([artifact.scope?.airflowRelease, artifact.scope?.pythonVersion, artifact.scope?.platform, artifact.scope?.projectionId], ["3.3.1", "3.12", "manylinux-x86_64", "airflow-core-five-requirement-projection-v1"]) || !artifact.scope.boundary.includes("not a complete apache-airflow installation")) fail("scope boundary differs");
  if (artifact.constraint?.evidenceClass !== "official-versioned-airflow-constraint-file" || artifact.constraint.entryCount !== 121 || artifact.constraint.selectedPins?.length !== 17) fail("constraint source boundary differs");
  if (!same([artifact.candidateUniverse?.projectCount, artifact.candidateUniverse?.candidateCount, artifact.candidateUniverse?.candidates?.length], [17, 24, 24])) fail("candidate universe differs");
  if (!Array.isArray(artifact.solutions) || artifact.solutions.length !== 64 || artifact.solutions.filter(({ constraintCompliant }) => constraintCompliant).length !== 1) fail("solution census differs");
  if (!same([artifact.resolverDiagnostics?.assignmentsConsidered, artifact.resolverDiagnostics?.acceptedSolutions, artifact.resolverDiagnostics?.rejectedAssignments], [128, 64, 64]) || !same(artifact.resolverDiagnostics.rejectionCounts.map(({ count }) => count), [32, 32])) fail("resolver diagnostic census differs");
  if (artifact.resolverDiagnostics.rejectionCounts.some(({ reason }) => !reason.includes("pydantic-core"))) fail("resolver rejection boundary differs");
  if (artifact.historicalLoad?.status !== "resolved-in-declared-projection" || artifact.historicalLoad.resolverDiagnosticsUsedAsCost !== false || !same(artifact.historicalLoad.results.map(({ costFunction, free, constrained, historicalLoad }) => [costFunction, free.optimumCost, constrained.optimumCost, historicalLoad]), [["wheel-download-bytes", 7676228, 7820824, 144596], ["environment-change-actions", 0, 7, 7], ["selected-wheel-count", 17, 17, 0]])) fail("Historical Load result differs");
  if (!same(artifact.historicalLoad.results.map(({ costFunction }) => costFunction), COST_IDS)) fail("cost inventory differs");
  if (!Array.isArray(artifact.constraintAblations) || artifact.constraintAblations.length !== 8) fail("ablation inventory differs");
  const pair = artifact.constraintAblations.find(({ id }) => id === "relax-pydantic-pair");
  if (!pair || pair.results[0].constrained.solutionCount !== 2 || pair.results.find(({ costFunction }) => costFunction === "environment-change-actions").historicalLoad !== 5) fail("paired dependency ablation differs");
  const typing = artifact.sharedDependencies?.find(({ project }) => project === "typing-extensions");
  if (!typing || typing.consumerCount !== 6) fail("shared dependency result differs");
  for (const solution of artifact.solutions) {
    if (solution.selections?.length !== 17 || !solution.solutionId?.startsWith("sha256:") || !solution.environmentIdentity?.startsWith("sha256:")) fail("solution identity boundary differs");
  }
  const projects = new Map(artifact.analysisProfile.projects.map((entry) => [entry.project, entry]));
  const candidates = new Map(artifact.candidateUniverse.candidates.map((entry) => [entry.candidateId, entry]));
  const loads = new Map(artifact.historicalLoad.results.map((entry) => [entry.costFunction, entry]));
  const ablations = new Map(artifact.constraintAblations.map((entry) => [entry.id, entry]));
  const baseline = artifact.solutions.find((solution) => solution.selections.every((selection) => projects.get(selection.project).baseline === selection.version));
  const constrained = artifact.solutions.find((solution) => solution.constraintCompliant);
  if (!baseline || !constrained) fail("solution witnesses are missing");
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    scope: artifact.scope,
    source: artifact.source,
    constraint: artifact.constraint,
    projects: artifact.analysisProfile.projects,
    candidateUniverse: artifact.candidateUniverse,
    solutions: artifact.solutions,
    diagnostics: artifact.resolverDiagnostics,
    historicalLoad: artifact.historicalLoad,
    constraintAblations: artifact.constraintAblations,
    sharedDependencies: artifact.sharedDependencies,
    limitations: artifact.limitations,
    baseline,
    constrained,
    project(id) { const value = projects.get(id); if (!value) fail(`unknown project ${id}`); return value; },
    candidate(project, version) { const value = candidates.get(`${project}==${version}`); if (!value) fail(`unknown candidate ${project}==${version}`); return value; },
    load(id) { const value = loads.get(id); if (!value) fail(`unknown cost ${id}`); return value; },
    ablation(id) { const value = ablations.get(id); if (!value) fail(`unknown ablation ${id}`); return value; }
  });
}
