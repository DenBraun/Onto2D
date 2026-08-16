import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildDynamicsView,
  buildExpandedSearchView,
  buildVisualStudy,
  formatMetric,
  normalizedDifferenceProfile,
  profilePath,
  sampleProfile,
  seriesPath
} from "../../apps/level-zero-validation/level-zero-visual-model.js";

const readJson = async (relativePath) => JSON.parse(await readFile(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8"
));

const integrated = await readJson(
  "cases/level-0-oscillator/artifacts/level-zero-validation-v3.json"
);
const objecthood = await readJson(
  "cases/level-0-oscillator/artifacts/phase-c-objecthood-v2.json"
);
const dynamics = await readJson(
  "cases/level-0-oscillator/artifacts/phase-c-dynamics-v2.json"
);
const expanded = await readJson(
  "cases/level-0-oscillator/artifacts/phase-c-expanded-search-v2.json"
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

test("the dynamics view preserves the frozen instability result and controls", () => {
  const view = buildDynamicsView(objecthood, dynamics);
  assert.equal(view.frames.length, 25);
  assert.equal(view.antisymmetricFrames.length, 25);
  assert.equal(view.maximumAmplification, 28.247160764);
  assert.equal(view.antisymmetricMaximum, 1);
  assert.equal(view.departureTime, 2.975);
  assert.equal(view.persistencePassed, false);
  assert.equal(view.priorDispositionChanged, false);
  assert.ok(view.profileMaximum > 0.7);
  assert.ok(view.initialPointwiseDifferenceMaximum > 0);

  const initialDifference = normalizedDifferenceProfile(
    view.frames[0],
    view.initialPointwiseDifferenceMaximum
  );
  const finalDifference = normalizedDifferenceProfile(
    view.frames.at(-1),
    view.initialPointwiseDifferenceMaximum
  );
  assert.ok(Math.abs(Math.max(...initialDifference) - 1) < 1e-12);
  assert.ok(Math.max(...finalDifference) > 30);

  const times = view.frames.map((frame) => frame.time);
  const amplitudes = view.frames.map((frame) => frame.amplification);
  const path = seriesPath(times, amplitudes, 720, 300, {
    xMin: times[0],
    xMax: times.at(-1),
    yMin: 0,
    yMax: 30.507
  });
  assert.match(path, /^M/);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("the dynamics visual refuses a trace bound to different evidence", () => {
  assert.throws(
    () => buildDynamicsView(objecthood, {
      ...dynamics,
      dependency: { ...dynamics.dependency, analysisHash: "sha256:different" }
    }),
    /not bound to the frozen localized pulse/
  );
  assert.throws(
    () => seriesPath([0, 1], [0], 720, 300, {
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1
    }),
    /equal-length finite arrays/
  );
  assert.throws(
    () => normalizedDifferenceProfile(viewFrameFixture(), 0),
    /positive initial maximum/
  );
});

test("the expanded visual preserves the preregistered bounded disposition", () => {
  const view = buildExpandedSearchView(integrated, expanded);
  assert.equal(view.analysisHash, integrated.analysisHash);
  assert.equal(view.expandedAnalysisHash, expanded.analysisHash);
  assert.equal(view.scenarioCount, 6);
  assert.equal(view.eligibleCount, 5);
  assert.equal(view.qualifiedCount, 0);
  assert.equal(view.indeterminateCount, 0);
  assert.equal(view.perturbationCount, 4);
  assert.deepEqual(
    view.scenarios.filter((scenario) => scenario.eligible).map((scenario) => ({
      id: scenario.id,
      asymmetric: scenario.gates.asymmetryPassed,
      realStable: scenario.gates.realAmplitudeStabilityPassed,
      phaseStable: scenario.gates.complexPhaseStabilityPassed,
      dynamicBank: scenario.gates.dynamicBankPassed,
      passed: scenario.passed
    })),
    [
      "mild-mass-split",
      "wide-mass-split",
      "stronger-coupling",
      "stiffer-quartic",
      "lower-coupling-split"
    ].map((id) => ({
      id,
      asymmetric: true,
      realStable: false,
      phaseStable: false,
      dynamicBank: true,
      passed: false
    }))
  );
  for (const scenario of view.scenarios) {
    assert.equal(scenario.stationary.components.length, 3);
    assert.equal(scenario.dynamics.length, 4);
    for (const probe of scenario.dynamics) {
      assert.equal(probe.times.length, probe.amplification.length);
      const path = seriesPath(probe.times, probe.amplification, 720, 300, {
        xMin: probe.times[0],
        xMax: probe.times.at(-1),
        yMin: 0,
        yMax: 10.5
      });
      assert.match(path, /^M/);
      assert.doesNotMatch(path, /NaN|Infinity/);
    }
  }
});

test("the expanded visual rejects unbound or incomplete evidence", () => {
  assert.throws(
    () => buildExpandedSearchView(integrated, {
      ...expanded,
      analysisHash: "sha256:different"
    }),
    /not bound to the integrated Level-0 result/
  );
  assert.throws(
    () => buildExpandedSearchView(integrated, {
      ...expanded,
      scenarios: expanded.scenarios.slice(0, 5)
    }),
    /six preregistered scenarios/
  );
});

function viewFrameFixture() {
  return {
    x: [0, 1],
    controlComposite: [0, 0],
    perturbedComposite: [0, 1]
  };
}

test("metric formatting remains compact without hiding zero", () => {
  assert.equal(formatMetric(0), "0");
  assert.equal(formatMetric(4.61616961549, 6), "4.61617");
  assert.equal(formatMetric(0.0000161527612103), "1.62e-5");
  assert.equal(formatMetric(Number.NaN), "n/a");
});
