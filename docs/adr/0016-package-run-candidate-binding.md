# ADR-0016: Normalized package/run candidate binding

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

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

`normalizeRunConfig`, versioned as `run-config-normalizer-v1`, validates a
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
`package-candidate-binding-v1`, does not trust the label on a supplied loaded
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
`package-candidate-generator-v1`, executes ADR-0015 directly from that frozen
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
- derived source-depth population selection, structural-attribute derivation,
  profile guards/capacities, complete numeric/substructure predicate
  evaluation, selector admission, and partial pruning remain separate
  implementation work. ADR-0017 later adds standalone graph-only evaluation
  and diagnostics; ADR-0018 materializes and binds the primitive depth-zero
  population; ADR-0019 combines those boundaries into package-bound graph-only
  local filtering without changing the derived-depth limit.

## Verification

Fixtures cover documented budget materialization, canonical set ordering,
closed-field and range failures, precision-policy rebasing, element/profile
alphabet derivation, representative disclosure, skeleton and role binding,
binding invariance, complete execution, raw-budget exhaustion, loaded-package
tamper and kernel-version substitution rejection, and every explicitly
unsupported generator mode.
