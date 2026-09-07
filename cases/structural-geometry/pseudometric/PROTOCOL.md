# StructuralPseudometric-v0: frozen bounded R6 protocol

Fixed on 2026-09-07 before implementation and measured generation.
This completes SG2-030/031/032/033 together over the unchanged ResponseSignature-v0.

## Domain, components and exact arithmetic

An input names one existing regime, optional left/right full or induced scopes
and diagnostic mode: coverage-only (default) or partial-with-coverage.
Rebuild both complete signature artifacts from the expected Model Packs.
No caller signatures, component subsets, weights, scales, thresholds, callbacks,
vocabulary mappings or pair-specific approvals are accepted.

Each compatible signature family is one categorical component: its entire joint
response multiset, including exact multiplicity. Use exact canonical value
equality, not fingerprints. Component distance is zero for equal multisets and
one otherwise, with fixed weight 1 and scale 1. Keep all three/five families.
The distance is the sum of component mismatches divided by the fixed family
count, represented as reduced integer numerator/positive denominator (zero 0/1).
All integers are bounded by five; no rounding, tolerance or pair-dependent
normalization enters the complete distance.

The complete domain consists of source/scoped objects whose fixed signature is
complete, including passed invariance. Untyped regimes share a source-independent
domain under the same profile. Typed domains are each restricted to one exact
verified full-source vocabulary context. This permits different induced scopes
of one source. Equal fingerprints or dictionary bytes in different source
contexts do not authorize comparison. Existing pairwise mappings do not establish
a common transitive vocabulary domain and are deliberately not an R6 override.
Future globally consistent vocabulary domains need a separate accepted policy.

Every artifact identifies both domains, compatibility, common domain hash or
null, each side's membership and the fixed component profile. Incompatible
domains make all comparison components indeterminate. Missing features and
unpassed invariance retain side-specific reasons; raw observations remain in
embedded evidence. Full distance stays null for any mandatory gap even if known
components differ. Coverage counts comparable families over the whole fixed
profile, never dropping an empty family. Empty profiles cannot have distance zero.

Partial-with-coverage optionally reports the mean over comparable families,
with exact coverage and guarantee none. It is explicitly an exploratory
pairwise-available diagnostic; a zero does not imply indistinguishability.
Zero comparable families give a null partial value. Failed/indeterminate
invariance or incompatible domains cannot contribute usable partial components.
The default records feature coverage/reasons but no partial scalar.

## Mathematical claim and limits

For one fixed nonempty profile and domain, each exact categorical mismatch is
a metric on feature values. Their fixed positive weighted mean is a metric on
the feature tuple. Pulling it back through the response feature map gives a
pseudometric on complete source/scoped structures; distinct graphs may have zero
distance. Nonnegativity, symmetry, self-zero and the triangle inequality follow
componentwise. No such claim extends to incomplete data or varying typed domains.
Renaming a typed source transports its whole domain: comparisons within the
renamed domain preserve distances, while cross-source authority remains absent.

The familiar partial-data counterexample extends to each actual profile size N:
A=(0,missing,0,...), B=(0,0,0,...), C=(1,0,0,...).
Partial AB=0, BC=1/N and AC=1/(N-1), violating the triangle inequality.
Strict distances involving A are null. Test N=3 and N=5 exactly.

Keep every upstream bound. The comparison allows five components, 140
observation evaluations, 280 individually bounded canonicalizer calls,
2,000,000 canonical entries and 16 MiB cumulative/final output. Account for
both signatures before adding the comparison records. Inherited string/depth
limits apply; overflow throws without a partial artifact. Verification rebuilds
all sources, scopes, policies, domains, evidence, rational results and diagnostics.
Readonly/browser/opt-in engine contracts and closed schemas remain additive.

## Frozen controls and independent reference

Construct one shared source containing the four complete signature graphs
(diamond with feedback, subdivided feedback, isolated extension, necessity
change) and five additional fragments (chain, mixed reciprocal graph, missing
role, missing necessity, isolates). Use distinct transported source IDs and
induced scopes, preserving every original edge annotation and all isolates.
The complete four-fragment matrix supplies 16 ordered pairs in each regime.
Retain all known signature collisions as zero-distance pairs.

Add chain/diamond in both orientations, incomplete self-comparison, empty
coverage, rejection and typed missingness, untyped comparisons with an
independently sourced signature control, typed cross-source equality without
authority, a changed full-source identity, and both sides at the maximum
topology signature workload. Fix these cases before inspecting distances.

Python independently reconstructs source responses/signatures and computes
distances with Fraction. Pin source controls, protocols, independent dependencies
and the JavaScript reference-summary bridge by SHA-256. Check endpoint signatures
as well as comparison summaries; expected generation reads no production output.
Compare all ordered source pairs against the independent reference.

Exhaust all three-symbol categorical tuples in dimensions three and five:
59,778 ordered pairs and 14,368,590 ordered triangles, plus exact symmetry and
self-zero. Each symbol represents a distinct nonempty valid multiset. Compare
production rational matrices with independent Fraction results. Separately
enumerate all 728 equal/different/missing aggregation profiles of length zero
through five across both diagnostic modes. Preserve the strict partial-data
counterexamples rather than tuning weights or dropping troublesome dimensions.

Transport all 16 complete scope-pair distances under a fixed full-source
node/edge renaming in each regime; compare typed domains through simultaneous
transport, not unsupported cross-source equality. Include one-sided untyped
renaming, scope-order normalization, typed mismatch, schema, browser, engine,
rehash forgery and bounded-resource controls. Goldens are written only after
independent source bindings and outcomes agree. Prior scientific bytes remain.
