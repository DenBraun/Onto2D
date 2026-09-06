# R2: compatible metric providers

Date: 2026-09-06. Contract frozen before the SG2-005 implementation.
Implemented under [ADR 0131](../adr/0131-compatible-structural-metric-providers.md).
The [review](METRIC_PROVIDER_REVIEW.md) and operative roadmap track acceptance.

## Public boundary

Add `@onto2d/structural-geometry/providers` inside the existing package. Keep
the root, experiments, Ollivier and flow exports and all closed v1 artifacts.
No external provider plugins, response-derived lengths, regimes or UI are part
of this contract. A provider supplies positive edge costs or discrete views;
these are not inter-structure distances or scientific confidence values.

`createStructuralMetricContext(pack)` verifies and snapshots the complete Model
Pack and its projection. It returns a frozen context containing `projection`
and a serializable `binding`. The context has a private runtime brand: a copied
or deserialized binding is not authority to declare a source verified. Recreate
a context from the expected pack when replaying. The binding records the model,
full source projection, projection policy, full-source normalization rule and
an explicit hash of the model-local dictionaries.

`createStructuralMetricProvider(id)` returns an immutable descriptor and
`build(projection, context, parameters)` method. The projection must match the
context's complete verified projection exactly. `buildStructuralProvider(pack,
request)` is the convenience entrypoint, and `verifyStructuralProviderArtifact`
rebuilds against an expected pack and request. No caller-supplied self-hash or
lookalike context substitutes for source verification.

| Provider ID | Output capability | Parameters and compatibility |
|---|---|---|
| `unit-v1` | `metric-values` | Empty parameters; unit rational vertex/edge weights and positive edge lengths, source weights ignored |
| `inverse-target-share-v1` | `metric-values` | Empty parameters; original weight audit and exact decimal interpretation, full-source incoming denominator, unit vertex weights and edge weights equal to lengths |
| `necessity-filtration-v1` | `filtration` | Empty parameters; all four nested necessary → enabling → contextual → optional stages, with every source node retained |
| `role-subset-v1` | `selection` | Explicit nonempty unique `roles`; canonical set order; original category validation and accounting |
| `typed-channel-v1` | `channels` | One supported `field` and 1–32 unique nonnegative integer `values`; numerically sorted channels; original overlapping membership and missing-field accounting |

All providers retain the original projection and selection-policy semantics.
Typed codes remain local to the bound dictionaries; unknown requested codes
can yield empty selections under the existing policy. A dictionary hash does
not assert a cross-model vocabulary mapping. Invalid category/weight data
cannot be hidden by selecting away its edges. Metric context hashes bind every
source length before selection, exactly as in the original experiments.

`requireStructuralMetricValues(artifact, pack, request)` verifies the artifact
and rejects filtration/selection/channel capabilities when a consumer requires
lengths. There is no implicit ordinal length for necessity or mixture of channels.
The raw costs need not equal shortest endpoint distances; a flow consumer still
performs its own metric closure and normalization.

## Additive analysis envelope

`analyzeStructuralGeometryWithProvider(pack, request)` accepts an explicit
`analysis` and `metricProviderId`, with an optional experiment `selection`:

- `structural-geometry`: `unit-v1` only, no selection;
- `structural-metric-experiment`: either metric provider and any existing
  selection (default `all`). A selected view is produced by its explicit view
  provider; necessity references the requested stage of the complete filtration.

The result binds the normalized request, context, metric provider artifact,
optional view provider artifact, and **unmodified legacy artifact**. It has its
own `structural-provider-analysis` identity and hash. The existing unit
integer results and weighted outward intervals are preserved in that legacy
artifact, not converted to another numeric representation.

`verifyStructuralProviderAnalysis` replays the full envelope from expected
sources and request. Opt-in engine definitions are
`createStructuralMetricProviderAnalysis()` (raw provider output) and
`createStructuralProviderAnalysis()` (analysis envelope). Both require the
authentic engine Model bridge. The portable entrypoint has no filesystem,
Python process or browser-global dependency.

## Compatibility matrix

| Existing path | R2 treatment |
|---|---|
| Root unit Forman | Reproduced byte for byte inside the additive analysis envelope |
| 72 typed/local-weight experiments | Shared original selection/audit/metric functions; provider envelope preserves exact legacy output, selection, normalization context and intervals |
| Unit Ollivier | Existing API/policy and all 40 artifacts remain unchanged; provider unit values agree on every scoped edge, with existing scope/support bounds retained |
| Shadow flow | Existing API/policy and all 20 original/supplemental trajectories remain unchanged; explicit initial lengths and flow normalization remain separate operations |

R2 does not replace Ollivier's unit transport policy with arbitrary costs or
override explicit flow initial lengths. Raw metric outputs can supply lengths
to an explicitly declared compatible consumer. Such an integration must retain
its scope and initialization policy; merely attaching a provider does not
authorize a changed transport measure or flow request.

## Identity, bounds and acceptance

New closed schemas describe the descriptor, serializable context binding,
provider input/artifact and analysis input/artifact. Versions remain string
`"1"`. All declarations and nested outputs are readonly. Hash domains are
`onto2d:structural-provider-{descriptor,dictionaries,context,artifact,analysis}:v1`.
The existing metric, selected-projection and metric-context hashes retain
their original domains and values.

Projection/source codec limits still apply. The new envelope profile permits
at most 4096 nodes, 16384 source edges, 32 views, 32768 total selected view-edge
occurrences, 500000 canonical entries and 8 MiB per artifact. No truncation or
partial success is allowed. Legacy Forman incidence and Ollivier/flow work
bounds apply independently to their own analyses.

Acceptance requires byte-identical legacy replay, full-source weight context,
fixed nodes/nested necessities/overlapping channels, explicit capability
rejection, source/context/input tampering tests, immutable snapshots, browser
and engine parity, closed schema/TypeScript checks and numeric references.
The original baseline and nine supplemental flow artifacts are preserved.
Run the complete repository tests/build after implementation and record the
actual evidence before marking R2 complete.
