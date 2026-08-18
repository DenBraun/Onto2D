# Live Bootstrap Provenance — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded
    Reconstructed

Primary effects:
    Identity

Domain:
    Software bootstrap / provenance

Evidence profile:
    direct-record
    derived
    inferred
    counterfactual
    unknown

Historical Load:
    Primary, bounded

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Secondary where dependency evidence is incomplete
```

## Purpose

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

## Upstream Baseline

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

## Non-goals

Do not:

- contact or modify upstream yet;
- treat `steps/manifest` as a complete dependency DAG;
- upgrade execution order into causal necessity;
- mix the model into `causal-emergence`;
- claim that Historical Load is a live-bootstrap metric;
- claim elimination of all trust roots;
- silently follow upstream `master`.

## Target Structure

```text
cases/live-bootstrap-provenance/
  README.md
  upstream.json
  extract.mjs
  schema/
  fixtures/
  generated/
  analysis/
  tests/

models/live-bootstrap-provenance/
  releases/<release-id>/

apps/bootstrap-provenance-explorer/
  README.md
  index.html
  bootstrap-provenance-explorer.js
  bootstrap-provenance-model.js
```

## Phase 0 — Freeze Evidence

Tasks:

- pin repository and commit;
- record hashes of every consumed file;
- record extraction profile version;
- record architecture/configuration assumptions;
- fail closed on hash mismatch;
- document unmodeled trust roots.

Acceptance:

- identical source bytes produce byte-identical extraction;
- upstream mutation changes source identity.

## Phase 1 — Parse `steps/manifest`

Support current relevant directives:

```text
build
improve
define
jump
uninstall
```

Preserve:

- exact order;
- predicates;
- repeated builds;
- target strings;
- source file and line;
- inactive events under the selected profile.

Unknown directives fail closed.

## Phase 2 — Build State Transitions

Represent:

```text
S0 --event0--> S1 --event1--> S2 ...
```

Track only deterministic declared state required for the case:

- installed targets;
- explicit removals;
- declared variables;
- kernel/environment jumps;
- active/inactive predicate status.

Do not pretend to simulate the full filesystem.

## Phase 3 — Evidence Model

Minimum relation/evidence classes:

```text
observed-order
declared-input
script-reference
produced-artifact
derived-state
inferred-dependency
external-root
unknown
```

Every stronger edge must answer:

> Why does this relation exist?

with either a source location or an explicit `inferred`/`unknown`.

Initial milestone audit:

```text
stage0-posix
M2-Planet / early bootstrap tooling
Mes
tcc-0.9.26
tcc-0.9.27
musl
binutils
gcc-4.0.4
gcc-4.7.4
Linux
bash
make
```

## Phase 4 — Onto2D Construction Space

Keep distinct:

```text
actual history
possible history
admissible history
shortest history
counterfactual history
```

Start with a bounded target such as the first GCC milestone.

Expose multiple cost functions:

```text
event-count
build-event-count
distinct-tool-count
trust-root-count
```

Never present a cost without naming the active function.

## Phase 5 — Admissibility Regimes

Initial regimes:

- **Observed** — actual pinned trace only;
- **Free** — explicitly declared counterfactual shortcuts;
- **Source-derived** — source required, larger pre-existing toolchain allowed;
- **Bootstrappable** — declared bootstrap ancestry constraints;
- **Auditable bootstrap** — stricter trust-root constraints.

Every regime rule must be marked either:

```text
upstream-derived
onto2d-defined
```

## Phase 6 — Historical Load

For target `x` and regime `F`:

```text
dH(x | F) = aF - a0
```

No numeric value without:

- target;
- path-space identity;
- cost function;
- regime;
- upstream revision;
- analysis version.

Return `unresolved` when the bounded model is insufficient.

## Phase 7 — Model Pack

Create:

```text
modelId: live-bootstrap-provenance
```

Entities may include:

- bootstrap event;
- bootstrap state;
- package/tool milestone;
- source artifact;
- trust root;
- environment transition;
- evidence relation.

Keep source identity distinct from analysis identity.

## Phase 8 — Model Studio

Add registry-backed model selection.

Model Studio must not branch generically on:

```js
if (modelId === "causal-emergence") ...
```

except through explicit registered model-specific adapters.

Verify the selected Model Pack before exposing contents.

## Phase 9 — Explorer

Views:

1. Bootstrap Trace
2. Provenance Graph
3. Trust Boundary
4. Counterfactual Paths
5. Historical Load
6. Evidence Inspector

Counterfactual paths must be visually unmistakable from actual upstream history.

## Phase 10 — Negative Tests

Required:

- reordered manifest changes trace identity;
- source byte mutation changes source identity;
- unknown directive fails;
- repeated build remains distinct;
- observed-order cannot satisfy demonstrated-dependency APIs;
- inferred relation cannot become upstream fact;
- counterfactual edge cannot enter source artifact;
- Historical Load requires explicit regime and cost;
- invalid Model Pack is rejected;
- switching models leaks no selection state.

## Phase 11 — Documentation

Create:

```text
cases/live-bootstrap-provenance/README.md
apps/bootstrap-provenance-explorer/README.md
docs/LIVE_BOOTSTRAP_PROVENANCE_METHOD.md
```

Update relevant project roadmap/structure docs.

## Phase 12 — Neutral Exporter Prototype

After the downstream case works, isolate a neutral prototype:

```text
manifest + configuration + revision
    ↓
resolved JSON trace
```

It must know nothing about:

```text
Onto2D
Historical Load
Causal Emergence
SOMA
```

Potential consumers:

- audit tools;
- visualizers;
- revision diff tools;
- external research;
- Onto2D.

Do not submit upstream yet.

## Upstream Contact Gate

Contact maintainers only when:

- the case is public and reproducible;
- the Explorer works;
- source/inference/counterfactual layers are separated;
- the neutral exporter exists;
- it is independently useful;
- stable output/schema documentation exists;
- a demo URL or screenshot exists.

The first contact should ask whether a machine-readable resolved bootstrap trace
would be useful upstream, not ask them to validate Onto2D theory.

## Definition of Done

A third party can deterministically reproduce:

```text
pinned live-bootstrap
      ↓
verified extraction
      ↓
upstream trace
      ↓
provenance + state history
      ↓
verified Model Pack
      ↓
Model Studio / Explorer
      ↓
explicit Onto2D analyses
```

For every important statement the system can answer:

- what did upstream declare?
- what did Onto2D derive?
- what did Onto2D infer?
- what did Onto2D introduce as a counterfactual?
- what remains unknown?
