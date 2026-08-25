import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import {
  buildConstraintAblations,
  buildSharedDependencies,
  calculateHistoricalLoad,
  enumerateSolutions,
  normalizeProject
} from "./src/resolver.mjs";

const DEFAULT_CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.join(DEFAULT_CASE_ROOT, "artifacts", "airflow-dependency-constraints.json");
const SOURCE_IDENTITY_DOMAIN = "onto2d:airflow-constraint-source-lock:v1";
const CASE_IDENTITY_DOMAIN = "onto2d:airflow-dependency-constraints-case:v1";
const PROFILE_IDENTITY_DOMAIN = "onto2d:airflow-constraint-analysis-profile:v1";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const EXPECTED_PROJECT_COUNT = 17;
const EXPECTED_ASSIGNMENT_COUNT = 128;
const EXPECTED_SOLUTION_COUNT = 64;

function fail(message) {
  throw new Error(`Airflow Dependency Constraints extraction failed: ${message}`);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(record(value, label)).sort();
  const wanted = [...expected].sort();
  if (!same(actual, wanted)) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

async function jsonFile(file, label) {
  const bytes = await readFile(file);
  if (bytes.length === 0 || bytes.length > MAX_JSON_BYTES) fail(`${label} has an invalid byte count`);
  try {
    return { bytes, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    fail(`${label} is not valid UTF-8 JSON`);
  }
}

function validateProfile(input) {
  const profile = record(input, "analysis profile");
  exactKeys(profile, ["format", "formatVersion", "scope", "rootRequirements", "projects", "costFunctions"], "analysis profile");
  if (profile.format !== "onto2d-airflow-constraint-analysis-profile" || profile.formatVersion !== "1") fail("analysis profile version is unsupported");
  exactKeys(profile.scope, ["airflowRelease", "rootProject", "rootVersion", "pythonVersion", "platform", "projectionId", "constraintPath", "boundary"], "analysis scope");
  if (profile.scope.airflowRelease !== "3.3.1" || profile.scope.rootProject !== "apache-airflow-core" || profile.scope.rootVersion !== "3.3.1" || profile.scope.pythonVersion !== "3.12" || profile.scope.platform !== "manylinux-x86_64" || profile.scope.projectionId !== "airflow-core-five-requirement-projection-v1" || profile.scope.constraintPath !== "constraints-no-providers-3.12.txt") fail("analysis scope differs from the reviewed v1 contract");
  if (!Array.isArray(profile.rootRequirements) || profile.rootRequirements.length !== 5 || !Array.isArray(profile.projects) || profile.projects.length !== EXPECTED_PROJECT_COUNT) fail("analysis profile inventory differs from the reviewed v1 contract");
  const projectIds = profile.projects.map((entry) => entry.project);
  if (new Set(projectIds).size !== projectIds.length || !same([...projectIds].sort(), projectIds)) fail("analysis projects must be unique and sorted");
  for (const entry of profile.projects) {
    exactKeys(entry, ["project", "versions", "baseline", "constrained", "dependencies"], `project ${entry.project}`);
    if (normalizeProject(entry.project) !== entry.project || !Array.isArray(entry.versions) || entry.versions.length === 0 || !entry.versions.includes(entry.baseline) || !entry.versions.includes(entry.constrained)) fail(`project ${entry.project} is invalid`);
    if (!same(Object.keys(entry.dependencies), entry.versions)) fail(`project ${entry.project} dependency versions are incomplete or reordered`);
    for (const version of entry.versions) {
      if (!Array.isArray(entry.dependencies[version])) fail(`project ${entry.project} dependencies are invalid`);
    }
  }
  const costIds = profile.costFunctions.map((entry) => entry.id);
  if (!same(costIds, ["wheel-download-bytes", "environment-change-actions", "selected-wheel-count"])) fail("cost function inventory differs from the reviewed v1 contract");
  return profile;
}

function parseConstraintFile(source) {
  const entries = [];
  const seen = new Set();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)$/.exec(line);
    if (!match) fail(`unsupported Airflow constraint line ${line}`);
    const project = normalizeProject(match[1]);
    if (seen.has(project)) fail(`duplicate Airflow constraint ${project}`);
    seen.add(project);
    entries.push({ project, version: match[2], sourceLine: line });
  }
  entries.sort((left, right) => left.project.localeCompare(right.project));
  return entries;
}

