# Distinguishability and comparison: adopted design constraints

Status: R2 providers, SG2-010 preparation and SG2-011/012/013 observations implemented;
final R3 comparison/coverage and R4–R7 probe/signature work remain planned.
Date: 2026-09-06. See the [operative roadmap](REVISED_ROADMAP.md).

## Two analysis spaces

Intra-graph geometry assigns positive lengths and computes directed curvature
and flow inside one source-bound graph. Inter-structure geometry compares
observable signatures of different objects under one declared regime. Directed
shortest-path distance need not be symmetric. The initial inter-structure
pseudometric must be symmetric on its declared complete comparison domain.

Keep mechanism representation, observation choices and epistemic support
separate. Scientific confidence is neither an edge length nor a distance weight.
No new operation is added to `@onto2d/kernel` for conceptual convenience.

## R2: metric providers without semantic migration

Retain `@onto2d/structural-geometry` and its root, `/experiments`, `/ollivier` and
`/flow` entrypoints. The implemented `/providers` subpath and six additive
schemas follow the [frozen SG2-005 contract](METRIC_PROVIDERS.md) and
[acceptance review](METRIC_PROVIDER_REVIEW.md). The attachment's illustrative
names do not override those public contracts.

A provider descriptor includes ID/version, origin, supported representation,
numeric policy, capabilities, context requirements and resource bounds. A
build request binds a verified projection and explicit context; output binds
provider, input, context, parameters and derived values. Distinguish outputs:

| Provider capability/family | Existing source | Required compatibility |
|---|---|---|
| Metric values: unit | `unit-v1` | Preserve unit vertex/edge weights and lengths, per-analysis policy identity and current defaults |
| Metric values: declared-weight hypothesis | `inverse-target-share-v1` | Preserve exact decimal interpretation, weight eligibility, **full-source** incoming-share denominator and outward Forman intervals |
| Filtration: necessity | `typed-source-parent-subgraph-v1` with necessity selection | Preserve necessary → enabling → contextual → optional inclusion, fixed nodes and full-source metric context; do not invent category lengths |
| Channels/role selections | Existing typed experiment selectors | Preserve overlapping channel memberships, model-local dictionary meaning and role subsets; no premature scalar mixture |
| Metric values: response-derived | No implementation | Deferred until response-only observations and zero-distance handling are defined independently |

Existing metric-policy IDs remain unchanged. A provider descriptor can identify
a family without renaming the policy that produced an old artifact. A new
provider-aware envelope references the exact old artifact and exposes provider
identity. It does not append fields to a closed v1 artifact or relabel all old
results as schema v2. Ordinary calls without the new API retain their exact
old output and hash. A wrapper with explicit provider identity has its own hash;
compare its referenced legacy output byte for byte.

Selection, metric computation, normalization context and flow initialization are
distinct operations. Filtration/channel providers must not be accepted by a
consumer requiring lengths unless an explicit compatible metric is supplied.
The flow API continues to normalize its own separate initial state. A response
pseudometric with zero values cannot silently become a positive length provider.

## R3: regime and observation contracts

SG2-010 now implements the [closed contracts](REGIME_CONTRACTS.md), their
content identities and bounded source/scope preparation. The following
observation and comparison semantics guide subsequent evaluators; preparation
itself explicitly has `evaluation: "not-run"`. SG2-011 now supplies separate
[measured exact observations](CANONICAL_OBSERVATIONS.md), preserving that preparation.
SG2-012 supplies [the frozen directed topology summary](TOPOLOGY_OBSERVATIONS.md)
with independently checked counts and disclosed collisions. SG2-013 adds
[joint typed observations and explicit vocabulary alignment](TYPED_OBSERVATIONS.md),
including scoped evidence gaps and separately approved mapping hashes.

A regime binds its ID/version, projection policy, canonicalization/matching
policy, ordered observable specifications, invariance and response probe-set
identities, missingness policy, aggregation/numeric policy and work bounds.
References require content hashes as well as human-readable IDs. Observation
descriptors state type, scope, units/normalization, required evidence, mandatory
status and the exact analysis that supplies them.

