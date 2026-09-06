# SG2-010: distinguishability regime and observable contracts

Status: implemented contract foundation for R3. Date: 2026-09-06.
See [ADR 0132](../adr/0132-bounded-structural-regime-contracts.md), the
[review](REGIME_CONTRACT_REVIEW.md) and [operative ledger](REVISED_ROADMAP.md).

## Delivered boundary

`@onto2d/structural-geometry/regimes` publishes three frozen regimes, nine
observable specifications and source-bound preparation/verification. Preparation
is useful for inspecting the precise observation contract, selecting a feasible
scope and recording source provenance before running an evaluator.

**This API does not compute observations or compare two structures.** Every
preparation has `evaluation: "not-run"`; its closed schema excludes measured
values, comparison status and distance. Suppliers identify exact operations;
their declarations alone do not install evaluators. Empty probe-set declarations
mean no probes are configured or executed. They are not successful invariance tests.

SG2-011 now implements [exact observations](CANONICAL_OBSERVATIONS.md) in a
separate artifact, preserving this preparation contract. SG2-012 now implements
[directed topology observations](TOPOLOGY_OBSERVATIONS.md) under the same boundary.
SG2-013 supplies [typed observations and vocabulary alignment](TYPED_OBSERVATIONS.md);
SG2-014/015 remain responsible for final comparison and missingness
result contracts. R3's synthetic split/merge acceptance gate is
still open. History, response signatures, pseudometrics and site work follow it.

## Fixed profiles

| Regime | Mandatory ordered observations | Scoped limit | Matching boundary |
|---|---|---|---|
| `canonical-structure-v1` | Canonical directed structure, including isolates | 1–6 nodes, 30 edges | Exact directed graph isomorphism, all node bijections permitted; source IDs and attributes excluded |
| `topology-only-v1` | Node count; edge count; sorted weak-component sizes; sorted SCC sizes; reachable ordered-pair count; cyclic-node count; isolated-node count | 1–64 nodes, 256 edges | Equality of this lossy seven-component profile; no graph-isomorphism claim |
| `typed-relations-v1` | Canonical directed structure; canonical directed structure with edge types | 1–6 nodes, 30 edges | One common node bijection must preserve adjacency and all five edge fields |

Reachability counts distinct ordered pairs `(u,v)` with `u != v` connected by
a directed path, once per pair. Component vectors include singleton isolates
and sort numerically ascending. Cyclic nodes belong to SCCs of size greater
than one; the inherited source policy rejects self-loops. No simple-cycle
enumeration, path multiplicity, diameter or adjacency matrix is hidden in the
summary profile. For example, an outward star and its inward reversal have
the same listed summaries, although their directed structures differ. SG2-012
retains this explicit collision and verifies separation with the exact evaluator.

Typed fields are `dependencyTypeId`, `interactionModeIds`, `ontologicalRole`,
`necessity`, `causalDirectionIds`. Codes are nonnegative safe integers. ID
arrays represent sets sorted numerically; duplicates are invalid. Role and
necessity universes reuse the established typed-selection policy. Absent fields
are mandatory evidence gaps, whereas explicitly declared empty sets are observed
empty sets. Neither weights nor scientific confidence become type coordinates.

## Identity and matching policy

All contracts use string schema/version `"1"`. A regime binds the source
projection policy, induced-scope policy, matching, vocabulary, ordered observable
references, declared invariances, both probe sets, missingness, aggregation and
resource bounds. Each reference contains ID, version and content hash. Observable
specs bind value type, scope, units, normalization, mandatory evidence, definition
and supplier operation. Nested policy hashes use their complete closed content.

Hash domains start with `onto2d:structural-regime-` and end with `:v1`:
`policy`, `observable`, `descriptor`, `node-color`, `scope`, `preparation` and the
case `suite`. The projection hash uses the existing projection-policy domain;
source/dictionary/context bindings reuse MetricProvider's existing domains.
No old hash, schema or numeric artifact changes.

