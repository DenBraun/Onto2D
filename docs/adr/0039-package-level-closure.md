# ADR-0039: Deterministic package-level closure

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0029 through ADR-0038 define independently replayable candidate census,
cohort, ranking, sensitivity, admission, selected-formation, profile, and
derived-depth artifacts. Calling those boundaries separately does not prove
that an entire level was executed under one package, RunConfig, binding, or
whole-level budget. It also leaves no single result hash or terminal status
that a case runner can publish and verify.

The current source-population binding is deliberately restricted to primitive
depth zero and target depth one. Null-model execution, generalized derived-
depth input, bounded fixpoint execution, and ladder closure are still separate
future boundaries. A level result must state that narrower scope instead of
claiming the target architecture is complete.

## Decision

`package-level-closure-v1` is the deterministic coordinator for the currently
supported `primitive-to-derived-depth-1-v1` scope.

- It verifies the loaded package and normalizes the RunConfig, then executes
  the complete candidate census, every declared selector's cohort partition,
  ranking and sensitivity report, all-selector admission, selected formations,
  residual profiles, and derived depth-1 population in that order.
- Before selector execution, it computes ranking evaluations, required
  perturbation variants, and sensitivity functional evaluations across all
  selectors. A level is rejected before partial selector work when any global
  ceiling or the RunConfig perturbation budget is exceeded.
- Configured null models or positive null-model runs are rejected with
  `PACKAGE_LEVEL_CLOSURE_NULL_MODELS_UNAVAILABLE`. A successful current-scope
  artifact records the baseline as `not-run` because null models were
  explicitly disabled; it does not fabricate a control distribution.
- The run identity binds kernel version, package/rules/depth-basis hashes, the
  normalized RunConfig hash, and the exact candidate binding hash in
  `onto2d:run:v1`.
- The level artifact embeds every prerequisite artifact, Boolean selectivity,
  selector censuses, retention metrics, reconciled candidate/formation/profile/
  element counts, global execution consumption, and the terminal
  `complete`, `empty`, or `indeterminate` interpretation. It is hashed in
  `onto2d:package-level-result:v1`.
- `empty` means no derived elements were materialized from an otherwise
  determinate chain. Admission or profile/population indeterminacy propagates
  to the level, and an indeterminate profile set still emits no partial
  derived population.
- Stored closure results are accepted only through exact deterministic replay
  from the independently supplied package, RunConfig, and execution options.
  `createKernel().closeLevel({ package, config, options })` is the public
  adapter for this scope. ADR-0041 subsequently adds generalized depth and
  explicit ladder coordinators without changing this primitive contract.

## Consequences

- callers can obtain and verify one content-addressed result for the first
  complete executable level rather than manually stitching stage artifacts;
- two selectors that fit per-selector limits can still fail the correct
  whole-level preflight when their combined work exceeds a budget;
- a successful result is truthful about disabled baselines and primitive-only
  source binding;
- null controls, bounded current-level fixpoints, and explanations were still
  required after this primitive milestone; bounded fixpoints were subsequently
  implemented by [ADR-0044](0044-bounded-current-level-fixpoint.md), while null
  controls and explanations were later closed by ADR-0071 through ADR-0075 and
  ADR-0057; round-local fixpoint null execution follows in ADR-0080. Carrier promotion was implemented in
  [ADR-0043](0043-explicit-carrier-promotion.md);
  generalized explicit closure and ladder termination are specified by
  ADR-0041 and boundary diagnostics by ADR-0042;
- `POST-CLOSURE-VIS-01` remains deferred until those closure requirements are
  complete, after which a verified case artifact will drive the GitHub Pages
  visualization.

## Verification

Local conformance covers complete, empty, and indeterminate terminals; run and
level domain hashes; exact replay; tamper rejection; public kernel methods;
unavailable-null-model rejection; aggregated ranking, perturbation, and
sensitivity ceilings; strict JSON Schema validation and contradictory-status
rejection; TypeScript declarations; and Node.js 20/22 repository validation.
Independent implementation comparison and additional-platform evidence remain
acceptance requirements.
