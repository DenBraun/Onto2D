# Structural Geometry verification and revised research protocol

Date: 2026-09-06. Existing computational controls remain frozen. H0–H8 below
govern subsequent research under the [R0–R12 roadmap](REVISED_ROADMAP.md).

The initial controls cover a single edge, an isolated node, a directed path,
cycle, outward and inward stars, tree, bidirected clique, a bridge, diamond DAG,
layered DAG, feed-forward triangle, feedback cycle, reciprocal pair and the
edge neighborhood illustrated in figure 1 of the directed Forman paper.
Analytic checks include an edge of curvature 2, a directed cycle of curvature
0, a bidirected three-node clique of curvature -2 on each edge, and the paper's
illustrated edge of curvature -4.

The production implementation uses degree counts. A separate Python standard
library reference enumerates incoming and outgoing edge incidences and sums
the unit specialization of equation (5), without importing or invoking the
JavaScript implementation. Frozen fixtures include the graph and per-edge
values. A check mode verifies the goldens; generation is explicit and does not
turn a mismatch into acceptance. The full Causal Emergence result is also
compared against the Python reference, then replayed from its exact Model Pack.

Behavioral checks cover source immutability, deep-frozen output, exact manifest
binding, tampered/rehashed results and projections, missing endpoints, foreign
layers, self-loops, parallel edges, unsupported policies, unknown request fields,
record/key ordering, relabeling equivariance, edge reversal and empty edge sets.
Schemas and public TypeScript declarations cover the complete transport/API.

The package remains outside the kernel and view code. Source snapshots, kernel
closure, existing apps and their public module revisions remain unchanged.
The complete repository suite and build must pass before completing this
milestone. Supported-runtime determinism is a CI gate; a local Node run is not
evidence that every CI runtime was executed locally.

## Implemented computational evidence

Stage 4 adds an [Ollivier suite](../../cases/structural-geometry/ollivier/README.md)
with 18 synthetic graphs and two explicit source-bound induced fragments, each
at two idleness values. The 242 optimal edge values agree exactly with an
independent NetworkX run that reconstructs directed distances and measures.
Portable certificate checks, analytic controls, exhaustive small transport
enumeration, scope accounting and direction/relabeling tests establish the bounded
computational contract. The external reference is version/source-hash identified
and repeated in a separate CI job. Scientific interpretation remains open.

Stage 3 now supplies a [typed metric experiment suite](../../cases/structural-geometry/experiments/README.md)
with full-source weight audits, fixed normalization context, necessity transitions,
role subsets and overlapping channel checks. Its separate Fraction/Decimal
reference covers directed weighted arithmetic. These are computational controls
and sensitivity observations, not comparative utility evidence.

Stage 5 adds [11 normalized flow trajectories](../../cases/structural-geometry/flow/README.md),
68 states and 1089 exact edge calculations independently reconstructed with
NetworkX. The published `G(3,2)` recurrence is exact over 17 states and a final
cut recovers three known groups. Capped and cyclic runs are not called converged.
The revised R1 gate still needs dedicated star and two-cluster single-bridge
flow controls; earlier Forman/Ollivier fixtures do not close that coverage gap.

The earlier H1–H6 numbering is historical: its curvature/flow/necessity/direction/
higher-order/cross-domain questions map into the more explicit H0–H8 below.
New tests must identify which version of the hypothesis protocol they use.

## Revised hypotheses and falsification

| ID | Question / planned test | Failure or limiting outcome |
|---|---|---|
| H0 | Do declared regime changes split/merge controlled observation classes as specified? | Constructed observable differences are ignored, or distinctions change without a policy reason |
| H1 | Do graph-native responses separate justified structural controls beyond trivial summaries? | No improvement over degree/SCC/reachability baselines or excessive indeterminate coverage |
| H2 | Do curvature variants capture local information beyond ordered endpoint degrees? | Redundancy or unstable signal; **unit Forman cannot add information beyond its exact endpoint-degree inputs** |
| H3 | Does normalized flow add stable decomposition information beyond static curvature? | Parameter-dominated/unstable behavior or no added information; a published synthetic reproduction alone is insufficient |
| H4 | Does response+geometry outperform response-only on preregistered held-out controls? | No measurable/robust benefit, or apparent benefit explained by coverage, leakage or cost |
| H5 | Does direction-sensitive persistence add beyond directed graph/motif/geometry features? | Redundancy, or differences caused only by an unjustified construction |
| H6 | Does explicit higher-order representation retain a known joint inference lost pairwise? | No demonstrated information gain or missing joint-semantics justification |
| H7 | Are independently sourced candidate analogues nearer than matched hard negatives/nulls? | No reliable distinction from matched controls or post-score mapping/tuning |
| H8 | Are conclusions stable under declared invariances and disclosed representation sensitivity? | Serialization/layout/label leakage, arbitrary matching, or dominant policy sensitivity |

