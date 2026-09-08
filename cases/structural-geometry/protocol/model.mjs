import { deepFreeze } from "@onto2d/kernel/canonical";

export const RIDGE_PROFILE = deepFreeze({ id: "biological-weighted-ridge-v1", version: "1",
  lambdas: [0.01, 0.1, 1, 10, 100], maxRows: 4096, maxFeatures: 128,
  maxFoldReferences: 2_000_000,
  foldBound: "n*(g*g-g+1)+g*(g-1)*(g-1) row-ID and training-group-ID array entries; reject before allocation",
  objective: "sum(normalized-weight*(y-intercept-z*beta)^2)+lambda*sum(beta^2)",
  standardization: "training-weighted-mean-and-population-standard-deviation",
  constantColumn: "zero-in-training-and-evaluation", intercept: "unpenalized-training-weighted-mean-y",
  solver: "cholesky-positive-definite-normal-equations", numeric: "finite-binary64",
  ordering: "lexicographic-numeric-x-then-y-then-weight", tuningTie: "larger-lambda",
  weighting: "equal-groups-then-equal-interventions-then-equal-eligible-targets",
  target: "within-intervention-average-rank-minus-one-over-target-count-minus-one",
  evaluation: "no-clipping-predictions-rank-with-exact-ties" });

const text = x => typeof x === "string" && x.length > 0;
const finite = x => typeof x === "number" && Number.isFinite(x);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const closed = (value, fields) => object(value) && !Object.getOwnPropertySymbols(value).length &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const dense = (value, maximum) => Array.isArray(value) && value.length <= maximum &&
  !Object.getOwnPropertySymbols(value).length && Object.keys(value).length === value.length &&
  Object.keys(value).every((key, index) => key === String(index));

export function groupedFolds(records) {
  if (!dense(records, RIDGE_PROFILE.maxRows) || !records.length ||
      records.some(r => !object(r) || !text(r.id) || !text(r.groupId)) || new Set(records.map(r => r.id)).size !== records.length) throw new Error("Expected distinct source rows and explicit groups.");
  const groups = [...new Set(records.map(r => r.groupId))].sort();
  if (groups.length < 3) throw new Error("Nested group validation requires at least three groups.");
  const g = groups.length;
  // Nested leave-one-group-out expansion is quadratic per input row. Bounding
  // only records.length permits billions of references when groups are unique.
  const references = records.length * (g * g - g + 1) + g * (g - 1) * (g - 1);
  if (references > RIDGE_PROFILE.maxFoldReferences) throw new Error("Nested group fold reference budget exceeded.");
  const rowsFor = allowed => {
    const included = new Set(allowed);
    return records.filter(r => included.has(r.groupId)).map(r => r.id).sort();
  };
  return groups.map(heldOut => {
    const trainGroups = groups.filter(g => g !== heldOut);
    return { heldOut, trainGroups, trainIds: rowsFor(trainGroups), testIds: rowsFor([heldOut]),
      inner: trainGroups.map(validationGroup => ({ validationGroup,
        trainGroups: trainGroups.filter(g => g !== validationGroup),
        trainIds: rowsFor(trainGroups.filter(g => g !== validationGroup)), validationIds: rowsFor([validationGroup]) })) };
  });
}

export function balancedTrainingRows(rows) {
  if (!dense(rows, RIDGE_PROFILE.maxRows) || !rows.length ||
      rows.some(r => !object(r) || !text(r.id) || !text(r.groupId) || !text(r.interventionId)) || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error("Training population needs distinct rows and groups/interventions.");
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.groupId)) groups.set(row.groupId, new Map());
    const interventions = groups.get(row.groupId);
    interventions.set(row.interventionId, (interventions.get(row.interventionId) ?? 0) + 1);
  }
  return rows.map(row => ({ x: row.x, y: row.y,
    weight: 1 / (groups.size * groups.get(row.groupId).size * groups.get(row.groupId).get(row.interventionId)) }));
}

