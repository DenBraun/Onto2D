import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildStateHistory,
  extractCase,
  materializeCase
} from "../extract.mjs";
import {
  analyzeHistoricalLoad,
  buildAnalysis,
  materializeAnalysis
} from "../analyze.mjs";
import { readCaseJson, traceFromText } from "./helpers.js";

function stateProjection(state) {
  return {
    installedTargets: state.installedTargets,
    removedTargets: state.removedTargets,
    activeDefinitions: state.activeDefinitions,
    kernelContext: state.kernelContext
  };
}

test("every event has exactly one state transition and every transition preserves correspondence", async () => {
  const { trace, stateHistory } = await extractCase();
  assert.equal(stateHistory.states.length, trace.events.length + 1);
  assert.equal(stateHistory.transitions.length, trace.events.length);
  assert.equal(new Set(stateHistory.transitions.map((entry) => entry.eventId)).size, trace.events.length);
  for (const event of trace.events) {
    const transition = stateHistory.transitions[event.ordinal];
    assert.equal(transition.eventId, event.eventId);
    assert.equal(transition.fromState, stateHistory.states[event.ordinal].stateId);
    assert.equal(transition.toState, stateHistory.states[event.ordinal + 1].stateId);
    assert.equal(stateHistory.states[event.ordinal + 1].afterEvent, event.eventId);
  }
});

test("inactive conditional events remain visible as explicit no-op transitions", async () => {
  const { trace, stateHistory } = await extractCase();
  const inactive = trace.events.filter((event) => !event.profileStatus.active);
  assert.equal(inactive.length, 8);
  for (const event of inactive) {
    const transition = stateHistory.transitions[event.ordinal];
    assert.deepEqual(transition.operations, [{ kind: "no-op", reason: "predicate-inactive" }]);
    assert.deepEqual(
      stateProjection(stateHistory.states[event.ordinal]),
      stateProjection(stateHistory.states[event.ordinal + 1])
    );
  }
});

test("definitions, uninstalls, and jumps update only their declared state projections", async () => {
  const { trace, stateHistory } = await extractCase();
  const buildFiwix = trace.events.find((event) => event.source.line === 39);
  const jumpFiwix = trace.events.find((event) => event.source.line === 43);
  const uninstallHeirloom = trace.events.find((event) => event.source.line === 75);
  assert.equal(stateHistory.states[buildFiwix.ordinal + 1].activeDefinitions.BUILD_FIWIX, "True");
  assert.equal(stateHistory.states[jumpFiwix.ordinal + 1].kernelContext, "fiwix");
  assert.equal(
    stateHistory.states[uninstallHeirloom.ordinal].installedTargets.includes("heirloom-devtools-070527"),
    true
  );
  assert.equal(
    stateHistory.states[uninstallHeirloom.ordinal + 1].installedTargets.includes("heirloom-devtools-070527"),
    false
  );
  assert.equal(
    stateHistory.states[uninstallHeirloom.ordinal + 1].removedTargets.includes("heirloom-devtools-070527"),
    true
  );
});

test("repeated builds remain separate transitions even when installed-state membership is unchanged", () => {
  const trace = traceFromText("build: tcc-0.9.27\nbuild: tcc-0.9.27\n");
  const history = buildStateHistory(trace);
  assert.equal(history.transitions.length, 2);
  assert.notEqual(history.transitions[0].transitionId, history.transitions[1].transitionId);
  assert.deepEqual(history.transitions.map((entry) => entry.operations), [
    [{ kind: "build", target: "tcc-0.9.27" }],
    [{ kind: "build", target: "tcc-0.9.27" }]
  ]);
  assert.deepEqual(history.states[1].installedTargets, ["tcc-0.9.27"]);
  assert.deepEqual(history.states[2].installedTargets, ["tcc-0.9.27"]);
});

test("analysis profile schema is a closed schema for a finite declared path space", async () => {
  const schema = await readCaseJson("schema/analysis-profile.schema.json");
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const profile = {
    format: "onto2d-live-bootstrap-analysis-profile",
    formatVersion: "1",
    analysisVersion: "test-v1",
    upstreamRevision: "0".repeat(40),
    traceIdentity: `sha256:${"0".repeat(64)}`,
    pathSpaceId: "finite-test-space",
    bounded: true,
    targets: [{ id: "target:test" }],
    costFunctions: ["event-count"],
    regimes: [{ id: "observed" }],
    counterfactualEdges: []
  };
  assert.equal(validate(profile), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...profile, bounded: false }), false);
  assert.equal(validate({ ...profile, undeclared: true }), false);
});

