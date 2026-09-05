# ADR-0124: Separate LTEE protocol contracts and eligibility audit

Status: implemented; independent scientific review pending

## Context

The History Matters roadmap calls for complete LTEE protocols after the exact
pilot and FD001 preparation. The selected 2008 Ara-3 evidence contains three
different replay experiments and aggregate generation cells. The exact partition
and numeric regression profiles cannot supply an experimental P/P+H score from
these tables. Published outcomes and earlier project analyses are already known.

## Decision

Implement the case-local `ltee-aggregate-protocol-audit-v1` policy and
`protocol-census-audit-v1` evaluator. Generate three individually hashed contracts,
a protocol set and a reproducible eligibility assessment over the existing
source lock. Freeze the cohort, cutoff, exposure, P/H/Y, missingness,
descriptive P0/P1 and outstanding scoring requirements for each protocol.

Use the existing `NOT_ELIGIBLE` registry status for scored evaluation under this
specific aggregate-table profile. Keep the verdict `not-evaluated`, all primary
scores null and independent review pending. This is not a judgment that LTEE
research or a future justified aggregate-count model is ineligible.

Add an optional registry `assessmentPath` and a separate `experimentalProtocols`
browser envelope. Rebuild every contract and assessment before the presentation
join; reject missing, duplicate, unregistered, modified or relabeled bundles.
The six scored results remain in their existing exact suite. The kernel,
scientific adapters, regression profile and Model Pack formats do not change.

## Alternatives considered

Treating aggregate rows as independent clones would invent identity and
dependence information. Pooling the three denominators would erase distinct
experimental exposure. An in-sample generation fit, a made-up constant baseline
or a new permutation test would introduce an unreviewed statistical claim.
Leaving LTEE as an unstructured draft would leave the documented protocol
milestone incomplete. A separate closed case profile makes the usable evidence
and unresolved scoring requirements concrete without generalizing an evaluator
from a single case.

## Consequences

All 38 observed cells and 10 not-run cells are accounted for, with nulls for
missing counts and explicit non-observation for zeros. Repeated clones, genotype
ambiguity, prior outcome exposure, attributed statistics and the replay-2
expected-mean diagnostic remain visible. No history gain, significance, causal
effect or Historical Load value is produced.

The source projection and original LTEE case/Model Pack retain their identities.
Updating pilot assembly changes its compiler binding and therefore the six
existing contract/result hashes; their metrics, verdicts and null assignments
must remain identical. The browser payload pin changes coherently.

## Artifacts and acceptance

The [protocol package](../../cases/ltee-evolutionary-contingency/history-benchmark/README.md)
contains the policy, contracts, source bundle, assessment, two closed local
schemas, reproduction commands and behavioral tests. Tests cover census and
exposure, missingness, source/policy drift, accessor rejection, claim promotion,
altered denominators, pooling, source discrepancies and registry joins.
`npm run history-benchmark:check` includes both schema validation and exact LTEE
regeneration checks. No independent reviewer is recorded by this implementation.
The [local implementation review](../history/HISTORY_LTEE_PROTOCOL_REVIEW.md)
records acceptance results and the preserved source/metric boundaries.