| Regime | Observation boundary |
|---|---|
| `canonical-structure-v1` | Exact directed graph structure modulo an explicitly permitted relabeling, with domain vocabulary excluded; bounded exact matching is implemented and independently checked |
| `topology-only-v1` | A frozen finite profile of directed connectivity, SCCs, reachability and specified cycle observables; its equality is equality of that profile, not graph-isomorphism proof |
| `typed-relations-v1` | A declared extension using dependency type, interaction mode, role, necessity and causal-direction annotations; no epistemic-status-to-distance conversion |
| `history-aware-v1` | Later compatible history observations with explicit release/evidence bindings and admissibility rules from existing History contracts |
| `perturbation-response-v1` | Frozen graph-native response observations supplied by R4/R5 |

The source document lists adjacency alongside summaries for topology-only. R3
must distinguish exact adjacency matching from a lossy summary profile. The
adopted split above keeps the exact canonical regime separate from the summary
baseline and records the chosen observable set in regime identity. Direction
is retained in the initial profiles; an undirected sensitivity profile is a
different policy, not an implicit fallback.

Source node IDs and provenance hashes remain exact and may change under
relabeling. Only the scientific descriptor, through its declared canonical
mapping, is invariant. Reuse the existing candidate canonicalizer only when a
faithful translation fits its graph/ref/role contract; canonical JSON alone
does not solve unlabeled graph matching. Freeze feasible work bounds and fail
explicitly on exhaustion rather than return a heuristic identity as exact.

Typed code `10` in one Model Pack is not automatically code `10` in another.
Cross-model typed comparison requires a frozen reviewed dictionary/role mapping
or an explicitly shared vocabulary binding. A missing mapping is indeterminate.
No mapping may be tuned after similarity is observed. The implemented SG2-013
alignment checks an externally expected mapping hash; review-evidence metadata
cannot approve itself. Compatibility alone does not assert graph equality or
supply a pairwise distance.

## Tri-state and missingness semantics

Return `indistinguishable-under-regime`, `distinguishable-under-regime` or
`indeterminate`, with a regime reference and diagnostics. Indistinguishability
is always limited to the recorded observation profile. It neither replaces
Canonical Identity nor asserts common mechanism, history, cause or equations.

Default `strict-indeterminate`: if a mandatory observation/probe is missing,
unavailable, rejected or unresolved, the complete comparison has null distance
and indeterminate status. Preserve any observed differences as diagnostics;
do not fabricate equality from absent history. Invalid artifact input is a
validation error, not an observed negative result. An interval overlapping a
decision boundary is unresolved unless the declared interval policy proves the
comparison; do not substitute its midpoint.

Coverage records numerator, denominator, component/family membership and reasons
for missing items. A display fraction alone is insufficient. Availability and
provenance are metadata in response v0, not distance features. Optional
`partial-with-coverage` reports only an explicitly labeled partial diagnostic;
the complete-regime distance remains null and its status stays indeterminate.
Pair-specific partial values do not inherit pseudometric guarantees.

## R4–R5: deterministic probe sandbox and response baseline

Invariance probes test changes a regime expressly ignores. Response probes
measure the consequence of a meaningful declared transformation. Freeze those
families separately before outcomes are inspected; do not relabel a failed
response test as an invariance afterwards.

Every probe run binds source pack, scoped projection, regime, probe policy and
parameters, target selection/mapping, transformed shadow-graph hash, observable
implementation and result. Targets must be stable under allowed relabeling:
use a declared role match, canonical orbit or invariantly aggregated target set.
Do not break structural ties by whichever source ID sorts first. A finite probe
budget and explicit rejection reason are mandatory; no random sampling without
a frozen seed and sampling policy.

Start with serialization/relabeling/presentation invariances and graph-native
feedback-edge, direction, constraint and support-path responses. Preserve the
immutable source, source verification and scope boundary accounting; derived
mutations live only in the sandbox. Source records do not acquire altered
hashes under their original identity. Presentation coordinates may change in
the test harness but never enter geometry or comparison values.

Transparent-chain/node edits require explicit semantics and an abstraction
policy. They can change ordinary adjacency, degree, Forman and flow. Small
length perturbations belong to parameter/representation sensitivity unless an
exact invariance is actually justified. Higher-order probes wait for R9.

