# ADR-0033: Complete package cohort partitioning

Status: implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The complete local-filter census now fixes every canonical candidate and its
local verdict, and the package functional runtime can calculate one eligible
candidate's finite score. Ranking still cannot begin until every locally
eligible candidate belongs to exactly one cohort under the selected
theory-bearing `CohortRule`. Constructing cohorts from a caller-selected subset
would change the competition population, optimum, degeneracy, and variational
selectivity without changing the rule.

Schema-v1 declares five rule forms. Shared support is transitive incidence,
profile role is exact normalized tuple equality, invariant windows are anchored
half-open bins, singleton means no competition, and global competition must be
explicit. Candidate-specific missing invariant data and interval uncertainty
at a window boundary must not silently become a default key.

## Decision

`package-cohort-partitioner-v1` consumes an independently reproduced complete
`package-candidate-census-evaluator-v1` artifact and one normalized cohort-rule
ID from the same loaded package.

- The partitioner reproduces the loaded package, RunConfig, execution limits,
  complete enumeration, and every embedded filter artifact through the census
  verifier. It never accepts a caller-provided candidate list or eligible
  label.
- Only `eligible` candidates enter cohort membership. Predicate-rejected and
  filter-indeterminate candidate IDs remain in separate sorted exclusion lists.
  A census whose threshold interpretation is already `indeterminate` produces
  an indeterminate partition and no cohorts. No eligible candidates produces
  an explicit empty partition.
- Cohort key expressions are reanalyzed under the package invariant
  declarations and executed by the same verified package value runtime used by
  functional scoring. Constants, canonical counts, exact/profile-consensus
  Quantity invariants, addition, and multiplication therefore have one
  execution meaning. Schema-v1 supplies neither coefficient nor structural-
  attribute environments for cohort keys, so those references remain loader
  errors.
- A normalized key atom records scalar identity directly, numbers as canonical
  unrounded decimals, and Quantities as canonical unrounded decimals, unit,
  inferred semantic when present, and effective absolute tolerance. Evidence
  and complete selection/invariant witnesses remain in the expression
  evaluation record but do not split otherwise identical resource or role
  keys.
- `shared-support` gives every key-expression slot its own resource namespace.
  A resource token hashes the slot index and normalized atom in
  `onto2d:cohort-resource:v1`. Cohorts are connected components of the
  candidate/resource incidence graph, so overlapping support joins candidates
  transitively while every candidate remains in exactly one component.
- `profile-role` groups candidates by exact canonical equality of the ordered
  normalized atom tuple. Key position is semantic and is not sorted.
- `invariant-window` computes the exact mathematical floor of
  `(value - origin) / width` and stores the arbitrary-precision signed bin
  index as a canonical integer string. The normalized origin and strictly
  positive width anchor lower-closed, upper-open bins. Non-zero origin or width
  uncertainty makes the partition indeterminate because it moves every bin.
  Candidate-value uncertainty is accepted only when its closed interval lies
  wholly inside one bin; touching or crossing another bin is indeterminate.
- `singleton` emits one cohort per eligible candidate. `global` emits one
  cohort containing the complete eligible population and is never synthesized
  when no rule is declared.
- If any required key evaluation is missing, ambiguous, or window-uncertain,
  the artifact retains every candidate key evaluation but emits no partial
  cohort list. This preserves a total-partition invariant and prevents ranking
  a silently reduced population.
- Each non-empty cohort hashes its rule, normalized key, and complete sorted
  member set in `onto2d:cohort:v1`. The complete partition binds package,
  rules, binding, census, counting domain, source population, rule, exclusions,
  all key evaluations, cohorts, and reconciled counts in
  `onto2d:package-cohort-partition:v1`.

## Consequences

- rankers can consume only a complete, content-addressed competition
  population;
- shared-support overlap cannot create duplicate or overlapping cohorts;
- deterministic bins do not rely on non-transitive pairwise epsilon chaining;
- scientific uncertainty cannot make boundary membership look exact;
- cohort construction still does not evaluate a selector, rank, admit, reject,
  or prune any eligible candidate.

## Verification

Local conformance fixtures cover all five rule kinds, transitive shared-support,
ordered profile-role tuples, negative and exact-boundary invariant bins,
within-bin and boundary-crossing uncertainty, exact/profile invariant
resolution, missing/ambiguous keys, empty eligible populations, rejected and
filter-indeterminate exclusions, census-threshold propagation, altered
census/package/run/options rejection, input-order and candidate-relabel
invariance, exact coverage/no-overlap reconciliation, hash reproduction,
schema/type agreement, and deterministic replay. The repository-wide Node.js
20 suite passes locally; independent Node.js 22 and cross-platform evidence
remain review gates.