function selectedWheel(urls, project, version) {
  const wheels = urls.filter((entry) => entry.packagetype === "bdist_wheel" && entry.yanked !== true);
  const platform = wheels.filter((entry) => entry.filename.includes("cp312-cp312") && entry.filename.includes("manylinux") && entry.filename.includes("x86_64") && !entry.filename.includes("musllinux"));
  const universal = wheels.filter((entry) => entry.filename.endsWith("-py3-none-any.whl"));
  const selected = [...platform, ...universal].sort((left, right) => left.filename.localeCompare(right.filename))[0];
  if (!selected || !Number.isSafeInteger(selected.size) || selected.size <= 0 || !/^[0-9a-f]{64}$/.test(selected.digests?.sha256)) fail(`${project}==${version} has no supported Python 3.12 manylinux x86_64 wheel`);
  return {
    filename: selected.filename,
    url: selected.url,
    size: selected.size,
    sha256: `sha256:${selected.digests.sha256}`,
    packagetype: selected.packagetype,
    pythonVersion: selected.python_version,
    requiresPython: selected.requires_python
  };
}

function metadataPath(project, version) {
  return `pypi/${project}-${version}.json`;
}

async function verifiedSources(caseRoot, sourceSpec) {
  const sourcesRoot = path.join(caseRoot, "sources");
  const { value: lock } = await jsonFile(path.join(sourcesRoot, "source-lock.json"), "source lock");
  exactKeys(lock, ["format", "formatVersion", "capturedAt", "sourceSpec", "files", "identity"], "source lock");
  const { identity, ...basis } = lock;
  if (lock.format !== "onto2d-airflow-constraint-source-lock" || lock.formatVersion !== "1" || hashCanonical(SOURCE_IDENTITY_DOMAIN, basis) !== identity) fail("source lock identity is invalid");
  const files = new Map();
  for (const entry of lock.files) {
    exactKeys(entry, ["path", "url", "size", "sha256"], `source-lock entry ${entry.path}`);
    const bytes = await readFile(path.join(sourcesRoot, entry.path));
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) fail(`${entry.path} differs from its source lock`);
    files.set(entry.path, { ...entry, bytes });
  }
  const expectedPaths = [sourceSpec.constraint.path, ...sourceSpec.pypiReleases.map((entry) => metadataPath(normalizeProject(entry.project), entry.version))].sort();
  if (!same([...files.keys()].sort(), expectedPaths)) fail("source-lock file inventory differs from source-spec");
  return { lock, files };
}

function validateSourceRequirement(metadata, requirement, label) {
  const requiresDist = metadata.info.requires_dist ?? [];
  if (!requiresDist.includes(requirement)) fail(`${label} is absent from exact PyPI requires_dist metadata`);
}

function sourceRecord(file, metadata) {
  return {
    path: file.path,
    url: file.url,
    size: file.size,
    sha256: file.sha256,
    project: normalizeProject(metadata.info.name),
    version: metadata.info.version
  };
}

function buildCandidate(profileEntry, version, file, metadata) {
  if (normalizeProject(metadata.info.name) !== profileEntry.project || metadata.info.version !== version) fail(`${file.path} project or version differs from the profile`);
  const dependencies = profileEntry.dependencies[version];
  for (const dependency of dependencies) {
    for (const requirement of dependency.sourceRequirements) validateSourceRequirement(metadata, requirement, `${profileEntry.project}==${version} requirement ${requirement}`);
  }
  return {
    candidateId: `${profileEntry.project}==${version}`,
    project: profileEntry.project,
    version,
    requiresPython: metadata.info.requires_python,
    dependencies,
    wheel: selectedWheel(metadata.urls, profileEntry.project, version),
    source: sourceRecord(file, metadata)
  };
}

function constraintAblationSummary(ablations) {
  return ablations.map((ablation) => ({
    id: ablation.id,
    relaxedProjects: ablation.relaxedProjects,
    admittedSolutions: ablation.results[0].constrained.solutionCount,
    historicalLoad: Object.fromEntries(ablation.results.map((result) => [result.costFunction, result.historicalLoad]))
  }));
}

function expectedExperiments(artifact) {
  const baseline = artifact.solutions.find((solution) => solution.selections.every((selection) => artifact.analysisProfile.projects.find((entry) => entry.project === selection.project).baseline === selection.version));
  const constrained = artifact.solutions.find((solution) => solution.constraintCompliant);
  if (!baseline || !constrained) fail("baseline or constrained witness is missing");
  return [
    {
      id: "bounded-resolution",
      label: "Free and officially constrained resolution in one finite projection",
      assignmentsConsidered: artifact.resolverDiagnostics.assignmentsConsidered,
      freeSolutions: artifact.solutions.length,
      constraintCompliantSolutions: artifact.solutions.filter((solution) => solution.constraintCompliant).length,
      rejectedAssignments: artifact.resolverDiagnostics.rejectedAssignments
    },
    {
      id: "environment-identity",
      label: "One root projection, different complete environments",
      rootProjectionEqual: true,
      baselineSolutionId: baseline.solutionId,
      constrainedSolutionId: constrained.solutionId,
      exactEnvironmentEqual: baseline.environmentIdentity === constrained.environmentIdentity,
      changedProjects: constrained.selections.filter((selection) => artifact.analysisProfile.projects.find((entry) => entry.project === selection.project).baseline !== selection.version).map((selection) => selection.project)
    },
    {
      id: "constraint-ablation",
      label: "Single-line and paired constraint relaxations",
      results: constraintAblationSummary(artifact.constraintAblations)
    },
    {
      id: "shared-dependency-reuse",
      label: "Dependency targets reused by independent project branches",
      results: artifact.sharedDependencies
    }
  ];
}

