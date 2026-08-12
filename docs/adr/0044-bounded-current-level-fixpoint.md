# ADR-0044: Bounded current-level fixpoint closure

Status: accepted; amended by ADR-0080

## Context

ADR-0041 closes an ascending sequence whose level `d` depends only on complete
lower depths. Some monotone package rules must also inspect elements admitted
at the level currently being constructed. Treating those references as an
ordinary later depth would change their semantics; accepting them in the
ordinary candidate path would permit an unbounded or order-dependent cycle.

The architecture therefore requires a separately opted-in bounded fixpoint.
It must preserve the same complete candidate, selector, formation, profile,
and population semantics as ordinary closure while making every round,
resource limit, terminal state, and tentative result auditable.

## Decision

`package-current-level-fixpoint-closure-v2` is the only coordinator that may
execute `referencesDepth: "self"`.

- Package loading requires `allowCurrentDepthReferences: true`; execution also
  requires `boundedFixpoint.enabled: true`. Ordinary bindings continue to
  reject the self-reference and direct callers are routed to the coordinator.
- `maxIterations` is required and limited to 1 through 10,000. It is part of
  the normalized RunConfig and therefore part of run and result identity.
- Current-level sources, current sets, and the cross-depth index are limited to
  1,000,000 unique element identities, matching the published artifact
  capacity; overflow fails explicitly before an invalid artifact is emitted.
- A level starts with an empty current set. Each round selects the configured
  `all-below` or `previous-only` lower populations and unions them with the
  complete previous current set.
- Each round independently enumerates and filters the complete bound candidate
  universe, runs every selector chain, admits formations, derives profiles,
  materializes elements, and executes configured null models over that exact
  round carrier under the existing verified policies and work ceilings.
- Canonical element IDs not already present in the current set or selected
  lower source are added monotonically. A round with no addition is the first
  convergence witness; evaluation order cannot retract an element.
- The round artifact binds source and before/after current-set hashes, all
  embedded stage artifacts, added IDs, execution totals, status, and a domain-
  separated round hash. Current-set state and final population use distinct
  hash domains.
- A converged level publishes the monotone current set. Alternate derivations
  are deduplicated by formation hash and record the first round in which each
  derivation appeared.
- If a round is indeterminate, or the iteration bound is consumed by rounds
  that still add elements, the level is `indeterminate`. Tentative elements
  and derivations remain in a separate audit population, while the final
  population and interpreted selectivity are withheld.
- A direct level above depth one accepts lower levels only after reproducing
  every one in ascending order from the independent package and RunConfig.
  Stored levels require exact replay.

`package-fixpoint-ladder-closure-v1` applies the same coordinator at consecutive
depths. It keeps the ordinary minimum-depth/all-appearances index and stops at
the requested bound, an indeterminate level, or a level that introduces no
globally new canonical element. The generic ladder and configured-kernel
adapters dispatch to it whenever bounded mode is enabled. The complete ladder
has its own domain hash and exact replay contract.

Profile-collapse and level-boundary diagnostics reject bounded-fixpoint runs
for now. Their existing comparison observes a terminal ordinary level, whereas
a truthful fixpoint comparison must define cumulative cross-round predicate,
selector, and admission observations. They must not silently compare only the
last round.

## Consequences

- current-level references remain impossible without two explicit opt-ins;
- termination is operationally bounded without fabricating convergence;
- exhausted work remains inspectable but cannot leak a partial final
  population into the next depth;
- ordinary and fixpoint ladders share candidate and selection semantics but
  retain distinct artifact versions and hash domains;
- pruning authorization and cumulative fixpoint profile collapse remain
  separate gates; round-local null execution is closed by ADR-0080;
- `POST-CLOSURE-VIS-01` remains pending until the complete kernel closure gate,
  rather than being triggered by this milestone alone.

## Verification

Local conformance covers the loader and run opt-ins, invalid depth references,
empty and non-empty convergence, first-observed derivation rounds, bounded
exhaustion, withheld final populations, preserved tentative populations,
current-level predicate and null-model execution, direct and multi-level exact replay, lower-
level tamper rejection, outer-ladder fixpoint termination, configured-kernel
dispatch, profile-collapse/boundary rejection, domain hashes, and strict Draft
2020-12 validation of binding, enumeration, census, round, population, level,
and ladder artifacts. The complete repository suite passes locally on Node.js
20 and 22. Independent implementation comparison and additional-platform
evidence remain acceptance requirements.
