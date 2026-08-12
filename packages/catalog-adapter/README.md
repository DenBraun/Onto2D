# `@onto2d/catalog-adapter`

This package loads and audits the existing `scr/level-*.json` catalogue without
changing it. The audit freezes current graph facts needed for Stage R0.

The kernel validates and content-addresses reviewed classification and node-
resolution policies plus caller-supplied independent annotation and blind-
adjudication artifacts. Actual policy authorship, access-controlled view
delivery, annotation collection, reviewed decisions for the current catalogue,
and assembly of the actual current-catalogue kernel package remain pending.
The generic adapter replay and closed ADR-0091 kernel binding are implemented;
raw `ParentCode` edges are never silently treated as generative dependencies.

The adapter now constructs a policy-limited, content-addressed classification
view and, for an already verified caller-supplied annotation chain, emits every
classified relation exactly once plus deterministic `generative` and
`formation-support` SCC partitions. Endpoint substitution, hidden view fields,
and altered upstream artifacts fail. This generic projection is not run on the
current catalogue and does not choose node dispositions.

Given a complete source-node inventory plus explicit reviewed component
dispositions, rationale artifacts, and edge destinations, the adapter replays
the entire classification chain, reconciles every node including isolated
records, constructs only the SCC membership fixed by that chain, and emits a
lossless typed condensation with a verified generative DAG. It never derives a
disposition from component size or a desired acyclicity outcome.

`createSourceMigrationReconciliationReport(...)` then replays that complete
chain and reports raw SCC size facts, all typed edge counts,
descriptive/nonformation resolution shares, cluster/member counts, available
frozen risk signals, and exact node/edge/DAG conservation. It requires a
verified post-unblinding amendment snapshot; a non-empty log forces effective
reprojection into a separately hashed artifact, recomputed SCCs, and newly
bound reviewed resolution/condensation instead of silently reusing stale
results. `createSourceMigrationMetrics(...)` completes the documented metric
set from one reviewed disposition per raw SCC and one catalogue level per
source node, deriving cross-level clusters and a separate risk-policy hash.
Reviewed current-catalogue decisions/data and application of the concentration
and package-assembly paths to them remain pending.

`createSourceMigrationExplanationIndex(...)` exactly replays that complete
metric chain and freezes one queryable lineage record per source node,
relation, and raw SCC. A bound session verifies the serialized index once and
returns separately content-addressed query results without reconstructing
scientific joins in presentation code.

`createSourceClusterConcentration(...)` binds independently frozen bottleneck
criteria and a complete source-vertex depth partition to the verified metrics.
It derives per-depth densities and pooled member shares, treats zero
denominators as indeterminate, and records the optional permutation baseline as
not run rather than inventing one.
