# Live Bootstrap Provenance

This case is a downstream, read-only analysis of a pinned
[`fosslinux/live-bootstrap`](https://github.com/fosslinux/live-bootstrap)
revision. It is not affiliated with or endorsed by the live-bootstrap project.
Live-bootstrap does not define Onto2D, Historical Load, the counterfactual
construction space planned for this case, or any resulting interpretation.

## Exact source boundary

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

## Evidence layers

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

## Generated artifacts

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

## Trust boundary and omissions

The first extraction models exact consumed bytes, manifest semantics, and
declared profile variables. It does not model or eliminate trust in hardware,
firmware, microcode, host preparation, mirrors, network transport, runtime
filesystem effects, unconsumed files, or submodule contents. It does not prove
that a represented build completed or that every earlier event was necessary
for a later event.

The fixture retains its upstream GPL-3.0-or-later notice. See `NOTICE.md` for
attribution and scope.

## Finite analysis and separate Model Pack

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

## Reproduction

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
