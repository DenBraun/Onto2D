import assert from "node:assert/strict";
import test from "node:test";
import { RIDGE_PROFILE, balancedTrainingRows, fitRidge, groupedFolds, predictRidge, selectLambda } from "./model.mjs";

test("nested group folds keep every held-out group out of fitting and tuning", () => {
  const rows = Array.from({ length: 5 }, (_, group) => Array.from({ length: group + 1 }, (_, i) => ({ id: `${group}/${i}`, groupId: `network-${group}` }))).flat();
  const folds = groupedFolds(rows);
  assert.equal(folds.length, 5);
  assert.deepEqual(folds, groupedFolds([...rows].reverse()));
  for (const fold of folds) {
    assert.equal(fold.trainIds.length + fold.testIds.length, rows.length);
    for (const inner of fold.inner) {
      assert.equal(inner.trainGroups.length, 3);
      assert.equal(inner.trainIds.length + inner.validationIds.length, fold.trainIds.length);
      assert.equal([...inner.trainIds, ...inner.validationIds].some(id => fold.testIds.includes(id)), false);
      assert.equal(inner.trainIds.some(id => inner.validationIds.includes(id)), false);
    }
  }
  assert.throws(() => groupedFolds([rows[0], rows[0]]));
  const sparse = [...rows]; delete sparse[1]; assert.throws(() => groupedFolds(sparse));
});

test("training weights balance groups and interventions despite unequal record counts", () => {
  const rows = [{ id: "a", groupId: "a", interventionId: "1", x: [1], y: 0 },
    { id: "b", groupId: "b", interventionId: "1", x: [1], y: 0 },
    { id: "c", groupId: "b", interventionId: "2", x: [1], y: 0 },
    { id: "d", groupId: "b", interventionId: "2", x: [1], y: 0 }];
  assert.deepEqual(balancedTrainingRows(rows).map(r => r.weight), [0.5, 0.25, 0.125, 0.125]);
});

test("nested fold expansion is bounded before materializing its quadratic population", () => {
  const distinctGroups = Array.from({ length: RIDGE_PROFILE.maxRows }, (_, index) => ({ id: `row-${index}`, groupId: `group-${index}` }));
  assert.throws(() => groupedFolds(distinctGroups), /fold reference budget/);
  const fewGroups = distinctGroups.map((row, index) => ({ ...row, groupId: `group-${index % 5}` }));
  const folds = groupedFolds(fewGroups);
  assert.equal(folds.length, 5);
  const actualReferences = folds.reduce((sum, fold) => sum + fold.trainIds.length + fold.testIds.length + fold.trainGroups.length +
    fold.inner.reduce((subtotal, inner) => subtotal + inner.trainIds.length + inner.validationIds.length + inner.trainGroups.length, 0), 0);
  assert.equal(actualReferences, RIDGE_PROFILE.maxRows * 21 + 5 * 4 * 4);
  assert.ok(actualReferences < RIDGE_PROFILE.maxFoldReferences);
});

test("ridge agrees with a closed-form fit, is row-order invariant and ignores constant training columns", () => {
  const rows = [{ x: [-1, 7], y: 0, weight: 1 }, { x: [1, 7], y: 1, weight: 1 }];
  const model = fitRidge(rows, 1);
  assert.ok(Math.abs(model.coefficients[0] - 0.25) < 1e-14);
  assert.equal(model.coefficients[1], 0);
  assert.ok(Math.abs(predictRidge(model, [-1, 1000]) - 0.25) < 1e-14);
  assert.ok(Math.abs(predictRidge(model, [1, -1000]) - 0.75) < 1e-14);
  assert.deepEqual(model, fitRidge([...rows].reverse(), 1));
  assert.deepEqual(rows[0].x, [-1, 7]);
  assert.throws(() => fitRidge([{ x: [NaN], y: 0, weight: 1 }], 1));
  assert.throws(() => fitRidge(rows, 0));
  assert.throws(() => fitRidge([{ x: [0], y: 0, weight: 1 }, { x: [1e-200], y: 1, weight: 1 }], 1), /underflow/);
  assert.throws(() => fitRidge([{ x: [0], y: 0, weight: 1e-300 }, { x: [1], y: 1, weight: 1e300 }], 1), /underflow/);
  assert.throws(() => predictRidge({ profileId: model.profileId, featureCount: 0, intercept: 0 }, []));
  assert.throws(() => predictRidge({ ...model, scales: [1, -1] }, [0, 0]));
});

test("tuning never chooses a missing candidate and resolves exact ties toward stronger regularization", () => {
  const scores = RIDGE_PROFILE.lambdas.map(lambda => ({ lambda, meanRankSkill: 0.25 }));
  assert.equal(selectLambda(scores), 100);
  assert.equal(selectLambda(scores.map(s => ({ ...s, meanRankSkill: s.lambda === 1 ? 0.5 : 0.25 }))), 1);
  assert.throws(() => selectLambda(scores.slice(1)));
  const sparse = scores.slice(0, 4); sparse.length = 5; assert.throws(() => selectLambda(sparse));
});

test("ridge fit, prediction and tuning reject undeclared fields and sparse feature vectors", () => {
  const rows = [{ x: [0], y: 0, weight: 1 }, { x: [1], y: 1, weight: 1 }];
  const model = fitRidge(rows, 1), hidden = Symbol("undeclared");
  for (const key of ["extra", hidden]) {
    const extraRows = structuredClone(rows); extraRows[key] = true;
    assert.throws(() => fitRidge(extraRows, 1));
    const extraFeatures = structuredClone(rows); extraFeatures[0].x[key] = true;
    assert.throws(() => fitRidge(extraFeatures, 1));
    const extraRow = structuredClone(rows); extraRow[0][key] = true;
    assert.throws(() => fitRidge(extraRow, 1));
    assert.throws(() => predictRidge({ ...model, [key]: true }, [0]));
    const prediction = [0]; prediction[key] = true;
    assert.throws(() => predictRidge(model, prediction));
    const coefficients = [...model.coefficients]; coefficients[key] = true;
    assert.throws(() => predictRidge({ ...model, coefficients }, [0]));
    const scores = RIDGE_PROFILE.lambdas.map(lambda => ({ lambda, meanRankSkill: 0 }));
    scores[0][key] = true;
    assert.throws(() => selectLambda(scores));
  }
  const sparse = structuredClone(rows); delete sparse[0].x[0];
  assert.throws(() => fitRidge(sparse, 1));
  assert.throws(() => predictRidge(model, new Array(1)));
  const groups = Array.from({ length: 3 }, (_, index) => ({ id: String(index), groupId: String(index) }));
  groups.extra = true;
  assert.throws(() => groupedFolds(groups));
  assert.throws(() => balancedTrainingRows(groups));
});
