import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyAirflowDependencyConstraintsCaseIdentity } from "../../cases/airflow-dependency-constraints/extract.mjs";

export const AIRFLOW_CONSTRAINT_MAPPING_VERSION = "airflow-dependency-constraints-mapping-v1";
const RELEASE_DOMAIN = "onto2d:airflow-constraint-model-release:v1";
const AUDIT_DOMAIN = "onto2d:airflow-constraint-model-audit:v1";
const EDGE_DOMAIN = "onto2d:airflow-constraint-model-edge:v1";

function fail(message) {
  throw new TypeError(`airflow-dependency-constraints Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice("sha256:".length, "sha256:".length + 20)}`;
}

function projectNodeId(project) { return `project:${project}`; }
function candidateNodeId(candidateId) { return `candidate:${candidateId}`; }
function solutionNodeId(solutionId) { return `solution:${solutionId}`; }
function loadNodeId(costFunction) { return `historical-load:${costFunction}`; }

export function compileAirflowDependencyConstraintsModelPack(input) {
  let artifact;
  try {
    artifact = verifyAirflowDependencyConstraintsCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }

  const profile = artifact.analysisProfile;
  const projectById = new Map(profile.projects.map((entry) => [entry.project, entry]));
  const candidateById = new Map(artifact.candidateUniverse.candidates.map((entry) => [entry.candidateId, entry]));
  const rootNode = {
    id: "root:apache-airflow-core-3.3.1-projection",
    name: "Airflow Core 3.3.1 dependency projection",
    description: "Five exact native apache-airflow-core requirements and their closed in-scope transitive dependency projection for Python 3.12 / manylinux x86_64.",
    shortDescription: "5 root requirements; 17 projects; bounded projection, not full installation.",
    entityKind: "dependency-root-projection",
    typeRole: "root",
    phase: "source-projection",
    scientificStatus: "source-locked",
    rootProject: profile.scope.rootProject,
    rootVersion: profile.scope.rootVersion,
    projectionId: profile.scope.projectionId,
    completeAirflowInstallation: false
  };
  const constraintNode = {
    id: "constraint:airflow-3.3.1-python-3.12-no-providers",
    name: "Airflow 3.3.1 / Python 3.12 constraints",
    description: "Official versioned constraints-no-providers file captured byte-for-byte; selected pins define the external admissibility regime in this projection.",
    shortDescription: `${artifact.constraint.entryCount} upstream pins; ${artifact.constraint.selectedPins.length} active in projection.`,
    entityKind: "versioned-constraint-record",
    typeRole: "constraint",
    phase: "source-record",
    scientificStatus: "direct-record",
    sourceIdentity: artifact.source.constraintFile.sha256,
    evidenceClass: artifact.constraint.evidenceClass,
    upstreamEntryCount: artifact.constraint.entryCount
  };
  const projectNodes = profile.projects.map((entry) => ({
    id: projectNodeId(entry.project),
    name: entry.project,
    description: "Normalized Python distribution project in the bounded candidate universe; versions remain separate candidate records.",
    shortDescription: `${entry.versions.length} candidate version(s); constraint pin ${entry.constrained}.`,
    entityKind: "python-project",
    typeRole: "project",
    phase: "candidate-universe",
    scientificStatus: "declared-projection",
    project: entry.project,
    candidateVersions: entry.versions,
    baselineVersion: entry.baseline,
    constrainedVersion: entry.constrained
  }));
  const candidateNodes = artifact.candidateUniverse.candidates.map((candidate) => ({
    id: candidateNodeId(candidate.candidateId),
    name: candidate.candidateId,
    description: "Exact PyPI release candidate with source-locked metadata and one selected compatible wheel record for the declared Python/platform profile.",
    shortDescription: `${candidate.wheel.size} bytes; ${candidate.dependencies.length} in-scope dependency edge(s).`,
    entityKind: "python-release-candidate",
    typeRole: "candidate",
    phase: "candidate-universe",
    scientificStatus: "cryptographically-verified-record",
    candidateId: candidate.candidateId,
    project: candidate.project,
    version: candidate.version,
    wheel: candidate.wheel,
    source: candidate.source,
    constraintPinned: projectById.get(candidate.project).constrained === candidate.version,
    baselineSelected: projectById.get(candidate.project).baseline === candidate.version
  }));
  const solutionNodes = artifact.solutions.map((solution) => ({
    id: solutionNodeId(solution.solutionId),
    name: solution.constraintCompliant ? "Officially constrained solution" : `Free solution ${solution.solutionId.slice(-10)}`,
    description: "Complete solution inside the declared finite project/candidate projection; its identity binds every selected release version.",
    shortDescription: `${solution.costs["wheel-download-bytes"]} wheel bytes; ${solution.costs["environment-change-actions"]} baseline change(s).`,
    entityKind: "dependency-solution",
    typeRole: "solution",
    phase: "resolution",
    scientificStatus: solution.constraintCompliant ? "constraint-compliant" : "free-admissible",
    solutionId: solution.solutionId,
    environmentIdentity: solution.environmentIdentity,
    costs: solution.costs,
    constraintCompliant: solution.constraintCompliant
  }));
  const loadNodes = artifact.historicalLoad.results.map((result) => ({
    id: loadNodeId(result.costFunction),
    name: `Historical Load / ${result.costFunction}`,
    description: "Difference between the constrained and free minimum under one predeclared cost in the same finite solution universe.",
    shortDescription: `${result.historicalLoad} ${result.unit}; ${result.free.solutionCount} free / ${result.constrained.solutionCount} constrained.`,
    entityKind: "historical-load-result",
    typeRole: "analysis-result",
    phase: "analysis",
    scientificStatus: "resolved-in-declared-projection",
    costFunction: result.costFunction,
    unit: result.unit,
    freeOptimum: result.free.optimumCost,
    constrainedOptimum: result.constrained.optimumCost,
    historicalLoad: result.historicalLoad,
    zeroResult: result.historicalLoad === 0,
    resolverDiagnosticsUsedAsCost: false
  }));
  const ablationNodes = artifact.constraintAblations.map((ablation) => ({
    id: `ablation:${ablation.id}`,
    name: ablation.id,
    description: "Onto2D counterfactual relaxation of selected official constraint pins; it does not modify or replace the upstream constraint file.",
    shortDescription: `${ablation.results[0].constrained.solutionCount} solution(s) admitted after relaxation.`,
    entityKind: "constraint-ablation",
    typeRole: "counterfactual",
    phase: "analysis",
    scientificStatus: "counterfactual",
    relaxedProjects: ablation.relaxedProjects,
    results: ablation.results.map((result) => ({ costFunction: result.costFunction, historicalLoad: result.historicalLoad }))
  }));
  const nodes = [rootNode, constraintNode, ...projectNodes, ...candidateNodes, ...solutionNodes, ...loadNodes, ...ablationNodes];

  const edges = [];
  for (const requirement of profile.rootRequirements) {
    edges.push({
      id: edgeId("requires-project", rootNode.id, projectNodeId(requirement.project), requirement.sourceRequirement),
      source: rootNode.id,
      target: projectNodeId(requirement.project),
      relation: "requires-project",
      relationLayer: "native-projection",
      evidenceClass: "pypi-requires-dist",
      evidenceStatus: "captured",
      sourceRequirement: requirement.sourceRequirement
    });
  }
  for (const candidate of artifact.candidateUniverse.candidates) {
    const candidateId = candidateNodeId(candidate.candidateId);
    edges.push({
      id: edgeId("has-candidate", projectNodeId(candidate.project), candidateId),
      source: projectNodeId(candidate.project),
      target: candidateId,
      relation: "has-candidate",
      relationLayer: "candidate-universe",
      evidenceClass: "source-locked-pypi-release",
      evidenceStatus: "captured"
    });
    for (const dependency of candidate.dependencies) {
      edges.push({
        id: edgeId("requires-project", candidateId, projectNodeId(dependency.project), dependency.sourceRequirements.join("|")),
        source: candidateId,
        target: projectNodeId(dependency.project),
        relation: "requires-project",
        relationLayer: "native-projection",
        evidenceClass: "pypi-requires-dist",
        evidenceStatus: "captured",
        sourceRequirements: dependency.sourceRequirements,
        specifiers: dependency.specifiers
      });
    }
  }
  for (const pin of artifact.constraint.selectedPins) {
    edges.push({
      id: edgeId("pins-candidate", constraintNode.id, candidateNodeId(`${pin.project}==${pin.version}`)),
      source: constraintNode.id,
      target: candidateNodeId(`${pin.project}==${pin.version}`),
      relation: "pins-candidate",
      relationLayer: "official-constraint",
      evidenceClass: "official-versioned-airflow-constraint-file",
      evidenceStatus: "captured"
    });
  }
  for (const solution of artifact.solutions) {
    const solutionId = solutionNodeId(solution.solutionId);
    for (const selection of solution.selections) {
      const candidate = candidateById.get(`${selection.project}==${selection.version}`);
      if (!candidate) fail(`solution references missing candidate ${selection.project}==${selection.version}`);
      edges.push({
        id: edgeId("selects-candidate", solutionId, candidateNodeId(candidate.candidateId), selection.project),
        source: solutionId,
        target: candidateNodeId(candidate.candidateId),
        relation: "selects-candidate",
        relationLayer: "resolution",
        evidenceClass: "exhaustive-bounded-enumeration",
        evidenceStatus: "derived"
      });
    }
    if (solution.constraintCompliant) {
      edges.push({
        id: edgeId("satisfies-constraint", solutionId, constraintNode.id),
        source: solutionId,
        target: constraintNode.id,
        relation: "satisfies-constraint",
        relationLayer: "analysis",
        evidenceClass: "exact-pin-membership",
        evidenceStatus: "derived"
      });
    }
  }
  for (const result of artifact.historicalLoad.results) {
    const resultId = loadNodeId(result.costFunction);
    for (const solutionId of result.free.optimumSolutionIds) {
      edges.push({ id: edgeId("free-optimum", resultId, solutionNodeId(solutionId)), source: resultId, target: solutionNodeId(solutionId), relation: "free-optimum", relationLayer: "analysis", evidenceClass: "bounded-minimization", evidenceStatus: "derived" });
    }
    for (const solutionId of result.constrained.optimumSolutionIds) {
      edges.push({ id: edgeId("constrained-optimum", resultId, solutionNodeId(solutionId)), source: resultId, target: solutionNodeId(solutionId), relation: "constrained-optimum", relationLayer: "analysis", evidenceClass: "bounded-minimization", evidenceStatus: "derived" });
    }
  }
  for (const ablation of artifact.constraintAblations) {
    edges.push({
      id: edgeId("counterfactual-relaxation", constraintNode.id, `ablation:${ablation.id}`),
      source: constraintNode.id,
      target: `ablation:${ablation.id}`,
      relation: "counterfactual-relaxation",
      relationLayer: "analysis",
      evidenceClass: "onto2d-counterfactual",
      evidenceStatus: "counterfactual",
      relaxedProjects: ablation.relaxedProjects
    });
  }

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, {
    mappingVersion: AIRFLOW_CONSTRAINT_MAPPING_VERSION,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity
  });
  const version = `v1-${releaseIdentity.slice("sha256:".length, "sha256:".length + 16)}`;
  const audit = {
    mappingVersion: AIRFLOW_CONSTRAINT_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    projectCount: artifact.candidateUniverse.projectCount,
    candidateCount: artifact.candidateUniverse.candidateCount,
    solutionCount: artifact.solutions.length,
    rejectedAssignments: artifact.resolverDiagnostics.rejectedAssignments,
    constraintCompliantSolutions: artifact.solutions.filter((solution) => solution.constraintCompliant).length,
    historicalLoad: artifact.historicalLoad.results.map((result) => ({ costFunction: result.costFunction, value: result.historicalLoad, unit: result.unit })),
    resolverDiagnosticsUsedAsCost: false,
    completeAirflowInstallationClaim: false
  };
  const sourceFiles = artifact.source.lock.files.map((file) => ({
    path: `cases/airflow-dependency-constraints/sources/${file.path}`,
    hash: file.sha256
  }));
  return buildModelPack({
    model: {
      id: "airflow-dependency-constraints",
      name: "Airflow Dependency Constraints",
      version,
      description: "Source-locked Airflow constraint record, finite Python dependency candidate universe, complete bounded solution census, counterfactual relaxations, and cost-relative Historical Load.",
      status: "external-source-locked-analysis-case"
    },
    source: {
      id: `airflow-constraints-${artifact.source.identity.slice("sha256:".length, "sha256:".length + 16)}`,
      files: sourceFiles,
      auditHash: hashCanonical(AUDIT_DOMAIN, audit)
    },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: {
        airflowRelease: profile.scope.airflowRelease,
        pythonVersion: profile.scope.pythonVersion,
        platform: profile.scope.platform,
        sourceIdentity: artifact.source.identity,
        caseIdentity: artifact.caseIdentity,
        releaseIdentity,
        mappingVersion: AIRFLOW_CONSTRAINT_MAPPING_VERSION,
        scopeBoundary: profile.scope.boundary,
        nonEndorsement: "The Apache Software Foundation and PyPI do not endorse Onto2D or this interpretation."
      },
      evidenceClasses: {
        "pypi-requires-dist": "Requirement string captured from exact source-locked PyPI release metadata.",
        "source-locked-pypi-release": "Candidate release and wheel record projected from an exact hashed PyPI JSON response.",
        "official-versioned-airflow-constraint-file": "Pin captured from the exact Airflow 3.3.1 / Python 3.12 constraint-file bytes.",
        "exhaustive-bounded-enumeration": "Solution derived by enumerating every assignment in the declared finite candidate universe.",
        "onto2d-counterfactual": "Analysis-only constraint relaxation that does not modify upstream evidence."
      },
      presentation: {
        profile: "airflow-dependency-constraints-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: {
          catalogTitle: "Airflow constraint projection",
          searchPlaceholder: "Search projects, candidates, solutions, and costs",
          typeFilter: "Record kind",
          phaseFilter: "Evidence phase",
          statusFilter: "Evidence status",
          parents: "Incoming requirement or analysis relations",
          children: "Outgoing requirement or analysis relations"
        },
        coordinates: [
          { field: "typeRole", label: "Kind" },
          { field: "scientificStatus", label: "Evidence" }
        ],
        boundary: {
          title: "Bounded dependency projection",
          summary: "Official pins, PyPI records, exhaustive solutions, resolver diagnostics, and Onto2D counterfactuals remain separate layers.",
          note: "This 17-project projection is not a complete Airflow installation or a pip performance benchmark."
        }
      },
      audit
    })
  });
}