export function verifyAirflowDependencyConstraintsCaseIdentity(input) {
  const artifact = structuredClone(record(input, "case artifact"));
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "scope", "source", "constraint", "analysisProfile", "candidateUniverse", "solutions", "resolverDiagnostics", "sharedDependencies", "historicalLoad", "constraintAblations", "experiments", "limitations", "caseIdentity"], "case artifact");
  if (artifact.format !== "onto2d-airflow-dependency-constraints-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "airflow-dependency-constraints-v1" || artifact.generatedBy !== "cases/airflow-dependency-constraints/extract.mjs") fail("case artifact constants differ from v1");
  const profile = validateProfile(artifact.analysisProfile);
  if (!same(artifact.scope, profile.scope)) fail("case scope differs from its analysis profile");
  if (artifact.candidateUniverse.projectCount !== EXPECTED_PROJECT_COUNT || artifact.candidateUniverse.candidateCount !== artifact.candidateUniverse.candidates.length) fail("candidate universe inventory is invalid");
  const replay = enumerateSolutions(artifact.candidateUniverse.candidates, profile);
  if (!same(replay.solutions, artifact.solutions) || !same(replay.diagnostics, artifact.resolverDiagnostics)) fail("solution space or resolver diagnostics are substituted");
  if (replay.diagnostics.assignmentsConsidered !== EXPECTED_ASSIGNMENT_COUNT || replay.solutions.length !== EXPECTED_SOLUTION_COUNT) fail("bounded solution census differs from the reviewed v1 result");
  const constrained = replay.solutions.filter((solution) => solution.constraintCompliant);
  if (constrained.length !== 1) fail("official constraints do not select exactly one bounded solution");
  const load = profile.costFunctions.map((cost) => calculateHistoricalLoad(replay.solutions, profile, cost.id));
  if (!same(artifact.historicalLoad.results, load) || artifact.historicalLoad.status !== "resolved-in-declared-projection") fail("Historical Load results are substituted");
  const ablations = buildConstraintAblations(replay.solutions, profile);
  if (!same(artifact.constraintAblations, ablations)) fail("constraint ablations are substituted");
  if (!same(artifact.sharedDependencies, buildSharedDependencies(profile))) fail("shared dependency result is substituted");
  if (!same(artifact.experiments, expectedExperiments(artifact))) fail("case experiments are substituted");
  const { caseIdentity, ...basis } = artifact;
  if (hashCanonical(CASE_IDENTITY_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildAirflowDependencyConstraintsCase(options = {}) {
  const caseRoot = path.resolve(options.caseRoot ?? DEFAULT_CASE_ROOT);
  const [{ value: sourceSpec }, { value: profileInput }] = await Promise.all([
    jsonFile(path.join(caseRoot, "source-spec.json"), "source spec"),
    jsonFile(path.join(caseRoot, "analysis-profile.json"), "analysis profile")
  ]);
  const profile = validateProfile(profileInput);
  if (sourceSpec.airflowRelease !== profile.scope.airflowRelease || sourceSpec.pythonVersion !== profile.scope.pythonVersion || sourceSpec.platform !== profile.scope.platform) fail("source spec differs from analysis scope");
  const verified = await verifiedSources(caseRoot, sourceSpec);
  const constraintFile = verified.files.get(sourceSpec.constraint.path);
  const constraintEntries = parseConstraintFile(new TextDecoder("utf-8", { fatal: true }).decode(constraintFile.bytes));
  const constraintMap = new Map(constraintEntries.map((entry) => [entry.project, entry.version]));
  for (const entry of profile.projects) {
    if (constraintMap.get(entry.project) !== entry.constrained) fail(`official constraint pin for ${entry.project} differs from the profile`);
  }

  const metadata = new Map();
  for (const release of sourceSpec.pypiReleases) {
    const project = normalizeProject(release.project);
    const relativePath = metadataPath(project, release.version);
    const file = verified.files.get(relativePath);
    metadata.set(`${project}==${release.version}`, { file, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes)) });
  }
  const rootMetadata = metadata.get(`${profile.scope.rootProject}==${profile.scope.rootVersion}`);
  if (!rootMetadata) fail("Airflow Core root metadata is missing");
  for (const requirement of profile.rootRequirements) validateSourceRequirement(rootMetadata.value, requirement.sourceRequirement, `root requirement ${requirement.sourceRequirement}`);
  const airflowMetadata = metadata.get(`apache-airflow==${profile.scope.airflowRelease}`);
  validateSourceRequirement(airflowMetadata.value, `apache-airflow-core==${profile.scope.airflowRelease}`, "apache-airflow root-to-core requirement");

  const candidates = [];
  for (const entry of profile.projects) {
    for (const version of entry.versions) {
      const source = metadata.get(`${entry.project}==${version}`);
      if (!source) fail(`PyPI source for ${entry.project}==${version} is missing`);
      candidates.push(buildCandidate(entry, version, source.file, source.value));
    }
  }
  const enumeration = enumerateSolutions(candidates, profile);
  if (enumeration.diagnostics.assignmentsConsidered !== EXPECTED_ASSIGNMENT_COUNT || enumeration.solutions.length !== EXPECTED_SOLUTION_COUNT) fail("bounded census does not match the reviewed v1 closure");
  const profileIdentity = hashCanonical(PROFILE_IDENTITY_DOMAIN, profile);
  const source = {
    identity: verified.lock.identity,
    lock: verified.lock,
    constraintFile: { path: constraintFile.path, url: constraintFile.url, size: constraintFile.size, sha256: constraintFile.sha256 },
    airflowRoot: sourceRecord(airflowMetadata.file, airflowMetadata.value),
    airflowCoreRoot: sourceRecord(rootMetadata.file, rootMetadata.value)
  };
  const constraint = {
    evidenceClass: "official-versioned-airflow-constraint-file",
    entryCount: constraintEntries.length,
    entries: constraintEntries,
    selectedPins: profile.projects.map((entry) => ({ project: entry.project, version: entry.constrained }))
  };
  const sharedDependencies = buildSharedDependencies(profile);
  const historicalLoad = {
    status: "resolved-in-declared-projection",
    profileIdentity,
    results: profile.costFunctions.map((cost) => calculateHistoricalLoad(enumeration.solutions, profile, cost.id)),
    resolverDiagnosticsUsedAsCost: false
  };
  const constraintAblations = buildConstraintAblations(enumeration.solutions, profile);
  const basis = {
    format: "onto2d-airflow-dependency-constraints-case",
    formatVersion: "1",
    caseVersion: "airflow-dependency-constraints-v1",
    generatedBy: "cases/airflow-dependency-constraints/extract.mjs",
    scope: profile.scope,
    source,
    constraint,
    analysisProfile: profile,
    candidateUniverse: { projectCount: profile.projects.length, candidateCount: candidates.length, candidates },
    solutions: enumeration.solutions,
    resolverDiagnostics: enumeration.diagnostics,
    sharedDependencies,
    historicalLoad,
    constraintAblations,
    experiments: [],
    limitations: [
      "The result is complete only inside the declared five-requirement Airflow Core projection and is not a complete apache-airflow installation or global PyPI census.",
      "Official Airflow constraints record a tested release configuration; exclusion from that file is not evidence that another version is broken or unsafe.",
      "PyPI release metadata and exact wheel records are source-locked, but wheel payload bytes are not vendored and pip installation is not replayed offline.",
      "The exhaustive resolver diagnostic counts assignments and rejections but neither search work nor runtime enters Historical Load.",
      "Environment-change cost is relative to one declared valid baseline; wheel bytes and wheel count are separate cost profiles."
    ]
  };
  basis.experiments = expectedExperiments(basis);
  return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_IDENTITY_DOMAIN, basis) });
}

async function main(argv) {
  const verify = argv.includes("--verify");
  if (argv.some((argument) => argument !== "--verify")) fail("only --verify is supported");
  const artifact = await buildAirflowDependencyConstraintsCase();
  verifyAirflowDependencyConstraintsCaseIdentity(artifact);
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  if (verify) {
    const current = await readFile(DEFAULT_OUTPUT).catch(() => fail(`missing committed artifact ${DEFAULT_OUTPUT}`));
    if (!current.equals(bytes)) fail(`committed artifact differs: ${DEFAULT_OUTPUT}`);
    console.log(`Verified ${DEFAULT_OUTPUT}`);
  } else {
    await mkdir(path.dirname(DEFAULT_OUTPUT), { recursive: true });
    await writeFile(DEFAULT_OUTPUT, bytes);
    console.log(`Wrote ${DEFAULT_OUTPUT}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
