# ADR-0041: Generalized level and explicit ladder closure

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

ADR-0039 closed only the primitive-to-depth-1 transition. ADR-0040 supplied a
verified depth-aware candidate census, but a caller still had to assemble the
cohort, selector, admission, formation, profile, and population chain manually.
Repeating that assembly at later depths would risk semantic drift, stale prior
levels, duplicated element identities, and ambiguous ladder termination.

Current-level self-reference is a separate fixed-point problem. It must not be
silently approximated by an ordinary ascending depth sequence.

## Decision

`package-depth-level-closure-v1` executes one target transition from a complete
contiguous prior-level chain.

- It reproduces the loaded package, normalized RunConfig, source selection,
  finite enumeration, complete local census, and every declared cohort,
  ranking, sensitivity, and admission input.
- It reuses the verified primitive selection algorithms through prepared
  depth-aware filter and functional sessions; no alternate ranking or
  admission policy exists for later depths.
- Ranking work, perturbation variants, and sensitivity evaluations are
  preflighted before selector execution. Null models remain unavailable and
  cause an explicit preflight failure.
- Selected formations, residual profiles, and derived elements carry the
  target depth. The result embeds prior level/population/run hashes and the
  exact source-selection hash.
- Complete, empty, and indeterminate terminals have the same meaning as the
  primitive transition. The full artifact is hashed in the existing
  `onto2d:package-level-result:v1` domain and stored artifacts require exact
  deterministic replay.

`package-ladder-closure-v1` executes consecutive target depths from one through
an explicitly requested bound of at most 64.

- Depth one uses `package-level-closure-v1`; later depths use the generalized
  coordinator over every already closed level.
- The RunConfig `sourceDepths` policy is preserved at each transition.
- A canonical element index includes the primitive population and every
  derived appearance. Structural identity is counted once, minimum derivation
  depth remains authoritative, and re-derivations remain visible.
- Execution stops after the requested depth, after the first level introduces
  no new element, or after an indeterminate level. These yield `complete`,
  `fixpoint`, or `indeterminate` respectively.
- Work ceilings are enforced independently for each level. Aggregate execution
  totals are reported for audit but do not redefine a per-level ceiling.
- The ladder embeds all level artifacts, introduction counts, selectivity
  records, execution totals, and terminal interpretation. It is hashed in
  `onto2d:package-ladder-result:v1` and verified only by exact replay.
- `boundedFixpoint.enabled: true` is rejected with
  `PACKAGE_LADDER_BOUNDED_FIXPOINT_UNAVAILABLE`; current-level round semantics
  remain future work in this artifact version. ADR-0044 subsequently adds a
  distinct fixpoint ladder and makes the generic dispatcher route enabled
  bounded runs to it.

## Consequences

- arbitrary explicit derivation depths now use one verified selection and
  materialization policy rather than depth-specific copies;
- callers can persist one complete, content-addressed ladder result with an
  auditable minimum-depth/all-appearances index;
- a no-new-element terminal is explicit and cannot be confused with requested-
  depth completion;
- the bound limits artifact and recursive replay growth, but it is not a claim
  that every package can afford all 64 depths under its candidate budgets;
- null baselines and bounded current-level fixpoints remain outside this
  closure version; ADR-0042 subsequently consumes its ordinary ladders for
  profile-collapse and level-boundary diagnostics, and ADR-0044 supplies the
  separate fixpoint closure.

## Verification

Local conformance covers depth-two complete selection/materialization,
depth-three `previous-only` ladder execution, exact level and ladder replay,
minimum-depth and re-derivation accounting, domain hashing, strict JSON Schema
validation, public JavaScript and TypeScript exposure, configured-kernel
capabilities, tamper rejection, and explicit bounded-fixpoint rejection by the
ordinary coordinator. ADR-0044 additionally verifies generic dispatch to the
separate bounded coordinator. The complete repository suite passes in the
supported Node.js 22 and 24 CI matrix. Independent implementation comparison
remains an acceptance requirement.
