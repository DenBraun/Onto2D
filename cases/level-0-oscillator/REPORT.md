# Level-0 Phase-B Reference Report

Date: 2026-08-15

## Result

The bounded reference benchmark behaves as specified. The on-shell, balanced
three-mode support cycle is admitted. Three controls are rejected without
collapsing their distinct failure reasons:

- the balanced dyad fails structural triadic closure;
- the detuned triad fails signed-frequency balance;
- the off-shell triad fails dispersion and grid-convergent stationarity.

This is computational conformance for `level-0-phase-b-reference@1.0.0`. It is
not complete numerical validation of Level 0 and is not empirical validation of
the foundational theory.

## Frozen evidence

| Item | Identity |
|---|---|
| Source PDF | v1.2, DOI `10.5281/zenodo.19397414`, `sha256:3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7` |
| Model | `sha256:c84ed471a612cad1a2f8d71f397305d329c32b12d34fff9b51ed905b3536090f` |
| Analysis | `sha256:ecb9e32e8564e00f639c4a2f57b3a612f087b41ad3110cfde53957cacdf38483` |
| Solver | `onto2d-level-0-reference-solver@1.0.0` |
| Method | `periodic-second-order-central-difference-v1` |

The runner verifies the source bytes against `source-lock.json` before creating
an Oracle request. Every returned quantity cites both the source and model
hashes. The kernel independently validates the candidate, request, solver
identity, parameters, tolerance, provenance, and response hash.

## Predeclared gates

The machine-readable thresholds are in `model-v1.json`:

- maximum absolute dispersion residual: `1e-10`;
- maximum fine-grid stationarity L2 residual: `0.02`;
- minimum observed stationarity convergence order: `1.8`;
- maximum wave-number and signed-frequency balance residual: `1e-10`;
- maximum periodic-norm relative drift: `1e-10`;
- minimum undirected simple cycle rank: `1`;
- every single-node removal destroys the length-three cycle.

The finite-difference grids are `256 x 256` and `512 x 512`. An independent
closed-form calculation of the discrete stencil eigenvalues reproduces the
solver residuals to less than `1e-10`. The analytic periodic norm also agrees
to less than `1e-10`.

## Numerical outcome

| Scenario | Dispersion residual | Frequency balance | Fine residual | Order | Cycle rank | Admitted |
|---|---:|---:|---:|---:|---:|---|
| `resonant-triad` | 0 | 0 | 0.00351204808432 | 1.99942599382 | 1 | yes |
| `balanced-dyad` | 0 | 0 | 0.000241069682058 | 1.9999087484 | 0 | no |
| `detuned-triad` | 0 | 1 | 0.00766740784691 | 1.99918577189 | 1 | no |
| `off-shell-triad` | 0.5 | 0 | 0.246588299283 | -0.0610180057161 | 1 | no |

The detuned control is important: its equation residual converges at second
order, but it still fails resonance. The dyad is equally important: its
numerical balance does not manufacture a nontrivial loop. The off-shell control
shows that a triangle and exact aggregate balance cannot rescue a mode outside
the declared equation.

## Scientific boundary

The test supports only the following statement:

> Under the frozen normalized periodic model and signed-frequency convention,
> the encoded Phase-B gate distinguishes one on-shell resonant support triad
> from structural, resonance, and dispersion controls.

The result does not establish that the model is unique, physically realized,
localized, nonlinearly self-bound, or sufficient for a CRT-node. The periodic
L2 norm is a numerical diagnostic and is not interpreted as localized
`Gamma`. Phase-C nonlinear coherence, perturbative persistence, collective
admissibility, Phase-D selection, and Level-0 completion remain open scientific
work.

## Reproduction

```sh
npm run case:level-0:phase-b:verify
node --test test/cases/level-0-oscillator.test.mjs
```

Regeneration is intentional and mutating:

```sh
npm run case:level-0:phase-b
```
