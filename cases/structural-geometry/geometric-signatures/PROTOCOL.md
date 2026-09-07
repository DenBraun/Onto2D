# GeometricSignature-v1: frozen SG2-040 protocol

Fixed on 2026-09-07 before implementation and measured signature generation.
This implements SG2-040 only. SG2-041/042/043 and public pages remain later gates.

## Source, requests and evidence

Consume existing provider-backed Forman, certified unit Ollivier and certified
shadow-flow outputs without changing their policies. Input explicitly declares
all three slots, each an existing analysis request or null (not requested).
Expected evidence explicitly declares Ollivier and flow artifacts or null
(missing evidence when requested). Forman is recomputed locally. Verify every
present artifact against the expected pack and corresponding request; malformed
evidence throws and cannot be downgraded to missingness. No caller summaries,
callbacks, distances, bins, weights or feature selection are accepted.

All enabled layers must address the exact same node/edge population. Ollivier's
requested analyzed edges may be a subset, but its underlying scoped graph must
match. Reject mismatched populations, rather than combine different objects.
Existing Forman supports full-node populations and typed edge selections; it
does not acquire an induced-scope adapter here. Forman can be disabled for the
existing induced real-source flow/Ollivier examples. Bound the common population
to 64 nodes and 64 edges; retain all upstream source and resource checks.

## Descriptors and provenance

Keep three ordered mandatory families: Forman curvature, Ollivier curvature,
flow trajectory. Scalar distributions are exact multisets of closed rational
intervals. Unit Forman and transport values are point intervals; experimental
Forman retains its certified outward 12-place interval endpoints. Never use an
interval midpoint or infer a definite sign across zero.

For each scalar distribution retain signs and minimum/maximum interval bounds.
Possible minimum edges have lower <= minimum upper; a certain minimum has upper
<= every other lower. Maximum rules are dual. Ties remain sets. Describe extreme
roles by the exact multiset of source/target in/out degrees in the common graph.
Exact edge IDs and possible/certain attaining sets remain separate provenance;
they never enter invariant feature values. Empty scalar populations have no
measured extrema or curvature feature, not a fabricated zero distribution.

Flow preserves joint length/curvature multisets per observed iteration, both
scalar distributions, actual changes and stable-step count. Align frames by
absolute integer iteration from 0 through the declared maximum. After any
termination, remaining slots are explicitly unavailable/null; no carry-forward,
zero padding, interpolation, time rescaling or best-match alignment. Framewise
use requires the same iteration and observed coverage on both sides. A short
verified trace is a partial fixed-horizon feature. Reaching the cap supplies full
frame coverage but never asserts convergence.

Retain all five termination reasons, iteration/cycle data and degenerate edge
count. Preserve the final cut policy and invariant weak/strong component sizes,
connectivity and removed count. If a strict length cut is configured, derive
above-threshold counts, entry/exit counts for each observed frame, and the
multiset of terminal consecutive above-threshold run lengths for final removed
edges. Keep entering/exiting and final removed IDs as provenance. These are
measured threshold persistence events, not inferred semantic bottlenecks or
cross-parameter stability. With no cut, events are explicitly unavailable.

Each feature is observed, partial or unavailable, with exact coverage and
reasons. Ollivier coverage is analyzed edges / common edges; flow coverage is
observed frames / declared horizon slots. Missing/not-requested and empty are
distinct. All three features must be observed for a whole value/fingerprint;
otherwise that whole value is null while measured partial descriptors remain.
Complete descriptor coverage does not resolve interval uncertainty or imply
flow convergence, structural equality, a pseudometric or empirical usefulness.

Profiles bind metric/selection/numeric/transport policies and flow settings.
Profile conditioning excludes raw source IDs, scope member IDs and explicit
length assignments, whose full records remain in requests/evidence. Explicit
flow initialization is marked as such. Profile/value hashes are provenance-free
fingerprints, not authority for comparisons across sources, initial metrics,
vocabularies or interval uncertainty. SG2-041 must lock those comparison rules.

Verification rebuilds from expected source, input and expected external evidence,
including its availability; caller self-hashes do not suffice. Output is deeply
immutable and portable to browsers, with separate schemas and opt-in engine
registration. External solvers remain in their existing adapter entrypoints.
Composite limits: 25 frames, 3,328 scalar samples, 1,600 joint samples, two million
canonical entries and 24 MiB cumulative/final output. Invalid or excessive work
throws without a partial success artifact.

## Frozen controls and independent evidence

Use the 11 original flow sources/requests; three supplemental controls (inward
half/half star, outward one/zero star, two-K4 bridge); all five experimental
Forman graphs; one necessary-edge weighted selection; partial Ollivier edges,
missing external evidence, all-disabled layers, one-step complete single-edge
coverage, and a path with tolerance one/stableSteps one. This gives 25 requests.
Preserve source packs in sources.json and exact requests in controls.json before
measuring signatures. Do not tune these after inspecting outcomes.

Independent source measurements use the already pinned NetworkX 3.2.1 network
simplex/Dijkstra helpers and the separate Decimal/Fraction Forman reference.
Generate numerical locks from frozen sources/requests without reading production
artifacts. Pin source/protocol/helper hashes and independent algorithm identity.
A standard-library Python reference independently groups distributions, computes
interval extrema, degree roles, fixed-horizon coverage and threshold run lengths
from those numerical locks. Production replays certificates and agrees on every
descriptor and provenance set. Separately verify numerical locks with NetworkX.

Test simultaneous node/edge/scope/initial-length transport and presentation/order
changes, including interval values, partial traces, cycles and cuts. Enumerate
small interval tuples to check possible/certain extrema independently, and all
short threshold membership traces to check entry/exit and terminal run lengths.
Exercise missing/partial/empty coverage, every termination reason, tamper/rehash,
source/request/evidence mismatch, schemas, types, browser, engine and bounds.
Prior scientific bytes and all ledger tasks remain intact.
