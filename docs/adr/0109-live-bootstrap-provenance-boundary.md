# ADR 0109: Live-bootstrap provenance and analysis boundary

- Status: accepted
- Date: 2026-08-17

## Context

The first substantial external construction-history case uses the
`fosslinux/live-bootstrap` manifest and selected build scripts. The manifest is
an observed execution specification, but it is not a complete dependency DAG.
Predicate evaluation, state snapshots, dependency hypotheses, counterfactual
paths, and Historical Load have different evidential status. Combining them in
one undifferentiated graph would turn temporal order into an unsupported causal
claim and make source drift difficult to detect.

The case also needs to reproduce without following a branch, tag, submodule
head, or remote resource. Its first named profile is `default-amd64`, while the
pinned upstream command reports architectures other than `x86` as development
only. That limitation must remain visible.

## Decision

Pin the case to live-bootstrap revision
`9a268c4c39cae952b268bc86da342be2175f03d4`. Record the raw SHA-256 of every
consumed upstream file and reject extraction before parsing if any byte differs.
The source lock, selected profile, ordered file hashes, and revision form a
domain-separated source identity. Updating any of them creates a new case
identity.

Preserve manifest directives as ordered events, including repeated builds,
definitions, jumps, uninstalls, predicates, comments, and exact source lines.
Profile evaluation and state transitions are deterministic derived facts and
are labelled as such. An inactive event remains in the trace. Event and state
identifiers are scoped by the source identity and ordinal.

Evidence records use a closed evidence-class vocabulary. Observed order may
support only an order relation. Script references and produced artifacts require
direct source locations. Heuristic dependencies remain inferred, unknown
relations remain unknown, and counterfactual edges live only in the Onto2D
analysis layer.

The `default-amd64` case profile models the configuration emitted for an amd64
QEMU run with otherwise declared defaults. It is an Onto2D-selected inspection
profile, not a claim of upstream support; the upstream development-only warning
is part of its assumptions.

Historical Load is computed only over a finite, identity-bearing construction
space with an explicit target, cost function, and admissibility regime. Missing
inputs produce `unresolved`, never an implied zero or guessed number.

## Consequences

- A third party can replay extraction from committed exact-byte fixtures or
  supply an upstream checkout whose consumed files match the lock.
- Source facts, deterministic projections, inferences, and Onto2D-created
  counterfactuals remain separately inspectable and separately identifiable.
- Reordering the manifest or changing one consumed byte changes trace identity.
- The case does not establish that observed predecessors are build-time causes.
- Hardware, firmware, microcode, host preparation, mirrors, network transport,
  and unconsumed upstream or submodule content remain outside the modeled trust
  boundary unless a later reviewed case revision adds them.
- The external model remains separate from `causal-emergence`; generic Model
  Studio code may consume either verified pack without a model-ID branch.
