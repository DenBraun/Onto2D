# Phase-C real-time persistence probe

Status date: 2026-08-15

This is the frozen two-direction real-amplitude probe. The later four-direction
complex extension is documented in
[`PHASE_C_EXPANDED_SEARCH.md`](PHASE_C_EXPANDED_SEARCH.md) without modifying
this artifact.

## Result

The localized stationary pulse is dynamically unstable under the declared
symmetric real-amplitude perturbation:

```text
symmetric-dynamical-instability-confirmed
```

The refined run amplifies a `0.001` normalized profile-shaped perturbation by
`28.2471607644` at `t=4`. The amplification first reaches the preregistered
threshold of `10` at `t=2.975`. The antisymmetric control remains bounded with
a maximum amplification of `1` and a final amplification of `0.786663532647`.

This extends the earlier static second-variation result. It does not change the
already negative objecthood disposition: the pulse still fails a necessary
stability gate and is not promoted to a CRT-node.

## Frozen dynamics

The probe inherits the three-component real-envelope energy from the frozen
Phase-C objecthood case and adds the canonical kinetic term:

```text
E = integral [
  0.5 sum_i ((dt u_i)^2 + (dx u_i)^2 + m2 u_i^2)
  - 2 lambda u_1 u_2 u_3
  + 0.25 g (sum_i u_i^2)^2
] dx.
```

The resulting component equations are

```text
d2_t u_i = d2_x u_i - m2 u_i
           + 2 lambda u_j u_k
           - g (sum_l u_l^2) u_i.
```

The normalized parameters are `m2=1`, `lambda=2`, and `g=0.5` on `[-8,8]`
with homogeneous Dirichlet boundaries. Initial velocities are zero. The
initial profile is the converged stationary pulse from the same finite-
difference equation used by the objecthood search.

Two perturbations are preregistered:

- symmetric direction `(1,1,1)`, matching the static negative sector;
- antisymmetric direction `(1,-1,0)`, acting as a bounded positive control.

Each direction is normalized before applying the `0.001` perturbation. The
unperturbed stationary solution is evolved beside each probe, and amplification
is the component-wise L2 distance from that paired control divided by its
initial value.

## Numerical method and controls

The external solver uses second-order velocity Verlet integration. The base
run uses `256` spatial intervals and CFL `0.2`. Temporal refinement halves the
time step on the same spatial grid. The fully refined run uses `512` intervals;
its CFL time step matches the temporally refined base run.

| Diagnostic | Base | Refined |
|---|---:|---:|
| symmetric maximum amplification | `28.2478319278` | `28.2471607644` |
| symmetric final Gamma change | `0.0304834420002` | `0.0304827768142` |
| symmetric maximum energy drift | `3.06840323436e-8` | `7.67046504345e-9` |
| antisymmetric maximum amplification | `1` | `1` |
| antisymmetric final amplification | `0.786605307167` | `0.786663532647` |
| antisymmetric maximum energy drift | `2.76695337432e-10` | `6.91724746621e-11` |
| stationary-control profile departure | `1.47282543567e-13` | `1.44556523408e-13` |

The symmetric amplification changes by `2.03248465247e-5` under temporal
refinement and `4.40841829253e-5` under spatial refinement. All declared
stationarity, energy, control, and convergence checks pass.

As an independent scale check, the frozen static profile-direction Rayleigh
quotient is `-0.99330785572`. Linearized zero-velocity growth predicts
`cosh(sqrt(0.99330785572)*4) = 26.9448068519`; the refined nonlinear result is
within five percent of that prediction.

## Reproduction and evidence

Run:

```sh
npm run case:level-0:dynamics:verify
```

The machine-readable model is
[`phase-c-dynamics-v1.json`](phase-c-dynamics-v1.json). The frozen output is
[`artifacts/phase-c-dynamics-v1.json`](artifacts/phase-c-dynamics-v1.json), and
the case-specific solver is
[`solver/phase-c-dynamics-solver.mjs`](solver/phase-c-dynamics-solver.mjs).

Evidence identities:

- source DOI: `10.5281/zenodo.19397414`;
- Phase-C objecthood dependency:
  `sha256:c3c13e3682ed27a81653f38f6bb52befb84d1539bb873a5b9ef87ed3837e9bc5`;
- dynamics model:
  `sha256:1527416db53db882b69620e5d75f28438570e7b5ec4baea8035e2f9fc899e1fd`;
- dynamics analysis:
  `sha256:d3fa61690eb4d4598d6db2398edda927d6a7f5b3a4f8e87e51d73b688a91f247`.

## Claim boundary

This is a bounded deterministic probe of two profile-shaped real-amplitude
directions over the finite window `0 <= t <= 4`. It does not cover arbitrary
real perturbations, complex phases, asymmetric stationary branches, other
bounded completions, other parameters, stochastic dynamics, or physical
observations. The dynamics equation and canonical kinetic term are explicit
case assumptions rather than a derivation from the source paper.

The probe can strengthen the reason for rejecting the localized pulse. It
cannot rescue or reverse that rejection, and it does not validate or falsify
the general theory.
