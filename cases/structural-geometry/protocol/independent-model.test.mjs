import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { RIDGE_PROFILE, fitRidge, predictRidge } from "./model.mjs";

const close = (actual, expected, label) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: nonfinite result`);
  assert.ok(Math.abs(actual - expected) <= 2e-12 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} differs from independent reference ${expected}`);
};

test("weighted ridge agrees with independent high-precision joint-intercept controls", () => {
  const process = spawnSync("python3", ["-B", fileURLToPath(new URL("./model-reference.py", import.meta.url))],
    { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(process.status, 0, process.error?.message ?? process.stderr);
  const reference = JSON.parse(process.stdout);
  assert.equal(reference.format, "onto2d-independent-weighted-ridge-controls-v1");
  assert.equal(reference.method, "decimal-80-joint-intercept-pivoted-gauss-jordan");
  assert.equal(reference.cases.length, 7);
  let compared = 0, extrapolatedOutsideUnitRange = false;
  for (const control of reference.cases) {
    assert.deepEqual(control.results.map(result => result.lambda), RIDGE_PROFILE.lambdas);
    for (const expected of control.results) {
      const model = fitRidge(control.rows, expected.lambda), label = `${control.id}/${expected.lambda}`;
      close(model.intercept, expected.intercept, `${label}/intercept`);
      for (const key of ["means", "scales", "coefficients"]) {
        assert.equal(model[key].length, expected[key].length);
        model[key].forEach((value, column) => close(value, expected[key][column], `${label}/${key}/${column}`));
      }
      control.predictionInputs.forEach((input, index) => {
        const value = predictRidge(model, input);
        close(value, expected.predictions[index], `${label}/prediction/${index}`);
        if (value < 0 || value > 1) extrapolatedOutsideUnitRange = true;
      });
      const mass = control.rows.reduce((sum, row) => sum + row.weight, 0);
      const objective = control.rows.reduce((sum, row) =>
        sum + row.weight / mass * (row.y - predictRidge(model, row.x)) ** 2, 0)
        + expected.lambda * model.coefficients.reduce((sum, value) => sum + value ** 2, 0);
      close(objective, expected.objective, `${label}/penalized-objective`);
      assert.ok(expected.normalEquationResidualMaximum <= 1e-70);
      compared += 1;
    }
  }
  assert.equal(compared, 35);
  assert.equal(extrapolatedOutsideUnitRange, true, "Unclipped extrapolation must remain visible");
});
