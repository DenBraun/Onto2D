# ADR-0015: Deterministic decorated-candidate enumeration

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

The skeleton enumerator and CandidateStore freeze the two ends of candidate
generation, but they do not define the finite decorated universe between them.
Direction, role, enabled parallel multiplicity, enabled self-loops, structural
attributes, and node references are all identity-bearing. Their enumeration
must be deterministic, bounded before the next candidate is materialized, and
diagnostically separate from canonical deduplication and graph-policy
exclusion.

Profile-derived role guards do not yet have executable semantics. The later
ADR-0017 graph-only evaluator is
deliberately separate from this enumerator and does not authorize pruning by
itself. ADR-0054 adds an internal-only audited pre-admission hook, and ADR-0055
adds internal-only observation and recursive edge-group frontier hooks. The
public enumerator must not accept arbitrary decision code or infer unsupported
semantics.

## Decision

`enumerateDecoratedCandidates` v3 accepts a finite set of simple skeletons, one
fixed counting domain, finite node and edge variant alphabets, and a graph
policy. A node variant is a reference plus its selected structural attributes.
An edge variant is a role plus its selected structural attributes. Scientific
meaning is caller-supplied; the enumerator performs no catalogue lookup or
scientific computation.

Before enumeration, the implementation:

- closes the input and option vocabularies;
- re-canonicalizes every skeleton and rejects duplicate skeleton identities;
- normalizes graph-policy defaults and canonicalization limits;
- normalizes Quantity-valued structural attributes through the graph
  canonicalizer;
- rejects non-structural attributes and variants that collapse to the same
  normalized structural value;
- sorts skeletons and variants by canonical content.

Simple-skeleton and one-edge alphabet preflight use the fixed supported
six-node/simple-edge safety ceiling. The configured decorated-edge limit still
governs every emitted candidate, so an edge bound below a skeleton's adjacency
count can define an empty completed universe without preventing that skeleton
from being identified first.

For each skeleton, node variants are assigned by deterministic Cartesian
product. Every simple adjacency receives at least one directed edge. With
parallel edges disabled it receives exactly one edge; with parallel edges
enabled it receives a canonical multiset of directed edge variants up to the
edge bound. Non-loop direction is represented by the two endpoint
orientations. When self-loops are enabled, every node receives an optional
loop multiset under the same bound. Multisets, not edge sequences, prevent
input-local edge ordering from inflating the raw universe.

The default edge bound is the architecture's `n + 2`. An explicit numeric
bound may instead define an empty but complete universe for a skeleton whose
simple adjacencies already exceed it. This is a universe definition, not
runtime exhaustion.

Each complete decoration is passed to the fixed-policy CandidateStore.
Directed-strong connectivity failures are counted as policy exclusions before
store admission. Other validation failures remain hard errors. The completed
result reconciles:

```text
generatedCandidates = policyExcludedCandidates
                    + canonicalizationIndeterminateCandidates
                    + preAdmissionPrunedCandidates
                    + attemptedCandidates
```

and separately reports canonical and duplicate candidates.

Three generator budgets are explicit:

- `maxDecorationStates` bounds logical recursive extensions;
- `maxRawCandidates` bounds complete decorations before the next candidate is
  materialized;
- `maxCandidates` retains the CandidateStore's unique-candidate semantics.

Complete-candidate canonicalization search exhaustion is converted into the
same non-interpretable generator result state and counted separately. Input
normalization must complete before a result artifact exists. State/raw
exhaustion retains an open CandidateStore snapshot; unique-candidate exhaustion retains its
`budget-exhausted` snapshot. Only successful traversal finalizes the store and
sets `interpretable: true`.

No resumable cursor is claimed at this historical boundary. The recorded cursor identifies the first
unvisited logical boundary for diagnostics only.

## Consequences

- finite skeleton and decoration alphabets now produce a complete canonical
  candidate set without caller-managed nesting loops;
- input skeleton, endpoint, node-variant, and edge-variant order is
  non-semantic;
- direction, roles, parallel multiplicity, loops, references, and declared
  structural attributes remain visible to canonical identity;
- raw, policy-excluded, canonicalization-indeterminate, attempted, canonical,
  and duplicate counts remain distinct;
- reaching a numeric budget is harmless if traversal is actually finished;
  attempting the next logical state makes truncation explicit;
- profile-slot derivation, node-growth frontiers, and resumable state remain
  separate work at this boundary; ADR-0081 subsequently adds exact node-
  frontier counts and portable replay-resumable state without reinterpreting
  this diagnostic cursor. Audited package-bound pre-admission, raw-frontier,
  and generalized depth-aware pruning are specified by ADR-0054 through ADR-0056.

## Acceptance artifacts

- differential reconciliation with a direct bounded brute-force decorator;
- input-order and skeleton-endpoint invariance;
- direction, role, parallel-multiset, and self-loop fixtures;
- directed-strong policy-exclusion reconciliation;
- edge-bound empty-universe behavior;
- raw, logical-state, unique-candidate, and canonicalization-search exhaustion;
- structural-attribute closure and SI-normalized duplicate rejection;
- schema, public type, capability, source, test, and build checks.
