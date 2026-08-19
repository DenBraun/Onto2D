import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS = Object.freeze({
  endpoints: path.join(CASE_ROOT, "source", "fd001-endpoints.json"),
  histories: path.join(CASE_ROOT, "source", "fd001-flagship-histories.json")
});
const RAW_LOCKS = Object.freeze({
  "train_FD001.txt": Object.freeze({ sha256: "963b5e22825b34d8b21c69e1aeb4af3e647050eb672ee8834ba4b5d91d2de0f8", bytes: 3515356 }),
  "test_FD001.txt": Object.freeze({ sha256: "3cda7109ce17bafb5443f2ac926cfcf88154b941b8c4cf95eb55d1ddd6f52851", bytes: 2228855 }),
  "RUL_FD001.txt": Object.freeze({ sha256: "a19c8ec94931949d0485bdc35118206e9c81c4547b422efb9cf86f4ceddbceca", bytes: 429 }),
  "readme.txt": Object.freeze({ sha256: "4f5270554b775c67e73aff383c5436fd329d6e4cc3d3a116913276fae511269b", bytes: 2442 }),
  "Damage Propagation Modeling.pdf": Object.freeze({ sha256: "e7aaef80c177333f400a4c1099fe76e67d244569b9397c937ec4cd3ed5b44a27", bytes: 434158 })
});
const SENSOR_LABELS = Object.freeze(Array.from({ length: 21 }, (_, index) => `sensor${index + 1}`));
const INPUT_LABELS = Object.freeze(["setting1", "setting2", "setting3", ...SENSOR_LABELS]);
const FLAGSHIP_IDS = Object.freeze([25, 72]);

