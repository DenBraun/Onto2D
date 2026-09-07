# Live Bootstrap Provenance

Case ID: `live-bootstrap-provenance`. [History case registry](../history-case-registry.json).

- [Live Bootstrap Provenance — use and reproduction](#live-bootstrap-provenance--use-and-reproduction)
- [Live Bootstrap Provenance — source and interpretation](#live-bootstrap-provenance--source-and-interpretation)
- [Evidence contract](#evidence-contract)
- [Provenance analysis method](#provenance-analysis-method)

<a id="live-bootstrap-provenance--use-and-reproduction"></a>

## Live Bootstrap Provenance — use and reproduction

This case is a downstream, read-only analysis of a pinned
[`fosslinux/live-bootstrap`](https://github.com/fosslinux/live-bootstrap)
revision. It is not affiliated with or endorsed by the live-bootstrap project.
Live-bootstrap does not define Onto2D, Historical Load, the counterfactual
construction space declared for this case, or any resulting interpretation.

<a id="live-bootstrap-provenance--use-and-reproduction--exact-source-boundary"></a>

### Exact source boundary

- Repository: `https://github.com/fosslinux/live-bootstrap`
- Commit: `9a268c4c39cae952b268bc86da342be2175f03d4`
- Git tree: `a1cdd49e41776ce150b790fe18f93c7611a142ae`
- Extraction profile: `live-bootstrap-provenance-v1`
- Case profile: `default-amd64`
- Primary consumed upstream file: `steps/manifest`
- Manifest raw SHA-256:
  `10d7fd566cdffab1802befcaaeb48484248c8e8eb0e2bc4efaa95fa8de54c592`

The committed `fixtures/manifest/steps-manifest` file is an exact-byte copy of
the consumed upstream file. `upstream.json` is the source lock. Extraction
verifies every consumed byte before parsing and does not access a branch, tag,
submodule head, or remote resource. A checkout can be checked directly with:

```sh
node cases/live-bootstrap-provenance/extract.mjs \
  --upstream-root /path/to/live-bootstrap
```

The selected profile corresponds to the configuration variables emitted for
an amd64 QEMU run with declared defaults. At the pinned revision, upstream
reports that only `x86` is supported and other architectures are for
development only. `default-amd64` is therefore an Onto2D inspection profile,
not an upstream support claim and not evidence that the complete build was
executed successfully.

<a id="live-bootstrap-provenance--use-and-reproduction--evidence-layers"></a>

### Evidence layers

| Layer | Meaning | Current examples |
|---|---|---|
| Upstream fact | Syntax and order directly present in pinned bytes | directive, target, predicate, source line, repeated build |
| Derived fact | Deterministic projection from verified facts and the declared profile | active status, state transition, observed-order record |
| Onto2D analysis | An explicitly versioned interpretation introduced by this repository | finite admissibility regimes, counterfactual paths, Historical Load |

Observed order is not treated as a dependency or a causal relation. The current
extraction emits no inferred-dependency or counterfactual relation. Its bounded
`selected-bootstrap-milestones-v1` audit adds 33 reviewed records from 16 exact
build-script fixtures. Each assertion is checked against a pinned whole-file
hash, exact source line, and expected line text before it can enter evidence.
The selected audit remains intentionally incomplete.

<a id="live-bootstrap-provenance--use-and-reproduction--generated-artifacts"></a>

### Generated artifacts

- `generated/upstream-trace.json` preserves all 205 executable directives in
  source order, including inactive events and repeated builds.
- `generated/state-transitions.json` contains an initial state and exactly one
  derived transition for every manifest event. It does not simulate a complete
  filesystem or claim build success.
- `generated/evidence.json` separates observed order, derived state, direct
  script references, declared inputs, produced artifacts, external roots, and
  explicitly unresolved relations.
- `generated/graph.json` is a presentation-neutral projection whose edges keep
  their evidence class and layer.
- `analysis/construction-space.json` declares one target, the actual pinned
  prefix, two counterfactual paths, three Onto2D-created edges, and four cost
  functions.
- `analysis/regimes.json` declares the factual observed reference and four
  optimization regimes without attributing those constraints upstream.
- `analysis/historical-load.json` contains all 16 cost/regime results, ties,
  eliminated free optima, first divergence, and single-constraint ablation.

Each identity-bearing artifact uses a versioned, domain-separated canonical
hash. Operational timestamps and local paths do not enter semantic identity.

<a id="live-bootstrap-provenance--use-and-reproduction--trust-boundary-and-omissions"></a>

### Trust boundary and omissions

The first extraction models exact consumed bytes, manifest semantics, and
declared profile variables. It does not model or eliminate trust in hardware,
firmware, microcode, host preparation, mirrors, network transport, runtime
filesystem effects, unconsumed files, or submodule contents. It does not prove
that a represented build completed or that every earlier event was necessary
for a later event.

The fixture retains its upstream GPL-3.0-or-later notice. See `NOTICE.md` for
attribution and scope.

<a id="live-bootstrap-provenance--use-and-reproduction--finite-analysis-and-separate-model-pack"></a>

### Finite analysis and separate Model Pack

The fixed analysis target is the first GCC 4.0.4 build milestone. The complete
declared space has exactly three paths: the actual pinned manifest prefix, an
opaque prebuilt-GCC shortcut, and a source build using a pre-existing binary
toolchain. Counterfactual edges are marked `introducedBy: Onto2D` and
`upstreamFact: false`; they are absent from every extracted artifact.

Historical Load requires an explicit target, bounded path space, cost function,
and optimization regime. Missing or insufficient inputs fail or produce an
explicit `unresolved` result with null numeric fields. For event count, the
source-derived regime yields `dH = 1` and the bootstrappable and
auditable-bootstrap regimes yield `dH = 78`. These are results of the disclosed
Onto2D construction model, not live-bootstrap metrics.

`models/live-bootstrap-provenance` compiles the upstream and derived evidence
into a separate content-addressed Model Pack. It never adds records to
`causal-emergence`, and it excludes counterfactual and Historical Load records.
The pack is available through the verified registry in Model Studio. The
focused [Bootstrap Provenance Explorer](../../apps/bootstrap-provenance-explorer/README.md)
shows the actual trace, evidence classes, trust boundary, separately styled
alternatives, and Historical Load results.

The local [neutral trace exporter](../../tools/live-bootstrap-trace/README.md)
resolves only manifest syntax and configuration status. It carries no Onto2D
analysis semantics and has not been submitted upstream.

<a id="live-bootstrap-provenance--use-and-reproduction--reproduction"></a>

### Reproduction

Materialize the deterministic artifacts:

```sh
npm run case:live-bootstrap
```

Verify committed artifacts without writing:

```sh
npm run case:live-bootstrap:verify
npm run case:live-bootstrap:analysis:verify
npm run model:live-bootstrap:verify
npm run test:live-bootstrap-trace
node --test cases/live-bootstrap-provenance/tests/*.test.js
node --test apps/bootstrap-provenance-explorer/bootstrap-provenance-model.test.mjs
```

The negative tests cover source-byte drift, revision identity, event reorder,
unknown directives, malformed predicates, repeated builds, evidence-class
upgrades, counterfactual leakage, inactive transitions, missing target/cost/
regime, undeclared or insufficient path spaces, invalid external Model Packs,
cross-model selection leakage, causal-release byte identity, and exact replay.

<a id="live-bootstrap-provenance--source-and-interpretation"></a>

## Live Bootstrap Provenance — source and interpretation

<a id="live-bootstrap-provenance--source-and-interpretation--purpose"></a>

### Purpose

Implement `live-bootstrap` as the first substantial real external
construction-history case in Onto2D.

Outputs:

```text
cases/live-bootstrap-provenance/
apps/bootstrap-provenance-explorer/
models/live-bootstrap-provenance/
```

The implementation must strictly separate:

1. upstream facts;
2. deterministic derivations;
3. evidence-backed interpretations;
4. Onto2D counterfactuals and analyses;
5. unknown/inferred relations.

<a id="live-bootstrap-provenance--source-and-interpretation--upstream-baseline"></a>

### Upstream Baseline

Repository:

```text
https://github.com/fosslinux/live-bootstrap
```

Pinned revision for the initial case:

```text
9a268c4c39cae952b268bc86da342be2175f03d4
```

Primary sources:

```text
steps/manifest
seed/
steps/
parts.rst
DEVEL.md
```

Updating the upstream revision creates a new reviewed case revision.

<a id="live-bootstrap-provenance--source-and-interpretation--non-goals"></a>

### Non-goals

Do not:

- contact or modify upstream yet;
- treat `steps/manifest` as a complete dependency DAG;
- upgrade execution order into causal necessity;
- mix the model into `causal-emergence`;
- claim that Historical Load is a live-bootstrap metric;
- claim elimination of all trust roots;
- silently follow upstream `master`.

<a id="evidence-contract"></a>

## Evidence contract

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

<a id="provenance-analysis-method"></a>

## Provenance analysis method

Status date: 2026-08-17

<a id="provenance-analysis-method--purpose"></a>

### Purpose

This method turns one pinned live-bootstrap manifest and a bounded set of
reviewed build-script lines into reproducible provenance artifacts. It then
applies a separately identified finite Onto2D construction model. The method is
designed to prevent source order, deterministic derivation, and counterfactual
analysis from collapsing into one unsupported causal graph.

The case is downstream, read-only, and not affiliated with or endorsed by the
live-bootstrap project. The accepted boundary decision is recorded in
[Evidence contract](#evidence-contract).

<a id="provenance-analysis-method--pinned-source-boundary"></a>

### Pinned source boundary

| Field | Value |
|---|---|
| Repository | `https://github.com/fosslinux/live-bootstrap` |
| Commit | `9a268c4c39cae952b268bc86da342be2175f03d4` |
| Tree | `a1cdd49e41776ce150b790fe18f93c7611a142ae` |
| Manifest SHA-256 | `10d7fd566cdffab1802befcaaeb48484248c8e8eb0e2bc4efaa95fa8de54c592` |
| Extraction profile | `live-bootstrap-provenance-v1` |
| Inspection configuration | `default-amd64` |

[`upstream.json`](upstream.json) pins every
consumed path and raw SHA-256. Extraction fails before parsing when any byte
differs. The fixtures contain the exact manifest, `.gitmodules`, and 16 selected
build scripts. Submodule content is not consumed.

The `default-amd64` profile represents declared variables for an amd64 QEMU
inspection. It is not an upstream support claim and not evidence that the full
bootstrap was executed. The pinned upstream source reports only `x86` as
supported and describes other architectures as development-only.

<a id="provenance-analysis-method--interpretation-layers"></a>

### Interpretation layers

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

<a id="provenance-analysis-method--deterministic-artifacts"></a>

### Deterministic artifacts

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

<a id="provenance-analysis-method--model-and-interfaces"></a>

### Model and interfaces

The content-addressed `live-bootstrap-provenance` Model Pack contains only
upstream and deterministic-derived provenance. It is registered separately
from `causal-emergence`. Its mapping metadata supplies model-specific labels to
the generic Model Studio; Studio does not branch on either model ID.

The [Bootstrap Provenance Explorer](../../apps/bootstrap-provenance-explorer/README.md)
adds focused trace, provenance, trust-boundary, path, Historical Load, and exact
record views. Actual and counterfactual paths use different labels and visual
layers. Changing evidence visibility never merges counterfactual edges into the
evidence graph.

The local [`tools/live-bootstrap-trace`](../../tools/live-bootstrap-trace/README.md)
prototype is a smaller upstream-neutral component. It knows only manifest
syntax, configuration resolution, source locations, revision identity, and
stable JSON export. It carries no case-specific analysis semantics and has not
been submitted upstream.

<a id="provenance-analysis-method--reproduction"></a>

### Reproduction

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

<a id="provenance-analysis-method--limitations-and-upstream-contact-gate"></a>

### Limitations and upstream-contact gate

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
