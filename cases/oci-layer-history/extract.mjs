import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashArtifactBytes, hashCanonical } from "@onto2d/kernel/canonical";
import {
  OCI_MEDIA_TYPES,
  layerSequenceIdentity,
  parseLayerTar,
  replayLayers,
  sha256,
  validateOciFixtureSpec
} from "./src/oci-layout.mjs";

const DEFAULT_CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.join(DEFAULT_CASE_ROOT, "artifacts", "oci-layer-history.json");
const LAYOUT_IDENTITY_DOMAIN = "onto2d:oci-layout-source:v1";
const CASE_IDENTITY_DOMAIN = "onto2d:oci-layer-history-case:v1";
const HISTORY_CLASS_DOMAIN = "onto2d:oci-flattened-history-class:v1";
const MAX_JSON_BYTES = 64 * 1024;
const HISTORY_IDS = Object.freeze(["history-a", "history-b", "history-redundant", "history-grouped"]);
const COST_IDS = Object.freeze(["layer-count", "operation-count", "changed-byte-count", "transferred-byte-count"]);
const ALLOWED_OPERATIONS = Object.freeze(["add-file", "replace-file", "delete-file"]);

function fail(message) {
  throw new Error(`OCI Layer History extraction failed: ${message}`);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(record(value, label)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateAnalysisProfile(input) {
  const profile = record(input, "analysis profile");
  exactKeys(profile, ["format", "formatVersion", "targetHistory", "targetState", "candidateHistories", "allowedOperations", "admissibilityRegime", "costFunctions"], "analysis profile");
  if (profile.format !== "onto2d-oci-history-analysis-profile" || profile.formatVersion !== "1" || profile.targetHistory !== "history-a" || profile.targetState !== "final-rootfs" || profile.admissibilityRegime !== "verified-native-layout-and-equal-final-rootfs-v1") fail("analysis profile constants differ from the reviewed v1 contract");
  if (!same(profile.candidateHistories, HISTORY_IDS)) fail("analysis candidates differ from the reviewed native history inventory");
  if (!same(profile.allowedOperations, ALLOWED_OPERATIONS)) fail("analysis operations differ from the reviewed v1 contract");
  if (!Array.isArray(profile.costFunctions) || profile.costFunctions.length !== COST_IDS.length) fail("analysis profile must declare exactly four cost functions");
  for (const [index, cost] of profile.costFunctions.entries()) {
    exactKeys(cost, ["id", "unit", "definition"], `cost function ${index}`);
    if (cost.id !== COST_IDS[index] || typeof cost.unit !== "string" || cost.unit.length === 0 || typeof cost.definition !== "string" || cost.definition.length === 0) fail(`cost function ${index} differs from the reviewed v1 contract`);
  }
  return profile;
}

function identityRegimes() {
  return [
    { id: "flattened-rootfs", label: "Flattened rootfs", evidence: "derived", question: "Do normalized final filesystem records match?" },
    { id: "layer-sequence", label: "Layer sequence", evidence: "native-descriptor-projection", question: "Do ordered uncompressed layer identities match?" },
    { id: "manifest", label: "Manifest", evidence: "cryptographically-verified", question: "Do native OCI manifest digests match?" },
    { id: "history-equivalence", label: "Historical equivalence", evidence: "declared-derived", question: "Are the histories equivalent under flattened-rootfs-v1?" }
  ];
}

function descriptor(value, mediaType, label, annotations = false) {
  exactKeys(value, annotations ? ["mediaType", "digest", "size", "annotations"] : ["mediaType", "digest", "size"], label);
  if (value.mediaType !== mediaType || !/^sha256:[0-9a-f]{64}$/.test(value.digest) || !Number.isSafeInteger(value.size) || value.size < 0) fail(`${label} is invalid`);
  return value;
}

async function jsonFile(file, label) {
  const bytes = await readFile(file);
  if (bytes.length > MAX_JSON_BYTES) fail(`${label} exceeds the JSON byte limit`);
  try {
    return { bytes, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    fail(`${label} is not valid UTF-8 JSON`);
  }
}

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else fail(`layout contains unsupported entry ${relative}`);
  }
  return files.sort();
}

function blobPath(layoutRoot, digest) {
  return path.join(layoutRoot, "blobs", "sha256", digest.slice("sha256:".length));
}

async function verifiedBlob(layoutRoot, value, label) {
  const bytes = await readFile(blobPath(layoutRoot, value.digest));
  if (bytes.length !== value.size || sha256(bytes) !== value.digest) fail(`${label} content does not match its descriptor`);
  return bytes;
}

function entryRecord(entry) {
  return {
    path: entry.path,
    size: entry.size,
    mode: entry.mode,
    uid: entry.uid,
    gid: entry.gid,
    mtime: entry.mtime,
    contentIdentity: sha256(entry.bytes),
    contentUtf8: new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes)
  };
}

