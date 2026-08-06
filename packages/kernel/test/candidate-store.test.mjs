import assert from "node:assert/strict";
import test from "node:test";
import {
  KernelError,
  KernelValidationError,
  canonicalize,
  createCandidateStore
} from "../src/index.js";

const REF_A = `sha256:${"a".repeat(64)}`;
const REF_B = `sha256:${"b".repeat(64)}`;
const REF_C = `sha256:${"c".repeat(64)}`;

function pair(role = "supports") {
  return {
    domain: "element-exact",
    nodes: [{ ref: REF_A }, { ref: REF_B }],
    edges: [{ from: 0, to: 1, role }]
  };
}

test("candidate store admits one canonical representative and counts isomorphic duplicates", () => {
  const store = createCandidateStore({ domain: "element-exact" });
  const admitted = store.add(pair());
  const duplicate = store.add({
    domain: "element-exact",
    nodes: [{ ref: REF_B }, { ref: REF_A }],
    edges: [{ from: 1, to: 0, role: "supports" }]
  });
  assert.equal(admitted.status, "admitted");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.candidateId, admitted.candidateId);
  assert.equal(store.size, 1);

  const snapshot = store.finalize();
  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.interpretable, true);
  assert.equal(snapshot.counts.attemptedCandidates, 2);
  assert.equal(snapshot.counts.uniqueCandidates, 1);
  assert.equal(snapshot.counts.duplicateCandidates, 1);
  assert.equal(snapshot.candidates[0].duplicateCount, 1);
});

test("final candidate-store snapshot is independent of candidate input order", () => {
  const first = createCandidateStore({ domain: "element-exact" });
  first.add(pair("supports"));
  first.add(pair("transforms"));

  const second = createCandidateStore({ domain: "element-exact" });
  second.add(pair("transforms"));
  second.add(pair("supports"));

  assert.equal(canonicalize(first.finalize()), canonicalize(second.finalize()));
});

test("candidate budget exhaustion never produces an interpretable complete snapshot", () => {
  const store = createCandidateStore({ domain: "element-exact", maxCandidates: 1 });
  const admitted = store.add(pair("supports"));
  const duplicate = store.add(pair("supports"));
  const exhausted = store.add(pair("transforms"));
  assert.equal(admitted.status, "admitted");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(exhausted.status, "budget-exhausted");
  assert.equal(store.status, "budget-exhausted");

  const snapshot = store.finalize();
  assert.equal(snapshot.status, "budget-exhausted");
  assert.equal(snapshot.interpretable, false);
  assert.equal(snapshot.counts.uniqueCandidates, 1);
  assert.equal(snapshot.counts.duplicateCandidates, 1);
  assert.equal(snapshot.counts.excludedCandidates, 1);
  assert.equal(snapshot.budget.exhausted?.firstExcludedCandidateId, exhausted.candidateId);
});

test("candidate store fixes one counting domain and closes explicitly", () => {
  const store = createCandidateStore({ domain: "element-exact" });
  assert.throws(
    () => store.add({
      domain: "profile-quotient",
      nodes: [{ ref: REF_C }],
      edges: []
    }),
    (error) => error instanceof KernelError && error.code === "CANDIDATE_STORE_DOMAIN_MISMATCH"
  );
  store.finalize();
  assert.throws(
    () => store.add(pair()),
    (error) => error instanceof KernelError && error.code === "CANDIDATE_STORE_CLOSED"
  );
});

test("candidate store validates its fixed canonicalization policy at creation", () => {
  assert.throws(
    () => createCandidateStore({
      domain: "element-exact",
      canonicalization: { policy: { connected: "yes" } }
    }),
    (error) => error instanceof KernelValidationError && error.code === "GRAPH_OPTIONS_VALIDATION_FAILED"
  );
  assert.throws(
    () => createCandidateStore(),
    (error) => error instanceof KernelValidationError && error.code === "CANDIDATE_STORE_VALIDATION_FAILED"
  );
});
