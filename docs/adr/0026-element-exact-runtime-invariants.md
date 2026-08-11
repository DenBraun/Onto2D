# ADR-0026: Element-exact runtime invariant resolution

Status: proposed implementation baseline; local conformance passed; extended
by ADR-0027; independent and cross-platform review pending

## Context

Every materialized primitive `Element` carries its normalized
`Record<string, Quantity>` invariants. Predicate plans already type-check an
`invariant` expression and record its required name, but ADR-0020 rejects it at
runtime because a candidate expression did not yet identify a trusted element
value or a unique node.

The package candidate binding now supplies enough information for one closed
case. In `element-exact`, every canonical candidate node refers to one exact
materialized element in the reproduced source population. In
`profile-quotient`, a profile class may contain members whose arbitrary
invariants differ even when their profile hashes agree. Selecting the
lexicographically smallest formation representative would therefore invent a
scientific invariant for the complete class.

## Decision

`local-predicate-evaluator-v7` evaluates a Quantity-valued `invariant` only
against an explicit element-exact invariant context.

- The context names the reproduced primitive source-population hash and
  contains exactly one entry for every distinct element reference in the
  candidate. Entries contain the available required invariant names and their
  normalized Quantity values. Unknown elements, extra invariant names, duplicate entries,
  malformed quantities, and context/candidate drift fail before evaluation.
- Package filtering derives this context from the verified
  `primitive-depth-population-v1`; it never accepts caller-substituted package
  values. Direct local-evaluator callers must provide the same explicit context,
  and the resulting artifact binds its source-population hash and resolved
  values.
- An explicit invariant `node` selector must select exactly one canonical node.
  An omitted selector is accepted only for a singleton candidate. Empty or
  multi-node resolution fails instead of selecting an arbitrary element or
  aggregating values.
- The selected element must declare the requested invariant. Its normalized SI
  unit and semantic must match the verified plan symbol. Scalar invariants are
  not available from the current Element contract and remain unsupported.
- A direct invariant retains the source Quantity's declared/computed/Oracle
  tolerance and provenance. It enters derived addition and scalar scaling
  through the unrounded path established by ADR-0024 and ADR-0025.
- Every compare witness carries canonical invariant-resolution records with the
  expression path, invariant name, canonical node index, element ID, and
  normalized source Quantity. The local artifact additionally records
  `invariantSourcePopulationHash` whenever invariant resolution is used.
- `profile-quotient` invariant evaluation fails preflight with
  `profile-invariant-consensus-not-frozen`. A future extension must prove a
  class-wide value or bind an explicit consensus/aggregation policy; the
  existing formation representative is not such a policy.

The local evaluation domain becomes
`onto2d:predicate-local-evaluation:v7`. Package-filter artifacts embed local
evaluations, so their evaluator and domain become
`package-candidate-filter-evaluator-v8` and
`onto2d:package-candidate-filter:v8`.

Runtime coefficients, profile-domain invariant consensus, general Quantity
products, balance, cycle-set selection, and substructure operators remain
unsupported.

ADR-0027 subsequently enables complete node/edge attribute balance while
retaining this evaluator/domain version as the historical invariant boundary.

## Consequences

- exact-domain predicates can consume the scientific values already attached
  to their materialized constituents without copying them into candidate attrs;
- local evaluation identity changes when the resolved invariant, element, or
  source-population identity changes, even when an identity policy excludes
  invariants from ordinary element structural identity;
- missing or ambiguous scientific data cannot silently become zero, a profile
  representative value, or an indeterminate selector shortcut;
- derived Quantity tolerance, exactness, evidence, and provenance rules remain
  compositional across constants, sums, invariants, addition, and scaling.

## Verification

Fixtures cover singleton and explicit canonical-node resolution, context-order
invariance, nested addition/scaling, tolerance and provenance retention,
missing contexts and values, context/candidate drift, unit/semantic mismatch,
ambiguous selectors, profile-domain rejection, package-derived context,
schema conformance, and Node.js 20/22 determinism.
