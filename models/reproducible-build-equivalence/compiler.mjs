import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyReproducibleBuildEquivalenceCaseIdentity } from "../../cases/reproducible-build-equivalence/extract.mjs";

export const REPRODUCIBLE_BUILD_MAPPING_VERSION = "reproducible-build-equivalence-mapping-v1";
const RELEASE_DOMAIN = "onto2d:reproducible-build-equivalence-model-release:v1";
const AUDIT_DOMAIN = "onto2d:reproducible-build-equivalence-model-audit:v1";
const EDGE_DOMAIN = "onto2d:reproducible-build-equivalence-model-edge:v1";

function fail(message) {
  throw new TypeError(`reproducible-build-equivalence Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`;
}

function shortHash(value) {
  return `${value.slice(0, 18)}...`;
}

function expectedMatrix(artifact) {
  const matrix = artifact.comparisons.map((comparison) => comparison.regimes.map((result) => result.equal));
  const expected = [
    [true, true, false, true, false],
    [true, true, true, true, false],
    [false, false, true, true, false]
  ];
  if (JSON.stringify(matrix) !== JSON.stringify(expected)) fail("equivalence matrix differs from the reviewed case contract");
}

export function compileReproducibleBuildEquivalenceModelPack(input) {
  let artifact;
  try {
    artifact = verifyReproducibleBuildEquivalenceCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }
  if (artifact.histories.length !== 4 || artifact.comparisons.length !== 3 || artifact.regimes.length !== 5) fail("case inventory differs");
  if (new Set(artifact.histories.map((history) => history.historyIdentity)).size !== 4) fail("historical execution records collapsed");
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  expectedMatrix(artifact);

  const sourceNodes = artifact.source.sourceFiles.map((file) => ({
    id: `source:${file.identity}`,
    name: file.path.split("/").at(-1),
    description: "Exact source file used by every captured fixture build; bytes and SHA-256 are verified before rebuilding.",
    shortDescription: `${file.bytes} bytes; ${shortHash(file.identity)}.`,
    entityKind: "build-source-file",
    typeRole: "source-input",
    phase: "declared-input",
    scientificStatus: "byte-verified",
    sourcePath: file.path,
    sourceSha256: file.identity,
    bytes: file.bytes
  }));
  const instructionNode = {
    id: `instructions:${artifact.build.instructionsIdentity}`,
    name: "Deterministic text-bundle instructions",
    description: "Versioned build instructions defining the specified artifact, pinned source date, normalized environment, and intentionally excluded ambient field.",
    shortDescription: `${artifact.build.instructions.format}; SOURCE_DATE_EPOCH ${artifact.build.instructions.sourceDateEpoch}.`,
    entityKind: "build-instruction-profile",
    typeRole: "build-instructions",
    phase: "declared-input",
    scientificStatus: "source-locked",
    instructionsIdentity: artifact.build.instructionsIdentity,
    instructions: artifact.build.instructions
  };
  const environmentNode = {
    id: "environment:normalized-build-v1",
    name: "Normalized build environment",
    description: "The three environment fields declared identity-relevant for this fixture. ONTO2D_SESSION_LABEL is recorded separately and explicitly excluded.",
    shortDescription: "LANG=C; TZ=UTC; fixed source date.",
    entityKind: "environment-profile",
    typeRole: "normalized-environment",
    phase: "declared-input",
    scientificStatus: "declared-profile",
    normalized: artifact.histories[0].environment.normalized,
    excludedFields: artifact.regimes.find((regime) => regime.id === "environment").excludedFields
  };
  const toolchains = [...new Map(artifact.histories.map((history) => [`${history.runtime.name}@${history.runtime.version}`, history.runtime])).entries()];
  const toolchainNodes = toolchains.map(([key, runtime]) => ({
    id: `toolchain:${key}`,
    name: key,
    description: "Runtime identity reported by an actual capture process. Platform and architecture remain part of provenance, not the toolchain equivalence projection.",
    shortDescription: `${runtime.platform}/${runtime.architecture}.`,
    entityKind: "build-toolchain",
    typeRole: "toolchain",
    phase: "actual-execution",
    scientificStatus: "captured-record",
    runtime
  }));
  const outputNodes = artifact.build.specifiedOutputs.map((output) => ({
    id: `artifact:${output.sha256}`,
    name: output.utf8.includes("channel=preview") ? "Preview output" : "Stable output",
    description: "A specified primary build output compared byte-for-byte by SHA-256; capture logs and provenance remain separate records.",
    shortDescription: `${output.bytes} bytes; ${shortHash(output.sha256)}.`,
    entityKind: "build-artifact",
    typeRole: "specified-output",
    phase: "actual-output",
    scientificStatus: "byte-verified",
    artifactPath: output.path,
    sha256: output.sha256,
    bytes: output.bytes,
    utf8: output.utf8
  }));
  const historyNodes = artifact.histories.map((history) => ({
    id: `history:${history.executionId}`,
    name: history.executionId.replaceAll("-", " "),
    description: "A distinct captured build execution. Its historical identity never collapses merely because another execution produced equal bytes under one regime.",
    shortDescription: `${history.runtime.name} ${history.runtime.version}; ${history.declaredInputs.parameters.releaseChannel}; ${history.artifact.bytes} bytes.`,
    entityKind: "build-execution-record",
    typeRole: "execution-history",
    phase: "actual-execution",
    scientificStatus: "captured-record",
    executionId: history.executionId,
    historyIdentity: history.historyIdentity,
    capturedAt: history.capturedAt,
    runtime: history.runtime,
    declaredInputs: history.declaredInputs,
    environment: history.environment,
    outputSha256: history.artifact.sha256
  }));
  const regimeNodes = artifact.regimes.map((regime) => ({
    id: `regime:${regime.id}`,
    name: regime.label,
    description: regime.question,
    shortDescription: `${regime.fields.length} compared field(s); ${regime.normalization}.`,
    entityKind: "equivalence-regime",
    typeRole: "equivalence-regime",
    phase: "derived-analysis",
    scientificStatus: "declared-profile",
    regimeId: regime.id,
    comparedFields: regime.fields,
    excludedFields: regime.excludedFields ?? [],
    normalization: regime.normalization
  }));
  const comparisonNodes = artifact.comparisons.map((comparison) => ({
    id: `comparison:${comparison.id}`,
    name: comparison.label,
    description: "A declared pair of distinct recorded build histories evaluated independently under every versioned equivalence regime.",
    shortDescription: `${comparison.regimes.filter((result) => result.equal).length}/5 regimes equal.`,
    entityKind: "history-comparison",
    typeRole: "comparison",
    phase: "derived-analysis",
    scientificStatus: "deterministically-derived",
    comparisonId: comparison.id,
    leftHistory: comparison.leftHistory,
    rightHistory: comparison.rightHistory,
    historiesDistinct: comparison.historiesDistinct
  }));
  const verdictNodes = artifact.comparisons.flatMap((comparison) => comparison.regimes.map((result) => ({
    id: `verdict:${comparison.id}:${result.regimeId}`,
    name: `${comparison.id} / ${result.label}`,
    description: result.equal ? "The two regime projections are exactly equal." : `The histories differ in: ${result.differingFields.join(", ")}.`,
    shortDescription: result.equal ? "EQUIVALENT under this regime." : `DISTINCT; ${result.differingFields.length} field(s) differ.`,
    entityKind: "equivalence-verdict",
    typeRole: "regime-verdict",
    phase: "derived-analysis",
    scientificStatus: "deterministically-derived",
    comparisonId: comparison.id,
    regimeId: result.regimeId,
    equal: result.equal,
    differingFields: result.differingFields,
    leftProjectionIdentity: result.leftProjectionIdentity,
    rightProjectionIdentity: result.rightProjectionIdentity
  })));
  const boundaryNode = {
    id: "boundary:historical-load-not-evaluated",
    name: "Historical Load is undefined here",
    description: artifact.historicalLoad.reason,
    shortDescription: "No route space, admissibility rule, or cost function.",
    entityKind: "analysis-boundary",
    typeRole: "historical-load-boundary",
    phase: "evidence-boundary",
    scientificStatus: "explicitly-not-evaluated",
    value: null
  };

  const nodes = [...sourceNodes, instructionNode, environmentNode, ...toolchainNodes, ...outputNodes, ...historyNodes, ...regimeNodes, ...comparisonNodes, ...verdictNodes, boundaryNode];
  const edges = [];
  for (const source of sourceNodes) edges.push({ id: edgeId("declares-source", instructionNode.id, source.id), source: instructionNode.id, target: source.id, relation: "declares-source", relationLayer: "declared", evidenceClass: "source-lock", evidenceStatus: "verified" });
  for (const history of artifact.histories) {
    const historyId = `history:${history.executionId}`;
    edges.push({ id: edgeId("uses-instructions", historyId, instructionNode.id), source: historyId, target: instructionNode.id, relation: "uses-instructions", relationLayer: "actual", evidenceClass: "captured-declared-input", evidenceStatus: "captured" });
    edges.push({ id: edgeId("uses-environment-profile", historyId, environmentNode.id), source: historyId, target: environmentNode.id, relation: "uses-environment-profile", relationLayer: "actual", evidenceClass: "captured-normalized-environment", evidenceStatus: "captured" });
    edges.push({ id: edgeId("executes-with", historyId, `toolchain:${history.runtime.name}@${history.runtime.version}`), source: historyId, target: `toolchain:${history.runtime.name}@${history.runtime.version}`, relation: "executes-with", relationLayer: "actual", evidenceClass: "captured-runtime", evidenceStatus: "captured" });
    edges.push({ id: edgeId("produces", historyId, `artifact:${history.artifact.sha256}`), source: historyId, target: `artifact:${history.artifact.sha256}`, relation: "produces", relationLayer: "actual", evidenceClass: "exact-output-bytes", evidenceStatus: "verified" });
    for (const source of sourceNodes) edges.push({ id: edgeId("consumes-source", historyId, source.id), source: historyId, target: source.id, relation: "consumes-source", relationLayer: "actual", evidenceClass: "declared-input-identity", evidenceStatus: "verified" });
  }
  for (const comparison of artifact.comparisons) {
    const comparisonId = `comparison:${comparison.id}`;
    edges.push({ id: edgeId("compares-left", comparisonId, `history:${comparison.leftHistory}`), source: comparisonId, target: `history:${comparison.leftHistory}`, relation: "compares-left", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived" });
    edges.push({ id: edgeId("compares-right", comparisonId, `history:${comparison.rightHistory}`), source: comparisonId, target: `history:${comparison.rightHistory}`, relation: "compares-right", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived" });
    for (const result of comparison.regimes) {
      const verdictId = `verdict:${comparison.id}:${result.regimeId}`;
      edges.push({ id: edgeId("has-verdict", comparisonId, verdictId), source: comparisonId, target: verdictId, relation: "has-verdict", relationLayer: "analysis", evidenceClass: "exact-projection-comparison", evidenceStatus: "derived", equal: result.equal });
      edges.push({ id: edgeId("evaluated-under", verdictId, `regime:${result.regimeId}`), source: verdictId, target: `regime:${result.regimeId}`, relation: "evaluated-under", relationLayer: "analysis", evidenceClass: "versioned-equivalence-profile", evidenceStatus: "derived" });
    }
  }
  for (const comparison of comparisonNodes) edges.push({ id: edgeId("bounded-by", comparison.id, boundaryNode.id), source: comparison.id, target: boundaryNode.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  const edgeIds = new Set();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} is repeated`);
    edgeIds.add(edge.id);
  }

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: REPRODUCIBLE_BUILD_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: REPRODUCIBLE_BUILD_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { sources: sourceNodes.length, toolchains: toolchainNodes.length, outputs: outputNodes.length, histories: historyNodes.length, regimes: regimeNodes.length, comparisons: comparisonNodes.length, verdicts: verdictNodes.length },
    equalVerdicts: verdictNodes.filter((node) => node.equal).length,
    distinctVerdicts: verdictNodes.filter((node) => !node.equal).length,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  const sourceFiles = [
    ...artifact.source.authoredFiles.map((file) => ({ path: `cases/reproducible-build-equivalence/${file.path}`, hash: file.identity })),
    ...artifact.source.sourceFiles.map((file) => ({ path: `cases/reproducible-build-equivalence/${file.path}`, hash: file.identity }))
  ];
  return buildModelPack({
    model: { id: "reproducible-build-equivalence", name: "Reproducible Build Equivalence", version, description: "Four captured build executions compared under five explicit, versioned history-equivalence regimes.", status: "reproducible-fixture-analysis-case" },
    source: { id: `reproducible-builds-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { methodology: artifact.methodology, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: REPRODUCIBLE_BUILD_MAPPING_VERSION },
      evidenceClasses: { "source-lock": "Exact authored source bytes and SHA-256.", "captured-runtime": "Runtime fields reported by the actual capture process.", "exact-output-bytes": "Specified output bytes verified by SHA-256.", "declared-input-identity": "Canonical identity over source, instructions, and declared parameters.", "versioned-equivalence-profile": "Explicit regime field selection and normalization.", "exact-projection-comparison": "Equality over two deterministic regime projections.", "analysis-scope": "Explicit boundary separating equivalence from undefined Historical Load." },
      identityRegimes: Object.fromEntries(artifact.regimes.map((regime) => [regime.id, regime.question])),
      presentation: {
        profile: "reproducible-build-equivalence-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Build histories and equivalence", searchPlaceholder: "Search executions, outputs, regimes, and verdicts", typeFilter: "Record kind", phaseFilter: "Evidence phase", statusFilter: "Evidence status", parents: "Incoming build or analysis relations", children: "Outgoing build or analysis relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }],
        boundary: { title: "History equivalence boundary", summary: "Execution identity, output equality, declared inputs, toolchain, environment, and provenance remain independently queryable.", note: "An equal verdict is local to one pair and one regime. Historical Load is not evaluated because this case declares no route cost problem." }
      },
      audit
    })
  });
}
