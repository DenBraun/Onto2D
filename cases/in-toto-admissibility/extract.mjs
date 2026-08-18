import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { buildInTotoFixture } from "./generate-fixture.mjs";
import { artifactHash, fixtureKey, metadataIdentity, sha256, verifyMetadataSignature } from "./src/metadata.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(CASE_ROOT, "fixtures");
const OUTPUT = path.join(CASE_ROOT, "artifacts", "in-toto-admissibility.json");
const SOURCE_DOMAIN = "onto2d:in-toto-fixture-source:v1";
const CASE_DOMAIN = "onto2d:in-toto-admissibility-case:v1";
const SCENARIO_LABELS = Object.freeze({
  valid: "Valid declared execution",
  shortcut: "Same output through a missing build step",
  "material-break": "Broken product-to-material continuity",
  "unauthorized-actor": "Package link signed by an unauthorized actor",
  "command-deviation": "Expected output from a different command"
});
const COST_FIELDS = Object.freeze({
  "step-count": "steps",
  "distinct-actor-count": "actors",
  "attestation-count": "attestations",
  "material-transition-count": "transitions"
});

function fail(message) {
  throw new Error(`in-toto Admissibility extraction failed: ${message}`);
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

async function json(relative) {
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length > 128 * 1024) fail(`${relative} exceeds its byte limit`);
  return { value: JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)), bytes };
}

async function collectFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
    else fail(`unsupported fixture entry ${relative}`);
  }
  return result.sort();
}

function recordCheck(id, label, sourcePointer, status, detail, evidenceClass = "cryptographically-verified") {
  return { id, label, sourcePointer, status, detail, evidenceClass };
}

function linkIndex(records) {
  return new Map(records.map((record) => [record.signed.name, record]));
}

function expectedHash(record, collection, artifactPath) {
  return record?.signed?.[collection]?.[artifactPath]?.sha256 ?? null;
}

