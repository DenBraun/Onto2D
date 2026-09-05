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

- model: `sha256:99fddf2cec4e70dff35446b9a957d9b32889dbb992392f80c02a4638694c5347`;
- analysis: `sha256:603b879e713a0a6b4472ffd1a718c39ac6b69c2285b942ca182c6028be155b7f`;
- Phase-B reference: `sha256:66125dfe5c2b9f3631196af6b251531dfe381402877ccd5be9a153d7ed359a41`;
- boundedness preflight: `sha256:3d1b6849b7bec9c286ea695f46439ef42fc7fc980f1b766f630083c877a11c0f`;
- objecthood v2: `sha256:d20ae86e0db42ae8c3ea47e379faff67d0f79eb924238504fa75b241280ac2a6`;
- dynamics v2: `sha256:c67724a11db17994b851ff79d868a90989d0d445fc054177497724f1a1f884ff`;
- expanded search v2: `sha256:a020a2b5c24f4e682c29845154a116bc52f051830dc01837cf088cd844f0c3a5`.

Independent scientific review remains pending under
[`REVIEW.md`](REVIEW.md).
