import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_EXPRESSION = path.join(CASE_ROOT, "fixtures", "fixture.nix");
const FIXTURE_OUTPUT = path.join(CASE_ROOT, "fixtures", "output.txt");
const CAPTURE_ROOT = path.join(CASE_ROOT, "capture");
const EXPECTED_NIX_VERSION = "nix (Nix) 2.31.0";
const RELEASE_URL = "https://releases.nixos.org/nix/nix-2.31.0/nix-2.31.0-aarch64-darwin.tar.xz";
const RELEASE_SHA256 = "914c81dd92b26a5d73dfb9e9e3629bfea108668efefd80d3d42553e4a76b4424";
const EVALUATION_APPLY = "fixtures: builtins.mapAttrs (_: value: { drv = value.drvPath; output = value.outPath; }) fixtures";

function fail(message) {
  throw new Error(`Nix fixture capture failed: ${message}`);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(stableJson(value), null, 2)}\n`, "utf8");
}

function parseArguments(argv) {
  const options = { verify: false, nixBinary: process.env.ONTO2D_NIX_BIN ?? "nix", libraryPath: process.env.ONTO2D_NIX_LIBRARY_PATH ?? null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify") options.verify = true;
    else if (argument === "--nix") options.nixBinary = argv[++index];
    else if (argument === "--library-path") options.libraryPath = argv[++index];
    else fail(`unknown argument ${argument}`);
  }
  if (typeof options.nixBinary !== "string" || options.nixBinary.length === 0) fail("--nix requires a path");
  if (options.libraryPath !== null && (typeof options.libraryPath !== "string" || options.libraryPath.length === 0)) fail("--library-path requires a path");
  return Object.freeze(options);
}

function run(binary, args, environment, label) {
  const result = spawnSync(binary, args, {
    cwd: CASE_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: environment
  });
  if (result.error) fail(`${label} could not execute ${binary}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited ${result.status}: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} did not return JSON`);
  }
}

function requireEvaluation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("evaluation must be an object");
  const expected = [
    "environmentBase",
    "environmentMutated",
    "flagshipLeft",
    "flagshipRight",
    "inputAddressed",
    "leftInput",
    "rightInput",
    "sharedInput",
    "sharedLeaf"
  ];
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected)) fail("evaluation fixture set is incomplete");
  for (const [fixtureId, record] of Object.entries(value)) {
    if (!record || Object.keys(record).sort().join(",") !== "drv,output") fail(`${fixtureId} evaluation fields are invalid`);
    if (!/^\/nix\/store\/[0-9a-df-np-sv-z]{32}-[A-Za-z0-9+._?=-]+\.drv$/.test(record.drv)) fail(`${fixtureId} drv path is invalid`);
    if (!/^\/nix\/store\/[0-9a-df-np-sv-z]{32}-[A-Za-z0-9+._?=-]+$/.test(record.output)) fail(`${fixtureId} output path is invalid`);
  }
  return value;
}

async function materializeFiles(outputs, verify) {
  if (verify) {
    for (const [relative, bytes] of outputs) {
      const target = path.join(CAPTURE_ROOT, relative);
      let current;
      try {
        current = await readFile(target);
      } catch {
        fail(`missing committed capture ${relative}`);
      }
      if (!current.equals(bytes)) fail(`committed capture differs: ${relative}`);
    }
    return;
  }

  const stagingRoot = await mkdtemp(path.join(CASE_ROOT, ".capture-stage-"));
  let stagingOwned = true;
  let backupRoot = null;
  try {
    for (const [relative, bytes] of outputs) {
      const target = path.join(stagingRoot, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }

    const backupCandidate = await mkdtemp(path.join(CASE_ROOT, ".capture-backup-"));
    await rm(backupCandidate, { recursive: true, force: true });
    try {
      await rename(CAPTURE_ROOT, backupCandidate);
      backupRoot = backupCandidate;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await rename(stagingRoot, CAPTURE_ROOT);
      stagingOwned = false;
    } catch (installError) {
      if (backupRoot) {
        try {
          await rename(backupRoot, CAPTURE_ROOT);
          backupRoot = null;
        } catch (restoreError) {
          throw new AggregateError([installError, restoreError], "capture replacement and rollback both failed");
        }
      }
      throw installError;
    }
    if (backupRoot) {
      await rm(backupRoot, { recursive: true, force: true });
      backupRoot = null;
    }
  } finally {
    if (stagingOwned) await rm(stagingRoot, { recursive: true, force: true });
  }
}

export async function captureNixFixture(optionsInput = {}) {
  const options = Object.freeze({
    verify: optionsInput.verify === true,
    nixBinary: optionsInput.nixBinary ?? process.env.ONTO2D_NIX_BIN ?? "nix",
    libraryPath: optionsInput.libraryPath ?? process.env.ONTO2D_NIX_LIBRARY_PATH ?? null
  });
  const temporaryRoot = await realpath(os.tmpdir());
  const storeRoot = await mkdtemp(path.join(temporaryRoot, "onto2d-nix-capture-"));
  const cacheRoot = path.join(storeRoot, "cache");
  const environment = {
    ...process.env,
    XDG_CACHE_HOME: cacheRoot,
    NIX_CONFIG: "experimental-features = nix-command\nsubstituters =\nconnect-timeout = 1"
  };
  if (options.libraryPath) environment.DYLD_LIBRARY_PATH = options.libraryPath;
  const storeArgs = ["--store", `local?root=${storeRoot}`];
  try {
    const version = run(options.nixBinary, ["--version"], environment, "version probe");
    if (version !== EXPECTED_NIX_VERSION) fail(`expected ${EXPECTED_NIX_VERSION}, received ${version}`);

    const expressionBytes = await readFile(FIXTURE_EXPRESSION);
    const outputBytes = await readFile(FIXTURE_OUTPUT);
    const evaluation = requireEvaluation(parseJson(run(options.nixBinary, [
      ...storeArgs,
      "eval",
      "--impure",
      "--json",
      "--file",
      FIXTURE_EXPRESSION,
      "--apply",
      EVALUATION_APPLY
    ], environment, "fixture evaluation"), "fixture evaluation"));

    const drvPaths = Object.values(evaluation).map((record) => record.drv).sort();
    const derivations = parseJson(run(options.nixBinary, [
      ...storeArgs,
      "derivation",
      "show",
      "--recursive",
      ...drvPaths
    ], environment, "derivation capture"), "derivation capture");
    if (Object.keys(derivations).length !== 9) fail("recursive derivation capture must contain exactly nine records");

    const nativeOutputPath = run(options.nixBinary, [
      ...storeArgs,
      "store",
      "add-file",
      "--name",
      "onto2d-identical-output",
      FIXTURE_OUTPUT
    ], environment, "fixed-output materialization");
    const fixedFixtures = ["flagshipLeft", "flagshipRight", "environmentBase", "environmentMutated"];
    if (fixedFixtures.some((fixtureId) => evaluation[fixtureId].output !== nativeOutputPath)) {
      fail("fixed-output derivations do not resolve to the materialized content-addressed path");
    }
    if (evaluation.inputAddressed.output === nativeOutputPath) fail("input-addressed control unexpectedly shares the content-addressed output path");

    const rawPathInfo = parseJson(run(options.nixBinary, [
      ...storeArgs,
      "path-info",
      "--json",
      nativeOutputPath
    ], environment, "native output inspection"), "native output inspection");
    const rawNative = rawPathInfo[nativeOutputPath];
    if (!rawNative || typeof rawNative.ca !== "string" || typeof rawNative.narHash !== "string") fail("native output path-info is incomplete");
    const nativeOutput = {
      path: nativeOutputPath,
      contentBytes: outputBytes.length,
      contentSha256: digest(outputBytes),
      contentUtf8: outputBytes.toString("utf8"),
      ca: rawNative.ca,
      narHash: rawNative.narHash,
      narSize: rawNative.narSize,
      references: rawNative.references,
      materialization: "nix-store-add-file"
    };

    const rawRecords = [];
    const outputs = new Map([
      ["evaluation.json", jsonBytes(evaluation)],
      ["derivations.json", jsonBytes(derivations)],
      ["native-output.json", jsonBytes(nativeOutput)]
    ]);
    for (const [fixtureId, evaluationRecord] of Object.entries(evaluation)) {
      const physicalPath = path.join(storeRoot, evaluationRecord.drv);
      const bytes = await readFile(physicalPath);
      const file = `drv/${path.basename(evaluationRecord.drv)}`;
      rawRecords.push({ fixtureId, drvPath: evaluationRecord.drv, file, bytes: bytes.length, sha256: digest(bytes) });
      outputs.set(file, bytes);
    }
    rawRecords.sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
    const metadata = {
      format: "onto2d-nix-native-capture",
      formatVersion: "1",
      nixVersion: "2.31.0",
      platform: "aarch64-darwin",
      storeDirectory: "/nix/store",
      storeBackend: "local-root-remapped",
      runtime: { releaseUrl: RELEASE_URL, archiveSha256: RELEASE_SHA256 },
      sourceFiles: [
        { file: "fixtures/fixture.nix", bytes: expressionBytes.length, sha256: digest(expressionBytes) },
        { file: "fixtures/output.txt", bytes: outputBytes.length, sha256: digest(outputBytes) }
      ],
      drvFiles: rawRecords,
      executionBoundary: {
        derivationsInstantiatedByNix: true,
        fixedOutputAddedByNix: true,
        derivationBuildersExecuted: false,
        inputAddressedOutputRealized: false
      }
    };
    outputs.set("metadata.json", jsonBytes(metadata));
    await materializeFiles([...outputs], options.verify);
    return Object.freeze({ metadata, evaluation, derivations, nativeOutput });
  } finally {
    await rm(storeRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  captureNixFixture(options).then(() => {
    console.log(`${options.verify ? "Verified" : "Captured"} ${CAPTURE_ROOT}`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