function verifyScenario(id, records, layoutBlock, trustedOwner, allKeys, targetHash, spec) {
  const layout = layoutBlock.signed;
  const byStep = linkIndex(records);
  const checks = [];
  const warnings = [];
  checks.push(recordCheck("layout-signature", "Trusted owner signed the layout", "root.layout.signatures[0]", verifyMetadataSignature(layoutBlock, trustedOwner.publicKey, trustedOwner.keyid) ? "pass" : "fail", "The frozen project-owner key verifies the exact layout bytes."));
  checks.push(recordCheck("layout-expiration", "Layout is fresh at the pinned evaluation time", "root.layout.signed.expires", Date.parse(spec.profile.evaluationTime) < Date.parse(layout.expires) ? "pass" : "fail", `${spec.profile.evaluationTime} is evaluated against ${layout.expires}.`, "direct-record"));

  for (const [stepIndex, step] of layout.steps.entries()) {
    const record = byStep.get(step.name);
    const pointer = `root.layout.signed.steps[${stepIndex}]`;
    checks.push(recordCheck(`${step.name}-required`, `${step.name} link is present`, pointer, record ? "pass" : "fail", record ? "One matching signed link record is present." : "No matching link record is present.", "direct-record"));
    if (!record) continue;
    const signature = record.signatures[0];
    const known = Object.values(allKeys).find((key) => key.keyid === signature.keyid);
    const integrity = Boolean(known && verifyMetadataSignature(record, known.publicKey, known.keyid));
    checks.push(recordCheck(`${step.name}-record-signature`, `${step.name} record signature is valid`, `${step.name}.link.signatures[0]`, integrity ? "pass" : "fail", integrity ? "The signature authenticates the exact link body." : "The link signature cannot be verified."));
    const authorized = integrity && step.pubkeys.includes(signature.keyid) && layout.keys[signature.keyid] && verifyMetadataSignature(record, layout.keys[signature.keyid], signature.keyid);
    checks.push(recordCheck(`${step.name}-authorized`, `${step.name} actor is authorized`, `${pointer}.pubkeys`, authorized ? "pass" : "fail", authorized ? "The signing key is authorized by the layout." : "The signing key is not an authorized functionary for this step."));
    checks.push(recordCheck(`${step.name}-threshold`, `${step.name} signature threshold is met`, `${pointer}.threshold`, authorized && step.threshold === 1 ? "pass" : "fail", authorized ? "One authorized signature satisfies threshold 1." : "Threshold 1 has no authorized valid signature."));
    if (!same(record.signed.command, step.expected_command)) warnings.push({
      id: `${step.name}-command-mismatch`,
      label: `${step.name} command differs from expected_command`,
      sourcePointer: `${pointer}.expected_command`,
      nativeEffect: "warning-only",
      detail: "in-toto v1.0 treats expected_command mismatch as an audit warning, not a verification failure."
    });
  }

  const build = byStep.get("build");
  const packaged = byStep.get("package");
  const sourcePath = spec.artifacts.sourcePath;
  const buildPath = spec.artifacts.buildPath;
  const finalPath = spec.artifacts.finalPath;
  const sourceDigest = artifactHash(Buffer.from(spec.artifacts.sourceUtf8, "utf8")).sha256;
  const buildMaterialPass = expectedHash(build, "materials", sourcePath) === sourceDigest && Object.keys(build?.signed?.materials ?? {}).length === 1;
  const buildProduct = expectedHash(build, "products", buildPath);
  const buildProductPass = buildProduct === targetHash && Object.keys(build?.signed?.products ?? {}).length === 1 && !(buildPath in (build?.signed?.materials ?? {}));
  checks.push(recordCheck("build-material-rules", "Build materials satisfy REQUIRE / ALLOW / DISALLOW", "root.layout.signed.steps[0].expected_materials", buildMaterialPass ? "pass" : "fail", buildMaterialPass ? "The exact source artifact is the only recorded build material." : "The required source is absent or an undeclared material is present.", "native-rule-evaluation"));
  checks.push(recordCheck("build-product-rules", "Build products satisfy REQUIRE / CREATE / DISALLOW", "root.layout.signed.steps[0].expected_products", buildProductPass ? "pass" : "fail", buildProductPass ? "The expected intermediate is created with the final content hash." : "The expected build product is absent, changed, or not a creation.", "native-rule-evaluation"));
  const packageMaterial = expectedHash(packaged, "materials", buildPath);
  const continuityPass = Boolean(buildProduct && packageMaterial && buildProduct === packageMaterial && Object.keys(packaged?.signed?.materials ?? {}).length === 1);
  const packageProduct = expectedHash(packaged, "products", finalPath);
  const packageProductPass = packageProduct === targetHash && Object.keys(packaged?.signed?.products ?? {}).length === 1 && !(finalPath in (packaged?.signed?.materials ?? {}));
  checks.push(recordCheck("package-material-match", "Package material MATCHes the build product", "root.layout.signed.steps[1].expected_materials", continuityPass ? "pass" : "fail", continuityPass ? "The native SHA-256 hash crosses the step boundary unchanged." : "The required intermediate is absent or does not match the build product.", "native-rule-evaluation"));
  checks.push(recordCheck("package-product-rules", "Package products satisfy REQUIRE / CREATE / DISALLOW", "root.layout.signed.steps[1].expected_products", packageProductPass ? "pass" : "fail", packageProductPass ? "The expected final artifact is the only package product." : "The final package product is absent, changed, or undeclared.", "native-rule-evaluation"));
  const inspectionPass = Boolean(packageProduct && packageProduct === targetHash);
  checks.push(recordCheck("final-inspection", "Final product MATCHes the package product", "root.layout.signed.inspect[0].expected_materials", inspectionPass ? "pass" : "fail", inspectionPass ? "The client-side target hash matches the signed package product." : "The target cannot be linked to the signed package product.", "native-rule-evaluation"));
  const nativeAccepted = checks.every((check) => check.status === "pass");
  const strictAccepted = nativeAccepted && warnings.length === 0;
  return {
    native: { status: nativeAccepted ? "accepted" : "rejected", checks, warnings },
    strictCommand: {
      profile: "onto2d-exact-command-profile-v1",
      status: strictAccepted ? "accepted" : "rejected",
      basis: nativeAccepted ? (warnings.length ? "native verification passed, but the declared Onto2D exact-command profile rejects the warning" : "native verification and exact commands pass") : "native verification already failed"
    }
  };
}

