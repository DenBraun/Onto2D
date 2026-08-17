# Live Bootstrap Provenance Method

Status date: 2026-08-17

## Purpose

This method turns one pinned live-bootstrap manifest and a bounded set of
reviewed build-script lines into reproducible provenance artifacts. It then
applies a separately identified finite Onto2D construction model. The method is
designed to prevent source order, deterministic derivation, and counterfactual
analysis from collapsing into one unsupported causal graph.

The case is downstream, read-only, and not affiliated with or endorsed by the
live-bootstrap project. The accepted boundary decision is recorded in
[ADR 0109](adr/0109-live-bootstrap-provenance-boundary.md).

## Pinned source boundary

| Field | Value |
|---|---|
| Repository | `https://github.com/fosslinux/live-bootstrap` |
| Commit | `9a268c4c39cae952b268bc86da342be2175f03d4` |
| Tree | `a1cdd49e41776ce150b790fe18f93c7611a142ae` |
| Manifest SHA-256 | `10d7fd566cdffab1802befcaaeb48484248c8e8eb0e2bc4efaa95fa8de54c592` |
| Extraction profile | `live-bootstrap-provenance-v1` |
| Inspection configuration | `default-amd64` |

[`upstream.json`](../cases/live-bootstrap-provenance/upstream.json) pins every
consumed path and raw SHA-256. Extraction fails before parsing when any byte
differs. The fixtures contain the exact manifest, `.gitmodules`, and 16 selected
build scripts. Submodule content is not consumed.

The `default-amd64` profile represents declared variables for an amd64 QEMU
inspection. It is not an upstream support claim and not evidence that the full
bootstrap was executed. The pinned upstream source reports only `x86` as
supported and describes other architectures as development-only.

## Interpretation layers

| Layer | Admitted records | Excluded interpretations |
|---|---|---|
| Upstream fact | Exact directive text, order, comments, source lines, and selected direct script assertions | Necessity, causality, and successful runtime production |
| Derived fact | Predicate result, state transition, state snapshot, and graph projection | New upstream claims |
| Onto2D analysis | Finite alternatives, admissibility regimes, costs, optima, divergence, ablation, and Historical Load | Claims attributed to live-bootstrap |

The closed evidence classes are `observed-order`, `declared-input`,
`script-reference`, `produced-artifact`, `derived-state`,
`inferred-dependency`, `external-root`, and `unknown`. An observed-order record
cannot satisfy an API that requires a demonstrated dependency. The first
release contains zero inferred-dependency records; one unresolved compiler
selection remains `unknown`.

## Deterministic artifacts

Extraction retains 205 executable manifest events: 197 active and 8 inactive
under the selected profile. Repeated targets remain separate occurrences. The
state history has one initial state and one transition per event. The evidence
artifact contains 442 records, including 204 observed-order records, 205
derived-state records, and 33 hash-and-line-checked assertions from selected
scripts.

The construction analysis declares one fixed target: the first GCC 4.0.4 build
milestone. Its complete finite path space has three paths:

1. the actual pinned manifest prefix;
2. an opaque prebuilt-GCC shortcut;
3. a source build using a pre-existing binary toolchain.

The two alternatives and their three edges are explicitly marked
`introducedBy: Onto2D` and `upstreamFact: false`. They never appear in the
upstream trace, extracted evidence, provenance graph, or external Model Pack.

Four cost functions are declared: event count, build-event count, distinct-tool
count, and trust-root count. Optimization is allowed only under the explicit
`free`, `source-derived`, `bootstrappable`, or `auditable-bootstrap` regime.
`observed` is a factual reference regime and is not an optimization regime.

Selected reproducible results are:

| Cost | Regime | a0 | aF | dH |
|---|---:|---:|---:|---:|
| Event count | Source-derived | 1 | 2 | 1 |
| Event count | Bootstrappable | 1 | 79 | 78 |
| Build-event count | Bootstrappable | 0 | 66 | 66 |
| Distinct-tool count | Bootstrappable | 1 | 53 | 52 |
| Trust-root count | Bootstrappable | 1 | 1 | 0 |

These values are properties of the disclosed finite Onto2D construction model.
Historical Load is not a live-bootstrap metric.

## Model and interfaces

The content-addressed `live-bootstrap-provenance` Model Pack contains only
upstream and deterministic-derived provenance. It is registered separately
from `causal-emergence`. Its mapping metadata supplies model-specific labels to
the generic Model Studio; Studio does not branch on either model ID.

The [Bootstrap Provenance Explorer](../apps/bootstrap-provenance-explorer/README.md)
adds focused trace, provenance, trust-boundary, path, Historical Load, and exact
record views. Actual and counterfactual paths use different labels and visual
layers. Changing evidence visibility never merges counterfactual edges into the
evidence graph.

The local [`tools/live-bootstrap-trace`](../tools/live-bootstrap-trace/README.md)
prototype is a smaller upstream-neutral component. It knows only manifest
syntax, configuration resolution, source locations, revision identity, and
stable JSON export. It carries no case-specific analysis semantics and has not
been submitted upstream.

## Reproduction

```sh
npm run case:live-bootstrap:verify
npm run case:live-bootstrap:analysis:verify
npm run model:live-bootstrap:verify
node --test cases/live-bootstrap-provenance/tests/*.test.js
node --test apps/bootstrap-provenance-explorer/bootstrap-provenance-model.test.mjs
npm run test:live-bootstrap-trace
npm run check:registry
```

To compare the exact fixtures with an independent upstream checkout:

```sh
node cases/live-bootstrap-provenance/extract.mjs \
  --upstream-root /path/to/live-bootstrap
```

## Limitations and upstream-contact gate

The modeled ancestry excludes hardware, firmware, microcode, host preparation,
mirrors, network transport, unconsumed files, submodule contents, and runtime
filesystem effects. A produced-artifact assertion reports source-declared
output or installation text, not successful execution. The selected script
audit is intentionally incomplete.

No upstream contact or submission is authorized by this implementation. A
future contact should occur only after the public case and Explorer reproduce
from the pinned revision, the neutral exporter remains useful without this
project, stable output and screenshots or a public demo exist, and the proposed
scope is limited to asking whether a machine-readable resolved trace is useful.