test("all committed extraction artifacts reproduce byte-for-byte", async () => {
  const artifacts = await materializeCase({ verify: true });
  assert.match(artifacts.trace.traceIdentity, /^sha256:[0-9a-f]{64}$/);
  assert.match(artifacts.stateHistory.stateHistoryIdentity, /^sha256:[0-9a-f]{64}$/);
  assert.match(artifacts.evidence.evidenceIdentity, /^sha256:[0-9a-f]{64}$/);
  assert.match(artifacts.graph.graphIdentity, /^sha256:[0-9a-f]{64}$/);
});

test("two independent extractions are structurally and identically equal", async () => {
  const first = await extractCase();
  const second = await extractCase();
  assert.deepEqual(first, second);
});

test("the finite construction space keeps actual and counterfactual histories distinct", async () => {
  const [{ trace, evidence }, analysis] = await Promise.all([
    extractCase(),
    buildAnalysis()
  ]);
  assert.equal(analysis.pathSpace.bounded, true);
  assert.equal(analysis.pathSpace.paths.length, 3);
  const actual = analysis.pathSpace.paths.find((candidate) => candidate.properties.actual);
  assert.equal(actual.id, "path:observed-prefix-to-first-gcc");
  assert.equal(actual.provenance.basis, "pinned-manifest-prefix");
  assert.equal(actual.steps.length, 81);
  assert.equal(actual.steps.reduce((sum, step) => sum + step.cost.event, 0), 79);
  assert.equal(actual.steps.reduce((sum, step) => sum + step.cost.build, 0), 66);
  assert.equal(analysis.pathSpace.counterfactualEdges.length, 3);
  assert.equal(analysis.pathSpace.counterfactualEdges.every((edge) =>
    edge.introducedBy === "Onto2D" && edge.upstreamFact === false
  ), true);
  assert.equal(trace.events.some((event) => event.eventId.startsWith("counterfactual:")), false);
  assert.equal(evidence.records.some((record) =>
    record.relation.includes("counterfactual")
    || record.subject.startsWith("counterfactual:")
    || record.object.startsWith("counterfactual:")
  ), false);
});

test("Historical Load reports every required identity and the declared cost matrix", async () => {
  const analysis = await buildAnalysis();
  assert.equal(analysis.results.length, 16);
  const expected = new Map([
    ["event-count/source-derived", 1],
    ["event-count/bootstrappable", 78],
    ["event-count/auditable-bootstrap", 78],
    ["build-event-count/source-derived", 1],
    ["build-event-count/bootstrappable", 66],
    ["distinct-tool-count/source-derived", 1],
    ["distinct-tool-count/bootstrappable", 52],
    ["trust-root-count/source-derived", 0],
    ["trust-root-count/bootstrappable", 0]
  ]);
  for (const result of analysis.results) {
    assert.equal(result.status, "resolved");
    assert.equal(result.target.id, "target:first-gcc-toolchain");
    assert.equal(result.pathSpace.identity, analysis.pathSpaceIdentity);
    assert.equal(result.pathSpace.size, 3);
    assert.equal(result.pathSpace.bounded, true);
    assert.equal(result.upstreamRevision, analysis.upstreamRevision);
    assert.equal(result.traceIdentity, analysis.traceIdentity);
    assert.equal(result.analysisVersion, analysis.analysisVersion);
    assert.match(result.costFunction.id, /^(event-count|build-event-count|distinct-tool-count|trust-root-count)$/);
    assert.notEqual(result.regime.id, "observed");
    assert.equal(result.dH, result.aF - result.a0);
    assert.match(result.resultIdentity, /^sha256:[0-9a-f]{64}$/);
    const key = `${result.costFunction.id}/${result.regime.id}`;
    if (expected.has(key)) assert.equal(result.dH, expected.get(key), key);
  }
});

