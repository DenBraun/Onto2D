# Phase-C asymmetric and complex search

Status date: 2026-08-16

## Result

The preregistered extension completed with a bounded negative result:

```text
bounded-negative-no-qualified-asymmetric-branch
```

All six frozen scenarios converged and all four frozen perturbations were
executed. The five eligible scenarios produced nonzero component asymmetry,
non-trivial `Gamma`, intrinsic localization, stable paired controls, bounded
four-probe dynamics, conserved energy, and agreeing time/space refinements.
None passed either the real-amplitude or the complex-phase block-Hessian gate.
No scenario therefore qualified as a trial CRT-node.

| Scenario | Eligible | Asymmetry | Gamma | Real Hessian | Phase Hessian | Worst refined amplification |
|---|---:|---:|---:|---|---|---:|
| `symmetric-control` | no | `7.15e-17` | `4.61434` | not positive definite | not positive definite | `6.43744x` |
| `mild-mass-split` | yes | `0.03346` | `4.60027` | not positive definite | not positive definite | `6.47106x` |
| `wide-mass-split` | yes | `0.06769` | `4.55789` | not positive definite | not positive definite | `6.42209x` |
| `stronger-coupling` | yes | `0.03430` | `3.56075` | not positive definite | not positive definite | `7.05465x` |
| `stiffer-quartic` | yes | `0.03186` | `5.24467` | not positive definite | not positive definite | `5.39403x` |
| `lower-coupling-split` | yes | `0.04542` | `5.92970` | not positive definite | not positive definite | `6.11847x` |

The worst refined amplification remains below the preregistered `10x`
departure threshold. That does not override a failed static gate: the protocol
requires every necessary gate to pass.

The full imaginary sector has two neutral relative-phase directions because
the declared energy depends on the sum of component phases. The frozen
positive-definiteness rule does not quotient those directions out, so its phase
gate is deliberately stricter than non-negative stability modulo symmetry.
That policy must be revised only through a new preregistration. It does not
alter this result because the real-amplitude Hessian fails independently in
every eligible scenario.

## Frozen protocol

The outcome-independent protocol was written before the new solver was run:

- human-readable preregistration:
  [`PHASE_C_EXPANDED_PREREGISTRATION.md`](PHASE_C_EXPANDED_PREREGISTRATION.md);
- portable machine-readable successor:
  [`phase-c-expanded-search-v2.json`](phase-c-expanded-search-v2.json);
- exactly one symmetric control and five eligible asymmetric parameter sets;
- exactly four perturbations: common phase, relative phase, off-center real,
  and complex wave packet;
- fixed coarse, fine, extended-domain, time-refined, and space-refined grids;
- a stopping rule that forbids adding scenarios or removing directions after
  inspecting the result.

The complex three-envelope energy is

```text
E = integral(
  0.5 * sum_i(|dt psi_i|^2 + |dx psi_i|^2 + m2_i |psi_i|^2)
  - 2 * lambda * Re(psi_1 psi_2 psi_3)
  + 0.25 * g * (sum_i |psi_i|^2)^2
) dx
```

with homogeneous Dirichlet boundaries. Independent real stationary envelopes
are solved by block Newton iteration. Complete discrete real-amplitude and
imaginary-phase sectors are checked by a block `LDL` positive-definiteness
certificate. Complex time evolution uses paired-control velocity Verlet at
base and refined resolution.

Solver v2 applies `portable-numeric-reporting-v1`: converged Newton residuals
are represented by the declared tolerance bound, numerical metrics are placed
on the `1e-9` reporting grid, and visualization traces use a `1e-6` grid. The
original v1 preregistration and artifact remain unchanged.

## Reproduce

The runner first reproduces the frozen objecthood and dynamics dependencies,
then validates every normalized Oracle response and replays the new solver:

```sh
npm run case:level-0:expanded:verify
```

Intentional artifact regeneration is separate:

```sh
npm run case:level-0:expanded
```

Frozen identities:

- model hash: `sha256:8d8736590444e5820ca167b8a74012f1c6d3c03fdba2e36c04910203280b0f99`;
- analysis hash: `sha256:a020a2b5c24f4e682c29845154a116bc52f051830dc01837cf088cd844f0c3a5`;
- artifact:
  [`artifacts/phase-c-expanded-search-v2.json`](artifacts/phase-c-expanded-search-v2.json);
- solver:
  [`solver/phase-c-expanded-solver.mjs`](solver/phase-c-expanded-solver.mjs).

## Claim boundary

This is a complete result only for the declared six-scenario, four-perturbation
search. It does not cover all asymmetric parameters, all complex functions,
alternative bounded nonlinear completions, unbounded time, or empirical
physics. It neither validates nor falsifies the general theory. Independent
scientific review remains pending.
