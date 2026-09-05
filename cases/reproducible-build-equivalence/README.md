# Reproducible Build Equivalence case

This case records four separate executions of one tiny deterministic build and
asks when their histories should count as equivalent. It implements the
portfolio's explicit relation:

```text
H1 ~F H2
```

The answer always depends on the named regime `F`; no global history equality
is inferred.

## Reproduce

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

## Actual captures

The baseline artifact was independently produced under Node.js 24.19.0 and
Node.js 22.23.2 on Darwin arm64. A third Node.js 24 execution changes only the
explicitly excluded `ONTO2D_SESSION_LABEL`. A fourth changes the declared
`releaseChannel` from `stable` to `preview`.

The build embeds the pinned source date, not wall-clock time, and captures as
little ambient state as possible. Its specified output is a small LF-terminated
UTF-8 text artifact. The execution log remains separate from the specified
artifact, following the Reproducible Builds distinction between primary output
and build information.

## Result matrix

| Pair | Bytes | Inputs | Toolchain | Environment | Provenance |
| --- | --- | --- | --- | --- | --- |
| Node 24 vs Node 22 | equal | equal | different | equal | different |
| ambient `alpha` vs `gamma` | equal | equal | equal | equal | different |
| `stable` vs `preview` | different | different | equal | equal | different |

Every execution retains a different history identity even when a selected
equivalence projection is equal.

## Evidence boundary

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

## History Matters pilot

The [frozen benchmark contract](history-benchmark/contract.json) compares the
complete source-fixture census under an exact semantic identity regime.
`npm run history-benchmark:check` replays its P/H/target artifacts, wrong-history
nulls and [result](history-benchmark/result.json). This is a regime-relative
semantic result, not empirical prediction or an independent review.