`ResponseSignature-v0` contains a fixed graph-native feature map: specified
reachability and component/SCC/cycle effects, typed/motif effects where supported,
and compatible closure/admissibility/identity observations only where an existing
analysis supplies them. Each optional integration has its own evidence binding
and missingness disposition. Graph ablation by itself is not a physical
intervention or kernel admissibility evaluation. History ablation uses
[existing history evidence rules](../history/HISTORY_EVIDENCE_MODEL.md) and
[identity regimes](../history/HISTORY_IDENTITY_REGIMES.md); it does not create
evidence or duplicate History Matters scoring.

Geometric observations are excluded from v0 so the response-only baseline stays
independent of R7. Motif and kernel analysis implementations remain separate
reusable analyses. Response signatures consume compatible outputs through a
declared adapter, with budgets and source identity checked at the boundary.

## R6: a pseudometric with an explicit mathematical domain

Freeze one finite feature map `f_R` for a regime, one nonempty component set `J`,
positive rational weights `w_j` and component pseudometrics `delta_j`. For
objects with complete comparable features under that fixed policy:

```text
d_R(A,B) = sum_j w_j * delta_j(f_R(A)_j, f_R(B)_j) / sum_j w_j
```

Categorical components use exact mismatch distance. Numeric components can use
`abs(x-y)/s_j` for a fixed positive scale, or a separately declared bounded
metric such as `min(1, abs(x-y)/s_j)`. Scales and family weights are frozen
before evaluation, with no pair-dependent or held-out-data normalization.
Family weighting prevents a family with more expanded targets from silently
dominating. A future calibration set must be disjoint from evaluation units.

Nonnegativity, symmetry, zero self-distance and the triangle inequality follow
from the component pseudometrics and fixed nonnegative combination. Pulling
this metric on features back to structures permits different structures to
have distance zero. This is the limited mathematical justification; it is not
a claim of probabilistic bisimulation. Property tests and an independent small
reference complement, rather than replace, this argument.

Why pairwise omission is unsafe, using normalized values in `[0,1]`:

```text
A = (0, missing)    B = (0, 0)    C = (1, 0)
pairwise-available means: d(A,B)=0, d(B,C)=1/2, d(A,C)=1
triangle inequality fails: 1 > 0 + 1/2
```

With strict missingness A is outside the complete comparison domain, so those
complete distances are null. A partial-data diagnostic must not be used to
claim equivalence classes or feed a metric-dependent algorithm as if certified.
An empty feature set is indeterminate, never zero distance.

For exact complete v0 signatures, `d=0` gives indistinguishability under that
signature regime and `d>0` gives distinguishability. “Near” is a different
thresholded evaluation claim. Positive tolerances generally do not define a
transitive equivalence relation. No tolerance-based zeroing is introduced to
force desirable classes. Interval features and approximate solvers need a
separate distance/status contract before inclusion in a certified profile.

## R7 and additive artifact design

`GeometricSignature-v1` is a separate layer over existing Forman/Ollivier/flow
artifacts. It records available distributions, invariant extrema descriptions,
normalized trajectory features, termination reason and cut policy. Preserve
exact source edge IDs as provenance; exclude raw IDs from invariant distance
coordinates. Iteration-limit, cycle and numerical failure cannot become a
fabricated “converged” coordinate. Unsupported geometric coverage is explicit.

Do not pad short trajectories with zero-valued scientific observations. Freeze
iteration alignment, early-stop and unequal-coverage rules before comparing
features. Fixed summary bins/scales and their numerical bounds belong to the
signature policy. Forman interval features need an explicit certified treatment.

A future aggregate analysis artifact references, as applicable, exact model(s),
scope/projection, regime/observations, provider/context, curvature implementation,
flow policy/trajectory, probes, response and geometric signatures. A separate
comparison artifact binds both independently verified sides, mapping, common
regime, component/normalization/weight policy, distance or null, status, coverage
and diagnostics. Require an explicit comparison regime in the initial API.
Optional layers are schema-declared unavailable, not placeholder zeros.

Keep current v1 envelopes, string versions and hashes stable. New artifacts
receive their own closed schemas, hash domains, readonly types and opt-in
engine registration. Verification must replay against supplied expected sources
and policies; two self-asserted signature hashes are insufficient authority.
External implementations remain behind the scientific-adapter boundary.

Benchmark response-only A against response-plus-geometry B on the same frozen
units, component availability and held-out protocol. Report coverage and cost,
not just favorable discrimination. Keep R8 directed topology and R9 higher-order
features separate until their own added-information gates are evaluated.
