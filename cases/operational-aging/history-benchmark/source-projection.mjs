import { createHash } from "node:crypto";
import { normalizeRegressionDataset, normalizeRegressionTargets } from "../../../packages/history-benchmark/src/predictive.js";

function fail(message) { throw new Error(`FD001 benchmark source: ${message}`); }
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const hash = (value) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
export const featureNames = Object.freeze(["setting1", "setting2", "setting3", ...Array.from({ length: 21 }, (_, i) => `sensor${i + 1}`)]);

export function parseFd001Observations(bytes, label) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  if (!text) fail(`${label} is empty`);
  const units = new Map();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length !== 26 || tokens.some((v) => !/^-?\d+(?:\.\d+)?$/.test(v))) fail(`${label} row ${index + 1} is not a 26-column decimal row`);
    const row = tokens.map(Number);
    if (row.some((v) => !Number.isFinite(v)) || !Number.isSafeInteger(row[0]) || row[0] < 1 || !Number.isSafeInteger(row[1]) || row[1] < 1) fail(`${label} has invalid numeric IDs or values`);
    if (!units.has(row[0])) units.set(row[0], []);
    units.get(row[0]).push(row);
  }
  const ids = [...units.keys()];
  if (!same(ids, Array.from({ length: ids.length }, (_, i) => i + 1))) fail(`${label} unit order or census is incomplete`);
  for (const [id, rows] of units) if (rows.some((row, index) => row[1] !== index + 1)) fail(`${label}/${id} has a gap or reordered cycle`);
  return units;
}

function sample(split, nativeId, rows, cutoff, window) {
  const history = rows.slice(Math.max(0, cutoff - 1 - window), cutoff - 1);
  if (!history.length) fail("empty prior history");
  const unitId = `fd001:${split}:${String(nativeId).padStart(3, "0")}`;
  return {
    sampleId: `${unitId}:${String(cutoff).padStart(4, "0")}`, unitId, split, cutoff, presentTime: cutoff,
    historyStart: history[0][1], historyEnd: history.at(-1)[1], present: rows[cutoff - 1].slice(2),
    history: featureNames.map((_, i) => history.reduce((sum, row) => sum + row[i + 2], 0) / history.length),
    recordHash: hash(rows.slice(0, cutoff).map((row) => row.slice(1)))
  };
}

/** No test RUL argument and no target table is available to this projection. */
export function projectFd001Observations(trainUnits, testUnits, protocol) {
  const { trainingFirstCutoff: start, trainingCutoffStep: step, historyWindow: window } = protocol.selection;
  if (![start, step, window].every((v) => Number.isSafeInteger(v) && v > 0) || start < 2) fail("invalid cutoff/window policy");
  const samples = [];
  for (const [id, rows] of trainUnits) {
    if (start >= rows.length) fail(`training unit ${id} has no eligible prefix under the declared cutoff policy`);
    for (let cutoff = start; cutoff < rows.length; cutoff += step) samples.push(sample("train", id, rows, cutoff, window));
  }
  for (const [id, rows] of testUnits) samples.push(sample("test", id, rows, rows.length, window));
  return normalizeRegressionDataset({ schemaVersion: "1", presentFeatures: featureNames, historyFeatures: featureNames.map((name) => `priorMean:${name}`), samples });
}

/** Supervised training outcomes join only after observation features are frozen. */
export function buildFd001TrainingTargets(trainUnits, dataset) {
  return normalizeRegressionTargets({ schemaVersion: "1", records: dataset.samples.filter((row) => row.split === "train").map((row) => {
    const nativeId = Number(row.unitId.split(":").at(-1));
    return { sampleId: row.sampleId, value: trainUnits.get(nativeId).length - row.cutoff };
  }) });
}
