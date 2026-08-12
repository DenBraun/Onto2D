# ADR-0082: Audited node-growth pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0081 exposes exact strict node-assignment frontiers and an internal subtree
hook, but deliberately grants no package predicate authority. Existing
canonical-prefix and raw edge-group pruning audits cannot be reused: their
extension frames begin only after the complete node multiset is known.

A node-growth controller must bind the actual incomplete-node universe,
reproduce exact descendant counts, retain static proof as the authorization
basis, and demonstrate that early closure preserves the established
pre-admission result and census. It must also account for connectivity-policy
exclusions that are not yet observable at a node prefix.

## Decision

`package-node-frontier-auditor-v1` constructs a deterministic frame from every
policy-relevant complete raw extension paired with each of its strict non-empty
node prefixes. For every package predicate declared monotone, seeded
with-replacement samples record the `nodesComplete: false` persistent-failure
diagnostic and the complete extension outcome. A persistent node-prefix failure
followed by a passing extension is a counterexample. As in ADR-0053 through
ADR-0056, absence of sampled counterexamples is falsification evidence only;
authorization still requires a `static-proven` plan and a passed canonical
audit.

The frame and audit are content-addressed independently of edge-frontier
artifacts. The prepared controller validates every supplied node prefix against
the bound domain, skeleton, node alphabet, assigned/remaining counts, exact
edge-completion count per assignment, and exact total raw descendants. It then
reproduces the partial diagnostic. Only a passed node audit, an authorized
static plan, and a detected persistent failure can close the subtree.

For `connected: true` with the `undirected` or `directed-weak` projection, each
raw descendant of a connected skeleton is policy-admissible because every
skeleton edge is mandatory. With `connected: false`, connectivity creates no
exclusions. `directed-strong` may still exclude descendants according to their
later edge directions, so v1 reports `blocked-connectivity` and grants no node
authority. This conservative restriction preserves the exact raw and policy
censuses, not merely the final candidate set.

`package-node-growth-pruned-candidate-generator-v1` consumes only the verified
controller. It retains canonical complete-candidate pre-admission pruning as a
final guard, records every node decision in a chained transcript, and
reconciles visited plus skipped raw candidates. Before returning an
interpretable artifact it requires exact candidate-store and count agreement
with the verified pre-admission-only reference, whose own eligible and
indeterminate sets already match pruning-disabled execution.

The depth-aware audit, decision, and generator reproduce the same contract with
separate hash domains and bind `targetDepth`, the verified contiguous prior
chain, and `sourcePopulationHash`. Profile-composition-gated node-frontier
enumeration remains rejected because that gate changes the audited extension
universe. ADR-0083 subsequently permits only the narrower complete-candidate
pre-admission controller after the profile gate has passed.

## Consequences

- package predicates can now close exact node-assignment subtrees at depth one
  and arbitrary verified target depths;
- all authority is external to the generic decorator and exactly replayable;
- forged prefix values, alphabets, cursors, or descendant counts fail before a
  decision is issued;
- `directed-strong` node growth remains deliberately unoptimized, while its
  complete-node edge-frontier pruning remains available under ADR-0055;
- ordinary closure and ladder APIs keep their exhaustive semantics until an
  explicit integration policy selects the optimized generator;
- `POST-CLOSURE-VIS-01` remains scheduled after the full kernel closure gate.

## Verification

Conformance covers sampled prefix/extension frames, exact frame hashes,
authorized persistent failure, counter and checkpoint tampering, real raw
subtree skips, reduced traversal state, complete pre-admission and
pruning-disabled differential equivalence, fail-closed directed-strong policy,
depth/source binding, exact reproduction, TypeScript declarations, strict Draft
2020-12 schemas, and Node.js 20/22 execution.
