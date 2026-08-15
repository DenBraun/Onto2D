# ADR-0034: Complete-cohort functional ranking

Status: implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

The complete cohort partition now fixes every locally eligible candidate's
competition population, and the finite functional evaluator can score one
verified eligible candidate. A selector result still cannot be obtained by
calling that evaluator independently and keeping only convenient values. Every
member must be evaluated, every unscoreable member must remain visible, and
the ranking must preserve semantic ties without using canonical identity as a
scientific decision.

Functional scores are rounded once under the bound run precision and retain an
effective absolute uncertainty. Pairwise tolerance equality is not transitive,
so applying it sequentially would make dense ranks depend on candidate order.
The selector epsilon is a separate, package-owned degeneracy window and must
not be confused with either score uncertainty or the functional result-
tolerance gate.

## Decision

`package-selector-ranker-v1` consumes an independently reproduced complete
`package-cohort-partitioner-v1` artifact and one normalized selector ID from
the same loaded package.

- The ranker reproduces the loaded package, complete census, and complete
  cohort partition. The partition rule must be the selector's declared rule;
  no caller-supplied member list or score is accepted.
- The referenced functional is evaluated for every cohort member through one
  prepared verified functional session. Every stored filter is reproduced,
  and every full scored or indeterminate functional artifact is retained.
- Scoreable members are serialized by objective-oriented exact rounded value
  and then candidate ID. Candidate ID is only a deterministic ordering and
  presentation-leader tie-break.
- Dense ranks start at `1`. Tolerance-equivalent rank groups are the connected
  components of the closed score intervals
  `[rounded - effectiveAbsoluteTolerance, rounded +
  effectiveAbsoluteTolerance]`. This transitive closure is deterministic and
  independent of input order; distinct components are strictly ordered.
- The mathematical optimum is the first objective-oriented rounded score.
  Semantic extrema contain every score whose oriented difference from that
  optimum is at most the normalized epsilon value under one closed boundary
  comparison. That comparison uses the maximum of the candidate score bound,
  optimum score bound, and epsilon's own effective absolute tolerance. It does
  not feed the comparison result back into another widening step.
- Degeneracy is the complete semantic-extremum count. Its ratio uses the full
  cohort size, and variational selectivity is
  `1 - degeneracy / cohortSize`. A singleton therefore reports zero observed
  variational concentration.
- Gap is the non-negative objective-oriented difference between the first and
  second serialized scoreable members. A tied second member gives zero; fewer
  than two scoreable members gives `null`. Its uncertainty is the sum of both
  score bounds.
- If any member is functionally indeterminate, every member and provisional
  dense rank remains inspectable, but the cohort optimum, semantic extrema,
  degeneracy, gap, and variational selectivity are `null`. The whole selector
  ranking is indeterminate rather than silently shrinking the denominator.
- An empty source partition produces an explicit empty ranking. An
  indeterminate source partition produces no cohort rankings. A ranked
  level-wide variational summary is the population-weighted value
  `1 - sum(degeneracy) / sum(cohortSize)`; it is `null` if any required cohort
  is indeterminate.
- A deterministic functional-evaluation ceiling is checked before evaluation.
  The complete artifact binds package, rules, run binding, census, partition,
  selector, policy identifiers, all functional evaluations, rankings, metrics,
  exclusions, execution counts, and reconciliation counts in
  `onto2d:package-selector-ranking:v1`.

## Consequences

- missing scientific values cannot improve a result by disappearing from its
  denominator;
- tolerance chaining cannot make ranks depend on input order;
- score uncertainty, epsilon degeneracy, and functional tolerance admission
  remain three explicit contracts;
- complete semantic extrema are retained even when canonical IDs provide a
  stable presentation order;
- this artifact does not perform sensitivity sweeps, combine multiple
  selectors into final admission, materialize elements, or authorize pruning.

## Verification

Local conformance fixtures cover minimization and maximization, exact and uncertain
dense ties, transitive interval components, epsilon boundaries and epsilon
tolerance, all-equal and singleton cohorts, gap zero/null/positive behavior,
multiple cohorts and weighted summaries, indeterminate member retention,
empty and source-indeterminate partitions, selector/rule/package/run/census/
partition drift, evaluation ceilings, candidate-order invariance, exact replay,
schema/type agreement, and deterministic replay. The repository-wide Node.js
20 suite passes locally; independent Node.js 22 and cross-platform evidence
remain review gates.
