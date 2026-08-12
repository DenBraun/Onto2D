# ADR-0068: Source-cluster concentration

- Status: accepted
- Date: 2026-08-12

## Context

The target architecture asks whether reviewed constitutive clusters concentrate
at independently defined bottleneck depths. That comparison must not use
cluster locations to choose the bottleneck definition, must count every source
resolution vertex exactly once, and must report depletion or indeterminacy as
faithfully as apparent concentration.

ADR-0066 supplies complete migration metrics but intentionally does not know
the kernel-depth population or independently frozen Boolean/variational
bottleneck criteria. A separate artifact is required so scientific thresholds
and depth assignments do not silently enter migration identity.

## Decision

`@onto2d/catalog-adapter` implements `source-cluster-concentration-v1`. It
first exactly replays the complete migration-metrics chain. The caller then
supplies:

- a versioned bottleneck definition, canonical freeze time, statement,
  exposure declaration, content-addressed definition artifact, and explicit
  concentrated/depleted enrichment thresholds that bracket one;
- an assertion that cluster locations were not inspected before the
  definition was frozen;
- one unique point per kernel depth with its `depthBasis`, total
  stratification-vertex count, bottleneck label, and the complete subset of
  reviewed source-resolution vertex IDs mapped to that depth.

Every reviewed source vertex must occur at exactly one point. The declared
stratification population must be at least as large as its source-vertex
subset. The adapter derives, per point, the constitutive-cluster count/density,
source-record count, constitutive-member count/share, and then pools member
shares over bottleneck versus non-bottleneck depths.

`enrichmentRatio` is bottleneck share divided by non-bottleneck share. A zero
or missing denominator produces `null` and `indeterminate`, never infinity.
Otherwise the independently frozen thresholds select `concentrated`,
`depleted`, or `uniform`. The result records `nullModel.status = "not-run"`;
it does not fabricate the optional seeded permutation baseline. The definition
and complete result receive separate content identities.

## Consequences

- Source vertices cannot be duplicated, omitted, or assigned to two depths.
- Cluster membership, dispositions, and member counts are derived from the
  reviewed migration rather than resubmitted.
- External non-source stratification vertices can remain in the density
  denominator through the declared complete population count.
- An exposed bottleneck definition fails closed, and depletion is a valid
  hypothesis-weakening outcome.
- Seeded permutation null execution remains a separate generic kernel gate;
  current-catalogue depth mapping and bottleneck authorship remain research
  inputs.
- `POST-CLOSURE-VIS-01` remains deferred until the complete kernel closure.

## Verification

Fixtures produce a deterministic depleted result, verify pooled counts/shares,
separate definition/result hashes, exact replay, schema conformance, rejection
of cluster-aware definitions and incomplete vertex partitions, and Node 20/22.
