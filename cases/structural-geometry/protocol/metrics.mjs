// Prospective DREAM4 target and rank-metric contracts. This module does not fit
// a model, select a scope or evaluate a biological dataset.
export const MAX_RANK_VALUES = 1024;
export const TARGET_PROFILE_ID = "dream4-off-target-absolute-rank-v1";
const GENES = Object.freeze(Array.from({ length: 10 }, (_, index) => `G${index + 1}`));
const ALIGNMENT_MEMBER = "DREAM4/inst/scripts/buildRData.R";

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function denseArray(value, label, maximum = MAX_RANK_VALUES) {
  if (!Array.isArray(value) || value.length > maximum || Object.getOwnPropertySymbols(value).length ||
      Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index))) {
    throw new Error(`${label} must be a bounded dense array without extra fields.`);
  }
  return value;
}

function finiteValues(values, label) {
  denseArray(values, label);
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${label} must contain finite numeric observations; missing values are not coerced.`);
  }
  return values;
}

function closed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getOwnPropertySymbols(value).length ||
      Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
    throw new Error(`Expected a closed ${label}.`);
  }
}

/** One-based average ranks, with ties determined by exact numeric equality. */
export function averageRanks(values) {
  finiteValues(values, "Rank values");
  const order = values.map((value, index) => ({ value, index }))
    .sort((left, right) => left.value < right.value ? -1 : left.value > right.value ? 1 : left.index - right.index);
  const ranks = new Array(values.length);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && order[end].value === order[start].value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[order[index].index] = rank;
    start = end;
  }
  return Object.freeze(ranks);
}

/** Pairwise rank skill, Spearman rho and Kendall tau-b; no undefined-to-zero coercion. */
export function rankMetrics(predicted, observed) {
  finiteValues(predicted, "Predicted values");
  finiteValues(observed, "Observed values");
  if (predicted.length !== observed.length) throw new Error("Rank metric populations must align exactly.");
  const count = predicted.length;
  const x = averageRanks(predicted).map(rank => BigInt(2 * rank - count - 1));
  const y = averageRanks(observed).map(rank => BigInt(2 * rank - count - 1));
  let numerator = 0n, predictedSumSquares = 0n, observedSumSquares = 0n;
  for (let index = 0; index < count; index += 1) {
    numerator += x[index] * y[index];
    predictedSumSquares += x[index] * x[index];
    observedSumSquares += y[index] * y[index];
  }
  const denominatorSquared = predictedSumSquares * observedSumSquares;
  const reason = count < 2 ? "too-few-observations" :
    predictedSumSquares === 0n && observedSumSquares === 0n ? "constant-prediction-and-observation" :
      predictedSumSquares === 0n ? "constant-prediction" : observedSumSquares === 0n ? "constant-observation" : null;
  let concordant = 0, discordant = 0, tiedPredictedOnly = 0, tiedObservedOnly = 0, tiedBoth = 0;
  for (let first = 0; first < count; first += 1) for (let second = first + 1; second < count; second += 1) {
    const dx = predicted[first] < predicted[second] ? -1 : predicted[first] > predicted[second] ? 1 : 0;
    const dy = observed[first] < observed[second] ? -1 : observed[first] > observed[second] ? 1 : 0;
    if (dx === 0 && dy === 0) tiedBoth += 1;
    else if (dx === 0) tiedPredictedOnly += 1;
    else if (dy === 0) tiedObservedOnly += 1;
    else if (dx === dy) concordant += 1;
    else discordant += 1;
  }
  const kendallNumerator = BigInt(concordant - discordant);
  const kendallDenominatorSquared = BigInt(concordant + discordant + tiedPredictedOnly) *
    BigInt(concordant + discordant + tiedObservedOnly);
  const skillDenominator = concordant + discordant + tiedPredictedOnly;
  const skillReason = count < 2 ? "too-few-observations" : skillDenominator === 0 ? "constant-observed" : null;
  return freeze({
    count,
    rankSkill: { value: skillReason === null ? (concordant - discordant) / skillDenominator : null,
      reason: skillReason, numerator: String(concordant - discordant), denominator: String(skillDenominator) },
    spearman: { value: reason === null ? Number(numerator) / Math.sqrt(Number(denominatorSquared)) : null,
      reason, numerator: String(numerator), predictedSumSquares: String(predictedSumSquares),
      observedSumSquares: String(observedSumSquares), denominatorSquared: String(denominatorSquared),
      exactComponents: "centered-doubled-average-ranks" },
    kendallTauB: { value: reason === null ? Number(kendallNumerator) / Math.sqrt(Number(kendallDenominatorSquared)) : null,
      reason, concordant, discordant, tiedPredictedOnly, tiedObservedOnly, tiedBoth,
      numerator: String(kendallNumerator), denominatorSquared: String(kendallDenominatorSquared) }
  });
}

function sourceTable(unit, name, rowCount) {
  const table = unit.tables[name];
  const fields = ["columns", "values", "nativeLines", "rowCount", "columnCount", "role", "sourceMember", "sourceSha256"];
  if (name !== "wildtype") fields.push("interventions", "alignmentEvidenceMember");
  closed(table, fields, `${name} native table`);
  denseArray(table.columns, "Native columns", 10);
  if (table.columns.length !== 10 || table.columns.some((gene, index) => gene !== GENES[index]) ||
      table.rowCount !== rowCount || table.columnCount !== 10) throw new Error("Native DREAM4 table shape or gene order changed.");
  denseArray(table.values, "Native expression rows", rowCount);
  denseArray(table.nativeLines, "Native line identities", rowCount);
  if (table.values.length !== rowCount || table.nativeLines.length !== rowCount ||
      table.nativeLines.some((line, index) => !Number.isSafeInteger(line) || line < 2 || (index && line <= table.nativeLines[index - 1]))) {
    throw new Error("Native DREAM4 row and line identities must be complete and ordered.");
  }
  for (const row of table.values) {
    finiteValues(row, "Native expression values");
    if (row.length !== 10) throw new Error("Native DREAM4 expression columns must align exactly.");
  }
  const member = `lightlyProcessedDownloadedData/${unit.id}/${name}.tsv`;
  if (table.sourceMember !== member || typeof table.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(table.sourceSha256) ||
      typeof table.role !== "string" || !table.role.length) throw new Error("Native DREAM4 table source binding is invalid.");
  const references = unit.sourceMembers.filter(reference => reference?.member === member);
  if (references.length !== 1 || references[0].kind !== "file" || references[0].sha256 !== table.sourceSha256 ||
      !Number.isSafeInteger(references[0].bytes) || references[0].bytes <= 0) throw new Error("Native DREAM4 table hash is not bound to its source inventory.");
  if (name !== "wildtype") {
    denseArray(table.interventions, "Native intervention identities", 10);
    if (table.interventions.length !== 10 || table.alignmentEvidenceMember !== ALIGNMENT_MEMBER) throw new Error("Missing native intervention alignment evidence.");
    table.interventions.forEach((intervention, index) => {
      closed(intervention, ["rowIndex", "gene"], "native intervention identity");
      if (intervention.rowIndex !== index || intervention.gene !== GENES[index]) throw new Error("Native intervention rows and gene identities disagree.");
    });
    if (name === "knockouts" && table.values.some((row, index) => row[index] !== 0)) throw new Error("Native knockout diagonal contradicts intervention identities.");
  }
  return table;
}

/** Build all ten nine-gene off-target populations from a verified D2 unit.
 * The caller binds the prepared native payload to its D2 artifact digest. Member
 * hashes below retain provenance; this function cannot rehash archived TSV bytes.
 */
export function dreamTargets(unit, contrast = "knockouts") {
  if (!["knockouts", "knockdowns"].includes(contrast)) throw new Error("Only separate knockout and knockdown contrasts are defined.");
  closed(unit, ["id", "splitGroup", "nodeIdentityScope", "nodes", "edges", "goldStandard", "tables", "sourceMembers", "census"], "DREAM4 native unit");
  if (typeof unit.id !== "string" || !/^insilico_size10_[1-5]$/.test(unit.id) || unit.splitGroup !== unit.id ||
      unit.nodeIdentityScope !== "network-local") throw new Error("DREAM4 targets require a complete network-local split identity.");
  denseArray(unit.nodes, "Native gene identities", 10);
  if (unit.nodes.length !== 10 || unit.nodes.some((gene, index) => gene !== GENES[index])) throw new Error("DREAM4 target genes must preserve source column order.");
  denseArray(unit.sourceMembers, "Native source inventory");
  closed(unit.tables, ["wildtype", "knockouts", "knockdowns", "multifactorial", "timeseries", "dualknockouts"], "DREAM4 observation table inventory");
  const wildtype = sourceTable(unit, "wildtype", 1), perturbed = sourceTable(unit, contrast, 10);
  const interventions = GENES.map((gene, rowIndex) => {
    const columns = GENES.map((name, index) => index).filter(index => index !== rowIndex);
    const baseline = columns.map(index => wildtype.values[0][index]);
    const values = columns.map(index => perturbed.values[rowIndex][index]);
    const magnitudes = values.map((value, index) => Math.abs(value - baseline[index]));
    finiteValues(magnitudes, "Absolute off-target responses");
    return { id: `${unit.id}:${contrast}:${gene}`, rowIndex, gene,
      genes: columns.map(index => GENES[index]), wildtype: baseline, perturbed: values,
      magnitudes, ranks: averageRanks(magnitudes),
      directlyIntervened: { gene, wildtype: wildtype.values[0][rowIndex],
        perturbed: perturbed.values[rowIndex][rowIndex], excluded: true } };
  });
  return freeze({ profileId: TARGET_PROFILE_ID, unitId: unit.id, splitGroup: unit.splitGroup,
    contrast, role: contrast === "knockouts" ? "primary" : "secondary",
    transform: "abs(perturbed-wildtype); no division, pseudocount, tolerance or cross-intervention pooling",
    source: { wildtype: { member: wildtype.sourceMember, sha256: wildtype.sourceSha256 },
      perturbed: { member: perturbed.sourceMember, sha256: perturbed.sourceSha256 }, alignmentEvidenceMember: ALIGNMENT_MEMBER },
    interventionCount: 10, offTargetCount: 90, interventions });
}