function compareHistories(id, label, left, right) {
  const rootfsEqual = left.finalRootfs.identity === right.finalRootfs.identity;
  return {
    id,
    label,
    left: left.id,
    right: right.id,
    results: {
      "flattened-rootfs": { left: left.finalRootfs.identity, right: right.finalRootfs.identity, equal: rootfsEqual },
      "layer-sequence": { left: left.layerSequenceIdentity, right: right.layerSequenceIdentity, equal: left.layerSequenceIdentity === right.layerSequenceIdentity },
      manifest: { left: left.manifest.digest, right: right.manifest.digest, equal: left.manifest.digest === right.manifest.digest },
      "history-equivalence": {
        left: hashCanonical(HISTORY_CLASS_DOMAIN, { rootfsIdentity: left.finalRootfs.identity }),
        right: hashCanonical(HISTORY_CLASS_DOMAIN, { rootfsIdentity: right.finalRootfs.identity }),
        equal: rootfsEqual
      }
    }
  };
}

function historyCost(history, id) {
  if (id === "layer-count") return history.layers.length;
  if (id === "operation-count") return history.layers.reduce((sum, layer) => sum + layer.operations.length, 0);
  if (id === "changed-byte-count") return history.layers.reduce((sum, layer) => sum + layer.operations.reduce((layerSum, operation) => layerSum + operation.changedBytes, 0), 0);
  if (id === "transferred-byte-count") return history.layers.reduce((sum, layer) => sum + layer.descriptor.size, 0);
  fail(`undeclared cost function ${id}`);
}

export function calculateHistoricalLoad(historiesInput, profileInput, costId) {
  const histories = new Map(historiesInput.map((history) => [history.id, history]));
  const profile = validateAnalysisProfile(profileInput);
  const declared = profile.costFunctions.find((cost) => cost.id === costId);
  if (!declared) fail(`undeclared cost function ${costId}`);
  const observed = histories.get(profile.targetHistory);
  if (!observed) fail("analysis target history is missing");
  const candidates = profile.candidateHistories.map((id) => {
    const history = histories.get(id);
    if (!history) fail(`analysis candidate ${id} is missing`);
    if (history.finalRootfs.identity !== observed.finalRootfs.identity) fail(`analysis candidate ${id} does not reach the declared target`);
    return { historyId: id, cost: historyCost(history, costId) };
  });
  const optimumCost = Math.min(...candidates.map((candidate) => candidate.cost));
  const observedCost = historyCost(observed, costId);
  return {
    costFunction: costId,
    unit: declared.unit,
    definition: declared.definition,
    observedHistory: observed.id,
    observedCost,
    optimumCost,
    optimumHistories: candidates.filter((candidate) => candidate.cost === optimumCost).map((candidate) => candidate.historyId),
    historicalLoad: observedCost - optimumCost,
    candidateCosts: candidates
  };
}

