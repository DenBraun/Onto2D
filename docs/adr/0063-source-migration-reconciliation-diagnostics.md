# ADR-0063: Source migration reconciliation diagnostics

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0061 can replay a complete caller-supplied classification, reviewed node
resolution, and lossless condensation, but a reviewer still needs one compact
artifact proving how the raw graph, typed projections, resolved vertices, and
relation destinations reconcile. The full architecture-level
`MigrationMetrics` also requires post-unblinding amendment history,
catalogue-level coordinates, reviewed raw-SCC disposition reporting, and a
loadable current migration. Those inputs do not yet exist and must not be
inferred from graph topology.

## Decision

`@onto2d/catalog-adapter` implements
`source-migration-reconciliation-v1`. It fully replays the policy, view,
annotations, adjudication, classified relations, node-resolution policy,
resolution, and condensation before deriving any diagnostic.

The report records:

- raw all-relation nontrivial SCC membership, relation references, complete
  size histogram, largest size, and reciprocal-dyad count;
- the six classified edge counts, blindness status, disagreement statistics,
  and generative/formation-support cyclic-component counts;
- resolved vertex/cluster counts, constitutive-cluster sizes, clustered source
  share, and exact relation-destination counts;
- the share of raw SCCs that no longer remain one strongly connected component
  in the formation-support projection, including the stricter share restored
  by adding only descriptive edges;
- available precommitted risk-threshold comparisons;
- explicit true node/edge/quotient reconciliation invariants.

A raw SCC counts as descriptively resolved only when its exact member set is
strongly connected in the raw graph and in the formation-plus-descriptive
projection, but not in formation support alone. Smaller surviving formation
SCCs do not cause the original raw component to be mislabeled as unchanged.
Singleton self-loops are preserved elsewhere but are not included in the raw
“nontrivial SCC” histogram, matching the repository catalogue audit.

The report uses a dedicated hash domain and exact serialized replay. ADR-0064
later made a verified amendment-log snapshot mandatory and added its frozen
post-unblinding threshold signal. A non-empty log requires a new effective
projection and is rejected rather than paired with stale resolution artifacts;
ADR-0065 now provides that projection and amendment-aware downstream replay.
The report still cannot be presented as the complete migration result.

## Consequences

- Reviewers can prove node/edge conservation and quantify descriptive or
  broader nonformation SCC resolution without manually joining artifacts.
- Input order, SCC traversal order, and relation order do not affect the
  report identity.
- The adapter still does not author policies, classify the current catalogue,
  invent dispositions, or construct a loadable source migration.
- Full `MigrationMetrics`, cross-catalogue-level cluster diagnostics,
  and reviewed raw-SCC dispositions are added later by ADR-0066;
  cluster-concentration analysis is added separately by ADR-0068.
- `POST-CLOSURE-VIS-01` remains deferred until the complete kernel closure
  gate.