function fail(message) { throw new Error(`Operational Aging source preparation failed: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function serialize(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

async function lockedFile(sourceDir, name) {
  const content = await readFile(path.join(sourceDir, name));
  const expected = RAW_LOCKS[name];
  const actual = { sha256: sha256(content), bytes: content.length };
  if (!same(actual, expected)) fail(`${name} differs from the exact NASA archive member`);
  return { name, content, ...actual };
}

function parseTable(input) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(input.content).trim();
  const rows = text.split(/\n/).map((line, index) => {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length !== 26 || tokens.some((token) => !/^-?(?:\d+|\d*\.\d+)$/.test(token))) fail(`${input.name}:${index + 1} is not a 26-column decimal row`);
    const values = tokens.map(Number);
    if (values.some((value) => !Number.isFinite(value))) fail(`${input.name}:${index + 1} contains a non-finite value`);
    if (!Number.isSafeInteger(values[0]) || !Number.isSafeInteger(values[1]) || values[0] < 1 || values[1] < 1) fail(`${input.name}:${index + 1} has an invalid unit or cycle`);
    return values;
  });
  return rows;
}

function groupRows(rows, label) {
  const units = new Map();
  for (const row of rows) {
    if (!units.has(row[0])) units.set(row[0], []);
    units.get(row[0]).push(row);
  }
  if (!same([...units.keys()], Array.from({ length: 100 }, (_, index) => index + 1))) fail(`${label} unit IDs differ`);
  for (const [unitId, sequence] of units) {
    if (sequence.some((row, index) => row[1] !== index + 1)) fail(`${label} unit ${unitId} cycles are not contiguous and ordered`);
  }
  return units;
}

function parseRul(input) {
  const tokens = new TextDecoder("utf-8", { fatal: true }).decode(input.content).trim().split(/\s+/);
  const values = tokens.map(Number);
  if (values.length !== 100 || values.some((value) => !Number.isSafeInteger(value) || value < 0)) fail("RUL_FD001.txt is not the expected 100-value non-negative vector");
  return values;
}

function rowProjection(row) {
  return { cycle: row[1], settings: row.slice(2, 5), sensors: row.slice(5, 26) };
}

function meanProjection(rows) {
  const means = Array.from({ length: 24 }, (_, index) => rows.reduce((total, row) => total + row[index + 2], 0) / rows.length);
  return { settings: means.slice(0, 3), sensors: means.slice(3) };
}

function sourceFile(input, role) {
  return { role, name: input.name, sha256: input.sha256, bytes: input.bytes };
}

function trainingRanges(rows) {
  return INPUT_LABELS.map((label, index) => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const row of rows) {
      const value = row[index + 2];
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    return { label, sourceColumn: index + 3, minimum, maximum, activeInDistance: maximum > minimum, exclusionReason: maximum > minimum ? null : "zero-training-range" };
  });
}

export async function buildFd001SourceProjections(sourceDir) {
  if (typeof sourceDir !== "string" || sourceDir.length === 0 || !path.isAbsolute(sourceDir)) fail("--source-dir must be an absolute path");
  const inputs = Object.fromEntries(await Promise.all(Object.keys(RAW_LOCKS).map(async (name) => [name, await lockedFile(sourceDir, name)])));
  const trainRows = parseTable(inputs["train_FD001.txt"]);
  const testRows = parseTable(inputs["test_FD001.txt"]);
  const trainUnits = groupRows(trainRows, "training");
  const testUnits = groupRows(testRows, "test");
  const rul = parseRul(inputs["RUL_FD001.txt"]);
  if (trainRows.length !== 20631 || testRows.length !== 13096) fail("FD001 row census differs");
  const ranges = trainingRanges(trainRows);
  if (ranges.filter((range) => range.activeInDistance).length !== 17) fail("FD001 active-distance dimension count differs");
  const sourceFiles = [
    sourceFile(inputs["train_FD001.txt"], "training-trajectories"),
    sourceFile(inputs["test_FD001.txt"], "test-trajectories"),
    sourceFile(inputs["RUL_FD001.txt"], "test-rul-vector"),
    sourceFile(inputs["readme.txt"], "dataset-documentation"),
    sourceFile(inputs["Damage Propagation Modeling.pdf"], "method-paper")
  ];
  const endpoints = {
    format: "onto2d-cmapss-fd001-endpoint-projection",
    formatVersion: "1",
    sourceFiles,
    columns: { unit: 1, cycle: 2, settings: [3, 4, 5], sensors: Array.from({ length: 21 }, (_, index) => index + 6), sensorLabels: SENSOR_LABELS },
    corpus: {
      dataset: "FD001",
      operatingConditionCount: 1,
      operatingConditionLabel: "Sea Level",
      faultModeCount: 1,
      faultModeLabel: "HPC Degradation",
      trainUnitCount: trainUnits.size,
      trainRowCount: trainRows.length,
      trainMaximumCycle: Math.max(...[...trainUnits.values()].map((rows) => rows.at(-1)[1])),
      trainingEndsAtFailureThreshold: true,
      testUnitCount: testUnits.size,
      testRowCount: testRows.length,
      testMaximumObservedCycle: Math.max(...[...testUnits.values()].map((rows) => rows.at(-1)[1])),
      testEndsBeforeFailureThreshold: true,
      providedRulCount: rul.length,
      providedRulMinimum: Math.min(...rul),
      providedRulMaximum: Math.max(...rul)
    },
    normalization: {
      source: "training-trajectories-only",
      method: "per-dimension training min-max",
      dimensions: ranges,
      activeDimensionCount: ranges.filter((range) => range.activeInDistance).length,
      zeroRangeDimensionCount: ranges.filter((range) => !range.activeInDistance).length
    },
    endpoints: [...testUnits].map(([unitId, rows]) => ({ unitId, ...rowProjection(rows.at(-1)), observedCycleCount: rows.length, providedRul: rul[unitId - 1], providedRulRole: "held-out-outcome-only", historyDescriptors: { last20ObservedMean: meanProjection(rows.slice(-20)), fullObservedMean: meanProjection(rows) } })),
    evidenceBoundary: {
      currentFrameFields: ["settings", "sensors"],
      excludedFromDistance: ["unitId", "cycle", "observedCycleCount", "providedRul"],
      providedRulUsedAsInput: false,
      futureTestRowsAvailable: false,
      latentHealthObserved: false
    }
  };
  const histories = {
    format: "onto2d-cmapss-fd001-flagship-history-projection",
    formatVersion: "1",
    sourceFiles: [sourceFile(inputs["test_FD001.txt"], "test-trajectories"), sourceFile(inputs["RUL_FD001.txt"], "test-rul-vector")],
    selection: {
      profile: "nearest-five-percent-max-rul-separation-v1",
      pairUniverseSize: 4950,
      eligiblePairCount: 247,
      eligibleFraction: 0.05,
      selectedUnitIds: FLAGSHIP_IDS,
      selectionUsesProvidedRulOutcome: true,
      selectionBiased: true
    },
    histories: FLAGSHIP_IDS.map((unitId) => ({ unitId, observedCycleCount: testUnits.get(unitId).length, providedRul: rul[unitId - 1], providedRulRole: "held-out-outcome-only", rows: testUnits.get(unitId).map(rowProjection) })),
    evidenceBoundary: {
      rowsContainOnlyObservedPrefix: true,
      futureCyclesSynthesized: false,
      latentHealthObserved: false,
      predictionIncluded: false
    }
  };
  return { endpoints, histories };
}

export async function run({ sourceDir, verify = false } = {}) {
  const projections = await buildFd001SourceProjections(sourceDir);
  for (const [key, output] of Object.entries(OUTPUTS)) {
    const expected = serialize(projections[key]);
    if (verify) {
      if (await readFile(output, "utf8") !== expected) fail(`${path.basename(output)} does not reproduce`);
    } else {
      await writeFile(output, expected);
    }
  }
  console.log(`${verify ? "Verified" : "Prepared"} FD001 source projections: ${projections.endpoints.endpoints.length} endpoints and ${projections.histories.histories.reduce((total, history) => total + history.rows.length, 0)} flagship history rows.`);
  return projections;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source-dir");
  const sourceDir = sourceIndex >= 0 ? args[sourceIndex + 1] : null;
  const allowed = new Set(["--source-dir", sourceDir, "--verify"]);
  const unknown = args.find((argument) => !allowed.has(argument));
  if (!sourceDir || unknown) { console.error("Usage: node prepare-source.mjs --source-dir /absolute/extracted/CMAPSSData [--verify]"); process.exitCode = 2; }
  else run({ sourceDir, verify: args.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
