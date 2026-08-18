import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyInTotoAdmissibilityCaseIdentity } from "../../cases/in-toto-admissibility/extract.mjs";

export const IN_TOTO_MAPPING_VERSION = "in-toto-provenance-mapping-v2";
const RELEASE_DOMAIN = "onto2d:in-toto-model-release:v1";
const AUDIT_DOMAIN = "onto2d:in-toto-model-audit:v1";
const EDGE_DOMAIN = "onto2d:in-toto-model-edge:v1";

function fail(message) {
  throw new TypeError(`in-toto-provenance Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`;
}

function artifactNodeId(artifactPath, sha256) {
  return `artifact:${sha256}:${hashCanonical("onto2d:in-toto-artifact-path:v1", artifactPath).slice(7, 19)}`;
}

function roleForKey(artifact, keyid) {
  if (keyid === artifact.layout.ownerKeyId) return "project owner";
  const steps = artifact.layout.steps.filter((step) => step.pubkeys.includes(keyid)).map((step) => step.name);
  return steps.length ? `${steps.join(" and ")} functionary` : "unauthorized fixture actor";
}

export function compileInTotoProvenanceModelPack(input) {
  let artifact;
  try {
    artifact = verifyInTotoAdmissibilityCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }

  const actorIds = [...new Set([
    artifact.layout.ownerKeyId,
    ...Object.keys(artifact.layout.keys),
    ...artifact.executions.flatMap((execution) => execution.links.map((link) => link.signerKeyId))
  ])];
  const actorNodes = actorIds.map((keyid) => ({
    id: `actor:${keyid}`,
    name: roleForKey(artifact, keyid),
    description: `Fixture-only Ed25519 identity ${keyid}; role is determined from the signed layout, not inferred from behavior.`,
    shortDescription: `${keyid.slice(0, 16)}…`,
    entityKind: "authorized-identity",
    typeRole: "actor",
    phase: "native-metadata",
    scientificStatus: artifact.layout.keys[keyid] || keyid === artifact.layout.ownerKeyId ? "cryptographically-verified" : "attested-unauthorized",
    nativeKeyId: keyid,
    authorizedRole: roleForKey(artifact, keyid)
  }));

  const layoutNode = {
    id: `layout:${artifact.layout.identity}`,
    name: "Signed root layout",
    description: "The project-owner-signed in-toto v1.0 layout that declares functionaries, required steps, artifact rules, and one client inspection.",
    shortDescription: `2 steps; 1 inspection; expires ${artifact.layout.expires}.`,
    entityKind: "in-toto-layout",
    typeRole: "layout",
    phase: "declared-policy",
    scientificStatus: "cryptographically-verified",
    nativeIdentity: artifact.layout.identity,
    expires: artifact.layout.expires
  };
  const stepNodes = artifact.layout.steps.map((step, index) => ({
    id: `step:${step.name}`,
    name: `${step.name} step`,
    description: "Native step definition preserved from the signed layout.",
    shortDescription: `threshold ${step.threshold}; ${step.pubkeys.length} authorized key(s).`,
    entityKind: "in-toto-step-definition",
    typeRole: "step-definition",
    phase: "declared-policy",
    scientificStatus: "cryptographically-verified",
    nativePointer: `root.layout.signed.steps[${index}]`,
    expectedCommand: step.expected_command,
    threshold: step.threshold
  }));
  const inspectionNodes = artifact.layout.inspections.map((inspection, index) => ({
    id: `inspection:${inspection.name}`,
    name: `${inspection.name} inspection`,
    description: "Native client inspection definition preserved separately from functionary execution links.",
    shortDescription: inspection.run.join(" "),
    entityKind: "in-toto-inspection-definition",
    typeRole: "inspection",
    phase: "declared-policy",
    scientificStatus: "cryptographically-verified",
    nativePointer: `root.layout.signed.inspect[${index}]`,
    run: inspection.run
  }));
  const ruleNodes = [];
  for (const [stepIndex, step] of artifact.layout.steps.entries()) {
    for (const field of ["expected_materials", "expected_products"]) {
      for (const [ruleIndex, rule] of step[field].entries()) ruleNodes.push({
        id: `rule:step:${step.name}:${field}:${ruleIndex}`,
        name: `${step.name} / ${rule.join(" ")}`,
        description: "Native in-toto artifact rule retained with an exact source pointer for mapped constraint audit.",
        shortDescription: rule.join(" "),
        entityKind: "in-toto-artifact-rule",
        typeRole: "rule",
        phase: "declared-policy",
        scientificStatus: "cryptographically-verified",
        ownerId: `step:${step.name}`,
        nativePointer: `root.layout.signed.steps[${stepIndex}].${field}[${ruleIndex}]`,
        nativeRule: rule
      });
    }
  }
  for (const [inspectionIndex, inspection] of artifact.layout.inspections.entries()) {
    for (const field of ["expected_materials", "expected_products"]) {
      for (const [ruleIndex, rule] of inspection[field].entries()) ruleNodes.push({
        id: `rule:inspection:${inspection.name}:${field}:${ruleIndex}`,
        name: `${inspection.name} / ${rule.join(" ")}`,
        description: "Native in-toto inspection rule retained with an exact source pointer.",
        shortDescription: rule.join(" "),
        entityKind: "in-toto-artifact-rule",
        typeRole: "rule",
        phase: "declared-policy",
        scientificStatus: "cryptographically-verified",
        ownerId: `inspection:${inspection.name}`,
        nativePointer: `root.layout.signed.inspect[${inspectionIndex}].${field}[${ruleIndex}]`,
        nativeRule: rule
      });
    }
  }
  const strictRuleNode = {
    id: "constraint:onto2d-exact-command-profile-v1",
    name: "Onto2D exact-command constraint",
    description: "Optional derived policy that turns a native expected_command warning into a rejection; explicitly not a native in-toto v1.0 artifact rule.",
    shortDescription: "Optional exact command equality.",
    entityKind: "onto2d-mapped-constraint",
    typeRole: "rule",
    phase: "derived-policy",
    scientificStatus: "declared-derived",
    sourceSemantics: "in-toto warning-only",
    profile: "onto2d-exact-command-profile-v1"
  };

  const artifactRecords = new Map();
  const rememberArtifact = (artifactPath, digest) => {
    const key = `${artifactPath}\0${digest}`;
    if (!artifactRecords.has(key)) artifactRecords.set(key, { path: artifactPath, sha256: digest });
  };
  rememberArtifact(artifact.artifacts.source.path, artifact.artifacts.source.sha256);
  rememberArtifact(artifact.artifacts.final.path, artifact.artifacts.final.sha256);
  for (const execution of artifact.executions) {
    for (const link of execution.links) {
      for (const collection of [link.record.signed.materials, link.record.signed.products]) {
        for (const [artifactPath, hashes] of Object.entries(collection)) rememberArtifact(artifactPath, hashes.sha256);
      }
    }
  }
  const artifactNodes = [...artifactRecords.values()].map((record) => {
    const knownBytes = record.sha256 === artifact.artifacts.source.sha256
      ? artifact.artifacts.source.bytes
      : record.sha256 === artifact.artifacts.final.sha256
        ? artifact.artifacts.final.bytes
        : null;
    const typeRole = record.path === artifact.artifacts.source.path ? "material" : record.path === artifact.artifacts.final.path ? "final-product" : "product-material";
    return {
    id: artifactNodeId(record.path, record.sha256),
    name: record.path,
    description: `Path-scoped fixture artifact record with native SHA-256 ${record.sha256}.`,
    shortDescription: `${knownBytes === null ? "size not captured" : `${knownBytes} bytes`}; ${record.sha256.slice(0, 16)}...`,
    entityKind: "supply-chain-artifact",
    typeRole,
    phase: "actual-execution",
    scientificStatus: knownBytes === null ? "attested" : "cryptographically-verified",
    artifactPath: record.path,
    sha256: record.sha256,
    bytes: knownBytes
  };
  });

  const executionNodes = artifact.executions.map((execution) => ({
    id: `execution:${execution.id}`,
    name: execution.label,
    description: "A frozen actual fixture execution represented by its signed native in-toto link set; it is not a counterfactual route.",
    shortDescription: `${execution.links.length} link(s); native ${execution.verification.native.status}.`,
    entityKind: "actual-execution",
    typeRole: "execution",
    phase: "actual-execution",
    scientificStatus: "attested",
    scenarioId: execution.id,
    nativeStatus: execution.verification.native.status,
    strictCommandStatus: execution.verification.strictCommand.status,
    finalSha256: execution.finalArtifact.sha256,
    actual: true
  }));
  const linkMap = new Map();
  for (const execution of artifact.executions) {
    for (const link of execution.links) if (!linkMap.has(link.identity)) linkMap.set(link.identity, link);
  }
  const linkNodes = [...linkMap.values()].map((link) => ({
    id: `link:${link.identity}`,
    name: `${link.record.signed.name} link / ${link.signerKeyId.slice(0, 12)}`,
    description: "Ed25519-signed native in-toto link record preserving command, materials, products, byproducts, and environment.",
    shortDescription: link.record.signed.command.join(" "),
    entityKind: "in-toto-link-record",
    typeRole: "link-record",
    phase: "actual-execution",
    scientificStatus: "cryptographically-verified",
    nativeIdentity: link.identity,
    signerKeyId: link.signerKeyId,
    stepName: link.record.signed.name,
    command: link.record.signed.command,
    materials: link.record.signed.materials,
    products: link.record.signed.products
  }));
  const verificationNodes = artifact.executions.flatMap((execution) => [
    {
      id: `verification:native:${execution.id}`,
      name: `${execution.id} / native ${execution.verification.native.status}`,
      description: "Deterministic bounded verification against native in-toto v1.0 layout, signature, threshold, and artifact-rule semantics.",
      shortDescription: `${execution.verification.native.checks.filter((check) => check.status === "pass").length}/${execution.verification.native.checks.length} checks pass.`,
      entityKind: "verification-record",
      typeRole: "native-verification",
      phase: "verification",
      scientificStatus: "deterministically-derived",
      scenarioId: execution.id,
      verdict: execution.verification.native.status,
      checks: execution.verification.native.checks,
      warnings: execution.verification.native.warnings
    },
    {
      id: `verification:strict-command:${execution.id}`,
      name: `${execution.id} / strict command ${execution.verification.strictCommand.status}`,
      description: "Optional Onto2D policy verdict, kept distinct from the native in-toto result.",
      shortDescription: execution.verification.strictCommand.status,
      entityKind: "verification-record",
      typeRole: "derived-verification",
      phase: "verification",
      scientificStatus: "declared-derived",
      scenarioId: execution.id,
      verdict: execution.verification.strictCommand.status,
      profile: execution.verification.strictCommand.profile
    }
  ]);
  const routeNodes = artifact.pathSpace.routes.map((route) => ({
    ...route,
    id: `route:${route.id}`,
    name: route.label,
    description: route.actual ? "The declared finite-space baseline corresponding to the valid actual fixture." : "A declared counterfactual route used only for bounded admissibility and cost comparison.",
    shortDescription: `${route.costs.steps} step(s); ${route.admissible ? "admissible" : "inadmissible"}.`,
    entityKind: "declared-route",
    typeRole: "route",
    phase: route.counterfactual ? "counterfactual-space" : "actual-baseline",
    scientificStatus: route.counterfactual ? "counterfactual" : "attested-mapped-baseline",
    routeId: route.id
  }));

  const nodes = [layoutNode, ...actorNodes, ...stepNodes, ...inspectionNodes, ...ruleNodes, strictRuleNode, ...artifactNodes, ...executionNodes, ...linkNodes, ...verificationNodes, ...routeNodes];
  const edges = [];
  edges.push({ id: edgeId("signed-by", layoutNode.id, `actor:${artifact.layout.ownerKeyId}`), source: layoutNode.id, target: `actor:${artifact.layout.ownerKeyId}`, relation: "signed-by", relationLayer: "native", evidenceClass: "valid-ed25519-signature", evidenceStatus: "verified" });
  for (const step of artifact.layout.steps) {
    edges.push({ id: edgeId("declares-step", layoutNode.id, `step:${step.name}`), source: layoutNode.id, target: `step:${step.name}`, relation: "declares-step", relationLayer: "native", evidenceClass: "signed-layout", evidenceStatus: "captured" });
    for (const keyid of step.pubkeys) edges.push({ id: edgeId("authorizes", `step:${step.name}`, `actor:${keyid}`), source: `step:${step.name}`, target: `actor:${keyid}`, relation: "authorizes", relationLayer: "native", evidenceClass: "signed-layout", evidenceStatus: "captured" });
  }
  for (const inspection of artifact.layout.inspections) edges.push({ id: edgeId("declares-inspection", layoutNode.id, `inspection:${inspection.name}`), source: layoutNode.id, target: `inspection:${inspection.name}`, relation: "declares-inspection", relationLayer: "native", evidenceClass: "signed-layout", evidenceStatus: "captured" });
  for (const rule of ruleNodes) edges.push({ id: edgeId("governed-by", rule.ownerId, rule.id), source: rule.ownerId, target: rule.id, relation: "governed-by", relationLayer: "native", evidenceClass: "signed-layout", evidenceStatus: "captured", nativePointer: rule.nativePointer });
  for (const execution of artifact.executions) {
    const executionId = `execution:${execution.id}`;
    const finalNodeId = artifactNodeId(artifact.artifacts.final.path, execution.finalArtifact.sha256);
    edges.push({ id: edgeId("produces-final", executionId, finalNodeId), source: executionId, target: finalNodeId, relation: "produces-final", relationLayer: "actual", evidenceClass: "exact-target-bytes", evidenceStatus: "verified" });
    edges.push({ id: edgeId("has-native-verdict", executionId, `verification:native:${execution.id}`), source: executionId, target: `verification:native:${execution.id}`, relation: "has-native-verdict", relationLayer: "derived", evidenceClass: "bounded-native-rule-evaluation", evidenceStatus: "derived" });
    edges.push({ id: edgeId("has-strict-verdict", executionId, `verification:strict-command:${execution.id}`), source: executionId, target: `verification:strict-command:${execution.id}`, relation: "has-strict-verdict", relationLayer: "derived", evidenceClass: "onto2d-policy-evaluation", evidenceStatus: "derived" });
    edges.push({ id: edgeId("applies-constraint", `verification:strict-command:${execution.id}`, strictRuleNode.id), source: `verification:strict-command:${execution.id}`, target: strictRuleNode.id, relation: "applies-constraint", relationLayer: "derived", evidenceClass: "declared-mapping", evidenceStatus: "derived" });
    for (const link of execution.links) {
      const linkId = `link:${link.identity}`;
      edges.push({ id: edgeId("includes-link", executionId, linkId), source: executionId, target: linkId, relation: "includes-link", relationLayer: "actual", evidenceClass: "fixture-file", evidenceStatus: "captured" });
      edges.push({ id: edgeId("records-step", linkId, `step:${link.record.signed.name}`, execution.id), source: linkId, target: `step:${link.record.signed.name}`, relation: "records-step", relationLayer: "native", evidenceClass: "native-link-name", evidenceStatus: "captured", scenarioId: execution.id });
      edges.push({ id: edgeId("signed-by", linkId, `actor:${link.signerKeyId}`, execution.id), source: linkId, target: `actor:${link.signerKeyId}`, relation: "signed-by", relationLayer: "native", evidenceClass: "valid-ed25519-signature", evidenceStatus: "verified", scenarioId: execution.id });
      for (const [artifactPath, hashes] of Object.entries(link.record.signed.materials)) {
        const target = artifactNodeId(artifactPath, hashes.sha256);
        edges.push({ id: edgeId("consumes", linkId, target, `${execution.id}:${artifactPath}`), source: linkId, target, relation: "consumes", relationLayer: "native", evidenceClass: "signed-link", evidenceStatus: "attested", scenarioId: execution.id, artifactPath, sha256: hashes.sha256 });
      }
      for (const [artifactPath, hashes] of Object.entries(link.record.signed.products)) {
        const target = artifactNodeId(artifactPath, hashes.sha256);
        edges.push({ id: edgeId("produces", linkId, target, `${execution.id}:${artifactPath}`), source: linkId, target, relation: "produces", relationLayer: "native", evidenceClass: "signed-link", evidenceStatus: "attested", scenarioId: execution.id, artifactPath, sha256: hashes.sha256 });
      }
    }
  }
  edges.push({ id: edgeId("maps-actual-route", "execution:valid", "route:declared-build-package"), source: "execution:valid", target: "route:declared-build-package", relation: "maps-actual-route", relationLayer: "derived", evidenceClass: "declared-analysis-profile", evidenceStatus: "derived" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has unresolved endpoint ${!nodeIds.has(edge.source) ? edge.source : edge.target}`);
  }

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: IN_TOTO_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: IN_TOTO_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    nativeInventory: { layouts: 1, steps: stepNodes.length, inspections: inspectionNodes.length, rules: ruleNodes.length, uniqueLinks: linkNodes.length, actors: actorNodes.length },
    analysisInventory: { executions: executionNodes.length, verificationRecords: verificationNodes.length, routes: routeNodes.length },
    historicalLoad: artifact.historicalLoad.results.map((result) => ({ costFunction: result.costFunction, value: result.historicalLoad, unit: result.unit }))
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.fixtureFiles].map((file) => ({ path: `cases/in-toto-admissibility/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "in-toto-provenance", name: "in-toto Admissibility", version, description: "Signed in-toto layout and link evidence, native verification results, optional command policy, bounded counterfactual routes, and cost-relative Historical Load.", status: "external-deterministic-fixture-case" },
    source: { id: `in-toto-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { specification: artifact.specification, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: IN_TOTO_MAPPING_VERSION, nativeCommandSemantics: "warning-only", nonEndorsement: "The in-toto project does not endorse Onto2D or this bounded interpretation." },
      evidenceClasses: { "signed-layout": "Rule or authorization recorded in the trusted-owner-signed layout.", "signed-link": "Materials or products attested in a functionary-signed native link.", "valid-ed25519-signature": "Ed25519 verification succeeds over the exact canonicalized metadata body.", "bounded-native-rule-evaluation": "Deterministic result of the documented v1 evaluator subset.", "declared-analysis-profile": "Onto2D-declared route or cost profile, not native in-toto evidence." },
      presentation: {
        profile: "in-toto-provenance-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Supply-chain records", searchPlaceholder: "Search layouts, links, actors, rules, and verdicts", typeFilter: "Record kind", phaseFilter: "Evidence phase", statusFilter: "Evidence status", parents: "Incoming provenance relations", children: "Outgoing provenance relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }],
        boundary: { title: "in-toto evidence boundary", summary: "Signed native layout and links remain separate from deterministic verdicts, optional Onto2D policy, counterfactual routes, and Historical Load.", note: "Command mismatch is warning-only under the pinned native specification; Historical Load is resolved only in the four-route declared space." }
      },
      audit
    })
  });
}