function routes() {
  return [
    { id: "direct-emit", label: "Directly emit final bytes", possible: true, admissible: false, actual: false, counterfactual: true, costs: { steps: 1, actors: 1, attestations: 1, transitions: 0 }, rejection: "required build and package links absent" },
    { id: "package-only", label: "Run only the package action", possible: true, admissible: false, actual: false, counterfactual: true, costs: { steps: 1, actors: 1, attestations: 1, transitions: 0 }, rejection: "required build link and material continuity absent" },
    { id: "build-package-single-actor", label: "Build and package under one unauthorized role", possible: true, admissible: false, actual: false, counterfactual: true, costs: { steps: 2, actors: 1, attestations: 2, transitions: 1 }, rejection: "functionary authorization fails" },
    { id: "declared-build-package", label: "Authorized build then authorized package", possible: true, admissible: true, actual: true, counterfactual: false, costs: { steps: 2, actors: 2, attestations: 2, transitions: 1 }, rejection: null }
  ];
}

export function calculateHistoricalLoad(routeInput, profile, costId) {
  const field = COST_FIELDS[costId];
  const definition = profile.costFunctions.find((cost) => cost.id === costId);
  if (!field || !definition) fail(`undeclared Historical Load cost ${costId}`);
  if (!same(routeInput.map((route) => route.id), profile.candidateRoutes)) fail("Historical Load candidate space differs from the frozen profile");
  const possible = routeInput.filter((route) => route.possible);
  const admissible = possible.filter((route) => route.admissible);
  if (!possible.length || !admissible.length) fail("Historical Load requires non-empty possible and admissible route sets");
  const freeOptimumCost = Math.min(...possible.map((route) => route.costs[field]));
  const admissibleOptimumCost = Math.min(...admissible.map((route) => route.costs[field]));
  return {
    costFunction: costId,
    unit: definition.unit,
    definition: definition.definition,
    freeOptimumCost,
    freeOptimumRoutes: possible.filter((route) => route.costs[field] === freeOptimumCost).map((route) => route.id),
    admissibleOptimumCost,
    admissibleOptimumRoutes: admissible.filter((route) => route.costs[field] === admissibleOptimumCost).map((route) => route.id),
    historicalLoad: admissibleOptimumCost - freeOptimumCost,
    equation: `${admissibleOptimumCost} - ${freeOptimumCost} = +${admissibleOptimumCost - freeOptimumCost}`
  };
}