export function fitRidge(rows, lambda) {
  if (!RIDGE_PROFILE.lambdas.includes(lambda) || !dense(rows, RIDGE_PROFILE.maxRows) || !rows.length) throw new Error("Invalid frozen ridge fit request.");
  const p = rows[0]?.x?.length;
  if (!Number.isInteger(p) || p < 1 || p > RIDGE_PROFILE.maxFeatures || rows.some(r => !closed(r, ["weight", "x", "y"]) ||
      !dense(r.x, RIDGE_PROFILE.maxFeatures) || r.x.length !== p ||
      r.x.some(x => !finite(x)) || !finite(r.y) || r.y < 0 || r.y > 1 || !finite(r.weight) || r.weight <= 0)) throw new Error("Ridge rows require dense finite features, rank targets and positive weights.");
  const data = rows.map(r => ({ x: [...r.x], y: r.y, weight: r.weight })).sort((a, b) => {
    for (let j = 0; j < p; j += 1) if (a.x[j] !== b.x[j]) return a.x[j] < b.x[j] ? -1 : 1;
    return a.y - b.y || a.weight - b.weight;
  });
  const mass = data.reduce((s, r) => s + r.weight, 0);
  if (!finite(mass) || mass <= 0) throw new Error("Invalid training weight mass.");
  data.forEach(r => { r.weight /= mass; if (r.weight === 0) throw new Error("Training weight underflow."); });
  const means = Array(p).fill(0), variances = Array(p).fill(0);
  const intercept = data.reduce((s, r) => s + r.weight * r.y, 0);
  for (const r of data) for (let j = 0; j < p; j += 1) means[j] += r.weight * r.x[j];
  for (const r of data) for (let j = 0; j < p; j += 1) variances[j] += r.weight * (r.x[j] - means[j]) ** 2;
  // Detect constants from actual training values, independent of rounding in mean.
  const scales = variances.map((v, j) => {
    if (data.every(r => r.x[j] === data[0].x[j])) return 0;
    if (v <= 0) throw new Error("Nonconstant training variance underflow.");
    return Math.sqrt(v);
  });
  if ([...means, ...scales, intercept].some(x => !finite(x))) throw new Error("Training standardization overflow.");
  const matrix = Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => j === k ? lambda : 0)), rhs = Array(p).fill(0);
  for (const r of data) {
    const z = r.x.map((x, j) => scales[j] === 0 ? 0 : (x - means[j]) / scales[j]);
    for (let j = 0; j < p; j += 1) {
      rhs[j] += r.weight * z[j] * (r.y - intercept);
      for (let k = 0; k <= j; k += 1) matrix[j][k] += r.weight * z[j] * z[k];
    }
  }
  const l = Array.from({ length: p }, () => Array(p).fill(0));
  for (let j = 0; j < p; j += 1) for (let k = 0; k <= j; k += 1) {
    let v = matrix[j][k];
    for (let q = 0; q < k; q += 1) v -= l[j][q] * l[k][q];
    l[j][k] = j === k ? Math.sqrt(v) : v / l[k][k];
    if (!finite(l[j][k]) || (j === k && l[j][k] <= 0)) throw new Error("Ridge system failed positive-definite verification.");
  }
  const tmp = Array(p).fill(0), coefficients = Array(p).fill(0);
  for (let j = 0; j < p; j += 1) { let v = rhs[j]; for (let k = 0; k < j; k += 1) v -= l[j][k] * tmp[k]; tmp[j] = v / l[j][j]; }
  for (let j = p - 1; j >= 0; j -= 1) { let v = tmp[j]; for (let k = j + 1; k < p; k += 1) v -= l[k][j] * coefficients[k]; coefficients[j] = v / l[j][j]; }
  if (coefficients.some(x => !finite(x))) throw new Error("Ridge solution is nonfinite.");
  return deepFreeze({ profileId: RIDGE_PROFILE.id, lambda, featureCount: p, means, scales, coefficients, intercept });
}

export function predictRidge(model, x) {
  if (!closed(model, ["coefficients", "featureCount", "intercept", "lambda", "means", "profileId", "scales"]) ||
      model.profileId !== RIDGE_PROFILE.id || !RIDGE_PROFILE.lambdas.includes(model.lambda) ||
      !Number.isInteger(model.featureCount) || model.featureCount < 1 || model.featureCount > RIDGE_PROFILE.maxFeatures ||
      !finite(model.intercept) ||
      [model.means, model.scales, model.coefficients].some(a => !dense(a, RIDGE_PROFILE.maxFeatures) || a.length !== model.featureCount || a.some(v => !finite(v))) ||
      model.scales.some((s, j) => s < 0 || (s === 0 && model.coefficients[j] !== 0)) ||
      !dense(x, RIDGE_PROFILE.maxFeatures) || x.length !== model.featureCount || x.some(v => !finite(v))) throw new Error("Invalid ridge prediction domain.");
  const value = x.reduce((s, v, j) => s + (model.scales[j] === 0 ? 0 : (v - model.means[j]) / model.scales[j]) * model.coefficients[j], model.intercept);
  if (!finite(value)) throw new Error("Ridge prediction overflow.");
  return value;
}

export function selectLambda(scores) {
  if (!dense(scores, RIDGE_PROFILE.lambdas.length) || scores.length !== RIDGE_PROFILE.lambdas.length ||
      scores.some(s => !closed(s, ["lambda", "meanRankSkill"]) || !RIDGE_PROFILE.lambdas.includes(s.lambda) || !finite(s.meanRankSkill) || s.meanRankSkill < -1 || s.meanRankSkill > 1) ||
      new Set(scores.map(s => s.lambda)).size !== scores.length) throw new Error("Tuning requires all frozen candidates on identical eligible validation groups.");
  return [...scores].sort((a, b) => b.meanRankSkill - a.meanRankSkill || b.lambda - a.lambda)[0].lambda;
}
