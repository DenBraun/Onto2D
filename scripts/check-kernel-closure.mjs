import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  KERNEL_CAPABILITIES,
  KERNEL_IMPLEMENTATION_STATUS
} from "../packages/kernel/src/index.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE_PATH = path.join(
  REPOSITORY_ROOT,
  "test",
  "fixtures",
  "kernel-closure-gate-v1.json"
);
const CAPABILITY_EVIDENCE_PATH = "test/fixtures/kernel-capability-evidence-v1.json";
const REQUIRED_FIXTURE_PATHS = Object.freeze([
  "test/fixtures/canonical-conformance-v1.json",
  "test/fixtures/skeleton-conformance-v1.json"
]);
const REQUIRED_CI_OPERATING_SYSTEMS = Object.freeze([
  "ubuntu-latest",
  "macos-latest",
  "windows-latest"
]);
const REQUIRED_CI_NODE_VERSIONS = Object.freeze([20, 22]);
const REQUIRED_CI_COMMANDS = Object.freeze([
  "npm test",
  "npm run check",
  "npm run build"
]);
const REQUIRED_GOLDEN_VERIFICATION_COMMAND = "npm run check:goldens";
const REQUIRED_GOLDEN_VERIFICATION_SCRIPT =
  "python3 scripts/reference/generate-conformance-fixtures.py --verify";

function fail(message) {
  throw new Error(`Kernel closure check failed: ${message}`);
}

function requireExactArray(actual, expected, label) {
  if (
    actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])
  ) {
    fail(`${label} differs from the frozen closure contract`);
  }
}

function yamlInlineList(values) {
  return `[${values.join(", ")}]`;
}

async function collectTestSuites(directory) {
  const suites = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) suites.push(...await collectTestSuites(absolutePath));
    if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      suites.push(path.relative(REPOSITORY_ROOT, absolutePath));
    }
  }
  return suites;
}

