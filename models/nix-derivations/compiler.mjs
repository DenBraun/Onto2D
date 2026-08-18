import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyNixDerivationCaseIdentity } from "../../cases/nix-derivation-identity/extract.mjs";

export const NIX_DERIVATION_MAPPING_VERSION = "nix-derivation-model-mapping-v2";
const RELEASE_DOMAIN = "onto2d:nix-derivation-model-release:v1";
const AUDIT_DOMAIN = "onto2d:nix-derivation-model-audit:v1";
const EDGE_DOMAIN = "onto2d:nix-derivation-model-edge:v1";

function fail(message) {
  throw new TypeError(`nix-derivations Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target) {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target }).slice("sha256:".length, "sha256:".length + 20)}`;
}

function outputStatus(mapping) {
  return mapping.evidence === "materialized-fixed-output" ? "materialized-content-addressed" : "declared-unrealized";
}

function storeObjectName(storePath) {
  const name = storePath.match(/^\/nix\/store\/[0-9a-df-np-sv-z]{32}-(.+)$/)?.[1];
  if (!name) fail(`cannot derive a display name from store path ${storePath}`);
  return name;
}

function relationKey(source, target, outputs = null) {
  return `${source}\u0000${target}\u0000${outputs === null ? "" : JSON.stringify(outputs)}`;
}

function requireExactRelations(actual, expected, keyOf, label) {
  const seen = new Set();
  for (const relation of actual) {
    const key = keyOf(relation);
    if (seen.has(key) || !expected.has(key)) fail(`${label} contains a duplicate or substituted relation`);
    seen.add(key);
  }
  if (seen.size !== expected.size) fail(`${label} omits a required relation`);
}

export function compileNixDerivationsModelPack(input) {
  let artifact;
  try {
    artifact = verifyNixDerivationCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }
  if (artifact.format !== "onto2d-nix-derivation-identity-case") fail("verified Nix case artifact is required");
  if (artifact.captureBoundary.derivationBuildersExecuted !== false || artifact.captureBoundary.derivationsInstantiatedByNix !== true) fail("unsupported execution boundary");
  const derivationByPath = new Map(artifact.derivations.map((derivation) => [derivation.drvPath, derivation]));
  const derivationPaths = new Set(derivationByPath.keys());
  if (derivationPaths.size !== artifact.derivations.length) fail("derivation paths must be unique");
  if (artifact.dependencyGraph.directEdges.some((edge) => !derivationPaths.has(edge.from) || !derivationPaths.has(edge.to) || edge.evidence !== "native")) fail("native dependency graph has unresolved or relabeled endpoints");
  if (artifact.dependencyGraph.closureEdges.some((edge) => !derivationPaths.has(edge.from) || !derivationPaths.has(edge.to) || edge.evidence !== "derived")) fail("derived closure graph has unresolved or relabeled endpoints");

  const expectedDirect = new Set();
  const expectedClosure = new Set();
  for (const derivation of artifact.derivations) {
    const directPaths = new Set();
    for (const input of derivation.directInputDrvs) {
      if (!derivationPaths.has(input.drvPath) || directPaths.has(input.drvPath)) fail(`${derivation.fixtureId} has an unresolved or repeated direct input`);
      directPaths.add(input.drvPath);
      expectedDirect.add(relationKey(derivation.drvPath, input.drvPath, input.outputs));
    }
    for (const member of derivation.inputClosure.members) {
      if (!derivationPaths.has(member)) fail(`${derivation.fixtureId} has an unresolved closure member`);
      if (!directPaths.has(member)) expectedClosure.add(relationKey(derivation.drvPath, member));
    }
  }
  requireExactRelations(
    artifact.dependencyGraph.directEdges,
    expectedDirect,
    (edge) => relationKey(edge.from, edge.to, edge.outputs),
    "native dependency graph"
  );
  requireExactRelations(
    artifact.dependencyGraph.closureEdges,
    expectedClosure,
    (edge) => relationKey(edge.from, edge.to),
    "derived closure graph"
  );

  const outputMappings = new Map();
  const mappedDerivations = new Set();
  for (const mapping of artifact.dependencyGraph.outputMappings) {
    const derivation = derivationByPath.get(mapping.derivation);
    if (!derivation || mappedDerivations.has(mapping.derivation)) fail(`output mapping has unknown or repeated derivation ${mapping.derivation}`);
    if (mapping.output !== "out" || mapping.path !== derivation.outputPath || mapping.addressing !== derivation.outputAddressing || mapping.contentIdentity !== derivation.outputContentIdentity || mapping.evidence !== derivation.outputEvidence) fail(`output mapping differs from derivation ${derivation.fixtureId}`);
    mappedDerivations.add(mapping.derivation);
    const prior = outputMappings.get(mapping.path);
    if (prior && (prior.contentIdentity !== mapping.contentIdentity || prior.evidence !== mapping.evidence)) fail(`output path ${mapping.path} has contradictory evidence`);
    outputMappings.set(mapping.path, mapping);
  }
  if (mappedDerivations.size !== derivationPaths.size) fail("output mappings do not cover every derivation");

  const derivationNodes = artifact.derivations.map((derivation) => ({
    id: derivation.drvPath,
    name: derivation.fixtureId,
    description: `Native Nix derivation ${derivation.drvName}; the builder was not executed in this capture.`,
    shortDescription: `${derivation.outputAddressing}; ${derivation.directInputDrvs.length} direct inputDrv relation(s).`,
    entityKind: "nix-derivation",
    typeRole: "derivation",
    phase: "native-capture",
    scientificStatus: "native-instantiated-unrealized",
    fixtureId: derivation.fixtureId,
    nativeIdentity: derivation.drvPath,
    rawIdentity: derivation.rawIdentity,
    addressing: derivation.outputAddressing,
    depth: derivation.depth,
    inputClosureIdentity: derivation.inputClosure.identity,
    builderEnvironmentIdentity: derivation.builderEnvironment.identity,
    sourceRecord: derivation.native
  }));
  const outputNodes = [...outputMappings.values()].map((mapping) => ({
    id: mapping.path,
    name: storeObjectName(mapping.path),
    description: mapping.evidence === "materialized-fixed-output"
      ? "Content-addressed store object materialized by nix store add-file; no derivation realization is claimed."
      : "Output path declared by a native input-addressed derivation; content was not realized in this capture.",
    shortDescription: `${mapping.addressing}; ${mapping.evidence}.`,
    entityKind: "nix-output",
    typeRole: "output",
    phase: "native-capture",
    scientificStatus: outputStatus(mapping),
    nativeIdentity: mapping.path,
    contentIdentity: mapping.contentIdentity,
    addressing: mapping.addressing,
    evidenceStatus: mapping.evidence
  }));
  const builderIds = [...new Set(artifact.derivations.map((derivation) => derivation.builder))];
  const builderNodes = builderIds.map((builder) => ({
    id: `builder:${builder}`,
    name: builder,
    description: "Builder path declared by native Nix derivation records; execution is outside this capture.",
    shortDescription: "Declared native builder path.",
    entityKind: "nix-builder",
    typeRole: "builder",
    phase: "native-capture",
    scientificStatus: "declared-unexecuted",
    nativeIdentity: builder
  }));
  const environmentByIdentity = new Map();
  for (const derivation of artifact.derivations) environmentByIdentity.set(derivation.builderEnvironment.identity, derivation.builderEnvironment);
  const environmentNodes = [...environmentByIdentity.entries()].map(([identity, environment]) => ({
    id: `environment:${identity}`,
    name: identity.slice(0, 22),
    description: "Deterministic builder-env-v1 projection over system, builder, arguments, and declared environment.",
    shortDescription: `${environment.system}; ${Object.keys(environment.env).length} declared environment fields.`,
    entityKind: "nix-environment-profile",
    typeRole: "environment",
    phase: "derived-projection",
    scientificStatus: "deterministically-derived",
    projectionIdentity: identity,
    profile: environment.profile,
    sourceRecord: environment
  }));
  const nodes = [...derivationNodes, ...outputNodes, ...builderNodes, ...environmentNodes];

  const directEdges = artifact.dependencyGraph.directEdges.map((edge) => ({
    id: edgeId("inputDrv", edge.from, edge.to),
    source: edge.from,
    target: edge.to,
    relation: "inputDrv",
    relationLayer: "native",
    dependencyType: "direct-derivation-input",
    necessity: "declared",
    evidenceClass: "native-nix-json-and-aterm",
    evidenceStatus: "captured",
    outputs: edge.outputs
  }));
  const closureEdges = artifact.dependencyGraph.closureEdges.map((edge) => ({
    id: edgeId("transitive-inputDrv", edge.from, edge.to),
    source: edge.from,
    target: edge.to,
    relation: "transitive-inputDrv",
    relationLayer: "derived",
    dependencyType: "transitive-derivation-input",
    necessity: "derived-closure",
    evidenceClass: "deterministic-projection",
    evidenceStatus: "derived"
  }));
  const outputEdges = artifact.dependencyGraph.outputMappings.map((mapping) => ({
    id: edgeId("declares-output", mapping.derivation, mapping.path),
    source: mapping.derivation,
    target: mapping.path,
    relation: "declares-output",
    relationLayer: "native",
    dependencyType: "derivation-output-specification",
    necessity: "declared",
    evidenceClass: mapping.evidence,
    evidenceStatus: mapping.evidence,
    outputName: mapping.output,
    addressing: mapping.addressing
  }));
  const builderEdges = artifact.derivations.map((derivation) => ({
    id: edgeId("declares-builder", derivation.drvPath, `builder:${derivation.builder}`),
    source: derivation.drvPath,
    target: `builder:${derivation.builder}`,
    relation: "declares-builder",
    relationLayer: "native",
    dependencyType: "builder-declaration",
    necessity: "declared",
    evidenceClass: "native-nix-json-and-aterm",
    evidenceStatus: "captured"
  }));
  const environmentEdges = artifact.derivations.map((derivation) => ({
    id: edgeId("has-builder-environment", derivation.drvPath, `environment:${derivation.builderEnvironment.identity}`),
    source: derivation.drvPath,
    target: `environment:${derivation.builderEnvironment.identity}`,
    relation: "has-builder-environment",
    relationLayer: "derived",
    dependencyType: "builder-environment-projection",
    necessity: "derived-projection",
    evidenceClass: "deterministic-projection",
    evidenceStatus: "derived"
  }));
  const edges = [...directEdges, ...closureEdges, ...outputEdges, ...builderEdges, ...environmentEdges];

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, {
    mappingVersion: NIX_DERIVATION_MAPPING_VERSION,
    caseIdentity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity
  });
  const version = `v1-${releaseIdentity.slice("sha256:".length, "sha256:".length + 16)}`;
  const audit = {
    mappingVersion: NIX_DERIVATION_MAPPING_VERSION,
    releaseIdentity,
    caseIdentity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    nativeInventory: {
      derivations: artifact.derivations.length,
      directInputDrvRelations: directEdges.length,
      outputs: outputNodes.length
    },
    derivedInventory: {
      transitiveClosureRelations: closureEdges.length,
      environmentProfiles: environmentNodes.length
    },
    executionBoundary: artifact.captureBoundary
  };
  const sourceFiles = [
    ...artifact.source.sourceFiles.map((file) => ({ path: `cases/nix-derivation-identity/${file.file}`, hash: file.identity })),
    ...artifact.source.captureFiles.map((file) => ({ path: `cases/nix-derivation-identity/${file.file}`, hash: file.identity })),
    ...artifact.source.rawDerivations.map((file) => ({ path: `cases/nix-derivation-identity/${file.file}`, hash: file.identity }))
  ];
  return buildModelPack({
    model: {
      id: "nix-derivations",
      name: "Nix Derivation Identity",
      version,
      description: "Pinned Nix 2.31.0 derivations, declared outputs, direct inputs, derived closure, and builder-environment projections.",
      status: "external-native-capture-case"
    },
    source: {
      id: `nix-${artifact.source.identity.slice("sha256:".length, "sha256:".length + 16)}`,
      files: sourceFiles,
      auditHash: hashCanonical(AUDIT_DOMAIN, audit)
    },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: {
        nixVersion: artifact.nix.version,
        platform: artifact.nix.platform,
        storeBackend: artifact.nix.storeBackend,
        sourceIdentity: artifact.source.identity,
        caseIdentity: artifact.caseIdentity,
        releaseIdentity,
        mappingVersion: NIX_DERIVATION_MAPPING_VERSION,
        derivationBuildersExecuted: false,
        fixedOutputMaterialization: artifact.nativeOutput.materialization,
        nativeOutputPath: artifact.nativeOutput.path,
        nativeOutputNarHash: artifact.nativeOutput.narHash,
        nonEndorsement: "Nix and NixOS do not endorse Onto2D or this interpretation."
      },
      evidenceClasses: {
        "native-nix-json-and-aterm": "Relation present in both Nix derivation JSON and the captured raw ATerm derivation.",
        "materialized-fixed-output": "Content-addressed store object added and inspected by Nix; derivation realization is not claimed.",
        unrealized: "A native output path is declared, but no output content was realized in this capture.",
        "deterministic-projection": "Relation or profile computed deterministically from verified native records."
      },
      identityRegimes: Object.fromEntries(artifact.regimes.map((regime) => [regime.id, regime.compares])),
      presentation: {
        profile: "nix-derivation-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: {
          catalogTitle: "Nix identity records",
          searchPlaceholder: "Search derivations and outputs",
          typeFilter: "Record kind",
          phaseFilter: "Capture phase",
          statusFilter: "Evidence status",
          parents: "Incoming native or derived relations",
          children: "Outgoing native or derived relations"
        },
        coordinates: [
          { field: "typeRole", label: "Kind" },
          { field: "scientificStatus", label: "Evidence" }
        ],
        boundary: {
          title: "Nix capture boundary",
          summary: "Native derivations and direct inputDrv relations remain separate from transitive closure and Onto2D identity regimes.",
          note: "Builders were not executed. Input-addressed content equality and Historical Load remain unresolved or undefined."
        }
      },
      audit
    })
  });
}
