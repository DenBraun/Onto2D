import { hashCanonical } from "@onto2d/kernel/canonical";

const SOLUTION_ID_DOMAIN = "onto2d:airflow-constraint-solution:v1";
const ENVIRONMENT_ID_DOMAIN = "onto2d:airflow-constraint-environment:v1";
const ALLOWED_OPERATORS = new Set(["==", "!=", ">=", "<=", ">", "<"]);

function fail(message) {
  throw new Error(`Airflow bounded resolver failed: ${message}`);
}

export function normalizeProject(value) {
  if (typeof value !== "string" || value.length === 0) fail("project name is invalid");
  return value.toLowerCase().replace(/[_.]+/g, "-");
}

function versionParts(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)*$/.test(value)) fail(`unsupported bounded version ${value}`);
  return value.split(".").map((part) => Number(part));
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return 0;
}

export function satisfies(version, specifiers) {
  if (!Array.isArray(specifiers) || specifiers.length === 0) fail("specifier set must be non-empty");
  return specifiers.every((specifier) => {
    if (!specifier || !ALLOWED_OPERATORS.has(specifier.operator)) fail("specifier operator is unsupported");
    const comparison = compareVersions(version, specifier.version);
    if (specifier.operator === "==") return comparison === 0;
    if (specifier.operator === "!=") return comparison !== 0;
    if (specifier.operator === ">=") return comparison >= 0;
    if (specifier.operator === "<=") return comparison <= 0;
    if (specifier.operator === ">") return comparison > 0;
    return comparison < 0;
  });
}

function selectionRecord(assignment, projectOrder) {
  return projectOrder.map((project) => ({ project, version: assignment.get(project).version }));
}

function validateAssignment(assignment, profile) {
  const failures = [];
  for (const requirement of profile.rootRequirements) {
    const candidate = assignment.get(requirement.project);
    if (!candidate || !satisfies(candidate.version, requirement.specifiers)) {
      failures.push(`root:${requirement.project}:${requirement.sourceRequirement}`);
    }
  }
  for (const source of assignment.values()) {
    for (const dependency of source.dependencies) {
      const target = assignment.get(dependency.project);
      if (!target || !satisfies(target.version, dependency.specifiers)) {
        failures.push(`${source.project}==${source.version}:${dependency.project}:${dependency.sourceRequirements.join(" & ")}`);
      }
    }
  }
  return failures.sort();
}

function solutionCosts(assignment, profile) {
  const candidates = [...assignment.values()];
  return {
    "wheel-download-bytes": candidates.reduce((sum, candidate) => sum + candidate.wheel.size, 0),
    "environment-change-actions": candidates.reduce((sum, candidate) => {
      const project = profile.projects.find((entry) => entry.project === candidate.project);
      return sum + (project.baseline === candidate.version ? 0 : 1);
    }, 0),
    "selected-wheel-count": candidates.length
  };
}

export function enumerateSolutions(candidates, profile) {
  const byProject = new Map();
  for (const candidate of candidates) {
    if (!byProject.has(candidate.project)) byProject.set(candidate.project, []);
    byProject.get(candidate.project).push(candidate);
  }
  const projectOrder = profile.projects.map((entry) => entry.project);
  if (projectOrder.some((project) => !byProject.has(project))) fail("candidate universe omits a declared project");
  for (const project of projectOrder) {
    byProject.get(project).sort((left, right) => compareVersions(left.version, right.version));
  }

  const assignment = new Map();
  const solutions = [];
  const rejectionCounts = new Map();
  let assignmentsConsidered = 0;
  function visit(index) {
    if (index < projectOrder.length) {
      const project = projectOrder[index];
      for (const candidate of byProject.get(project)) {
        assignment.set(project, candidate);
        visit(index + 1);
      }
      assignment.delete(project);
      return;
    }
    assignmentsConsidered += 1;
    const failures = validateAssignment(assignment, profile);
    if (failures.length > 0) {
      for (const failure of failures) rejectionCounts.set(failure, (rejectionCounts.get(failure) ?? 0) + 1);
      return;
    }
    const selections = selectionRecord(assignment, projectOrder);
    const environmentIdentity = hashCanonical(ENVIRONMENT_ID_DOMAIN, { selections });
    const basis = {
      selections,
      environmentIdentity,
      costs: solutionCosts(assignment, profile),
      constraintCompliant: profile.projects.every((entry) => assignment.get(entry.project).version === entry.constrained)
    };
    solutions.push({ ...basis, solutionId: hashCanonical(SOLUTION_ID_DOMAIN, basis) });
  }
  visit(0);
  solutions.sort((left, right) => left.solutionId.localeCompare(right.solutionId));
  return {
    solutions,
    diagnostics: {
      assignmentsConsidered,
      acceptedSolutions: solutions.length,
      rejectedAssignments: assignmentsConsidered - solutions.length,
      rejectionCounts: [...rejectionCounts.entries()].map(([reason, count]) => ({ reason, count }))
    }
  };
}

