# ADR-0042: Bounded profile collapse and level-boundary diagnostics

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

Profile-quotient generation is an abstraction over element-exact generation.
Equal profiles do not by themselves prove that substituting a representative
preserves local verdicts, selector observables, or the final admitted set.
Comparing raw selectivity ratios would also mix different denominators.

ADR-0041 provides exactly replayable bounded ladders in either counting domain.
The kernel therefore needs a falsifiable comparison in one common canonical
domain and a separate diagnostic that can compare those errors with declared
ontology-level transitions without rewriting author data.

## Decision

`package-profile-collapse-evaluator-v1` compares one requested target depth.

- It reproduces the loaded package and RunConfig, overrides only the counting
  domain, and closes independent element-exact and profile-quotient ladders to
  the same requested bound.
- Every candidate is projected into `profile-quotient` by replacing each
  verified constituent with its normalized profile hash and re-running graph
  canonicalization under the exact bound graph policy and search ceiling.
- Exact multiplicities are grouped under their projected candidate ID. Each
  observation records local verdict, per-predicate outcomes, final admission,
  and selector outcome/score/rank/sensitivity status. Internal and cross-domain
  observable consistency are explicit.
- The compared sets contain finally selected projected candidates. The report
  stores exact-only, quotient-only, intersection, and symmetric-difference
  IDs. `collapseError` is the symmetric-difference size divided by the exact
  projected admitted-set size, is `null` for an empty exact set, and is never
  clamped.
- A completed mismatch is a `counterexample`, not an execution error. The
  lexicographically smallest set difference or observable mismatch retains the
  projected candidate and both observation groups.
- If either ladder terminates before the target transition, the report is
  `truncated`. The full comparison is hashed in
  `onto2d:package-profile-collapse:v1` and accepted only by exact replay.

`package-level-boundary-detector-v1` evaluates every transition through one
requested bound.

- It closes one exact/profile ladder pair and derives each collapse point from
  that shared run, preserving one `depthBasis`.
- Search-interval membership uses the transition target depth inclusively.
  Within each interval, candidate minima must be within `tieTolerance` of the
  minimum and no greater than `maximumCollapseError`.
- Without intervals, global candidate minima are reported but
  `detectedBoundary` remains false.
- A declared comparison uses only a uniform element ontology coordinate or the
  explicit RunConfig `ontologyTarget`. Missing or mixed declarations produce a
  `null` match rather than an inferred label.
- Detected and declared depths, every comparison row, the paired ladder hashes,
  terminal interpretation, and the non-mutation policy are hashed in
  `onto2d:package-level-boundary-report:v1` and exactly replayed.

## Consequences

- profile abstraction is now tested against projected structural results and
  observables rather than incomparable raw denominators;
- exact multiplicity does not create a false mismatch when all grouped members
  agree;
- an abstraction that hides differing invariants, selector outcomes, scores,
  or ranks yields a preserved counterexample;
- computed minima and detections remain diagnostic artifacts and cannot mutate
  author-declared ontology coordinates;
- carrier promotion remains a separate explicit artifact and policy gate,
  implemented subsequently by [ADR-0043](0043-explicit-carrier-promotion.md).

## Verification

Local conformance covers exact multiplicity collapsing to one equivalent
profile candidate, zero collapse error, a non-identical-invariant selector
counterexample, grouped observable inconsistency, domain hashes, exact replay,
tamper rejection, interval minima, declared/detected matching, no-interval
candidate-only behavior, strict JSON Schema validation, public JavaScript and
TypeScript exposure, and configured-kernel adapters. The complete repository
suite passes in the supported Node.js 22 and 24 CI matrix. Independent
implementation comparison remains an acceptance requirement.