Exact matching is bounded at 100,000 kernel search states per canonicalizer
call, including its skeleton and candidate phases. The untyped profile requires
one such observation; the typed profile declares two, so its total allowance
is at most 200,000 states before any future reuse. The declared
`canonicalizeCandidate` translation uses `single-candidate`, a uniform synthetic
SHA-256 node reference, a constant `source-parent` edge role, preserved direction
and a disconnected-compatible graph policy. The synthetic reference is a uniform
color, not a source record or kernel-package identity. Typed set attributes must
be encoded as canonical JSON strings of sorted integer arrays because the kernel
accepts scalar attributes, not arrays. A contract test checks interface feasibility;
SG2-011 supplies independent untyped matching checks; SG2-013 now independently
checks joint typed matching and approved code remapping. Exhaustion must
raise an error, never produce a heuristic exact identity. No kernel changes are
introduced. The summary profile uses no graph canonicalizer and permits at most
4,096 distinct reachability pair visits, with its node/edge bounds also limiting
traversal work. All preparations use at most 100,000 canonical entries and 1 MiB.

Permitted relabeling changes source and preparation hashes. Observation values
are invariant under the declared mapping; source-bound witnesses may change. Canonical JSON
serializes a labeled object deterministically; it is not graph isomorphism.
Scope membership must travel with any node renaming. Presentation changes have
no comparison coordinates. A direction-reversal response is not silently added
to the declared invariance set.

Typed meanings are bound to the full source dictionary hash. Equal code numbers,
or even equal dictionary bytes in different models, do not authorize a common
vocabulary. Cross-model comparison requires an explicit reviewed shared-vocabulary
binding or mapping; this preparation API neither accepts nor manufactures one.
SG2-013 now provides a separate mapping and alignment API; missing compatibility
produces unresolved alignment with null values. Final comparison will translate
that evidence gap to indeterminate. Availability/provenance metadata remains
outside future distance coordinates.

The frozen strict policy requires null complete distance and indeterminate
status for mandatory missing/unavailable/rejected/unresolved evidence, retaining
observed differences as diagnostics. Invalid artifacts raise validation errors.
Exact complete equality/difference has no tolerance threshold. Intervals and
partial distances are unsupported; numerical distance construction remains a
separate comparison contract. These are declarations, not implemented comparisons.

## Source-bound preparation API

```js
import {
  getDistinguishabilityRegime, prepareStructuralRegime,
  verifyStructuralRegimePreparation
} from "@onto2d/structural-geometry/regimes";

const regime = getDistinguishabilityRegime("canonical-structure-v1");
const input = {
  regimeId: regime.id,
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] }
};
const preparation = prepareStructuralRegime(verifiedCausalPack, input);
verifyStructuralRegimePreparation(preparation, verifiedCausalPack, input);
// preparation.evaluation === "not-run"
```

An explicit regime ID is required. Omitting `scope` means the complete source;
an oversized source fails instead of choosing a fragment automatically. Induced
scope IDs must be distinct, present in the source and within the regime bound;
request order is normalized without mutating the request. Empty scopes fail.
Source node and edge IDs are opaque Model Pack strings: leading/trailing
whitespace is preserved exactly in requests, witnesses and boundary partitions.
An untrimmed ID and its trimmed spelling are different identifiers. Input and
preparation schemas accept the same source spelling as the runtime.

The complete Model Pack and full projection are verified **before** scope
selection, so corrupt or forbidden excluded records cannot be hidden. The
artifact retains the R2 context, including the full dictionary hash. This does
not compute metric values or normalize a length state. Selected isolates remain.
Every source edge belongs to exactly one recorded partition: internal, incoming
boundary, outgoing boundary or external. The scope hash includes the full source
projection identity. Boundary edges do not silently enter scoped observations.

`verifyDistinguishabilityRegime(value, expectedId)` and
`verifyStructuralObservationSpec(value, expectedId)` require exact built-in
content. Rehashing an altered policy is insufficient. Preparation verification
reconstructs everything from the expected source and request; a self-asserted
artifact or context hash supplies no authority.

Four additive closed schemas cover observable spec, regime, input and preparation.
Schema validation checks shape and fixed profiles; runtime replay additionally
checks source identity, partition completeness and cross-record relationships.
Readonly TypeScript declarations and browser bundles expose the same API.
`createStructuralRegimePreparationAnalysis()` opts into engine analysis
`structural-regime-preparation` through the authentic Model bridge.

## Reproducible examples

The [six examples](../../cases/structural-geometry/regimes/README.md) bind each
regime to a declared five-node control and a six-node Causal Emergence fragment.

```sh
npm run structural-geometry:regimes:check
npm run structural-geometry:regimes:report
```

Only `structural-geometry:regimes:build` regenerates the frozen preparations.
The report verifies stored bytes before displaying scope counts and `not-run`.
No benchmark discrimination score or scientific validation is produced here.