export function verifyInTotoAdmissibilityCaseIdentity(input) {
  const artifact = structuredClone(input);
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "specification", "source", "layout", "artifacts", "executions", "experiments", "pathSpace", "historicalLoad", "evidenceBoundary", "caseIdentity"], "case artifact");
  if (artifact.format !== "onto2d-in-toto-admissibility-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "in-toto-admissibility-v1" || artifact.generatedBy !== "cases/in-toto-admissibility/extract.mjs") fail("case constants differ from the reviewed v1 contract");
  if (artifact.specification.version !== "1.0.0" || artifact.specification.commandMismatchSemantics !== "warning-only") fail("the pinned in-toto semantics were substituted");
  if (!same(artifact.executions.map((execution) => execution.id), ["valid", "shortcut", "material-break", "unauthorized-actor", "command-deviation"])) fail("execution inventory is incomplete or reordered");
  const statuses = Object.fromEntries(artifact.executions.map((execution) => [execution.id, [execution.verification.native.status, execution.verification.strictCommand.status]]));
  if (!same(statuses, { valid: ["accepted", "accepted"], shortcut: ["rejected", "rejected"], "material-break": ["rejected", "rejected"], "unauthorized-actor": ["rejected", "rejected"], "command-deviation": ["accepted", "rejected"] })) fail("native or strict-command verdict was substituted");
  if (new Set(artifact.executions.map((execution) => execution.finalArtifact.sha256)).size !== 1) fail("executions do not retain identical final bytes");
  if (artifact.pathSpace.routes.some((route) => route.counterfactual && route.actual)) fail("a counterfactual route was marked actual");
  if (!same(artifact.pathSpace.routes, routes())) fail("declared finite path space was substituted");
  for (const result of artifact.historicalLoad.results) {
    if (!same(result, calculateHistoricalLoad(artifact.pathSpace.routes, artifact.historicalLoad.profile, result.costFunction))) fail(`Historical Load was substituted for ${result.costFunction}`);
  }
  const { caseIdentity, ...basis } = artifact;
  if (hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildInTotoAdmissibilityCase() {
  const [specFile, profileFile, expectedFixture] = await Promise.all([json("fixture-spec.json"), json("analysis-profile.json"), buildInTotoFixture()]);
  const spec = specFile.value;
  const profile = profileFile.value;
  if (spec.format !== "onto2d-in-toto-fixture-spec" || spec.profile.specification !== "in-toto Specification v1.0.0" || profile.format !== "onto2d-in-toto-admissibility-analysis-profile") fail("fixture or analysis profile is unsupported");
  const actualFixtureFiles = await collectFiles(FIXTURE_ROOT);
  if (!same(actualFixtureFiles, Object.keys(expectedFixture.files).sort())) fail("fixture contains missing or unexpected files");
  const fixtureFiles = [];
  for (const relative of actualFixtureFiles) {
    const bytes = await readFile(path.join(FIXTURE_ROOT, relative));
    if (!bytes.equals(Buffer.from(expectedFixture.files[relative], "utf8"))) fail(`${relative} differs from deterministic source`);
    fixtureFiles.push({ path: `fixtures/${relative}`, identity: `sha256:${sha256(bytes)}`, bytes: bytes.length });
  }
  const layoutBlock = JSON.parse(await readFile(path.join(FIXTURE_ROOT, "root.layout"), "utf8"));
  const trustedOwner = expectedFixture.keys.owner;
  if (!verifyMetadataSignature(layoutBlock, trustedOwner.publicKey, trustedOwner.keyid)) fail("trusted project-owner signature is invalid");
  const targetBytes = await readFile(path.join(FIXTURE_ROOT, "target", spec.artifacts.finalPath));
  const targetHash = artifactHash(targetBytes).sha256;
  const executions = [];
  for (const id of spec.scenarioOrder) {
    const directory = path.join(FIXTURE_ROOT, "scenarios", id);
    const filenames = (await readdir(directory)).sort();
    const records = await Promise.all(filenames.map(async (filename) => JSON.parse(await readFile(path.join(directory, filename), "utf8"))));
    executions.push({
      id,
      label: SCENARIO_LABELS[id],
      evidenceClass: "signed-native-link-set",
      actual: true,
      finalArtifact: { path: spec.artifacts.finalPath, sha256: targetHash, bytes: targetBytes.length },
      links: records.map((record, index) => ({ filename: filenames[index], identity: metadataIdentity(record), signerKeyId: record.signatures[0].keyid, record })),
      verification: verifyScenario(id, records, layoutBlock, trustedOwner, expectedFixture.keys, targetHash, spec)
    });
  }
  const executionIndex = new Map(executions.map((execution) => [execution.id, execution]));
  const pathRecords = routes();
  const artifact = {
    format: "onto2d-in-toto-admissibility-case",
    formatVersion: "1",
    caseVersion: spec.caseVersion,
    generatedBy: "cases/in-toto-admissibility/extract.mjs",
    specification: {
      name: "in-toto Specification",
      version: "1.0.0",
      source: spec.profile.specificationUrl,
      metadataProfile: "layout-and-link-json-metablocks-ed25519",
      commandMismatchSemantics: "warning-only"
    },
    source: {
      profile: spec.profile,
      authoredFiles: [
        { path: "fixture-spec.json", identity: `sha256:${sha256(specFile.bytes)}`, bytes: specFile.bytes.length },
        { path: "analysis-profile.json", identity: `sha256:${sha256(profileFile.bytes)}`, bytes: profileFile.bytes.length }
      ],
      fixtureFiles,
      identity: hashCanonical(SOURCE_DOMAIN, { authored: [`sha256:${sha256(specFile.bytes)}`, `sha256:${sha256(profileFile.bytes)}`], fixtureFiles })
    },
    layout: {
      identity: metadataIdentity(layoutBlock),
      ownerKeyId: trustedOwner.keyid,
      expires: layoutBlock.signed.expires,
      keys: layoutBlock.signed.keys,
      steps: layoutBlock.signed.steps,
      inspections: layoutBlock.signed.inspect
    },
    artifacts: {
      source: { path: spec.artifacts.sourcePath, sha256: artifactHash(Buffer.from(spec.artifacts.sourceUtf8, "utf8")).sha256, bytes: Buffer.byteLength(spec.artifacts.sourceUtf8) },
      final: { path: spec.artifacts.finalPath, sha256: targetHash, bytes: targetBytes.length, utf8: targetBytes.toString("utf8") }
    },
    executions,
    experiments: [
      { id: "same-output-wrong-history", left: "valid", right: "shortcut", finalBytesEqual: executionIndex.get("valid").finalArtifact.sha256 === executionIndex.get("shortcut").finalArtifact.sha256, nativeAdmissibilityEqual: false, result: "same final artifact; different native provenance admissibility" },
      { id: "material-continuity", execution: "material-break", failedCheck: "package-material-match", result: "rejected" },
      { id: "actor-authorization", execution: "unauthorized-actor", failedCheck: "package-authorized", commandMatches: true, result: "rejected" },
      { id: "command-semantics", execution: "command-deviation", nativeResult: "accepted-with-warning", strictOnto2dResult: "rejected", result: "native and optional strict policies remain distinct" }
    ],
    pathSpace: { status: "finite-declared-space", routes: pathRecords },
    historicalLoad: {
      status: "resolved-in-declared-space",
      definition: "Shortest admissible route cost minus shortest technically possible route cost for one exact target artifact.",
      profile,
      results: profile.costFunctions.map((cost) => calculateHistoricalLoad(pathRecords, profile, cost.id)),
      nonClaim: "Historical Load is an Onto2D result for this frozen path space, not an in-toto metric or a universal supply-chain score."
    },
    evidenceBoundary: {
      native: ["signed layout", "signed link records", "artifact hashes", "functionary authorization", "artifact rules", "verification warnings"],
      derived: ["scenario comparison", "finite path classification", "Historical Load"],
      counterfactual: pathRecords.filter((route) => route.counterfactual).map((route) => route.id),
      unknown: ["real-world actor intent", "host trust outside signed records", "security quality of the owner-authored layout"],
      exclusions: ["general in-toto verifier compatibility", "network retrieval", "clock-dependent verification", "claim that expected_command is a native rejection rule"]
    },
    caseIdentity: null
  };
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_DOMAIN, basis);
  return verifyInTotoAdmissibilityCaseIdentity(artifact);
}

export async function run({ verify = false } = {}) {
  const artifact = await buildInTotoAdmissibilityCase();
  if (!verify) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  assert.equal(await readFile(OUTPUT, "utf8"), serialize(artifact), "Committed in-toto case artifact differs from deterministic extraction.");
  console.log(`${verify ? "Verified" : "Extracted"} in-toto Admissibility ${artifact.caseVersion}: ${artifact.executions.length} signed executions, ${artifact.caseIdentity}`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
