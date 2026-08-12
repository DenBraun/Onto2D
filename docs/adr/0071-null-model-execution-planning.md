# ADR-0071: Null-model execution planning and independent streams

- Status: accepted
- Date: 2026-08-12

## Context

The architecture requires every null model to state the exact ontology gate
and carrier population it randomizes. It also requires deterministic streams
that do not change when models or workers are reordered, and it forbids
copying invalidated predicate, functional, cohort, selector, or evidence
results into a randomized trial.

Previously these constraints existed only as prose. A closure rejected every
enabled null model, while there was no executable artifact between normalized
run configuration and a future trial runner. Implementing transformations
before freezing this boundary would permit silent changes to the sampled
universe or accidental stream coupling.

## Decision

`package-null-model-plan-v1` is an immutable, exactly replayable execution-plan
artifact. Its constructor accepts a verified complete primitive or depth-aware
candidate census and binds:

- the package, rules, depth basis, normalized run, generation binding, and
  census identities;
- either the run's explicit ontology coordinate or an explicit derivation-
  depth gate;
- the complete canonically ordered candidate-ID carrier and its counting
  domain, source population, and carrier hash;
- one typed proposal/preservation contract for each configured model;
- one trial record per model and configured trial index;
- the mandatory per-trial recomputation and no-cross-universe-pooling rules.

Model order is normalized by `RunConfig`. Each stream is derived in the
`PACKAGE_NULL_MODEL_STREAM` hash domain from the run seed, normalized run
identity, carrier, model, and trial index. Trial IDs use a separate domain.
Adding a worker or reordering authored model identifiers therefore cannot
change stream identity. The declared draw-expansion contract is SHA-256
counter expansion with rejection sampling; model executors must implement
that exact stream before they may claim conformance.

The plan accepts only complete census carriers. Configured models and
`nullModelRuns` must be enabled or disabled together. Total planned trials and
carrier size have hard limits before arrays are materialized.

A disabled plan has `status: "not-run"` and reason
`null-models-disabled`. An enabled plan has `status: "planned"` and reason
`trial-execution-and-metric-distributions-pending`. In particular, `planned`
is not a completed scientific baseline and cannot replace the current closure
`baseline.status: "not-run"` result.

## Consequences

- future proposal and trial executors receive one exact, bounded population
  and cannot silently switch ontology gates;
- model/trial stream identities are stable under scheduling and authored
  model-order changes;
- every later baseline sample can cite a plan, carrier, and stream identity;
- plan verification reproduces its upstream package and census instead of
  trusting embedded identities;
- closure continues to reject configured null models until transformations,
  full per-trial reevaluation, distributions, and interpretation are
  implemented.

ADR-0072 subsequently implements the transformation/proposal portion. Full
per-trial reevaluation, distributions, and interpretation remain open.

## Verification

Conformance covers all three model contracts, complete carrier disclosure,
six independent model/trial streams, authored-order invariance, seed
sensitivity, explicit disabled and ontology-gated states, primitive and depth-
aware census inputs, hard trial limits, unknown options, tampering, kernel
facade methods, public types, compiled JSON Schema, and local Node.js 20/22
execution.
