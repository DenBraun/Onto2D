# ADR-0053: Deterministic monotonicity audit and pruning controller

- Status: accepted
- Date: 2026-08-12

## Context

Predicate plans already distinguish a package's `monotoneViolation` assertion,
static failure persistence, partial detectability, and the resulting pruning
eligibility. The partial graph evaluator can reproduce a persistent failure for
a `static-proven` graph plan, but deliberately reports
`pruningAuthorized: false`. Letting that diagnostic close generator branches
without an independently bound falsification audit would make the enumerated
universe depend on an unaudited optimization.

The architecture also requires randomized extension checks to remain
falsification evidence rather than mathematical proof. Passing samples must not
promote a `blocked-unproven` assertion, while one discovered repair must fail
the audit before pruning can affect a census.

## Decision

`package-predicate-monotonicity-auditor-v1` reproduces the complete depth-one
package candidate universe and binds its package, rules, run configuration,
candidate binding, seed, canonical candidate IDs, and extension-frame hash.
Its v1 extension model is
`complete-node-canonical-edge-prefix-v1`: all candidate nodes are fixed, and a
strict canonical edge prefix is paired with the corresponding complete
candidate. This narrow model matches the next generator-integration boundary
without claiming node-growth or arbitrary attribute derivation.

For every predicate declaring `monotoneViolation: true`, the auditor samples
uniformly from the finite set of strict edge-prefix/complete-extension pairs,
with replacement. Draws use domain-separated SHA-256 rejection sampling keyed
by the run hash, universe hash, predicate-plan hash, sample ordinal, and
rejection counter. There is no ambient randomness and no modulo bias. The
default is 200 samples per declared predicate, the artifact records the exact
requested count and every accepted frame index, and the hard per-predicate
ceiling is 10,000.

Each supported graph plan is evaluated on both the partial prefix and complete
extension. A `partial fail -> extension pass` pair is a counterexample to the
declared violation monotonicity and gives the plan and whole audit `failed`
status. Unsupported runtime operators, a zero sample budget, or an empty strict
extension frame are explicit indeterminate states. Audit samples retain the
partial graph, complete candidate, complete/partial evaluation, and diagnostic
hashes plus their outcomes, edge counts, and stream-draw count. Stored audits
are accepted only through exact deterministic reproduction.

Passing samples mean only that the bounded audit found no counterexample. A
plan is marked pruning-eligible only when it also has analyzer status
`static-proven`. Passing samples never upgrade `blocked-unproven`,
`blocked-partial-data`, or runtime-unsupported plans.

`package-partial-pruning-controller-v1` is a separate decision boundary. It
reproduces the complete audit, rejects partial graphs outside the bound
package/run vocabulary, and accepts only complete-node states under the frozen
extension model. It authorizes pruning exactly when:

1. the whole package audit passed;
2. the named plan's audit passed;
3. the analyzer marked that plan `static-proven`;
4. the reproduced partial diagnostic contains a persistent failure.

The embedded `partial-graph-predicate-evaluator-v1` artifact continues to say
`pruningAuthorized: false`; authority exists only in the separately hashed
controller decision. Audit artifacts use
`onto2d:package-pruning-audit:v1`, sample draws use
`onto2d:package-pruning-audit-sample:v1`, the candidate frame uses
`onto2d:package-pruning-audit-universe:v1`, and decisions use
`onto2d:package-pruning-decision:v1`.

## Consequences

False monotonicity claims now have a deterministic, replayable failure path,
and statically proven claims can receive an explicit authorization without
weakening the diagnostic evaluator's contract. Package/run drift, audit
tampering, foreign node references or roles, open node sets, and unsupported
plans fail closed.

This ADR does not by itself let candidate enumeration discard work. ADR-0054
adds a prepared session and correctness-first pre-admission integration with a
separate pruning census and pruning-disabled post-filter differential
conformance. Recursive decoration-state branch closure, arbitrary node-growth,
structural-attribute growth, depth-aware audit universes, and resume-state
serialization remain outside v1. ADR-0055 subsequently adds a distinct actual
raw-frontier audit/controller for depth-one edge-group closure without
changing this canonical-prefix contract.