export function calculateHistoricalLoad(solutions, profile, costId, relaxedProjects = []) {
  const declared = profile.costFunctions.find((entry) => entry.id === costId);
  if (!declared) fail(`undeclared cost function ${costId}`);
  const relaxed = new Set(relaxedProjects);
  for (const project of relaxed) {
    if (!profile.projects.some((entry) => entry.project === project)) fail(`unknown relaxed project ${project}`);
  }
  if (!Array.isArray(solutions) || solutions.length === 0) fail("free solution set is empty");
  const constrained = solutions.filter((solution) => solution.selections.every((selection) => {
    if (relaxed.has(selection.project)) return true;
    return profile.projects.find((entry) => entry.project === selection.project).constrained === selection.version;
  }));
  if (constrained.length === 0) fail("constraint-compliant solution set is empty");
  const freeCost = Math.min(...solutions.map((solution) => solution.costs[costId]));
  const constrainedCost = Math.min(...constrained.map((solution) => solution.costs[costId]));
  return {
    costFunction: costId,
    unit: declared.unit,
    definition: declared.definition,
    relaxedProjects: [...relaxed].sort(),
    free: {
      solutionCount: solutions.length,
      optimumCost: freeCost,
      optimumSolutionIds: solutions.filter((solution) => solution.costs[costId] === freeCost).map((solution) => solution.solutionId)
    },
    constrained: {
      solutionCount: constrained.length,
      optimumCost: constrainedCost,
      optimumSolutionIds: constrained.filter((solution) => solution.costs[costId] === constrainedCost).map((solution) => solution.solutionId)
    },
    historicalLoad: constrainedCost - freeCost
  };
}

export function buildConstraintAblations(solutions, profile) {
  const variable = profile.projects.filter((entry) => entry.versions.length > 1).map((entry) => entry.project);
  const regimes = [
    ...variable.map((project) => ({ id: `relax-${project}`, relaxedProjects: [project] })),
    { id: "relax-pydantic-pair", relaxedProjects: ["pydantic", "pydantic-core"] }
  ];
  return regimes.map((regime) => ({
    ...regime,
    results: profile.costFunctions.map((cost) => calculateHistoricalLoad(solutions, profile, cost.id, regime.relaxedProjects))
  }));
}

export function buildSharedDependencies(profile) {
  const consumers = new Map();
  for (const requirement of profile.rootRequirements) {
    if (!consumers.has(requirement.project)) consumers.set(requirement.project, new Set());
    consumers.get(requirement.project).add(`${profile.scope.rootProject}==${profile.scope.rootVersion}`);
  }
  for (const source of profile.projects) {
    for (const version of source.versions) {
      for (const dependency of source.dependencies[version]) {
        if (!consumers.has(dependency.project)) consumers.set(dependency.project, new Set());
        consumers.get(dependency.project).add(source.project);
      }
    }
  }
  return [...consumers.entries()]
    .map(([project, values]) => ({ project, consumers: [...values].sort(), consumerCount: values.size }))
    .filter((entry) => entry.consumerCount > 1)
    .sort((left, right) => right.consumerCount - left.consumerCount || left.project.localeCompare(right.project));
}
