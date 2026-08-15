# ADR-0016: Normalized package/run candidate binding

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

ADR-0015 defines exhaustive decoration only after a caller supplies complete
finite skeleton, node-variant, and edge-variant alphabets. That low-level
boundary deliberately cannot decide which package primitives, profile classes,
roles, or run budgets define a scientific candidate universe.

The next D2 increment needs a reproducible bridge from a loaded `RulePackage`
and `RunConfig` without yet claiming profile guards, integrated predicate
execution, partial pruning, closure-depth selection, or derived structural
attributes.

## Decision

`normalizeRunConfig`, versioned as `run-config-normalizer-v2`, validates a
closed schema-v1 configuration and returns an immutable normalized value.
Research choices without normative defaults remain required. Only the five
documented `RunBudget` defaults are materialized:

- `maxNodes = 4`;
- `maxEdges = "n+2"`;
- `maxCandidates = 1_000_000`;
- `perturbationSamples = 200`;
- `nullModelRuns = 500`.

Set-valued axes, roles, null models, and graph structural-attribute names are
canonicalized independently of input order. Precision, graph, substructure,
ontology, threshold, boundary, and bounded-fixpoint fields use their executable
closed contracts. A normalized configuration is hashed in
`onto2d:run-config:v1` when bound to generation.

`createPackageCandidateBinding`, versioned as
`package-candidate-binding-v2`, does not trust the label on a supplied loaded
package. It removes only derived primitive element IDs, reloads the normalized
package with an independently expected kernel version, and requires the entire
reproduced loader artifact to match before deriving a universe. Direct calls
default that expectation to the package's current kernel version and may supply
an explicit expected version; `createKernel({ version })` injects its own fixed
version into every downstream package-verification boundary.

The binding freezes:

- the package ID and primitive depth basis;
- the normalized RunConfig and its domain-separated hash;
- the exact sorted primitive element-ID population;
- profile classes, sorted members, and the lexicographically smallest element
  ID as the disclosed deterministic representative;
- element-ID node variants for `element-exact`, or one profile-hash variant per
  class for `profile-quotient`;
- one edge variant per normalized `roleAlphabet` entry;
- every complete connected simple skeleton from one through `maxNodes`;
- the run's edge/unique-candidate limits and separately declared raw,
  decoration-state, and canonical-search execution limits.

The complete basis is hashed in `onto2d:package-candidate-binding:v1`.
`enumeratePackageCandidates`, versioned as
`package-candidate-generator-v5`, executes ADR-0015 directly from that frozen
basis and returns the binding beside the low-level enumeration result.

The current bridge is intentionally limited to the normalized package's
primitive population. It records that population explicitly rather than
pretending to select an evolved closure depth. It rejects before enumeration:

- `single-candidate`, which requires a caller-supplied candidate;
- `graphPolicy.connected = false`, because only the connected skeleton
  universe is implemented;
- non-empty structural node or edge attribute vocabularies, because no
  package-to-decoration attribute derivation rule exists yet;
- wall-time or resident-memory budgets, because the synchronous enumerator
  cannot enforce them deterministically;
- a canonical search budget too small to revalidate every bound skeleton and
  the edge-variant preflight;
- packages with no primitives.

Profile slot guards and capacities do not filter variants, and predicate plans
do not prune branches. The role alphabet remains an explicit RunConfig input;
it is not inferred from observed profiles.

## Consequences

- equivalent set order in RunConfig produces the same run and binding hashes;
- element-exact and profile-quotient universes now come from verified package
  identities rather than hand-built variant arrays;
- profile representatives and quotient membership remain auditable;
- execution-safety limits that are not research RunBudget fields still affect
  binding identity and are reported on exhaustion;
- unsupported semantics fail before any partial universe is returned;
- these contracts were intentionally left to separate decisions. ADR-0017
  through ADR-0078 subsequently add graph/local evaluation, primitive and
  generalized depth populations, selection/materialization, audited pruning,
  complete-candidate profile composition, and package-driven scalar candidate
  attributes. ADR-0085 later adds package-driven Quantity attributes, and
  ADR-0086 role-dependent edge values. ADR-0088 subsequently closes
  formation-functional later-depth carry-forward through derived `Element`
  invariants without adding same-candidate feedback to this bridge.
  ADR-0081 subsequently adds portable replay-resumable
  low-level traversal, ADR-0082 predicate-authorized node growth, and ADR-0084
  audited profile-state raw-frontier pruning without changing the binding.

## Verification

Fixtures cover documented budget materialization, canonical set ordering,
closed-field and range failures, precision-policy rebasing, element/profile
alphabet derivation, representative disclosure, skeleton and role binding,
binding invariance, complete execution, raw-budget exhaustion, loaded-package
tamper and kernel-version substitution rejection, and every explicitly
unsupported generator mode.