export function verifyOciLayerHistoryCaseIdentity(input) {
  const artifact = structuredClone(record(input, "case artifact"));
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "specification", "source", "identityRegimes", "histories", "experiments", "counterfactuals", "historicalLoad", "limitations", "caseIdentity"], "case artifact");
  if (artifact.format !== "onto2d-oci-layer-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "oci-layer-history-v1" || artifact.generatedBy !== "cases/oci-layer-history/extract.mjs" || artifact.specification?.version !== "1.1.1") fail("case artifact constants differ from the reviewed v1 contract");
  if (!same(artifact.identityRegimes, identityRegimes())) fail("identity regimes are substituted");
  exactKeys(artifact.source, ["format", "formatVersion", "specification", "authoredFiles", "layoutFiles", "identity"], "case source");
  if (artifact.source.format !== "onto2d-oci-layout-source" || artifact.source.formatVersion !== "1" || !same(artifact.source.specification, artifact.specification)) fail("case source boundary is inconsistent");
  const { identity: sourceIdentity, ...sourceBasis } = artifact.source;
  if (hashCanonical(LAYOUT_IDENTITY_DOMAIN, sourceBasis) !== sourceIdentity) fail("source identity does not match its exact basis");
  if (!Array.isArray(artifact.histories) || !same(artifact.histories.map((history) => history.id), HISTORY_IDS)) fail("native history inventory or order is incomplete");
  for (const history of artifact.histories) {
    exactKeys(history, ["id", "label", "evidenceClass", "manifest", "config", "layerSequenceIdentity", "layers", "finalRootfs"], `history ${history.id}`);
    if (history.evidenceClass !== "native-oci-layout" || !Array.isArray(history.layers) || history.layers.length === 0) fail(`history ${history.id} is not native bounded evidence`);
    descriptor(history.manifest, OCI_MEDIA_TYPES.manifest, `manifest ${history.id}`, true);
    descriptor(history.config, OCI_MEDIA_TYPES.config, `config ${history.id}`);
    for (const [index, layer] of history.layers.entries()) {
      if (layer.ordinal !== index || layer.diffId !== layer.descriptor?.digest) fail(`history ${history.id} layer order or DiffID is substituted`);
      descriptor(layer.descriptor, OCI_MEDIA_TYPES.layer, `layer ${history.id}/${index}`, true);
      exactKeys(layer.history, ["created", "created_by", "comment"], `history record ${history.id}/${index}`);
    }
    if (history.layerSequenceIdentity !== layerSequenceIdentity(history.layers.map((layer) => layer.diffId))) fail(`history ${history.id} layer sequence identity is substituted`);
    if (!same(history.finalRootfs, history.layers.at(-1).stateAfter)) fail(`history ${history.id} final rootfs is not its final derived state`);
  }
  const targetIdentity = artifact.histories[0]?.finalRootfs?.identity;
  if (!targetIdentity || artifact.histories.some((history) => history.finalRootfs.identity !== targetIdentity)) fail("native histories do not share one verified final rootfs");
  if (new Set(artifact.histories.map((history) => history.manifest.digest)).size !== artifact.histories.length) fail("manifest identities must remain distinct");
  if (new Set(artifact.histories.map((history) => history.layerSequenceIdentity)).size !== artifact.histories.length) fail("layer sequence identities must remain distinct");
  const byId = new Map(artifact.histories.map((history) => [history.id, history]));
  const addedA = byId.get("history-a").layers.find((layer) => layer.id === "a-add-a");
  const deletedA = byId.get("history-a").layers.find((layer) => layer.id === "a-delete-a");
  if (!addedA?.operations.some((operation) => operation.kind === "add-file" && operation.target === "a.txt") || !deletedA?.operations.some((operation) => operation.kind === "delete-file" && operation.target === "a.txt")) fail("deleted-history experiment is detached from its derived operations");
  const expectedExperiments = [
    compareHistories("flattening", "Same final rootfs, different layer ancestry", byId.get("history-a"), byId.get("history-b")),
    {
      id: "deleted-history",
      label: "A deleted file remains visible in ancestry",
      history: "history-a",
      hiddenPath: "a.txt",
      addedInLayer: "a-add-a",
      deletedInLayer: "a-delete-a",
      absentFromFinalRootfs: !byId.get("history-a").finalRootfs.files.some((file) => file.path === "a.txt")
    },
    compareHistories("redundant-mutations", "Cancelled mutations preserve the same final rootfs", byId.get("history-redundant"), byId.get("history-b")),
    compareHistories("layer-grouping", "Layer grouping changes ancestry without changing final files", byId.get("history-grouped"), byId.get("history-b"))
  ];
  if (!same(artifact.experiments, expectedExperiments)) fail("case experiments are substituted");
  const profile = validateAnalysisProfile(artifact.historicalLoad?.profile);
  if (artifact.historicalLoad.status !== "resolved-in-declared-space" || !Array.isArray(artifact.historicalLoad.results) || !same(artifact.historicalLoad.results.map((result) => result.costFunction), COST_IDS)) fail("Historical Load result inventory is substituted");
  for (const result of artifact.historicalLoad.results) {
    const replay = calculateHistoricalLoad(artifact.histories, profile, result.costFunction);
    if (JSON.stringify(replay) !== JSON.stringify(result)) fail(`Historical Load result is substituted for ${result.costFunction}`);
  }
  const historyA = byId.get("history-a");
  const reversedInput = [...historyA.layers].reverse().map((layer) => ({ id: layer.id, entries: layer.entries.map((entry) => ({ ...entry, bytes: Buffer.from(entry.contentUtf8, "utf8") })) }));
  const reversed = replayLayers(reversedInput);
  const expectedCounterfactuals = [{ id: "history-a-reversed", evidenceClass: "counterfactual", sourceHistory: "history-a", manifest: null, layerOrder: reversedInput.map((layer) => layer.id), finalRootfs: { identity: reversed.final.identity, files: reversed.final.files }, differsFromNativeFinal: reversed.final.identity !== historyA.finalRootfs.identity }];
  if (!same(artifact.counterfactuals, expectedCounterfactuals)) fail("counterfactual history crossed the native OCI boundary or was substituted");
  const { caseIdentity, ...basis } = artifact;
  if (hashCanonical(CASE_IDENTITY_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildOciLayerHistoryCase(options = {}) {
  const caseRoot = path.resolve(options.caseRoot ?? DEFAULT_CASE_ROOT);
  const layoutRoot = path.join(caseRoot, "fixtures", "oci-layout");
  const [specSource, profileSource, layoutHeaderSource, indexSource] = await Promise.all([
    jsonFile(path.join(caseRoot, "fixture-spec.json"), "fixture spec"),
    jsonFile(path.join(caseRoot, "analysis-profile.json"), "analysis profile"),
    jsonFile(path.join(layoutRoot, "oci-layout"), "OCI layout header"),
    jsonFile(path.join(layoutRoot, "index.json"), "OCI index")
  ]);
  const spec = specSource.value;
  const profile = validateAnalysisProfile(profileSource.value);
  validateOciFixtureSpec(spec);
  exactKeys(layoutHeaderSource.value, ["imageLayoutVersion"], "OCI layout header");
  if (layoutHeaderSource.value.imageLayoutVersion !== spec.profile.layoutVersion) fail("OCI layout version differs from the fixture profile");
  exactKeys(indexSource.value, ["schemaVersion", "mediaType", "manifests"], "OCI index");
  if (indexSource.value.schemaVersion !== 2 || indexSource.value.mediaType !== OCI_MEDIA_TYPES.index || !Array.isArray(indexSource.value.manifests)) fail("OCI index is unsupported");
  if (indexSource.value.manifests.length !== spec.histories.length) fail("OCI index does not contain every declared native history");

  const declaredHistories = new Map(spec.histories.map((history) => [history.id, history]));
  const seenReferences = new Set();
  const histories = [];
  const referencedDigests = new Set();
  for (const manifestDescriptorInput of indexSource.value.manifests) {
    const manifestDescriptor = descriptor(manifestDescriptorInput, OCI_MEDIA_TYPES.manifest, "manifest descriptor", true);
    exactKeys(manifestDescriptor.annotations, ["org.opencontainers.image.ref.name"], "manifest annotations");
    const id = manifestDescriptor.annotations["org.opencontainers.image.ref.name"];
    const declared = declaredHistories.get(id);
    if (!declared || seenReferences.has(id)) fail(`OCI index contains unknown or duplicate reference ${id}`);
    seenReferences.add(id);
    referencedDigests.add(manifestDescriptor.digest);
    const manifestBytes = await verifiedBlob(layoutRoot, manifestDescriptor, `manifest ${id}`);
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
    exactKeys(manifest, ["schemaVersion", "mediaType", "config", "layers"], `manifest ${id}`);
    if (manifest.schemaVersion !== 2 || manifest.mediaType !== OCI_MEDIA_TYPES.manifest || !Array.isArray(manifest.layers) || manifest.layers.length !== declared.layers.length) fail(`manifest ${id} is unsupported`);
    const configDescriptor = descriptor(manifest.config, OCI_MEDIA_TYPES.config, `config descriptor ${id}`);
    referencedDigests.add(configDescriptor.digest);
    const configBytes = await verifiedBlob(layoutRoot, configDescriptor, `config ${id}`);
    const config = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(configBytes));
    exactKeys(config, ["created", "architecture", "os", "config", "rootfs", "history"], `config ${id}`);
    exactKeys(config.rootfs, ["type", "diff_ids"], `config rootfs ${id}`);
    if (config.created !== spec.profile.created || config.architecture !== spec.profile.architecture || config.os !== spec.profile.os || config.rootfs.type !== "layers" || !Array.isArray(config.rootfs.diff_ids) || config.rootfs.diff_ids.length !== manifest.layers.length || !Array.isArray(config.history) || config.history.length !== manifest.layers.length) fail(`config ${id} differs from the bounded fixture profile`);
    const replayInput = [];
    const nativeLayers = [];
    for (const [index, layerDescriptorInput] of manifest.layers.entries()) {
      const layerDescriptor = descriptor(layerDescriptorInput, OCI_MEDIA_TYPES.layer, `layer descriptor ${id}/${index}`, true);
      exactKeys(layerDescriptor.annotations, ["org.opencontainers.image.title"], `layer annotations ${id}/${index}`);
      if (config.rootfs.diff_ids[index] !== layerDescriptor.digest) fail(`config DiffID differs from uncompressed layer digest ${id}/${index}`);
      referencedDigests.add(layerDescriptor.digest);
      const layerBytes = await verifiedBlob(layoutRoot, layerDescriptor, `layer ${id}/${index}`);
      const entries = parseLayerTar(layerBytes);
      replayInput.push({ id: declared.layers[index].id, entries });
      nativeLayers.push({
        ordinal: index,
        id: declared.layers[index].id,
        label: declared.layers[index].label,
        descriptor: layerDescriptor,
        diffId: config.rootfs.diff_ids[index],
        history: config.history[index],
        entries: entries.map(entryRecord)
      });
    }
    const replay = replayLayers(replayInput);
    for (const [index, state] of replay.states.entries()) {
      nativeLayers[index].operations = state.operations;
      nativeLayers[index].stateAfter = { identity: state.identity, files: state.files };
    }
    histories.push({
      id,
      label: declared.label,
      evidenceClass: "native-oci-layout",
      manifest: manifestDescriptor,
      config: configDescriptor,
      layerSequenceIdentity: layerSequenceIdentity(config.rootfs.diff_ids),
      layers: nativeLayers,
      finalRootfs: { identity: replay.final.identity, files: replay.final.files }
    });
  }
  if (seenReferences.size !== declaredHistories.size) fail("OCI index omits a declared native history");

  const layoutFiles = await collectFiles(layoutRoot);
  const expectedFiles = new Set(["index.json", "oci-layout", ...[...referencedDigests].map((digest) => `blobs/sha256/${digest.slice("sha256:".length)}`)]);
  if (layoutFiles.length !== expectedFiles.size || layoutFiles.some((file) => !expectedFiles.has(file))) fail("OCI layout contains missing, unreferenced, or unexpected files");
  const fileRecords = [];
  for (const relative of layoutFiles) {
    const bytes = await readFile(path.join(layoutRoot, relative));
    fileRecords.push({ path: `fixtures/oci-layout/${relative}`, bytes: bytes.length, identity: hashArtifactBytes(bytes) });
  }
  histories.sort((left, right) => spec.histories.findIndex((entry) => entry.id === left.id) - spec.histories.findIndex((entry) => entry.id === right.id));
  const byId = new Map(histories.map((history) => [history.id, history]));
  const experiments = [
    compareHistories("flattening", "Same final rootfs, different layer ancestry", byId.get("history-a"), byId.get("history-b")),
    {
      id: "deleted-history",
      label: "A deleted file remains visible in ancestry",
      history: "history-a",
      hiddenPath: "a.txt",
      addedInLayer: "a-add-a",
      deletedInLayer: "a-delete-a",
      absentFromFinalRootfs: !byId.get("history-a").finalRootfs.files.some((file) => file.path === "a.txt")
    },
    compareHistories("redundant-mutations", "Cancelled mutations preserve the same final rootfs", byId.get("history-redundant"), byId.get("history-b")),
    compareHistories("layer-grouping", "Layer grouping changes ancestry without changing final files", byId.get("history-grouped"), byId.get("history-b"))
  ];
  const historyA = byId.get("history-a");
  const reversedInput = [...historyA.layers].reverse().map((layer) => ({
    id: layer.id,
    entries: layer.entries.map((entry) => ({ ...entry, bytes: Buffer.from(entry.contentUtf8, "utf8") }))
  }));
  const reversed = replayLayers(reversedInput);
  const counterfactuals = [{
    id: "history-a-reversed",
    evidenceClass: "counterfactual",
    sourceHistory: "history-a",
    manifest: null,
    layerOrder: reversedInput.map((layer) => layer.id),
    finalRootfs: { identity: reversed.final.identity, files: reversed.final.files },
    differsFromNativeFinal: reversed.final.identity !== historyA.finalRootfs.identity
  }];
  const historicalLoadResults = profile.costFunctions.map((cost) => calculateHistoricalLoad(histories, profile, cost.id));
  const sourceBasis = {
    format: "onto2d-oci-layout-source",
    formatVersion: "1",
    specification: spec.ociImageSpec,
    authoredFiles: [
      { path: "fixture-spec.json", bytes: specSource.bytes.length, identity: hashArtifactBytes(specSource.bytes) },
      { path: "analysis-profile.json", bytes: profileSource.bytes.length, identity: hashArtifactBytes(profileSource.bytes) }
    ],
    layoutFiles: fileRecords
  };
  const basis = {
    format: "onto2d-oci-layer-history-case",
    formatVersion: "1",
    caseVersion: "oci-layer-history-v1",
    generatedBy: "cases/oci-layer-history/extract.mjs",
    specification: spec.ociImageSpec,
    source: { ...sourceBasis, identity: hashCanonical(LAYOUT_IDENTITY_DOMAIN, sourceBasis) },
    identityRegimes: identityRegimes(),
    histories,
    experiments,
    counterfactuals,
    historicalLoad: {
      status: "resolved-in-declared-space",
      interpretation: "Observed cost minus the minimum cost among the four declared native histories that reach the exact target rootfs.",
      profile,
      results: historicalLoadResults
    },
    limitations: [
      "The evaluator implements only the bounded uncompressed regular-file and whiteout fixture profile; it is not a container runtime.",
      "Flattened identity includes file bytes and selected POSIX metadata, but not every filesystem feature allowed by OCI.",
      "The Historical Load values apply only to the four declared native histories, target rootfs, admissibility regime, and cost functions.",
      "No public image tag, registry response, signature, runtime execution, or endorsement by the Open Container Initiative is claimed."
    ]
  };
  return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_IDENTITY_DOMAIN, basis) });
}

async function main(argv) {
  const verify = argv.includes("--verify");
  if (argv.some((argument) => argument !== "--verify")) fail("only --verify is supported");
  const artifact = await buildOciLayerHistoryCase();
  verifyOciLayerHistoryCaseIdentity(artifact);
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
