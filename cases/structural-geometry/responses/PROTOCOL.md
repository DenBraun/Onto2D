# Graph-native response probes v1

This SG2-022 protocol is fixed before implementation results are generated.
It adds a separate response registry to the immutable sandbox and measured
invariance controls, preserving all earlier source packs, contracts and artifacts.

## Fixed scope and probes

Every request binds one verified source, an existing explicit regime and its
unchanged full/induced scope. All three regimes execute feedback-edge ablation,
single-edge direction reversal and redundant-support-path ablation. The typed
regime additionally executes separate necessary-parent and enabling-parent
ablations. These two selectors use only the already declared `necessity` field.
They operationalize declared dependency constraints; they do not assign a domain
boundary role or infer physical necessity. Domain-specific constraint/boundary
maps require separately sourced and reviewed semantics in the later domain stage.

Select every eligible target, with no source-ID override, first representative,
sampling or truncation. Feedback targets are edges u→v for which v can reach u
in the scoped baseline. Direction targets are every internal edge. Necessary
and enabling targets are every edge with the respective declared field value.
If any scoped necessity field is absent, that selector is unresolved: retain
known eligible and unknown source IDs, but execute no incomplete target set.
Malformed present fields anywhere in the full source remain validation errors.

Support targets are all nonempty simple directed paths with distinct vertices
whose complete edge deletion still permits a directed path between the same
ordered endpoints. The surviving alternative is edge-disjoint from the removed
path; shared interior vertices are allowed. Single-edge paths are included.
Enumerate all roots and path prefixes with a fixed finite work budget. This
includes both routes of a diamond without choosing one arbitrary representative.
Keep all scoped vertices, even if path ablation leaves some isolated.

Every target starts from the same baseline. Reversal carries typed annotations
unchanged and rejects an operation that would create parallel edges. It does
not recode the meaning of a directed annotation. No boundary/external edge is
edited; all original scope partitions remain provenance. Derived graphs use
the existing shadow-graph contract with their own hashes, never Model Pack
identity. Response execution records have a separate versioned hash domain.

## Measured evidence and strict coverage

Measure the baseline and every applied target with the existing regime's full
ordered observable profile. A new private source-bound adapter invokes the
existing canonical, topology and joint typed evaluators. Compare exact values;
report signed after-minus-before deltas only for scalar integer observables.
Graph values and sorted component-size vectors use exact equality/difference,
without inventing a coordinatewise matching or scalar distance.

A complete target response is `changed` or `unchanged`; neither is globally
predefined as success. Missing mandatory observations make it `indeterminate`,
retaining observed component differences. Rejected transformations have no graph,
observation or response. An exhaustive empty selector is `unavailable` with
`no-eligible-targets`; unresolved type selection uses `missing-selector-evidence`.
These reasons remain distinct. Neither becomes a measured zero response.

Per-probe coverage counts observed baseline/after observable pairs against all
planned targets and all mandatory regime observables. Rejected targets count
in its denominator. Empty profiles are incomplete. Overall coverage counts
fully observed compatible probes against the fixed compatible registry profile;
one unavailable, unresolved, rejected or incomplete probe keeps the overall
result indeterminate. The registry explicitly lists probes excluded by regime.

An invariant diagnostic histogram retains the complete multiset of target
component states/scalar deltas and rejection categories. Source IDs, alias order,
graph hashes and traversal work never enter histogram keys. Histograms remain
diagnostics, including for incomplete probes: this is not ResponseSignature-v0,
a pseudometric, a physical intervention or a kernel admissibility result.
The later signature stage must freeze feature and applicability rules separately.

## Limits, controls and acceptance

Limits are 32 targets per probe, 64 targets across the request, 2,048
transformation edge visits, 4,096 simple-path extensions and 131,072 selector
adjacency-entry scans. Graph bounds remain those of the selected regime. Since
direction reversal exhausts all internal edges, a response request with more
than 32 scoped edges exceeds its fixed target budget. Preflight all selectors
before baseline observation or target execution; overflow is an error, never
a partial target set. At most 65 observation evaluations and 130 individually
bounded canonicalizer calls are allowed. Canonical serialization allows 500,000
entries and 4 MiB cumulative/final output; inherited string/depth limits apply.

Freeze controls for a chain, directed cycle, reciprocal pair, diamond,
transitive triangle, typed necessary/enabling/contextual/optional dependencies,
missing necessity and other typed fields, isolates, boundary edges, opaque IDs,
and an explicitly scoped Causal Emergence fragment. Include a 32-edge cycle
with 32 additional isolates: 64 targets and 2,048 transformation edge visits.
Include rejection, unchanged direction response, target absence, mixed complete
and missing diagnostics and graph-regime distinctions. Controls are selected
before any measured outcome.

An independent Python reference constructs all selectors from source records,
enumerates simple paths, uses Boolean transitive closure for predicates/topology,
and exhaustive node bijections for graph/typed observation orbits. It does not
read production artifacts to generate expectations. Bind source/control/protocol
and independent reference dependencies by SHA-256. Exhaust all 69 loopless
directed graphs on one through three nodes in all three regimes, assigning
fixed complete typed fields (207 requests). Verify every target, transformation,
mapping, rejection, measured orbit/delta, coverage and invariant histogram.
Traversal scan counts are implementation diagnostics, checked for bounds rather
than equated with independent closure work. Transport exhaustive targets and
histograms under node/edge relabeling and reversed record serialization.

Write goldens only after independent expected outcomes and source hashes agree.
Check readonly/browser/engine APIs, closed schemas, expected-source replay,
tampering, complete source audit, finite resource limits and old scientific bytes.
SG2-023 remains the later optional History integration gate; SG2-024 supplies the
subsequent response signature. No failed measurement changes its probe family.
