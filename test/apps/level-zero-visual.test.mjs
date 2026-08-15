import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildVisualStudy,
  formatMetric,
  profilePath,
  sampleProfile
} from "../../apps/level-zero-validation/model.js";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8"
));

const integrated = await readJson(
  "cases/level-0-oscillator/artifacts/level-zero-validation-v1.json"
);
const objecthood = await readJson(
  "cases/level-0-oscillator/artifacts/phase-c-objecthood-v1.json"
);

test("the visual study preserves the frozen phase disposition", () => {
  const study = buildVisualStudy(integrated, objecthood);
  assert.equal(study.analysisHash, integrated.analysisHash);
  assert.equal(study.sourceDoi, "10.5281/zenodo.19397414");
  assert.equal(study.phaseBPassed, true);
  assert.equal(study.cubicRejected, true);
  assert.equal(study.phaseDStopped, true);
  assert.equal(study.levelZeroValidated, false);

  assert.deepEqual(
    study.branches.map(({ id, localized, nontrivial, stable, passed }) => ({
      id,
      localized,
      nontrivial,
      stable,
      passed
    })),
    [
      {
        id: "localized-pulse",
        localized: true,
        nontrivial: true,
        stable: false,
        passed: false
      },
      {
        id: "stable-plateau",
        localized: false,
        nontrivial: true,
        stable: true,
        passed: false
      },
      {
        id: "uncoupled-vacuum",
        localized: false,
        nontrivial: false,
        stable: true,
        passed: false
      }
    ]
  );
  assert.deepEqual(study.branches[0].failedGates, ["amplitude stability"]);
  assert.deepEqual(study.branches[1].failedGates, ["intrinsic localization"]);
  assert.deepEqual(study.branches[2].failedGates, [
    "non-trivial Gamma",
    "intrinsic localization"
  ]);
});

test("the guide takes displayed metrics directly from the objecthood artifact", () => {
  const study = buildVisualStudy(integrated, objecthood);
  for (const branch of study.branches) {
    const source = objecthood.scenarios.find((scenario) => scenario.id === branch.id);
    assert.equal(branch.gammaBase, source.scientificResult.values.gamma_fine);
    assert.equal(branch.gammaExtended, source.scientificResult.values.gamma_extended);
    assert.equal(
      branch.domainChange,
      source.scientificResult.values.gamma_domain_relative_change
    );
    assert.equal(
      branch.rayleigh,
      source.scientificResult.values.symmetric_profile_rayleigh_quotient
    );
  }
});

test("the disclosed profile references remain finite and visually distinct", () => {
  const pulse = sampleProfile("localized-pulse", 8);
  const plateau = sampleProfile("stable-plateau", 8);
  const vacuum = sampleProfile("uncoupled-vacuum", 8);
  const center = Math.floor(pulse.length / 2);

  assert.ok(Math.abs(pulse[center].y - 0.4260527710) < 1e-8);
  assert.ok(Math.abs(plateau[center].y - (4 + Math.sqrt(10)) / 3) < 2e-6);
  assert.equal(vacuum[center].y, 0);
  assert.equal(pulse[0].y, null);
  assert.equal(plateau[0].y, null);

  for (const [samples, maximumY] of [[pulse, 0.55], [plateau, 2.75], [vacuum, 0.55]]) {
    const path = profilePath(samples, 760, 330, maximumY);
    assert.match(path, /^M/);
    assert.doesNotMatch(path, /NaN|Infinity/);
  }
});

test("the visual refuses evidence from a different objecthood analysis", () => {
  assert.throws(
    () => buildVisualStudy(integrated, { ...objecthood, analysisHash: "sha256:different" }),
    /do not share the frozen Phase-C identity/
  );
});

test("metric formatting remains compact without hiding zero", () => {
  assert.equal(formatMetric(0), "0");
  assert.equal(formatMetric(4.61616961549, 6), "4.61617");
  assert.equal(formatMetric(0.0000161527612103), "1.62e-5");
  assert.equal(formatMetric(Number.NaN), "n/a");
});
