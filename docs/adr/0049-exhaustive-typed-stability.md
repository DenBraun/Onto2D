# ADR-0049: Exhaustive typed `stableUnder`

- Status: accepted
- Date: 2026-08-12

## Context

The predicate language and numeric-policy binder already recognized
`stableUnder(delta, P, threshold)`, but the rule-package perturbation registry
was untyped and the local evaluator rejected the operator. Executing it without
freezing the edit family, invalid-edit denominator, empty family, three-valued
inner outcomes, and resource ceiling would make the same package depend on
hidden runtime choices. A sampled mode additionally needs a versioned random
stream and statistical uncertainty contract; the existing run seed and sample
budget alone do not define either.

## Decision

Schema v1 admits registry-only string identifiers for compatibility and four
executable finite definition kinds:

- `edge-deletion`, optionally restricted to declared roles;
- `node-deletion`, which also removes incident edges;
- `edge-role-replacement`, with a non-empty list of distinct `from`/`to`
  mappings;
- `numeric-attribute-displacement`, targeting one structural node or edge
  attribute by a positive finite epsilon in one or both declared directions.

Executable definitions normalize the enumeration to
`exhaustive-valid-single-edits-v1` and the empty policy to `indeterminate`
unless `vacuous-pass` is explicit. Registry-only strings remain analyzable but
fail package-filter preflight when a plan tries to execute them. Sampled
enumeration is not accepted by this contract.

One canonical parent item and one applicable edit specification form one
attempt. Attempts are ordered by canonical parent index and normalized
definition order. Semantically distinct attempts remain distinct denominator
members even when they canonicalize to the same perturbed candidate. Every
valid perturbation is canonicalized under the original graph policy and keeps
its candidate ID, canonical-to-parent node/edge mappings, nested outcome, and
witnesses. Missing/non-numeric attributes, non-finite or ineffective numeric
displacements, and graph-policy-invalid results are retained as skipped audit
records and omitted from the valid denominator. Canonicalization budget errors
and other non-validation errors propagate instead of being relabeled invalid.

Let `V` be the number of valid perturbed candidates, `S` the passing count, and
`I` the indeterminate count. The evaluator compares the exact rational bounds

```text
lower = S / V
upper = (S + I) / V
```

against the exact decimal spelling of `threshold`. It passes when
`lower >= threshold`, fails when `upper < threshold`, and is otherwise
indeterminate. Rounded decimal bounds are diagnostics only and use the bound
run precision. `V = 0` is indeterminate unless the definition explicitly uses
`vacuous-pass`.

The local artifact binds a domain-separated perturbation-context hash, exact
threshold, decision rule, all reconciled counts, bounds, and attempts. Nested
substructure policies are discovered through `stableUnder` and their ID is
retained when needed. Perturbations and substructures share the existing
10,000-attempt ceiling, with the exact edit-family size preflighted before
materialization. Runtime invariants inside a perturbed candidate remain
unsupported until subset/missing-node invariant resolution is separately
defined.

The changed semantics use `local-predicate-evaluator-v15`,
`onto2d:predicate-local-evaluation:v15`,
`package-candidate-filter-evaluator-v16`, and
`onto2d:package-candidate-filter:v16`. Package filtering supplies only the
typed definitions required by each plan, and complete census execution retains
every resulting pass/fail/indeterminate artifact.

## Consequences

Finite stability claims are now deterministic, reproducible, auditable, and
available in both `element-exact` and `profile-quotient` counting domains.
Changing an edit kind, role filter, replacement, target attribute, epsilon,
direction, or empty policy changes package/rules identity and the bound local
evaluation. Numeric displacement is rejected unless the target attribute is
structural under the run graph policy, because a non-structural value is absent
from canonical candidate identity.

This decision does not define sampled stability. A future sampled mode must
add a versioned PRNG/stream derivation, sampling frame, replacement policy,
sample-size semantics, uncertainty interval, and decision rule rather than
reusing the exact evaluator under an approximate label.
