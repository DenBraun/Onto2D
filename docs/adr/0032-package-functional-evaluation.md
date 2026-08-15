# ADR-0032: Package-bound finite functional evaluation

Status: implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

Package loading already normalizes typed `Functional` expressions, coefficient
Quantities, result specifications, and selector references. The runtime stops
after local predicate filtering, so cohort ranking cannot yet obtain a score
without bypassing the verified candidate universe or reinterpreting expression
semantics. Functionals must remain unavailable to generation and must execute
only for a candidate whose complete local-filter artifact is reproducibly
`eligible`.

Unlike predicate comparison, a functional has an explicit result
`QuantitySpec`. That result semantic closes the otherwise missing semantic of a
general `Quantity * Quantity` product. The evaluator must also preserve source
uncertainty, coefficient provenance, and candidate-specific missing-data state
instead of inventing a score.

## Decision

`package-functional-evaluator-v1` evaluates one normalized package functional
for one verified eligible package candidate.

- The evaluator independently verifies the loaded package, reproduces the
  package candidate binding, and exactly reproduces the supplied filter
  artifact from its embedded candidate. A changed filter hash, predicate
  witness, candidate, package, run, or execution limit fails before functional
  execution. A reproduced verdict other than `eligible` is rejected because
  functionals execute only after local filtering.
- The normalized functional expression is reanalyzed under the package's
  complete invariant declarations and normalized coefficient record. Runtime
  expression bytes and the reproduced expression/analysis hashes enter the
  functional artifact.
- The finite runtime supports numeric/Quantity constants, canonical
  node/edge/directed-cycle-edge counts, scalar/Quantity structural-attribute
  sums, Quantity coefficients, element-exact or identical-profile-consensus
  Quantity invariants, addition, and multiplication. ADR-0087 supplies the
  normalized candidate-attribute environment to analysis and freezes shared
  functional/cohort-key sum execution.
- Values remain unrounded through the complete expression and round exactly
  once under the bound run precision policy. A number result is lifted to the
  dimensionless result Quantity. A Quantity result must have the functional's
  analyzed result dimension; its final unit and semantic come from the
  normalized result specification.
- Functional addition may combine dimension-compatible terms with different
  input semantic labels because the authored functional and its result
  specification explicitly declare the synthesized result semantic. The input
  Quantities and evidence remain visible in coefficient/invariant witnesses;
  this does not weaken the stricter same-semantic rule for local predicate
  Quantity addition.
- General multiplication combines canonical units multiplicatively and
  propagates effective absolute interval bounds. For accumulated point `a`
  with bound `da` and next point `b` with bound `db`, the new conservative
  bound is `abs(a) * db + abs(b) * da + da * db`. Computational exactness and
  declared scientific uncertainty remain separate.
- The computed score has provenance method `finite-functional-expression-v1`
  and the sorted union of evidence from constants, coefficients, and resolved
  invariants. Coefficient witnesses record the expression path, coefficient
  name, and normalized source Quantity. Invariant and set-selection witnesses
  reuse the existing canonical local contracts.
- The computed effective absolute bound must meet the functional result's
  declared `toleranceTarget` at the rounded score. If it does not, the artifact
  is `indeterminate` with reason `result-tolerance-target-unmet` and exposes the
  diagnostic calculation but no score eligible for ranking.
- Missing or ambiguous invariant resolution and unavailable/disagreeing
  profile member values also produce a content-addressed `indeterminate`
  artifact with a stable reason and details. Invalid package, binding, filter,
  expression, unit, or coefficient state remains a hard contract error.

The artifact is hashed in
`onto2d:package-functional-evaluation:v1`. It records package/rules/binding,
filter/candidate, functional/expression/analysis identities, result
specification, run precision, status, score or indeterminate reason, diagnostic
calculation, and complete witnesses. Operational timing is excluded.

## Consequences

- selector ranking can consume scores without evaluating functionals during
  generation or trusting a caller-provided eligible label;
- authored coefficient expressions and general Quantity products become
  executable in the context where their result semantic is actually declared;
- insufficient scientific precision cannot silently enter an optimum;
- candidate-specific missing data remains enumerable for later
  selection-indeterminate reconciliation;
- cohort construction, ranking, sensitivity, and admission remain later
  artifacts and cannot be claimed by this evaluator alone.

## Verification

Conformance fixtures cover exact scalar lifting, coefficient/invariant
addition, multi-Quantity products and interval bounds, boundary-only rounding,
evidence/provenance union, node/edge/cycle counts, element and profile
resolution, tolerance-target failure, missing/ambiguous data, altered
filter/binding/package rejection, candidate relabelling, schema/type/hash
agreement, and Node.js 22/24 CI determinism.
