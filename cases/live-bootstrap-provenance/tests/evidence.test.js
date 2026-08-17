import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildEvidence,
  extractCase,
  requireDemonstratedDependency,
  verifySourceInputs,
  verifyEvidenceBoundary
} from "../extract.mjs";
import { readCaseJson } from "./helpers.js";

test("evidence records are schema-valid, sourced, and limited to justified relations", async () => {
  const [{ evidence }, schema] = await Promise.all([
    extractCase(),
    readCaseJson("schema/provenance-evidence.schema.json")
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(evidence), true, JSON.stringify(validate.errors));
  assert.equal(evidence.records.length, 442);
  assert.equal(evidence.records.filter((record) => record.evidenceClass === "observed-order").length, 204);
  assert.equal(evidence.records.filter((record) => record.evidenceClass === "derived-state").length, 205);
  assert.equal(evidence.records.filter((record) => record.method === "reviewed-line-assertion-v1").length, 33);
  assert.equal(evidence.records.every((record) => record.source !== null), true);
  assert.equal(evidence.evidenceProfile.id, "selected-bootstrap-milestones-v1");
  assert.equal(evidence.records.some((record) => record.relation === "uses"), false);
  assert.equal(evidence.records.some((record) => record.evidenceClass === "inferred-dependency"), false);
});

test("observed order cannot satisfy a demonstrated dependency request", async () => {
  const { trace, evidence } = await extractCase();
  const subject = trace.events[1].eventId;
  const object = trace.events[0].eventId;
  assert.ok(evidence.records.some((record) =>
    record.subject === subject
    && record.object === object
    && record.evidenceClass === "observed-order"
  ));
  assert.throws(
    () => requireDemonstratedDependency(evidence.records, subject, object),
    /no demonstrated dependency/
  );
});

test("a direct script reference can satisfy a demonstrated dependency request", () => {
  const record = {
    evidenceId: "evidence:test:000000",
    subject: "build:gcc",
    relation: "uses",
    object: "artifact:tcc",
    evidenceClass: "script-reference",
    layer: "upstream-fact",
    source: { path: "steps/gcc/pass1.sh", line: 17 },
    status: "observed"
  };
  assert.equal(requireDemonstratedDependency([record], record.subject, record.object), record);
});

test("reviewed build-script evidence resolves to exact manifest event occurrences", async () => {
  const { trace, evidence } = await extractCase();
  const gccPass1 = trace.events.filter((event) =>
    event.directive === "build" && event.target === "gcc-4.0.4"
  )[0];
  const demonstrated = requireDemonstratedDependency(
    evidence.records,
    gccPass1.eventId,
    "tool:tcc"
  );
  assert.equal(demonstrated.evidenceClass, "declared-input");
  assert.deepEqual(demonstrated.source, {
    path: "steps/gcc-4.0.4/pass1.sh",
    line: 82
  });
  const gccPass2 = trace.events.filter((event) =>
    event.directive === "build" && event.target === "gcc-4.0.4"
  )[1];
  assert.ok(evidence.records.some((record) =>
    record.subject === gccPass2.eventId
    && record.evidenceClass === "unknown"
    && record.status === "unknown"
  ));
});

test("inferred dependencies cannot be relabeled as upstream facts", () => {
  assert.throws(() => verifyEvidenceBoundary({ records: [{
    evidenceId: "evidence:test:000000",
    subject: "a",
    relation: "depends-on",
    object: "b",
    evidenceClass: "inferred-dependency",
    layer: "upstream-fact",
    source: null,
    status: "observed"
  }] }), /mislabeled as a fact/);
});

test("counterfactual relations cannot enter extracted evidence", () => {
  assert.throws(() => verifyEvidenceBoundary({ records: [{
    evidenceId: "evidence:test:000000",
    subject: "a",
    relation: "counterfactual-shortcut",
    object: "b",
    evidenceClass: "unknown",
    layer: "onto2d-analysis",
    source: null,
    status: "unknown"
  }] }), /entered extracted evidence/);
});

test("observed-order evidence cannot be attached to a causal relation", () => {
  assert.throws(() => verifyEvidenceBoundary({ records: [{
    evidenceId: "evidence:test:000000",
    subject: "a",
    relation: "uses",
    object: "b",
    evidenceClass: "observed-order",
    layer: "upstream-fact",
    source: { path: "steps/manifest", line: 2 },
    status: "observed"
  }] }), /non-order relation/);
});

test("the extracted graph contains no counterfactual or inferred edge", async () => {
  const { graph } = await extractCase();
  assert.equal(graph.edges.some((edge) => edge.relation.includes("counterfactual")), false);
  assert.equal(graph.edges.some((edge) => edge.evidenceClass === "inferred-dependency"), false);
  assert.deepEqual(new Set(graph.nodes.map((node) => node.layer)), new Set([
    "upstream-fact",
    "derived-fact"
  ]));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  assert.equal(graph.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)), true);
});

test("evidence-profile changes alter evidence identity without mutating source identity", async () => {
  const [lock, profile, artifacts] = await Promise.all([
    readCaseJson("upstream.json"),
    readCaseJson("evidence-profile.json"),
    extractCase()
  ]);
  const verified = await verifySourceInputs(lock);
  const changed = structuredClone(profile);
  changed.assertions[0].claim = `${changed.assertions[0].claim} Reviewed test change.`;
  const changedEvidence = buildEvidence(artifacts.trace, artifacts.stateHistory, {
    profile: changed,
    inputs: verified.inputs
  });
  assert.equal(artifacts.trace.source.sourceIdentity, verified.sourceIdentity);
  assert.notEqual(changedEvidence.evidenceIdentity, artifacts.evidence.evidenceIdentity);
  assert.notEqual(
    changedEvidence.evidenceProfile.profileIdentity,
    artifacts.evidence.evidenceProfile.profileIdentity
  );
});

test("reviewed assertions fail closed when their exact source line does not match", async () => {
  const [lock, profile, artifacts] = await Promise.all([
    readCaseJson("upstream.json"),
    readCaseJson("evidence-profile.json"),
    extractCase()
  ]);
  const verified = await verifySourceInputs(lock);
  const changed = structuredClone(profile);
  changed.assertions[0].source.expected = "different source text";
  assert.throws(
    () => buildEvidence(artifacts.trace, artifacts.stateHistory, {
      profile: changed,
      inputs: verified.inputs
    }),
    /line mismatch/
  );
});
