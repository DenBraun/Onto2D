# Reproducible Build Equivalence

Case ID: `reproducible-build-equivalence`. [History case registry](../history-case-registry.json).

- [Reproducible Build Equivalence — use and reproduction](#reproducible-build-equivalence--use-and-reproduction)
- [Reproducible Build Equivalence — source and interpretation](#reproducible-build-equivalence--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="reproducible-build-equivalence--use-and-reproduction"></a>

## Reproducible Build Equivalence — use and reproduction

This case records four separate executions of one tiny deterministic build and
asks when their histories should count as equivalent. It implements the
portfolio's explicit relation:

```text
H1 ~F H2
```

The answer always depends on the named regime `F`; no global history equality
is inferred.

<a id="reproducible-build-equivalence--use-and-reproduction--reproduce"></a>

### Reproduce

```sh
npm run case:reproducible-builds:verify
npm run model:reproducible-builds:verify
```

The normal build is offline. `build-spec.json` locks two exact fixture source
files plus the exact builder implementation, the artifact contract, normalized
environment, parameter sets, execution inventory, comparison pairs, and
official methodology links.
`fixture/executions.json` contains the four frozen capture records.

The capture command fails closed unless `LANG=C`, `TZ=UTC`, and the pinned
`SOURCE_DATE_EPOCH` are present in the real process environment. It reads the
excluded session label from `ONTO2D_SESSION_LABEL`; the field is not merely
inserted after the run.

<a id="reproducible-build-equivalence--use-and-reproduction--actual-captures"></a>

### Actual captures

The baseline artifact was independently produced under Node.js 24.19.0 and
Node.js 22.23.2 on Darwin arm64. A third Node.js 24 execution changes only the
explicitly excluded `ONTO2D_SESSION_LABEL`. A fourth changes the declared
`releaseChannel` from `stable` to `preview`.

The build embeds the pinned source date, not wall-clock time, and captures as
little ambient state as possible. Its specified output is a small LF-terminated
UTF-8 text artifact. The execution log remains separate from the specified
artifact, following the Reproducible Builds distinction between primary output
and build information.

<a id="reproducible-build-equivalence--use-and-reproduction--result-matrix"></a>

### Result matrix

| Pair | Bytes | Inputs | Toolchain | Environment | Provenance |
| --- | --- | --- | --- | --- | --- |
| Node 24 vs Node 22 | equal | equal | different | equal | different |
| ambient `alpha` vs `gamma` | equal | equal | equal | equal | different |
| `stable` vs `preview` | different | different | equal | equal | different |

Every execution retains a different history identity even when a selected
equivalence projection is equal.

<a id="reproducible-build-equivalence--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

Direct records are limited to exact local source bytes, four captured execution
records, reported runtime/platform fields, and exact output bytes. Projection
identities, field differences, and equivalence verdicts are derived.

The case does not establish cross-machine or non-Darwin reproducibility and
does not prove builder trustworthiness. It also does not compute Historical
Load: no candidate-route space, admissibility predicate, or cost function is
declared, so the value is undefined rather than zero.

Methodology follows the official Reproducible Builds definition, build
environment perimeter, and `SOURCE_DATE_EPOCH` specification linked in
`build-spec.json`.

<a id="reproducible-build-equivalence--use-and-reproduction--history-matters-pilot"></a>

### History Matters pilot

The [frozen benchmark contract](history-benchmark/contract.json) compares the
complete source-fixture census under an exact semantic identity regime.
`npm run history-benchmark:check` replays its P/H/target artifacts, wrong-history
nulls and [result](history-benchmark/result.json). This is a regime-relative
semantic result, not empirical prediction or an independent review.

<a id="reproducible-build-equivalence--source-and-interpretation"></a>

## Reproducible Build Equivalence — source and interpretation

<a id="reproducible-build-equivalence--source-and-interpretation--purpose"></a>

### Purpose

Prevent Onto2D from adopting the false rule:

```text
different history => different identity
```

This case introduces explicit historical equivalence.

Primary concept:

```text
H1 ~F H2
```

where two build histories are equivalent under declared regime `F`.

<a id="reproducible-build-equivalence--source-and-interpretation--implemented-result"></a>

### Implemented Result

The v1 experiment is complete. Four separate build executions preserve exact
source bytes, a versioned instruction profile, normalized environment fields,
runtime provenance, and specified output bytes. The baseline was captured under
Node.js 24.19.0 and Node.js 22.23.2 on Darwin arm64; both runs produced the same
205-byte artifact with SHA-256
`6207334e1eea21837e2f7b8c0ce734e43abcdd41ea2bac2a38c7a3b54aaa6b57`.

Three declared pairs are evaluated under byte-output, declared-input,
toolchain, normalized-environment, and provenance regimes. The same baseline
pair is equal under byte and input identity but different under toolchain and
provenance identity. An excluded ambient-field control remains equal under the
environment regime, while a declared `releaseChannel` mutation changes both
input identity and output bytes.

The exact case artifact and dedicated `reproducible-build-equivalence` Model
Pack reproduce offline. Historical Load is not evaluated: the case defines no
candidate route space, admissibility predicate, or cost function, so a numeric
value would be undefined rather than zero.

<a id="reproducible-build-equivalence--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D treats every execution difference as identity-relevant
or cannot support regime-relative equivalence.

<a id="evidence-contract"></a>

## Evidence contract

1. Capture four actual fixture executions and keep their source, runtime,
   environment, output, and timestamp records immutable.
2. Define five versioned regimes: byte output, declared inputs, toolchain,
   normalized environment, and provenance.
3. Compute a separate deterministic projection identity for each history and
   regime. An equivalence verdict compares only two projections under the same
   regime.
4. Record excluded ambient fields explicitly. In v1,
   `ONTO2D_SESSION_LABEL` is evidence but is not part of normalized environment
   identity.
5. Preserve every execution as a distinct history even when selected
   projections are equal.
6. Treat cross-machine and non-Darwin reproducibility as unknown because the v1
   captures do not supply that evidence.
7. Do not emit Historical Load. Without candidate routes, admissibility, and a
   cost function, the value is undefined rather than zero.
