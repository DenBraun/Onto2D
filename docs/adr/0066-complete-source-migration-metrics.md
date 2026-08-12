# ADR-0066: Complete source-migration metrics

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0063 computes every migration diagnostic derivable from the reviewed
classification, resolution, and condensation chain, but the architecture's
`MigrationMetrics` contract additionally requires one explicit disposition
for every raw nontrivial SCC and the count of clusters crossing source-
catalogue levels. Neither fact may be inferred from a desired topology or from
an incomplete node subset.

ADR-0065 also makes effective post-unblinding classification executable, so
the complete metric artifact must work for both the original frozen projection
and a separately hashed current projection without accepting stale reviewed
inputs.

## Decision

`@onto2d/catalog-adapter` implements `source-migration-metrics-v1`. The
constructor exactly verifies the complete reconciliation report and all of its
upstream policy, annotation, amendment, projection, resolution, and
condensation inputs. The caller then supplies:

- exactly one primary-resolution record and rationale `ArtifactRef` for every
  raw nontrivial SCC in the verified report;
- exactly one non-negative source-catalogue level for every reconciled source
  node, including isolated records.

Raw-component members and edge identities are always derived from the report;
callers cannot replace them. If all members resolve into one reviewed cluster,
the primary resolution and `resultingCluster` must exactly match the cluster's
reviewed disposition. If members resolve to multiple vertices, the record must
state nonformation-layer separation, except when replay proves that a
post-unblinding change converted a formerly strongly connected formation
projection into a separated effective projection. In that case the primary
resolution must explicitly state post-unblinding reclassification.

The adapter derives the full architecture metric set, including raw counts and
histograms, all six effective edge counts, blindness/disagreement/change
signals, complete dispositions, resolution shares, cluster counts,
cross-catalogue-level clusters, clustered-source share, and fitting-risk
reasons. It hashes the frozen risk-policy subset separately and hashes the
complete artifact under `onto2d:source-migration-metrics:v1`.

## Consequences

- Missing, duplicate, unknown, or topologically inconsistent raw-SCC
  dispositions fail closed.
- Missing, duplicate, unknown, or invalid catalogue-level mappings fail
  closed; isolated nodes remain part of the denominator and completeness
  check.
- Cross-level cluster counts are derived from the reviewed node partition and
  complete source-level mapping rather than submitted as trusted totals.
- Frozen and amended classification paths produce the same metric contract
  but retain different upstream identities and risk evidence.
- Cluster-concentration testing remains separate and is implemented later by
  ADR-0068 from an independently frozen bottleneck definition. Current-
  catalogue policy, annotations, dispositions, levels, and the loadable
  migration package remain research/application inputs.
- `POST-CLOSURE-VIS-01` remains deferred until the complete kernel closure.

## Verification

Fixtures cover raw-SCC separation, reviewed constitutive condensation, a
cross-level amended cluster, complete node/edge propagation, independent risk-
policy and metrics hashes, exact replay, JSON Schema conformance, missing
catalogue levels, contradictory dispositions, tampering, and Node 20/22.
