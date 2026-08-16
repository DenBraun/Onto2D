# Integrated Level-0 portable validation

Status date: 2026-08-16

## Result

The complete portable-reporting pipeline reproduces a bounded negative result:

```text
complete-negative-result-within-portable-expanded-model
```

Phase B admits the resonant-triad control, the minimal cubic potential fails
the boundedness preflight, and no original or asymmetric Phase-C branch passes
every required static and dynamic gate. Phase D therefore remains
`not-run-no-object-qualified-nodes`. This is not empirical validation or a
claim about all nonlinear completions.

## Numerical identity migration

Version 3 depends on solver-v2 successors for objecthood, dynamics, and the
expanded search. They use `portable-numeric-reporting-v1`:

- a converged residual below Newton tolerance is represented by that tolerance
  as a stable upper bound;
- approximate scalar results are placed on an explicit absolute reporting
  grid before canonical hashing;
- visualization traces use their own coarser grid;
- raw symmetric and antisymmetric `LDL` minimum pivots are excluded from the
  objecthood identity, while stable gate flags and Rayleigh witnesses remain.

The v1 and v2 integrated models, runners, and artifacts are preserved. Version
3 is a new contract, not an in-place reinterpretation of an old hash.

## Reproduce

```sh
npm run case:level-0:verify
```

The command reproduces all five direct dependencies and compares the result
byte-for-byte with
[`artifacts/level-zero-validation-v3.json`](artifacts/level-zero-validation-v3.json).
The machine-readable contract is
[`level-zero-validation-v3.json`](level-zero-validation-v3.json).

Frozen identities:

- model: `sha256:d1f6e4c29c1894c7bde1a98190865f6e0e8fec31c3bdcf73cdbe03b0fccbdd35`;
- analysis: `sha256:778e3ab29ff707a4b8961f7c88f5f117825c1005158521cb0a339bc911d13436`;
- Phase-B reference: `sha256:ecb9e32e8564e00f639c4a2f57b3a612f087b41ad3110cfde53957cacdf38483`;
- boundedness preflight: `sha256:3a1a052cd01f2932428ab4c2e0d50dde1c20a0eca7e482a44cc10dd4a66b1c90`;
- objecthood v2: `sha256:b2442288c5ebc8e6df802a46deb78697155e345c9f76cd68fe7312738aa4047f`;
- dynamics v2: `sha256:fddf195e2a439e051b94ad0d560774a0d996e927ad66ccc154d08f6013fabc2f`;
- expanded search v2: `sha256:78703eec1202bebe57cdd5014e49bbac4c9a5a801bb9ff419cc0e21e32afd2f6`.

Independent scientific review remains pending under
[`REVIEW.md`](REVIEW.md).