test("free-optimum ties and eliminated paths remain explicit", async () => {
  const analysis = await buildAnalysis();
  const result = analysis.results.find((entry) =>
    entry.costFunction.id === "trust-root-count" && entry.regime.id === "bootstrappable"
  );
  assert.deepEqual(result.freeOptima, [
    "path:observed-prefix-to-first-gcc",
    "path:opaque-prebuilt-gcc",
    "path:source-from-prebuilt-toolchain"
  ]);
  assert.deepEqual(result.admissibleOptima, ["path:observed-prefix-to-first-gcc"]);
  assert.deepEqual(result.eliminatedFreeOptima.map((entry) => entry.pathId), [
    "path:opaque-prebuilt-gcc",
    "path:source-from-prebuilt-toolchain"
  ]);
  assert.equal(result.dH, 0);
  assert.equal(result.firstDivergence.index, 0);
});

test("constraint ablation reports the selected optimum after removing each constraint", async () => {
  const analysis = await buildAnalysis();
  const result = analysis.results.find((entry) =>
    entry.costFunction.id === "event-count" && entry.regime.id === "bootstrappable"
  );
  assert.deepEqual(result.eliminatedFreeOptimumBy, ["constraint:bootstrap-ancestry"]);
  assert.deepEqual(result.constraintAblation, [{
    constraintId: "constraint:bootstrap-ancestry",
    ablatedPath: "path:opaque-prebuilt-gcc",
    ablatedCost: 1,
    costReduction: 78
  }]);
});

test("Historical Load refuses implicit target, cost, regime, unbounded space, and observed reference", async () => {
  const analysis = await buildAnalysis();
  const regimes = await readCaseJson("analysis/regimes.json");
  const regimeSet = {
    constraintsById: new Map(regimes.constraints.map((entry) => [entry.id, entry])),
    regimesById: new Map(regimes.regimes.map((entry) => [entry.id, entry]))
  };
  assert.throws(() => analyzeHistoricalLoad(analysis.pathSpace, regimeSet, {}), /fields must be exactly/);
  assert.throws(() => analyzeHistoricalLoad(analysis.pathSpace, regimeSet, {
    targetId: "target:first-gcc-toolchain",
    costFunctionId: "missing",
    regimeId: "free"
  }), /unknown cost function/);
  assert.throws(() => analyzeHistoricalLoad(analysis.pathSpace, regimeSet, {
    targetId: "target:first-gcc-toolchain",
    costFunctionId: "event-count",
    regimeId: "observed"
  }), /not an optimization regime/);
  assert.throws(() => analyzeHistoricalLoad({ ...analysis.pathSpace, bounded: false }, regimeSet, {
    targetId: "target:first-gcc-toolchain",
    costFunctionId: "event-count",
    regimeId: "free"
  }), /explicitly bounded/);
});

test("an insufficient declared space returns unresolved instead of a numeric Historical Load", async () => {
  const analysis = await buildAnalysis();
  const actual = {
    id: "constraint:test-actual",
    predicate: { field: "actual", equals: true }
  };
  const notSource = {
    id: "constraint:test-not-source",
    predicate: { field: "sourceDerived", equals: false }
  };
  const free = { id: "free", optimization: true, constraints: [] };
  const impossible = {
    id: "impossible",
    label: "Impossible test regime",
    optimization: true,
    constraints: [actual.id, notSource.id]
  };
  const result = analyzeHistoricalLoad(analysis.pathSpace, {
    constraintsById: new Map([[actual.id, actual], [notSource.id, notSource]]),
    regimesById: new Map([[free.id, free], [impossible.id, impossible]])
  }, {
    targetId: "target:first-gcc-toolchain",
    costFunctionId: "event-count",
    regimeId: "impossible"
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.reason, "no-admissible-declared-path");
  assert.equal(result.a0, null);
  assert.equal(result.aF, null);
  assert.equal(result.dH, null);
});

test("generated analysis profile conforms and Historical Load replay is byte-identical", async () => {
  const [analysis, schema] = await Promise.all([
    materializeAnalysis({ verify: true }),
    readCaseJson("schema/analysis-profile.schema.json")
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(analysis.analysisProfile), true, JSON.stringify(validate.errors));
  assert.match(analysis.analysisIdentity, /^sha256:[0-9a-f]{64}$/);
});