export async function run() {
  const gate = JSON.parse(await readFile(GATE_PATH, "utf8"));
  if (gate.schemaVersion !== "1" || gate.gate !== "schema-v1-kernel-release-closure") {
    fail("the closure contract identity is invalid");
  }

  const implementation = gate.implementation;
  if (implementation?.localStatus !== "closed") {
    fail("the local implementation status is not closed");
  }
  const statusTokens = KERNEL_IMPLEMENTATION_STATUS.split("/");
  if (statusTokens.at(-1) !== implementation.statusTokenSuffix) {
    fail("the public implementation status does not end in the closure token");
  }
  if (
    !Object.isFrozen(KERNEL_CAPABILITIES)
    || !Object.isFrozen(KERNEL_CAPABILITIES.implemented)
    || !Object.isFrozen(KERNEL_CAPABILITIES.pending)
  ) {
    fail("the public capability registry is mutable");
  }
  requireExactArray(
    KERNEL_CAPABILITIES.pending,
    implementation.expectedPendingCapabilities,
    "pending capabilities"
  );
  if (
    KERNEL_CAPABILITIES.implemented.length
    !== implementation.expectedImplementedCapabilityCount
  ) {
    fail("the implemented capability count changed without closure-contract review");
  }
  if (
    new Set(KERNEL_CAPABILITIES.implemented).size
    !== KERNEL_CAPABILITIES.implemented.length
  ) {
    fail("the implemented capability registry contains duplicates");
  }
  if (KERNEL_CAPABILITIES.implemented.some(
    (capability) => typeof capability !== "string" || capability.length === 0
  )) {
    fail("the implemented capability registry contains an invalid name");
  }

  if (gate.capabilityEvidenceManifest !== CAPABILITY_EVIDENCE_PATH) {
    fail("the capability-evidence manifest path differs from the closure contract");
  }
  const capabilityEvidence = JSON.parse(await readFile(
    path.join(REPOSITORY_ROOT, CAPABILITY_EVIDENCE_PATH),
    "utf8"
  ));
  if (
    capabilityEvidence.schemaVersion !== "1"
    || capabilityEvidence.coverage
      !== "every-published-schema-v1-kernel-capability"
  ) {
    fail("the capability-evidence manifest identity is invalid");
  }
  if (
    capabilityEvidence.expectedCapabilityCount
    !== KERNEL_CAPABILITIES.implemented.length
  ) {
    fail("the capability-evidence manifest has a stale capability count");
  }
  const mappedCapabilities = [];
  const mappedSuites = new Set();
  let mappedTestCount = 0;
  for (const suite of capabilityEvidence.suites ?? []) {
    if (
      typeof suite.path !== "string"
      || !suite.path.startsWith("packages/kernel/test/")
      || !suite.path.endsWith(".test.mjs")
      || mappedSuites.has(suite.path)
    ) {
      fail(`invalid or duplicate capability-evidence suite: ${suite.path}`);
    }
    mappedSuites.add(suite.path);
    const suiteSource = await readFile(path.join(REPOSITORY_ROOT, suite.path), "utf8");
    const actualTestCount = suiteSource.match(/^test\(/gm)?.length ?? 0;
    if (
      !Number.isSafeInteger(suite.testCount)
      || suite.testCount <= 0
      || actualTestCount !== suite.testCount
    ) {
      fail(`test count drift in capability-evidence suite: ${suite.path}`);
    }
    if (!Array.isArray(suite.capabilities) || suite.capabilities.length === 0) {
      fail(`capability-evidence suite has no mapped capability: ${suite.path}`);
    }
    mappedTestCount += actualTestCount;
    mappedCapabilities.push(...suite.capabilities);
  }
  const behavioralKernelSuites = (await collectTestSuites(path.join(
    REPOSITORY_ROOT,
    "packages",
    "kernel",
    "test"
  ))).filter((suite) => suite !== "packages/kernel/test/contracts.test.mjs").sort();
  requireExactArray(
    [...mappedSuites].sort(),
    behavioralKernelSuites,
    "behavioral kernel evidence suites"
  );
  if (mappedTestCount !== capabilityEvidence.expectedMappedTestCount) {
    fail("the capability-evidence test count differs from its frozen total");
  }
  const mappedCapabilitySet = new Set(mappedCapabilities);
  if (mappedCapabilitySet.size !== mappedCapabilities.length) {
    fail("a published capability is mapped to more than one primary evidence suite");
  }
  const missingCapabilities = KERNEL_CAPABILITIES.implemented.filter(
    (capability) => !mappedCapabilitySet.has(capability)
  );
  const unknownCapabilities = mappedCapabilities.filter(
    (capability) => !KERNEL_CAPABILITIES.implemented.includes(capability)
  );
  if (missingCapabilities.length > 0 || unknownCapabilities.length > 0) {
    fail(
      "capability-evidence coverage differs from the public registry: "
      + `missing=${missingCapabilities.join(",") || "none"}; `
      + `unknown=${unknownCapabilities.join(",") || "none"}`
    );
  }

  const fixtures = gate.independentConformanceFixtures ?? [];
  requireExactArray(
    fixtures.map((fixture) => fixture.path),
    REQUIRED_FIXTURE_PATHS,
    "independent conformance fixtures"
  );
  for (const fixture of fixtures) {
    const absolutePath = path.resolve(REPOSITORY_ROOT, fixture.path);
    if (
      absolutePath !== REPOSITORY_ROOT
      && !absolutePath.startsWith(`${REPOSITORY_ROOT}${path.sep}`)
    ) {
      fail(`fixture path escapes the repository: ${fixture.path}`);
    }
    const digest = createHash("sha256")
      .update(await readFile(absolutePath))
      .digest("hex");
    if (digest !== fixture.sha256) {
      fail(`independent fixture drift: ${fixture.path}`);
    }
  }

  const workflow = await readFile(
    path.join(REPOSITORY_ROOT, ".github", "workflows", "ci.yml"),
    "utf8"
  );
  const ci = gate.requiredCiMatrix;
  requireExactArray(
    ci.operatingSystems,
    REQUIRED_CI_OPERATING_SYSTEMS,
    "required CI operating systems"
  );
  requireExactArray(
    ci.nodeVersions,
    REQUIRED_CI_NODE_VERSIONS,
    "required CI Node.js versions"
  );
  requireExactArray(ci.commands, REQUIRED_CI_COMMANDS, "required CI commands");
  if (!workflow.includes(`os: ${yamlInlineList(ci.operatingSystems)}`)) {
    fail("CI operating-system matrix differs from the closure contract");
  }
  if (!workflow.includes(`node-version: ${yamlInlineList(ci.nodeVersions)}`)) {
    fail("CI Node.js matrix differs from the closure contract");
  }
  for (const command of ci.commands) {
    if (!workflow.includes(`run: ${command}`)) {
      fail(`CI does not execute required command: ${command}`);
    }
  }
  if (ci.evidenceStatus !== "required") {
    fail("cross-platform CI evidence must remain required");
  }
  if (
    gate.independentReview?.canonicalFixtures !== "required"
    || gate.independentReview.verificationCommand
      !== REQUIRED_GOLDEN_VERIFICATION_COMMAND
  ) {
    fail("independent canonical-fixture review must remain required");
  }
  const packageManifest = JSON.parse(await readFile(
    path.join(REPOSITORY_ROOT, "package.json"),
    "utf8"
  ));
  if (
    packageManifest.scripts?.["check:goldens"]
    !== REQUIRED_GOLDEN_VERIFICATION_SCRIPT
  ) {
    fail("the non-mutating independent golden verification command is missing");
  }
  if (
    gate.postClosureVisualization?.gate !== "POST-CLOSURE-VIS-01"
    || gate.postClosureVisualization.required !== true
    || gate.postClosureVisualization.phase !== "after-release-acceptance"
  ) {
    fail("the mandatory post-closure visualization gate is missing or weakened");
  }

  console.log(
    `Kernel closure contract passed: ${KERNEL_CAPABILITIES.implemented.length} implemented, `
    + `${KERNEL_CAPABILITIES.pending.length} pending, ${mappedTestCount} mapped kernel tests; `
    + "external CI/review evidence remains required."
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
