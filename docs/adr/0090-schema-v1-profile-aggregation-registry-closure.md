# ADR-0090: Schema-v1 profile-aggregation registry closure

- Status: accepted
- Date: 2026-08-12

## Context

The capability inventory still described "additional profile invariant
aggregation" as pending after ADR-0051 implemented strict consensus and the
explicit `arithmetic-mean-conservative-v1` policy. No paper requirement or
package contract names another aggregation operator. Inventing a median,
minimum, maximum, interval union, or weighted mean would require scientific
choices about admissible types, weights, uncertainty, evidence, missing data,
and provenance that cannot be inferred by the kernel.

Treating every conceivable future operator as unfinished work makes the
schema-v1 kernel impossible to close even though its vocabulary is already a
closed enum and unknown policies fail before execution.

## Decision

The schema-v1 profile-invariant aggregation registry is complete with exactly
two modes:

1. omitted `profileAggregation`: strict identical normalized consensus across
   the complete profile class;
2. `arithmetic-mean-conservative-v1`: the explicit numeric scalar/Quantity
   policy frozen by ADR-0051.

All other names remain invalid at JSON Schema and expression-analysis
boundaries. They are future scientific extensions, not pending implementations
of the current kernel. Adding one requires a new ADR, an explicit schema and
artifact version, complete member/type/unit/semantic rules, uncertainty and
provenance combination, and conformance across local predicates, package
functionals, and cohort keys.

No runtime artifact or hash-domain version changes because this decision
closes the existing registry rather than changing either executable policy.

## Consequences

- the speculative `additional-profile-invariant-aggregation` pending
  capability is removed;
- the kernel does not imply that arithmetic means are universally meaningful;
- unsupported operator names continue to fail explicitly instead of receiving
  a hidden default or representative substitution;
- future research packages can extend the registry only through a versioned,
  reviewable scientific contract.

## Verification

Existing analyzer and JSON Schema negatives reject unknown aggregation names.
Scalar and Quantity tests cover exact member order, precision, uncertainty,
evidence, and profile-wide execution in local predicates, functionals, cohort
keys, and nested substructures. Capability and documentation checks ensure the
closed registry is no longer reported as unfinished work.

`POST-CLOSURE-VIS-01` remains scheduled only after every remaining kernel gate
is closed.
