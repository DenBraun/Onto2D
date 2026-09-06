# Typed directed observations and vocabulary alignment

Status: SG2-013 implemented within the frozen `typed-relations-v1` profile.
Date: 2026-09-06. See the [review](TYPED_OBSERVATION_REVIEW.md) and
[operative roadmap](REVISED_ROADMAP.md).

The `/typed` API measures untyped directed structure and the same graph with
five edge fields. It also prepares source-bound vocabulary mappings and aligns
complete typed values when caller policy explicitly permits that mapping.
It preserves every earlier regime, observable spec, preparation and evaluator.
Pairwise comparison statuses, distances and general mandatory-coverage
aggregation remain SG2-014/015. Probes and signatures remain R4/R5.

## One common graph matching

| Field | Accepted value | Interpretation |
|---|---|---|
| `dependencyTypeId` | Nonnegative safe integer | Local dependency-type code |
| `interactionModeIds` | Distinct nonnegative safe integers | Local code set, sorted numerically |
| `ontologicalRole` | `arising`, `maintenance`, `modulation` | Declared role |
| `necessity` | `necessary`, `enabling`, `contextual`, `optional` | Declared necessity class |
| `causalDirectionIds` | Distinct nonnegative safe integers | Local code set, sorted numerically |

One node bijection must preserve directed endpoints and **all five fields
together**. The implementation translates to the existing kernel candidate
canonicalizer using the frozen uniform node reference, fixed source-parent role,
disconnected support and the five structural edge attributes. Arrays become
canonical JSON strings of numerically sorted sets for the kernel's scalar
attribute interface; the public result decodes them back to arrays.

Independent per-field matching is insufficient. Two reciprocal-edge controls
have the same untyped graph and a valid matching for each individual field,
but disagree on which dependency and interaction codes belong together. Their
joint typed values differ. This control prevents a false match from independently
canonicalizing each field or comparing only type histograms.

Source node IDs, edge IDs, labels, weights, confidence, scientific status,
quantization and other annotations do not enter observation coordinates.
Isolates and directed structure remain. A witness records one deterministic
bijection with every normalized edge tuple; it neither computes canonical
orbits nor supplies invariant probe targets.

## Measurement, missing evidence and local code identity

```js
import { observeTypedRelations, verifyTypedRelationsObservation,
  createTypedRelationsObservationAnalysis } from "@onto2d/structural-geometry/typed";

const input = {
  regimeId: "typed-relations-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5"] }
};
const result = observeTypedRelations(pack, input);
verifyTypedRelationsObservation(result, pack, input);
console.log(result.observations[1].availability);
// Register createTypedRelationsObservationAnalysis() explicitly with an engine.
```

Scope defaults to the full graph. The full Model Pack and its source projection
are verified before scoped measurement. Every **present** typed field in the
complete source is validated, so an invalid excluded field cannot be hidden.
Absent excluded fields do not create scoped gaps. Internal edges alone supply
the measured tuples; all boundary partitions remain in preparation provenance.

An absent scoped field is missing mandatory evidence. An explicitly declared
empty code array is a valid observed empty set. Null, wrong types, duplicate set
members, unknown role/necessity strings and unsafe integers are validation
errors. No default role, code or empty set fills a missing field.

The immutable artifact contains the unchanged preparation, full local vocabulary
binding, two ordered observations, field-evidence accounting and an artifact hash:

- `observations[0]` always measures the exact untyped graph under the typed
  regime's first spec. Its value agrees with SG2-011; its value hash binds the
  typed regime/implementation, so it is not the SG2-011 artifact identity.
- `observations[1]` contains the jointly typed graph and complete witness when
  all scoped edge fields are present. Its availability is `"observed"`.
- If any scoped field is absent, the second observation has availability
  `"missing"` and null `value`, `valueHash` and `witness`. The envelope records
  `evaluation: "incomplete"` while retaining the untyped observation and every
  `{sourceEdgeId, field}` gap. Otherwise evaluation is `"measured"`.
- Evidence counts are `5 × scopedEdgeCount`, observed field count and the gap
  list. An isolate-only graph has complete, vacuous edge evidence.

The vocabulary binds the exact source model identity, full dictionary hash from
R2 and the existing vocabulary policy. Model Pack dictionaries are opaque JSON:
this evaluator does not assume universal table names, infer dictionary meanings
from labels or assert that every local code has a reviewed dictionary entry.
It observes declared code symbols in their source context. Domain code lookup
and scientific justification of a vocabulary mapping require separate evidence.

**A typed value hash is a fingerprint of the canonical graph with raw local
codes. It is not cross-source semantic equality.** The value hash binds regime,
spec and implementation but excludes source IDs/dictionaries to retain the
declared observation invariances. Dictionary/model identity stays in provenance
and the compatibility gate. Two equal hashes with incompatible vocabularies
cannot authorize a typed comparison.

## Explicit mapping authority

`createStructuralVocabularyMapping(leftPack, rightPack, declaration)` binds two
verified full-source vocabularies and this closed declaration:

```js
const declaration = {
  id: "reviewed-domain-mapping",
  version: "1",
  fields: {
    dependencyTypeId: [{ left: 0, right: 10 }],
    interactionModeIds: [{ left: 0, right: 3 }],
    ontologicalRole: [{ left: "arising", right: "arising" }],
    necessity: [{ left: "necessary", right: "necessary" }],
    causalDirectionIds: [{ left: 0, right: 0 }]
  },
  reviewEvidence: { reference: reviewReference, contentHash: reviewContentHash }
};
```

