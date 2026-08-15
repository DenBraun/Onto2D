# Phase-C boundedness preflight

Status date: 2026-08-15

## Outcome

The frozen minimal cubic model fails the boundedness gate. On the declared
unbounded nonnegative amplitude ray, the phase-minimized potential is

```text
V(r) = 3 r^2 - 0.5 r^3.
```

Its leading coefficient is negative, so `V(r)` tends to negative infinity as
`r` grows. This analytical result rejects the declared potential before any
claim about a localized CRT solution, stability, or objecthood is attempted.

The external solver also records a finite numerical witness:

| `r` | `V(r)` |
|---:|---:|
| 1 | 2.5 |
| 2 | 8 |
| 4 | 16 |
| 8 | -64 |
| 16 | -1280 |
| 32 | -13312 |
| 64 | -118784 |

The positive stationary radius is `r = 4`, and the derivative at the final
sample is `-5760`. The samples support the negative tail witness; they are not
used to extrapolate unboundedness. That conclusion follows from the exact
leading cubic term.

## Frozen identities

- source DOI: `10.5281/zenodo.19397414`, version `v1.2`;
- source SHA-256: `sha256:3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7`;
- model hash: `sha256:c532f0fdf1658e1afefd9fa647a29c47ed33f49a7c49f9792f18f7fa65eb4148`;
- analysis hash: `sha256:3a1a052cd01f2932428ab4c2e0d50dde1c20a0eca7e482a44cc10dd4a66b1c90`;
- solver: `onto2d-level-0-phase-c-preflight@1.0.0`, method
  `cubic-amplitude-ray-v1`.

The machine-readable model is
[`phase-c-boundedness-v1.json`](phase-c-boundedness-v1.json), and the complete
result is
[`artifacts/phase-c-boundedness-v1.json`](artifacts/phase-c-boundedness-v1.json).

## Interpretation boundary

This is a falsification preflight for one explicit operationalization of the
paper's quadratic terms and cubic coupling. The relative field phase is free
and is chosen along the lowering direction. It is not a claim that the paper
uniquely fixes this dimensionless parameter set or sign convention.

The accepted Oracle response means that the kernel verified the exact request,
quantities, tolerances, solver identity, and evidence references. It does not
mean that the scientific model passed. The scientific result is
`rejected-unbounded-potential`.

Phase C can proceed only after freezing and justifying at least one of:

- a bounded amplitude domain;
- a positive stabilizing even-order term and its coefficient domain;
- another potential with an explicit lower-bound certificate.

Even after boundedness passes, localized support, nontrivial `Gamma`, nonlinear
stationarity, perturbative persistence, and stability remain separate tests.