These are research questions, not claims established by the current fixtures.
Negative findings remain reportable and constrain any promotion of geometry.

## Controls and baseline comparisons

Positive invariance controls initially cover serialization/key/record order,
permitted relabeling and presentation coordinates. Compare invariant descriptors
through declared mappings, not full provenance hashes. Transparent nodes/chains
need a separate abstraction rule; small length perturbations test sensitivity,
not automatic exact equivalence. Equivalent supported pack encodings still
require complete source verification.

Negative controls should target a **declared observable**: feedback deletion,
branch/convergence changes, an asymmetric critical-edge reversal, constraint
placement, required support removal, cycle creation/removal or compatible
history differences with the same present state. Joint-dependence controls wait
for reviewed higher-order semantics. A meaningful mutation need not separate
under every lossy regime. Global reversal can preserve corresponding curvature
and even produce an isomorphic graph; do not require a difference it cannot have.

Hard negatives preserve node/edge counts, directed degree sequences, SCC/motif
profiles where feasible and typed-category counts while changing the target
organization. State exactly which constraints are preserved and how the null
generator samples them; feasible proposals alone do not imply a uniform null.
Freeze seeds, work budgets, rejected proposals and coverage diagnostics.

Benchmark against exact graph matching/canonical identity where compatible,
topology summaries, typed motifs, degree/SCC/reachability, spectral features,
role-projected comparisons and an offline WL/graph-kernel baseline where feasible.
Any omitted baseline needs a bounded feasibility reason. Include **response-only
pseudometric A** and **response+geometry B** on the same evaluation population,
with matched component coverage. Static curvature is the baseline for added
flow; directed graph/motifs are baselines for persistence.

## Preregistration and leakage controls

Before examining comparative output, freeze source releases/scopes, mappings,
probe families/targets, observables, distance domain, component scales/weights,
flow parameters, signature bins/alignment, primary outcomes and null/negative
generation. Group train/calibration/evaluation by independent base structure or
source unit so relabeled variants and repeated probes cannot leak across splits.
Do not learn weights, mappings or thresholds on the cases used to claim success.

For the fixed-domain pseudometric, test nonnegativity, symmetry, self-zero and
triangle inequality as well as the [mathematical construction](DISTINGUISHABILITY_DESIGN.md).
Exercise absent mandatory observations, empty profiles, different dictionaries,
incompatible regimes, partial-data triangle counterexamples and numeric/interval
uncertainty. Do not average only favorable comparable components and call the
result a universal distance. Report all coverage and failure dispositions.

R7 records effect sizes/discrimination or decomposition outcomes, uncertainty
appropriate to the frozen sampling design, runtime/resource cost and sensitivity
to provider, step, idleness, cap, tolerance and cut threshold. Define primary
criteria and multiple-comparison treatment before trials. Independently verify
small cases and rerun the exact old baseline after provider/probe changes.

R10's four domains are independently sourced candidate analogues, not validation
goldens. R11 requires frozen role/probe adjudication, blinded evaluation and
matched constrained nulls. A failure to improve or an indeterminate dataset
must remain visible; it cannot be cured by drawing four isomorphic templates.

## Public reporting gate

No single similarity percentage, pooled benchmark score or cross-domain
equivalence claim is authorized by passing the initial computational controls.
Use the [website readiness checklist](REVISED_ROADMAP.md) and
[interface claim rules](WEBSITE_PLAN.md). Separate method exposition, computational
agreement and measured scientific results; never convert the attachment's sample
numbers into observed similarity.
