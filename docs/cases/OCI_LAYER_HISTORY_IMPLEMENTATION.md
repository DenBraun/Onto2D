# OCI Layer History — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity
    Present State

Domain:
    Container images

Evidence profile:
    direct-record
    cryptographically-verified
    derived
    counterfactual

Historical Load:
    Bounded candidate

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

Study how different ordered layer histories can produce the same flattened
filesystem state.

Primary distinction:

```text
final rootfs
    !=
layer history
```

This case provides an intuitive real-world model of history being erased by
flattening.

## Outputs

```text
cases/oci-layer-history/
apps/oci-layer-history-lab/
models/oci-layer-provenance/
docs/cases/OCI_LAYER_HISTORY_IMPLEMENTATION.md
```

## Phase 0 — Fixture Strategy

Create deterministic OCI fixtures locally.

Avoid dependence on changing public image tags.

Use a minimal image layout with tiny files so every layer can be inspected
manually.

Canonical histories:

```text
History A:
empty
 -> add /a
 -> add /b
 -> delete /a
 -> add /c
 -> final

History B:
empty
 -> add /b
 -> add /c
 -> final
```

The final root filesystem must be equal under the declared filesystem identity
profile.

## Phase 1 — Parse OCI Layout

Extract:

- manifest identity;
- config identity;
- ordered layer descriptors;
- layer digests;
- history entries;
- diff IDs where available;
- media types.

Pin all fixture bytes and hashes.

## Phase 2 — Deterministic Layer Application

Implement a bounded layer evaluator supporting only the fixture profile.

It must model:

- file addition;
- file replacement;
- deletion/whiteout;
- directory changes required by fixtures.

Do not build a general container runtime.

Generate:

```text
state-after-layer-N
```

for every layer.

## Phase 3 — Identity Regimes

Implement:

### Flattened Filesystem Identity

Compare normalized final rootfs.

### Layer Sequence Identity

Compare ordered layer identities.

### Manifest Identity

Compare OCI manifest identity.

### Historical Equivalence

Declare histories equivalent under a selected flattened-state regime while
retaining different ancestry.

## Phase 4 — Experiments

### Experiment A — Flattening

Same rootfs, different layer sequence.

### Experiment B — Deleted history

History A contains a file that does not exist in the final rootfs.

### Experiment C — Redundant mutations

Introduce add/replace/delete operations that cancel out in final state.

### Experiment D — Same files, different grouping

Group the same final changes into different layer boundaries.

### Experiment E — History-sensitive cost

Compare explicit cost functions:

```text
layer-count
operation-count
changed-byte-count
transferred-byte-count
```

## Phase 5 — Historical Load

This is a good Stage-B Historical Load case.

Requirements:

- finite declared history space;
- explicit final target;
- explicit allowed layer operations;
- explicit cost function;
- explicit admissibility regime.

Never use "number of layers" as a universal complexity metric.

## Phase 6 — Model Pack

Create:

```text
modelId: oci-layer-provenance
```

Entities:

- image manifest;
- image config;
- layer;
- filesystem state;
- file object;
- layer operation;
- history record.

Keep derived flattened states separate from native OCI records.

## Phase 7 — Explorer

Views:

1. Layer Timeline
2. Flattened Rootfs
3. History Diff
4. Deleted/Hidden History
5. Identity Regime Comparison
6. Historical Load

A useful visual:

```text
History A  ----\
                > SAME FINAL ROOTFS
History B  ----/
```

with a toggle switching from flattened view to ancestry view.

## Phase 8 — Negative Tests

Required:

- reversing layers changes the derived state when order matters;
- whiteouts are not treated as ordinary files;
- same final rootfs does not imply same manifest/layer identity;
- source layer byte mutation changes case identity;
- counterfactual histories cannot enter upstream fixture extraction;
- Historical Load refuses undeclared cost functions.

## Falsification Criterion

The case fails if Onto2D cannot preserve hidden layer ancestry after projecting
to the same final filesystem state.

## Definition of Done

Two pinned OCI fixtures can be verified as identical under flattened filesystem
identity while remaining distinct under layer-history identity, with every
derived state reproducible from exact layer bytes.
