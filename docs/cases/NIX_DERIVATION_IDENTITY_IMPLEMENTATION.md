# Nix Derivation Identity — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity

Domain:
    Functional package management

Evidence profile:
    direct-record
    cryptographically-verified
    derived
    unknown

Historical Load:
    Not primary

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Not primary
```

Status: implemented and verified. The reproducible method, exact results, and
execution boundary are documented in
[`cases/nix-derivation-identity/README.md`](../../cases/nix-derivation-identity/README.md).

## Purpose

Study a real engineering system where construction derivation and output
content are represented as distinct identity-relevant concepts.

Primary distinction:

```text
what was produced
    vs
how it was produced
```

## Outputs

```text
cases/nix-derivation-identity/
apps/nix-derivation-explorer/
models/nix-derivations/
docs/external-cases/NIX_DERIVATION_IDENTITY_IMPLEMENTATION.md
```

## Initial Scope

Use a bounded frozen fixture set.

Do not start with all of Nixpkgs.

Capture enough data to represent:

```text
derivation
outputs
input derivations
input sources
builder
arguments
system
environment
output content identity
```

## Phase 0 — Pin Environment

Record:

- Nix version;
- fixture source files;
- exact derivation text/JSON;
- selected store behavior;
- source hashes;
- platform assumptions.

The case must fail closed when fixture identity changes.

## Phase 1 — Canonical Fixture Set

Build fixtures demonstrating:

1. same output content from distinct derivations where feasible;
2. different derivations with different input closure;
3. environment changes that alter derivation identity;
4. output identity comparison;
5. input-addressed/content-addressed distinction where supported by the fixture.

Do not claim generality from one fixture.

## Phase 2 — Extract Native Derivation Model

Preserve native fields before mapping:

```text
drv identity
outputs
inputDrvs
inputSrcs
system
builder
args
env
```

Keep direct input relations separate from transitive closure.

## Phase 3 — Derived Graphs

Compute deterministic projections:

- direct derivation dependency graph;
- transitive input closure;
- derivation depth;
- shared ancestry;
- output-to-derivation mapping.

Derived relations must be marked `derived`.

## Phase 4 — Identity Regimes

Implement:

### Output Content Identity

Compare resulting content identity.

### Derivation Identity

Compare derivation identity.

### Input Closure Identity

Compare transitive declared inputs.

### Builder Environment Identity

Compare builder, system, arguments and declared environment under an explicit
normalization profile.

### History Equivalence

Allow a declared equivalence regime that collapses histories under output
identity while preserving derivation differences in the Inspector.

## Phase 5 — Experiments

### Experiment A — Same content, different derivation

This is the flagship experiment.

If a clean same-content fixture cannot be produced under the selected Nix mode,
the case must report that limitation rather than fabricate one.

### Experiment B — Shared output ancestry

Compare derivations with partially shared inputs.

### Experiment C — Environment mutation

Change a derivation-relevant environment field and observe whether output
content changes.

### Experiment D — Addressing mode comparison

Compare identity semantics under the bounded supported input/content-addressed
modes.

## Phase 6 — Model Pack

Create:

```text
modelId: nix-derivations
```

Entities:

- derivation;
- output;
- input source;
- builder;
- environment profile;
- dependency relation;
- derived closure relation.

Preserve Nix-native identities in source records.

## Phase 7 — Explorer

Core panels:

```text
CONTENT
DERIVATION
INPUT CLOSURE
BUILDER
ENVIRONMENT
ANCESTRY
```

The same selected pair should be comparable under multiple identity regimes.

Visually separate:

- direct inputs;
- transitive closure;
- same-content relation;
- derivation identity;
- Onto2D equivalence relation.

## Phase 8 — Historical Questions

Historical Load is optional in the first release.

Only add it after an explicit finite counterfactual construction space exists.

Potential cost functions:

```text
derivation-count
distinct-input-count
closure-size
builder-transition-count
```

## Phase 9 — Negative Tests

Required:

- direct input is not confused with transitive input;
- same output content does not force same derivation identity;
- derivation mutation changes derivation identity;
- source mutation changes case identity;
- inferred equivalence does not modify native Nix identity;
- Model Pack verification fails on source mismatch.

## Falsification Criterion

The case fails if Onto2D collapses:

```text
content identity
and
construction/derivation identity
```

into a single undifferentiated relation.

## Definition of Done

A pinned bounded Nix fixture can be extracted deterministically, represented as
a verified model, and compared in the Explorer under independent content,
derivation and input-closure identity regimes.

Completed result: nine native derivations, eight direct `inputDrv` relations,
five transitive-only derived relations, four experiments, five identity
regimes, a 25-node/40-edge `nix-derivations` Model Pack, and an exact-artifact
browser lab. The input-addressed control remains explicitly unrealized; no
builder execution or Historical Load value is claimed.
