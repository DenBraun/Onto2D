import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "chemical-synthesis-history.json");
const CASE_DOMAIN = "onto2d:chemical-synthesis-history-case:v1";
const SOURCE_DOMAIN = "onto2d:chemical-synthesis-history-source:v1";
const ROUTE_DOMAIN = "onto2d:chemical-route-fragment:v1";
const HASH = /^sha256:[0-9a-f]{64}$/;
const REACTION_ID = /^ord-[0-9a-f]{32}$/;
const DATASET_ID = /^ord_dataset-[0-9a-f]{32}$/;
const ORD_SCHEMA_LOCK = Object.freeze({
  repository: "https://github.com/open-reaction-database/ord-schema",
  tag: "v0.3.10",
  evidence: ".github/workflows/validation.yml",
  evidenceSha256: "031b28e311047c74f0c5965d5c076510b912a6e317e4b953c7e0ccb151c8f75b"
});

const FILES = Object.freeze({
  upstream: "upstream.json",
  identity: "identity-profile.json",
  analysis: "analysis-profile.json",
  conditionSweep: "fixtures/ahneman-condition-sweep.json",
  cascade: "fixtures/islatravir-cascade.json"
});

function fail(message) {
  throw new Error(`Chemical Synthesis History extraction failed: ${message}`);
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function json(relative) {
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length > 256 * 1024) fail(`${relative} exceeds its 256 KiB case-input limit`);
  const text = new TextDecoder("utf8", { fatal: true }).decode(bytes);
  return { value: JSON.parse(text), bytes };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isRecord(value) || !same(Object.keys(value).sort(), [...expected].sort())) fail(`${label} fields differ`);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function requireOptionalMeasurement(value, label) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be finite or null`);
  return value;
}

export function preserveOptionalMeasurement(value, label = "measurement") {
  return requireOptionalMeasurement(value, label);
}

function validateCompound(compound, label) {
  if (!isRecord(compound)) fail(`${label} must be an object`);
  if (compound.name !== null) requireString(compound.name, `${label}.name`);
  requireString(compound.smiles, `${label}.smiles`);
  requireString(compound.nativeRole, `${label}.nativeRole`);
}

function routeIdentity(route, productSmiles, identityProfile) {
  const fields = {
    reactionId: route.reactionId,
    productSmiles,
    arylHalideSmiles: route.inputs.arylHalide.smiles,
    amineSmiles: route.inputs.amine.smiles,
    catalystSmiles: route.inputs.catalyst.smiles,
    baseSmiles: route.inputs.base.smiles,
    additiveSmiles: route.inputs.additive.smiles,
    temperature: route.conditions.temperature,
    reactionTime: route.conditions.reactionTime,
    workupTypes: route.workups
  };
  if (!same(Object.keys(fields), identityProfile.routeIdentity.fields)) fail("route identity fields differ from the declared profile");
  return hashCanonical(ROUTE_DOMAIN, fields);
}

function validateConditionSweep(input, identityProfile) {
  if (input.format !== "onto2d-ord-native-field-projection" || input.projectionVersion !== "ahneman-extrema-v1") fail("Ahneman projection version is unsupported");
  if (!DATASET_ID.test(input.datasetId) || input.selection.sourceReactionCount !== 4312) fail("Ahneman dataset identity or count differs from the source lock");
  if (!Array.isArray(input.targets) || input.targets.length !== 5 || input.selection.selectedRecordCount !== 10) fail("Ahneman selection must contain five target pairs");
  const orderedProducts = input.targets.map((target) => target.productIdentifier.value);
  if (!same(orderedProducts, [...orderedProducts].sort())) fail("Ahneman targets are not in declared source-SMILES order");
  if (new Set(orderedProducts).size !== orderedProducts.length) fail("Ahneman target identifiers repeat");
  if (input.targets.reduce((sum, target) => sum + target.sourceCohortSize, 0) !== input.selection.sourceReactionCount) fail("Ahneman cohort sizes do not cover the source dataset");

  const reactionIds = new Set();
  return {
    ...input,
    targets: input.targets.map((target) => {
      if (target.productIdentifier.type !== "SMILES" || !target.productIdentifier.value) fail(`${target.id} lacks an exact product SMILES`);
      if (!Array.isArray(target.routes) || target.routes.length !== 2) fail(`${target.id} must contain one minimum and one maximum route fragment`);
      if (!same(target.routes.map((route) => route.selectionReason), ["minimum-recorded-yield", "maximum-recorded-yield"])) fail(`${target.id} extrema are reordered`);
      const routes = target.routes.map((route) => {
        if (!REACTION_ID.test(route.reactionId) || reactionIds.has(route.reactionId)) fail(`${target.id} has an invalid or repeated reaction_id`);
        reactionIds.add(route.reactionId);
        if (!HASH.test(route.nativeRecordSha256)) fail(`${route.reactionId} has an invalid deterministic protobuf hash`);
        for (const [key, compound] of Object.entries(route.inputs)) validateCompound(compound, `${route.reactionId}.inputs.${key}`);
        if (!Array.isArray(route.workups)) fail(`${route.reactionId}.workups must be an array`);
        if (route.outcome.productSmiles !== target.productIdentifier.value) fail(`${route.reactionId} product does not match its exact target identifier`);
        const yieldValue = requireOptionalMeasurement(route.outcome.yield?.value ?? null, `${route.reactionId}.yield`);
        if (yieldValue === null || yieldValue < 0 || yieldValue > 105) fail(`${route.reactionId} selected yield is outside ORD bounds`);
        if (route.provenance.doi !== "10.1126/science.aar5169") fail(`${route.reactionId} provenance DOI was substituted`);
        return { ...route, routeIdentity: routeIdentity(route, target.productIdentifier.value, identityProfile) };
      });
      if (routes[0].outcome.yield.value > routes[1].outcome.yield.value) fail(`${target.id} minimum yield exceeds maximum yield`);
      return { ...target, routes };
    })
  };
}

function validateCascade(input) {
  if (input.format !== "onto2d-ord-native-field-projection" || input.projectionVersion !== "islatravir-cross-reference-v1") fail("islatravir projection version is unsupported");
  if (!DATASET_ID.test(input.datasetId) || !Array.isArray(input.records) || input.records.length !== 3) fail("islatravir projection must contain three native records");
  const expectedIds = [
    "ord-9b830b3dea9b4c68b349f901df69e119",
    "ord-7c920412f21b4b8195d3bf450f022cbd",
    "ord-80ea7d29d01a42beae0627f615b2f314"
  ];
  if (!same(input.records.map((record) => record.reactionId), expectedIds)) fail("islatravir native record order differs from the reviewed chain");
  if (!same(input.records.map((record) => record.ordinal), [0, 1, 2])) fail("islatravir ordinals are invalid");
  if (!same(input.records[0].crossReferencedReactionIds, [])) fail("cascade origin must not synthesize an upstream cross-reference");
  if (!same(input.records[1].crossReferencedReactionIds, [expectedIds[0], expectedIds[0]])) fail("the duplicated native first-step cross-reference was not preserved");
  if (!same(input.records[2].crossReferencedReactionIds, [expectedIds[1]])) fail("final islatravir record must cross-reference the second record");
  for (const record of input.records) {
    if (!HASH.test(record.nativeRecordSha256)) fail(`${record.reactionId} native hash is invalid`);
    if (!Array.isArray(record.outcomes) || !record.outcomes.length) fail(`${record.reactionId} has no preserved outcomes`);
    for (const [index, outcome] of record.outcomes.entries()) {
      for (const key of ["conversionPercentage", "yieldPercentage", "selectivityPercentage"]) requireOptionalMeasurement(outcome[key], `${record.reactionId}.outcomes[${index}].${key}`);
    }
    if (record.provenance.doi !== "10.1126/science.aay8484") fail(`${record.reactionId} provenance DOI was substituted`);
  }
  if (input.records.at(-1).desiredProduct.name !== "islatravir") fail("cascade target was substituted");
  return input;
}

function declaredRoutes() {
  return [
    { id: "direct-unrecorded-shortcut", label: "Direct shortcut to islatravir", actual: false, counterfactual: true, candidate: true, admissible: false, costs: { reactionRecords: 1, recordedIntermediates: 0 }, rejection: "no ORD reaction record or native material-continuity chain supports the shortcut" },
    { id: "two-record-shortcut", label: "One intermediate, then target", actual: false, counterfactual: true, candidate: true, admissible: false, costs: { reactionRecords: 2, recordedIntermediates: 1 }, rejection: "one construction transition lacks an exact ORD record and cross-reference" },
    { id: "three-records-without-continuity", label: "Three records without material continuity", actual: false, counterfactual: true, candidate: true, admissible: false, costs: { reactionRecords: 3, recordedIntermediates: 2 }, rejection: "record count alone cannot replace native reaction_id continuity" },
    { id: "ord-cross-referenced-cascade", label: "Pinned ORD cross-referenced cascade", actual: true, counterfactual: false, candidate: true, admissible: true, costs: { reactionRecords: 3, recordedIntermediates: 2 }, rejection: null }
  ];
}

export function calculateChemicalHistoricalLoad(routeInput, profile, costId) {
  const definition = profile.costFunctions.find((cost) => cost.id === costId);
  if (!definition) fail(`undeclared Historical Load cost ${costId}`);
  if (!same(routeInput.map((route) => route.id), profile.candidateRoutes)) fail("Historical Load route space differs from the frozen profile");
  const candidates = routeInput.filter((route) => route.candidate);
  const admissible = candidates.filter((route) => route.admissible);
  if (!candidates.length || !admissible.length) fail("Historical Load needs non-empty candidate and admissible sets");
  const freeOptimumCost = Math.min(...candidates.map((route) => route.costs[definition.field]));
  const admissibleOptimumCost = Math.min(...admissible.map((route) => route.costs[definition.field]));
  const historicalLoad = admissibleOptimumCost - freeOptimumCost;
  return {
    costFunction: costId,
    unit: definition.unit,
    definition: definition.definition,
    freeOptimumCost,
    freeOptimumRoutes: candidates.filter((route) => route.costs[definition.field] === freeOptimumCost).map((route) => route.id),
    admissibleOptimumCost,
    admissibleOptimumRoutes: admissible.filter((route) => route.costs[definition.field] === admissibleOptimumCost).map((route) => route.id),
    historicalLoad,
    equation: `${admissibleOptimumCost} - ${freeOptimumCost} = +${historicalLoad}`
  };
}

function buildExperiments(conditionSweep, cascade) {
  return [
    ...conditionSweep.targets.map((target) => {
      const [minimum, maximum] = target.routes;
      return {
        id: `same-target-different-route:${target.id}`,
        targetId: target.id,
        leftRouteId: minimum.id,
        rightRouteId: maximum.id,
        exactProductIdentifierEqual: minimum.outcome.productSmiles === maximum.outcome.productSmiles,
        nativeRecordIdentityEqual: minimum.reactionId === maximum.reactionId,
        routeIdentityEqual: minimum.routeIdentity === maximum.routeIdentity,
        arylHalideIdentifierEqual: minimum.inputs.arylHalide.smiles === maximum.inputs.arylHalide.smiles,
        catalystIdentifierEqual: minimum.inputs.catalyst.smiles === maximum.inputs.catalyst.smiles,
        recordedYieldDifferencePercentagePoints: maximum.outcome.yield.value - minimum.outcome.yield.value,
        result: "same exact source product identifier; distinct recorded route fragments"
      };
    }),
    {
      id: "native-cross-reference-continuity:islatravir",
      records: cascade.records.map((record) => record.reactionId),
      supportedTransitions: [
        { fromReactionId: cascade.records[0].reactionId, toReactionId: cascade.records[1].reactionId, nativeReferenceMultiplicity: 2 },
        { fromReactionId: cascade.records[1].reactionId, toReactionId: cascade.records[2].reactionId, nativeReferenceMultiplicity: 1 }
      ],
      result: "two inter-record transitions are directly recorded by native ORD reaction_id references"
    }
  ];
}

function validateUpstream(upstream) {
  if (upstream.format !== "onto2d-chemical-synthesis-upstream-lock" || upstream.source.release !== "v0.1.0" || upstream.source.commit !== "8b83754b865c8a9f30667fbea4dfdc892d4dad60") fail("ORD release lock was substituted");
  if (!same(upstream.source.schema, ORD_SCHEMA_LOCK) || upstream.datasets.length !== 2) fail("ORD schema or dataset inventory was substituted");
  for (const dataset of upstream.datasets) {
    if (!DATASET_ID.test(dataset.datasetId) || !/^[0-9a-f]{64}$/.test(dataset.sha256) || !/^[0-9a-f]{64}$/.test(dataset.protobufSha256)) fail(`${dataset.role} source identity is invalid`);
  }
}

function verifyChemicalSourceIdentity(artifact) {
  const source = artifact.source;
  exactKeys(source, ["identity", "authoredFiles", "externalFiles", "retrieval"], "case source");
  if (!HASH.test(source.identity ?? "") || source.retrieval?.liveNetworkRequiredByBuild !== false) fail("case source boundary is invalid");
  const expectedAuthored = Object.entries(FILES).map(([role, filePath]) => [role, filePath]);
  if (!Array.isArray(source.authoredFiles) || !same(source.authoredFiles.map((file) => [file.role, file.path]), expectedAuthored)) fail("authored source inventory differs");
  for (const [index, file] of source.authoredFiles.entries()) {
    exactKeys(file, ["role", "path", "identity", "bytes"], `authoredFiles[${index}]`);
    if (!HASH.test(file.identity) || !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`authoredFiles[${index}] identity is invalid`);
  }
  if (!Array.isArray(source.externalFiles) || source.externalFiles.length !== artifact.ord.datasets.length) fail("external source inventory differs");
  for (const [index, dataset] of artifact.ord.datasets.entries()) {
    const file = source.externalFiles[index];
    exactKeys(file, ["path", "identity", "bytes", "datasetId"], `externalFiles[${index}]`);
    if (file.datasetId !== dataset.datasetId || file.path !== dataset.path || file.identity !== `sha256:${dataset.sha256}` || !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`${dataset.role} external source lock differs`);
  }
  const expectedIdentity = hashCanonical(SOURCE_DOMAIN, {
    release: artifact.ord.release,
    commit: artifact.ord.commit,
    schema: ORD_SCHEMA_LOCK,
    externalFiles: source.externalFiles,
    authoredFiles: source.authoredFiles
  });
  if (source.identity !== expectedIdentity) fail("source identity was substituted");
}

export function verifyChemicalSynthesisHistoryCaseIdentity(input) {
  const artifact = structuredClone(input);
  if (!isRecord(artifact) || artifact.format !== "onto2d-chemical-synthesis-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "chemical-synthesis-history-v1") fail("unsupported case artifact version");
  if (artifact.generatedBy !== "cases/chemical-synthesis-history/extract.mjs") fail("case generator was substituted");
  if (artifact.ord.release !== "v0.1.0" || artifact.ord.commit !== "8b83754b865c8a9f30667fbea4dfdc892d4dad60" || artifact.ord.schemaVersion !== ORD_SCHEMA_LOCK.tag) fail("ORD release semantics were substituted");
  if (!same(artifact.ord.datasets.map((dataset) => dataset.role), ["same-target-condition-sweep", "cross-referenced-cascade"])) fail("ORD dataset roles differ");
  if (artifact.cohorts.conditionSweep.datasetId !== artifact.ord.datasets[0].datasetId || artifact.cohorts.linkedCascade.datasetId !== artifact.ord.datasets[1].datasetId) fail("cohort dataset references differ from the source lock");
  verifyChemicalSourceIdentity(artifact);
  if (artifact.cohorts.conditionSweep.targets.length !== 5 || artifact.cohorts.conditionSweep.targets.some((target) => target.routes.length !== 2)) fail("condition-sweep inventory is incomplete");
  for (const target of artifact.cohorts.conditionSweep.targets) {
    for (const route of target.routes) {
      if (route.routeIdentity !== routeIdentity(route, target.productIdentifier.value, artifact.identityProfiles)) fail(`${route.id} route identity was substituted`);
    }
  }
  const expectedExperiments = buildExperiments(artifact.cohorts.conditionSweep, artifact.cohorts.linkedCascade);
  if (!same(artifact.experiments, expectedExperiments)) fail("identity or continuity experiment results were substituted");
  if (!same(artifact.pathSpace.routes, declaredRoutes())) fail("declared route space was substituted");
  for (const result of artifact.historicalLoad.results) {
    if (!same(result, calculateChemicalHistoricalLoad(artifact.pathSpace.routes, artifact.historicalLoad.profile, result.costFunction))) fail(`${result.costFunction} Historical Load result was substituted`);
  }
  if (artifact.pathSpace.routes.some((route) => route.counterfactual && route.actual)) fail("a counterfactual route was promoted to actual history");
  if (!artifact.evidenceBoundary.nonClaims.includes("exact product SMILES equality proves physical-batch continuity")) fail("physical-batch non-claim is missing");
  const { caseIdentity, ...basis } = artifact;
  if (!HASH.test(caseIdentity ?? "") || hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildChemicalSynthesisHistoryCase() {
  const loaded = Object.fromEntries(await Promise.all(Object.entries(FILES).map(async ([key, relative]) => [key, await json(relative)])));
  const upstream = loaded.upstream.value;
  const identityProfiles = loaded.identity.value;
  const analysisProfile = loaded.analysis.value;
  validateUpstream(upstream);
  if (identityProfiles.format !== "onto2d-chemical-synthesis-identity-profile" || analysisProfile.format !== "onto2d-chemical-synthesis-analysis-profile") fail("identity or analysis profile is unsupported");
  const conditionSweep = validateConditionSweep(loaded.conditionSweep.value, identityProfiles);
  const linkedCascade = validateCascade(loaded.cascade.value);
  const externalFiles = upstream.datasets.map((dataset) => ({ path: dataset.path, identity: `sha256:${dataset.sha256}`, bytes: dataset.compressedBytes, datasetId: dataset.datasetId }));
  const authoredFiles = Object.entries(FILES).map(([role, relative]) => ({ role, path: relative, identity: `sha256:${sha256(loaded[role].bytes)}`, bytes: loaded[role].bytes.length }));
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, { release: upstream.source.release, commit: upstream.source.commit, schema: upstream.source.schema, externalFiles, authoredFiles });
  const routes = declaredRoutes();
  const artifact = {
    format: "onto2d-chemical-synthesis-history-case",
    formatVersion: "1",
    caseVersion: "chemical-synthesis-history-v1",
    generatedBy: "cases/chemical-synthesis-history/extract.mjs",
    ord: {
      name: upstream.source.name,
      release: upstream.source.release,
      commit: upstream.source.commit,
      schemaVersion: upstream.source.schema.tag,
      license: upstream.source.license,
      datasets: upstream.datasets.map(({ role, datasetId, name, reactionCount, doi, path, sha256: digest }) => ({ role, datasetId, name, reactionCount, doi, path, sha256: digest }))
    },
    source: { identity: sourceIdentity, authoredFiles, externalFiles, retrieval: upstream.retrieval },
    identityProfiles,
    cohorts: { conditionSweep, linkedCascade },
    experiments: buildExperiments(conditionSweep, linkedCascade),
    pathSpace: { status: "finite-declared-analysis-space", routes },
    historicalLoad: {
      status: "resolved-in-declared-space",
      definition: "Shortest admissible route cost minus shortest unconstrained candidate cost for the exact pinned islatravir target inside the four-route analysis space.",
      profile: analysisProfile,
      results: analysisProfile.costFunctions.map((cost) => calculateChemicalHistoricalLoad(routes, analysisProfile, cost.id)),
      interpretation: "A value of +2 means that preserving the pinned ORD record chain requires two additional reaction records, or equivalently two additional explicitly represented intermediate states, compared with the declared direct shortcut.",
      nonClaim: analysisProfile.nonClaim
    },
    evidenceBoundary: {
      directRecords: ["ORD dataset and reaction identifiers", "selected native compound identifiers", "conditions", "workups", "outcomes", "yield measurements", "provenance DOI", "native reaction_id cross-references"],
      derived: ["exact-string target grouping", "route-fragment identities", "extrema comparisons", "bounded continuity interpretation", "Historical Load"],
      counterfactual: routes.filter((route) => route.counterfactual).map((route) => route.id),
      unknown: ["chemical equivalence beyond exact source-string equality", "physical batch identity without native cross-reference", "feasibility of counterfactual shortcuts", "mechanism", "laboratory safety", "economic cost"],
      nonClaims: ["exact product SMILES equality proves physical-batch continuity", "a zero recorded yield means the reaction is universally impossible", "the selected extrema are globally optimal chemistry", "Historical Load is an ORD metric or universal synthesis score"]
    },
    caseIdentity: null
  };
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_DOMAIN, basis);
  return verifyChemicalSynthesisHistoryCaseIdentity(artifact);
}

export async function run({ verify = false } = {}) {
  const artifact = await buildChemicalSynthesisHistoryCase();
  if (!verify) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  assert.equal(await readFile(OUTPUT, "utf8"), serialize(artifact), "Committed chemical synthesis artifact differs from deterministic extraction.");
  console.log(`${verify ? "Verified" : "Extracted"} Chemical Synthesis History ${artifact.caseVersion}: ${artifact.cohorts.conditionSweep.targets.length} exact targets, ${artifact.experiments.length} experiments, ${artifact.caseIdentity}`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
