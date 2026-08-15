# Level-0 oscillator reference validation

This case is the first numerical Onto2D study. It implements a bounded Phase-B
reference model and three negative controls. It does not claim complete Level-0
closure or empirical validation of the foundational theory.

## Reproduce

Node.js 22 or newer is required.

```sh
npm run case:level-0:verify
npm run case:level-0:phase-b:verify
npm run case:level-0:phase-c:verify
npm run case:level-0:objecthood:verify
```

To regenerate the frozen artifact intentionally:

```sh
npm run case:level-0
npm run case:level-0:phase-b
npm run case:level-0:phase-c
npm run case:level-0:objecthood
```

The non-mutating verification command is the normal review path.

The default `case:level-0` command runs the integrated gated pipeline. Its
human-readable conclusion is in
[`LEVEL_ZERO_VALIDATION.md`](LEVEL_ZERO_VALIDATION.md).

For the interactive evidence view, open
[`Level-0 Numerical Validation`](../../apps/level-zero-validation/).

The external handoff and independent derivations are listed in
[`REVIEW.md`](REVIEW.md). Review remains pending and is not implied by passing
the local reproduction.

## Frozen model

[`model-v1.json`](model-v1.json) declares a dimensionless periodic `1+1` model:

```text
psi(x,t) = A exp(i(k x - omega t + phase))
d2_t psi - d2_x psi + m2 psi = 0
m2 = omega^2 - k^2
```

The solver evaluates stationarity on `256 x 256` and `512 x 512` periodic
grids with second-order central differences. It reports the fine-grid L2
residual and the observed convergence order. Transport values are rounded to
12 significant digits and carry an absolute reporting tolerance of `1e-10`.

The signed-frequency convention is an explicit case assumption. Negative
frequency labels are used to express the paper's balance equation; this case
does not claim that this convention is uniquely required.

## Scenarios

| Scenario | Numerical state | Structure | Expected result |
|---|---|---|---|
| `resonant-triad` | on shell, stationary, balanced | three-node simple cycle | admitted |
| `balanced-dyad` | on shell, stationary, balanced | reciprocal segment, cycle rank zero | rejected |
| `detuned-triad` | on shell and stationary, frequency sum nonzero | three-node simple cycle | rejected |
| `off-shell-triad` | dispersion and stationarity fail | three-node simple cycle | rejected |

The structural surrogate for relational overdetermination is the undirected
simple cycle rank `E - V + C`, with a required value of at least one. Node
removal must destroy the length-three cycle. This surrogate is a declared
operationalization, not a derivation from the paper.

## Evidence boundary

The case-specific solver is
[`solver/reference-solver.mjs`](solver/reference-solver.mjs). It uses the
`@onto2d/scientific-adapter` interface and does not import the kernel. The case
runner creates canonical candidates and Oracle request bindings, invokes the
solver, and asks the kernel to validate the normalized response and evidence
references.

The frozen
[`reference-validation-v1.json`](artifacts/reference-validation-v1.json)
contains candidate identities, request and response hashes, accepted
quantities, structural witnesses, gate decisions, and the final analysis hash.
The source PDF and complete machine-readable model are both included in every
quantity's evidence lineage.

The human-readable outcome and exact numerical table are in
[`REPORT.md`](REPORT.md).

The separate Phase-C boundedness preflight is documented in
[`PHASE_C_PREFLIGHT.md`](PHASE_C_PREFLIGHT.md). It rejects the frozen free cubic
potential as unbounded below. This negative result narrows the next model
decision; it does not establish nonlinear CRT objecthood.

The bounded follow-up in [`PHASE_C_OBJECTHOOD.md`](PHASE_C_OBJECTHOOD.md)
searches a stabilized real-envelope trial family. Its localized branch is
unstable, its stable branch is not intrinsically localized, and its uncoupled
control has zero `Gamma`. No branch is promoted to a CRT-node.

## Interpretation boundary

This benchmark establishes computational conformance for one declared model:

- an on-shell balanced triangle passes the encoded Phase-B gate;
- balance alone does not promote a dyad to a triadic closure;
- topology alone does not rescue detuned or off-shell modes;
- the finite-difference residual converges at the expected order.

The periodic L2 norm is reported only as a solver diagnostic. It is not the
paper's localized `Gamma`, and it does not establish bounded support,
perturbative persistence, nonlinear CRT objecthood, collective stability,
Level-0 completion, or physical truth. Those require new frozen scientific
specifications and evidence.