All five maps are explicit. A field's entries form a partial bijection: neither
left nor right values may repeat. Arrays map individual member codes. Entry
order is normalized; a map may include unused values. An identity mapping can
declare a reviewed shared vocabulary. Role/necessity correspondences are also
explicit and must stay within their frozen universes.

Creating or verifying this artifact does **not** approve it. The review-evidence
reference records provenance; the runtime does not fetch that document,
authenticate its author or establish scientific review from a self-asserted
hash. The calling application must freeze its accepted mapping hash through
its own review process before examining comparison outcomes. Verification with
`verifyStructuralVocabularyMapping(mapping, leftPack, rightPack, expectedDeclaration)`
checks exact endpoint/declaration replay against separately expected inputs.

```js
import { alignTypedRelations, verifyTypedRelationsAlignment }
  from "@onto2d/structural-geometry/typed";

// approvedMappingHash comes from trusted, previously frozen caller policy.
// Do not obtain approval automatically from the artifact being submitted.
const options = { mapping, approvedMappingHash };
const alignment = alignTypedRelations(leftPack, leftInput, rightPack, rightInput, options);
verifyTypedRelationsAlignment(alignment, leftPack, leftInput, rightPack, rightInput, options);
```

Without a mapping, only the same **exact** source model binding and dictionary
hash establish local vocabulary compatibility. Different releases, relabeled
sources or metadata revisions require explicit mapping even when dictionary
bytes match. This is a conservative compatibility rule; equal model names or
local numbers supply no implicit cross-source authority.

An approved mapping must cover every value used in every scoped field on both
sides. Right-hand values translate into the left vocabulary. The implementation
then reruns joint typed canonicalization with original right source IDs retained
in its witness. Replacing numbers in an already canonical result is insufficient:
the new field order can change the canonical node numbering.

The alignment artifact records both source observations, mapping and externally
expected approval hash. `compatibility.state` is `"compatible"` or `"unresolved"`.
Missing types, missing approval/mapping or uncovered values produce explicit
reasons and `aligned: null`. Malformed or wrong-source mappings throw even if
another evidence gap would already prevent alignment. Compatible results contain
both canonical values/witnesses in the left vocabulary and its domain hash.
They may still be different graphs: compatibility is not graph equality.

There is no final comparison status or numeric distance here. Pair-oriented
alignment is not a fixed global metric domain. A future complete-domain
pseudometric must freeze one common vocabulary/mapping policy across its domain.

## Limits and contracts

The existing regime allows 1–6 nodes, 30 edges, 100,000 search states per kernel
call, 100,000 canonical entries and 1 MiB per complete artifact. Each observation
uses at most two canonicalizer calls, including their skeleton phases. Each
alignment uses at most five calls: two observations and right-side rematching.
The separate alignment policy limits mapping entries to 1,024 across all fields.
No truncation, greedy identity or partial typed graph is substituted on failure.

Five additive closed schemas cover typed input/observation, mapping declaration,
source-bound mapping and alignment. Runtime verification recomputes full expected
results, including values, witnesses, evidence, approval and source provenance.
Schema validation checks shape and local consistency, not graph isomorphism,
injectivity across map rows, total entry counts or arithmetic reconciliation.
Readonly declarations and browser/Node replay use the same public API. Evaluator
errors use `STRUCTURAL_TYPED_`; inherited source/preparation/kernel errors remain.

Hash domains are `onto2d:structural-typed-{implementation,value,observation,
alignment-policy,vocabulary-mapping,vocabulary-domain,alignment}:v1`.
Value hashes exclude availability and witnesses; the complete artifact binds
all of them. No existing hash domain or accepted artifact is rewritten.

## Independent controls

The [case suite](../../cases/structural-geometry/typed/README.md) freezes 26
observations (24 complete, two incomplete), five mappings and eight alignments
(four compatible, four unresolved). Python independently enumerates all node
permutations and checks graph orbits, complete original/remapped witnesses and
evidence accounting. The exhaustive census uses absent/A/B edges with two fixed
five-field tuples:

| Nodes | Labeled graphs | Typed isomorphism classes |
|---|---:|---:|
| 1 | 1 | 1 |
| 2 | 9 | 6 |
| 3 | 729 | 138 |

All 739 graphs agree without false merges/splits. All 720 relabelings of a
six-node control retain its typed value. Additional controls exercise each
field, joint correlations, sets, missing data, Unicode IDs, source/dictionary
changes, complete six-node graphs and explicit vocabulary approval. The unchanged
Causal Emergence release contributes its six-node/11-edge fragment with all
55 scoped fields present. No cross-domain mapping is inferred for that source.

```sh
npm run structural-geometry:typed:check
npm run structural-geometry:typed:report
```

For deliberate regeneration, review controls/mappings first, then run
`python3 -B cases/structural-geometry/typed/reference.py --write` and
`npm run structural-geometry:typed:build`. The builder rejects stale source
hashes and disagreements before writing. Check/report commands never regenerate.
Constructed fixture approval is test authorization, not external scientific
review. Independent algorithm agreement does not establish empirical usefulness.
