import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashArtifactBytes, hashCanonical } from "@onto2d/kernel/canonical";
import {
  IDENTITY_REGIMES,
  builderEnvironmentProjection,
  compareDerivations,
  inputClosureProjection,
  verifyNativeDerivation
} from "./src/nix-identity.mjs";

const DEFAULT_CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.join(DEFAULT_CASE_ROOT, "artifacts", "nix-derivation-identity.json");
const SOURCE_DOMAIN = "onto2d:nix-derivation-capture-source:v1";
const CASE_DOMAIN = "onto2d:nix-derivation-identity-case:v1";
const FIXTURE_ORDER = Object.freeze([
  "sharedLeaf",
  "sharedInput",
  "leftInput",
  "rightInput",
  "flagshipLeft",
  "flagshipRight",
  "environmentBase",
  "environmentMutated",
  "inputAddressed"
]);
const EXPERIMENTS = Object.freeze([
  Object.freeze({ id: "same-content-different-derivation", label: "Same content, different derivation", left: "flagshipLeft", right: "flagshipRight", claim: "Two native fixed-output derivations resolve to one materialized content-addressed store object." }),
  Object.freeze({ id: "partially-shared-input-closure", label: "Partially shared input closure", left: "flagshipLeft", right: "environmentBase", claim: "The pair shares one native input derivation while only the left side retains a route-specific input." }),
  Object.freeze({ id: "environment-mutation", label: "Environment mutation", left: "environmentBase", right: "environmentMutated", claim: "A declared environment change alters derivation and builder-environment identity without altering verified output content." }),
  Object.freeze({ id: "addressing-mode", label: "Addressing mode comparison", left: "environmentBase", right: "inputAddressed", claim: "The fixed content-addressed output is materialized; the input-addressed control remains deliberately unrealized, so cross-mode content equality is unresolved." })
]);

function fail(message) {
  throw new Error(`Nix Derivation Identity extraction failed: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function decode(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8`);
  }
}

async function jsonFile(file, label) {
  const bytes = await readFile(file);
  try {
    return { bytes, value: JSON.parse(decode(bytes, label)) };
  } catch (error) {
    if (error.message.startsWith("Nix Derivation Identity extraction failed:")) throw error;
    fail(`${label} is not valid JSON`);
  }
}

function depthOf(drvPath, index, visiting = new Set()) {
  const derivation = index.get(drvPath);
  if (!derivation) fail(`cannot compute depth for missing derivation ${drvPath}`);
  if (visiting.has(drvPath)) fail(`derivation graph contains a cycle at ${drvPath}`);
  if (derivation.directInputDrvs.length === 0) return 0;
  visiting.add(drvPath);
  const depth = 1 + Math.max(...derivation.directInputDrvs.map((input) => depthOf(input.drvPath, index, visiting)));
  visiting.delete(drvPath);
  return depth;
}

export function verifyNixDerivationCaseIdentity(input) {
  const artifact = structuredClone(record(input, "case artifact"));
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "source", "captureBoundary", "nix", "regimes", "nativeOutput", "derivations", "dependencyGraph", "comparisons", "limitations", "caseIdentity"], "case artifact");
  const { caseIdentity, ...basis } = artifact;
  const { identity: sourceIdentity, ...sourceBasis } = artifact.source;
  if (hashCanonical(SOURCE_DOMAIN, sourceBasis) !== sourceIdentity) fail("source identity does not match its exact basis");
  if (hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildNixDerivationCase(options = {}) {
  const caseRoot = path.resolve(options.caseRoot ?? DEFAULT_CASE_ROOT);
  const captureRoot = path.join(caseRoot, "capture");
  const fixturesRoot = path.join(caseRoot, "fixtures");
  const metadataSource = await jsonFile(path.join(captureRoot, "metadata.json"), "capture metadata");
  const evaluationSource = await jsonFile(path.join(captureRoot, "evaluation.json"), "capture evaluation");
  const derivationsSource = await jsonFile(path.join(captureRoot, "derivations.json"), "captured derivations");
  const nativeOutputSource = await jsonFile(path.join(captureRoot, "native-output.json"), "native output");
  const metadata = metadataSource.value;
  exactKeys(metadata, ["drvFiles", "executionBoundary", "format", "formatVersion", "nixVersion", "platform", "runtime", "sourceFiles", "storeBackend", "storeDirectory"], "capture metadata");
  if (metadata.format !== "onto2d-nix-native-capture" || metadata.formatVersion !== "1" || metadata.nixVersion !== "2.31.0" || metadata.platform !== "aarch64-darwin") fail("capture format, Nix version, or platform is unsupported");
  if (metadata.storeDirectory !== "/nix/store" || metadata.storeBackend !== "local-root-remapped") fail("capture store boundary is unsupported");
  exactKeys(metadata.executionBoundary, ["derivationBuildersExecuted", "derivationsInstantiatedByNix", "fixedOutputAddedByNix", "inputAddressedOutputRealized"], "execution boundary");
  if (metadata.executionBoundary.derivationsInstantiatedByNix !== true || metadata.executionBoundary.fixedOutputAddedByNix !== true || metadata.executionBoundary.derivationBuildersExecuted !== false || metadata.executionBoundary.inputAddressedOutputRealized !== false) fail("capture execution boundary is inconsistent");
  exactKeys(metadata.runtime, ["archiveSha256", "releaseUrl"], "runtime");
  if (!/^https:\/\/releases\.nixos\.org\//.test(metadata.runtime.releaseUrl) || !/^[0-9a-f]{64}$/.test(metadata.runtime.archiveSha256)) fail("runtime provenance is invalid");

  const sourceFileRecords = new Map();
  for (const source of metadata.sourceFiles) {
    exactKeys(source, ["bytes", "file", "sha256"], `source file ${source.file}`);
    if (!/^fixtures\/(?:fixture\.nix|output\.txt)$/.test(source.file) || sourceFileRecords.has(source.file)) fail(`unexpected or duplicate source file ${source.file}`);
    const bytes = await readFile(path.join(caseRoot, source.file));
    if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) fail(`source file mismatch: ${source.file}`);
    sourceFileRecords.set(source.file, { ...source, identity: hashArtifactBytes(bytes) });
  }
  if (sourceFileRecords.size !== 2) fail("exactly two fixture source files are required");

  const evaluation = record(evaluationSource.value, "evaluation");
  if (JSON.stringify(Object.keys(evaluation).sort()) !== JSON.stringify([...FIXTURE_ORDER].sort())) fail("evaluation fixture IDs are incomplete");
  const nativeDerivations = record(derivationsSource.value, "derivations");
  const drvMetadata = new Map(metadata.drvFiles.map((entry) => [entry.fixtureId, entry]));
  if (drvMetadata.size !== FIXTURE_ORDER.length || Object.keys(nativeDerivations).length !== FIXTURE_ORDER.length) fail("capture must contain nine unique derivations");
  const rawEvidence = [];
  const provisional = [];
  for (const fixtureId of FIXTURE_ORDER) {
    const evaluated = evaluation[fixtureId];
    exactKeys(evaluated, ["drv", "output"], `evaluation ${fixtureId}`);
    const raw = drvMetadata.get(fixtureId);
    if (!raw) fail(`missing raw derivation metadata for ${fixtureId}`);
    exactKeys(raw, ["bytes", "drvPath", "file", "fixtureId", "sha256"], `raw derivation ${fixtureId}`);
    if (raw.drvPath !== evaluated.drv || raw.file !== `drv/${path.basename(evaluated.drv)}`) fail(`raw derivation binding mismatch for ${fixtureId}`);
    const rawBytes = await readFile(path.join(captureRoot, raw.file));
    if (rawBytes.length !== raw.bytes || sha256(rawBytes) !== raw.sha256) fail(`raw derivation bytes differ for ${fixtureId}`);
    const native = verifyNativeDerivation(evaluated.drv, nativeDerivations[evaluated.drv], decode(rawBytes, `raw derivation ${fixtureId}`));
    if (native.outputs.out?.path !== evaluated.output || Object.keys(native.outputs).length !== 1) fail(`evaluation output mismatch for ${fixtureId}`);
    rawEvidence.push({ fixtureId, drvPath: evaluated.drv, file: `capture/${raw.file}`, bytes: raw.bytes, identity: `sha256:${raw.sha256}` });
    provisional.push({ fixtureId, drvPath: evaluated.drv, outputPath: evaluated.output, native, rawIdentity: `sha256:${raw.sha256}` });
  }

  const nativeOutput = structuredClone(record(nativeOutputSource.value, "native output"));
  exactKeys(nativeOutput, ["ca", "contentBytes", "contentSha256", "contentUtf8", "materialization", "narHash", "narSize", "path", "references"], "native output");
  const outputFixtureBytes = await readFile(path.join(fixturesRoot, "output.txt"));
  if (nativeOutput.materialization !== "nix-store-add-file" || nativeOutput.contentBytes !== outputFixtureBytes.length || nativeOutput.contentSha256 !== sha256(outputFixtureBytes) || nativeOutput.contentUtf8 !== decode(outputFixtureBytes, "fixture output")) fail("native output content evidence is inconsistent");
  if (!/^fixed:sha256:[0-9a-df-np-sv-z]{52}$/.test(nativeOutput.ca) || !/^sha256-[A-Za-z0-9+/]{43}=$/.test(nativeOutput.narHash) || !Array.isArray(nativeOutput.references) || nativeOutput.references.length !== 0) fail("native output path information is invalid");

  const pathToFixture = new Map(provisional.map((entry) => [entry.drvPath, entry.fixtureId]));
  const derivations = provisional.map((entry) => {
    const directInputDrvs = Object.entries(entry.native.inputDrvs).map(([drvPath, value]) => {
      const inputFixtureId = pathToFixture.get(drvPath);
      if (!inputFixtureId) fail(`${entry.fixtureId} references an uncaptured derivation ${drvPath}`);
      return { fixtureId: inputFixtureId, drvPath, outputs: [...value.outputs] };
    });
    const output = entry.native.outputs.out;
    const fixed = output.method === "flat" && output.hashAlgo === "sha256" && typeof output.hash === "string";
    if (fixed && (output.path !== nativeOutput.path || output.hash !== nativeOutput.contentSha256)) fail(`${entry.fixtureId} fixed output is not bound to native content evidence`);
    return {
      fixtureId: entry.fixtureId,
      drvPath: entry.drvPath,
      drvName: entry.native.name,
      rawIdentity: entry.rawIdentity,
      outputPath: entry.outputPath,
      outputAddressing: fixed ? "fixed-content:flat:sha256" : "input-addressed",
      outputContentIdentity: fixed ? `sha256:${nativeOutput.contentSha256}` : null,
      outputEvidence: fixed ? "materialized-fixed-output" : "unrealized",
      directInputDrvs,
      inputSrcs: [...entry.native.inputSrcs],
      system: entry.native.system,
      builder: entry.native.builder,
      args: [...entry.native.args],
      env: structuredClone(entry.native.env),
      native: entry.native
    };
  });
  const derivationIndex = new Map(derivations.map((entry) => [entry.drvPath, entry]));
  for (const derivation of derivations) {
    derivation.inputClosure = inputClosureProjection(derivation.drvPath, derivations);
    derivation.builderEnvironment = builderEnvironmentProjection(derivation);
    derivation.depth = depthOf(derivation.drvPath, derivationIndex);
  }

  const comparisons = EXPERIMENTS.map((experiment) => compareDerivations(experiment, derivations));
  const directEdges = derivations.flatMap((derivation) => derivation.directInputDrvs.map((input) => ({
    from: derivation.drvPath,
    to: input.drvPath,
    outputs: input.outputs,
    relation: "inputDrv",
    evidence: "native"
  }))).sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  const closureEdges = derivations.flatMap((derivation) => {
    const direct = new Set(derivation.directInputDrvs.map((input) => input.drvPath));
    return derivation.inputClosure.members.filter((drvPath) => !direct.has(drvPath)).map((drvPath) => ({
      from: derivation.drvPath,
      to: drvPath,
      relation: "transitive-inputDrv",
      evidence: "derived"
    }));
  }).sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  const outputMappings = derivations.map((derivation) => ({
    derivation: derivation.drvPath,
    output: "out",
    path: derivation.outputPath,
    addressing: derivation.outputAddressing,
    contentIdentity: derivation.outputContentIdentity,
    evidence: derivation.outputEvidence
  }));

  const captureFiles = [
    ["capture/metadata.json", metadataSource.bytes],
    ["capture/evaluation.json", evaluationSource.bytes],
    ["capture/derivations.json", derivationsSource.bytes],
    ["capture/native-output.json", nativeOutputSource.bytes]
  ].map(([file, bytes]) => ({ file, bytes: bytes.length, identity: hashArtifactBytes(bytes) }));
  const sourceBasis = {
    format: "onto2d-nix-source-basis",
    formatVersion: "1",
    runtime: metadata.runtime,
    sourceFiles: [...sourceFileRecords.values()],
    captureFiles,
    rawDerivations: rawEvidence
  };
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, sourceBasis);
  const basis = {
    format: "onto2d-nix-derivation-identity-case",
    formatVersion: "1",
    caseVersion: "nix-derivation-identity-v1",
    generatedBy: "cases/nix-derivation-identity/extract.mjs",
    source: { ...sourceBasis, identity: sourceIdentity },
    captureBoundary: structuredClone(metadata.executionBoundary),
    nix: {
      version: metadata.nixVersion,
      platform: metadata.platform,
      storeDirectory: metadata.storeDirectory,
      storeBackend: metadata.storeBackend,
      derivationJsonStatus: "experimental-in-nix-2.31.0"
    },
    regimes: IDENTITY_REGIMES,
    nativeOutput,
    derivations,
    dependencyGraph: { directEdges, closureEdges, outputMappings },
    comparisons,
    limitations: [
      "No derivation builder was executed in this capture.",
      "The fixed-output store object was materialized with nix store add-file, not by realizing either derivation.",
      "The input-addressed output is unrealized; its output-content and history-class comparisons are unresolved.",
      "The fixture does not claim generality across Nix versions, platforms, stores, or experimental content-addressed derivations.",
      "No Historical Load is defined because no complete counterfactual construction space or cost function is declared."
    ]
  };
  return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
}

async function main(argv) {
  const verify = argv.includes("--verify");
  if (argv.some((argument) => argument !== "--verify")) fail("only --verify is supported");
  const artifact = await buildNixDerivationCase();
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  if (verify) {
    let current;
    try {
      current = await readFile(DEFAULT_OUTPUT);
    } catch {
      fail(`missing committed artifact ${DEFAULT_OUTPUT}`);
    }
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
    console.error(error.message);
    process.exitCode = 1;
  });
}
