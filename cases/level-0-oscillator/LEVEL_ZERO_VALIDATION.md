# Integrated Level-0 numerical validation

Status date: 2026-08-15

This is the frozen v1 report. The current expanded disposition is documented
in [`LEVEL_ZERO_VALIDATION_V2.md`](LEVEL_ZERO_VALIDATION_V2.md); v1 remains
unchanged and independently reproducible.

## Result

The declared case executed completely and produced a negative result:

```text
complete-negative-result-within-declared-model
```

Level 0 is not validated in this model because no tested Phase-C branch
qualifies as a CRT-node. The result neither validates nor falsifies the general
theory and is not an empirical claim.

| Gate | Result | Consequence |
|---|---|---|
| Phase-B resonant closure | pass | `resonant-triad` enters Phase C |
| Free cubic boundedness | fail | the minimal unbounded potential is rejected |
| Stabilized pulse | localized but amplitude-unstable | no CRT-node |
| Stabilized plateau | amplitude-stable but box-dependent | no CRT-node |
| Uncoupled vacuum | `Gamma=0` | no CRT-node |
| Phase-D collective gate | not run | no eligible CRT-node exists |

Stopping before Phase D is part of the frozen gate logic. Creating an ensemble
from a candidate that failed objecthood would invalidate the declared
formation sequence.

## Reproduction chain

The integrated runner independently reproduces each frozen dependency before
using its status. A matching hash written inside a stale artifact is not enough;
the complete artifact must match a fresh computation.

| Dependency | Analysis hash |
|---|---|
| Phase-B reference | `sha256:ecb9e32e8564e00f639c4a2f57b3a612f087b41ad3110cfde53957cacdf38483` |
| Phase-C boundedness preflight | `sha256:3a1a052cd01f2932428ab4c2e0d50dde1c20a0eca7e482a44cc10dd4a66b1c90` |
| Phase-C objecthood search | `sha256:c3c13e3682ed27a81653f38f6bb52befb84d1539bb873a5b9ef87ed3837e9bc5` |

The integrated identities are:

- source DOI: `10.5281/zenodo.19397414`, version `v1.2`;
- model hash: `sha256:92cf3e05e8d75866bed589acf97906488d334c4c1772259c6cedb8f9da8cc6c4`;
- analysis hash: `sha256:f9c7cb2b7364aece577dc8bd6e0b97375213c7d2974ff78cc6cc66b6979d6d8d`.

The pipeline specification is
[`level-zero-validation-v1.json`](level-zero-validation-v1.json), and the
complete integrated result is
[`artifacts/level-zero-validation-v1.json`](artifacts/level-zero-validation-v1.json).

Run the non-mutating reproduction with:

```sh
npm run case:level-0:v1:verify
```

Independent scientific review is pending. The exact reproduction and manual
derivation checklist is in [`REVIEW.md`](REVIEW.md); a green local run is not a
substitute for that review.

## What was tested

- exact source and model identity;
- on-shell, balance, stationarity, simple-cycle, and removal gates in Phase B;
- analytical and sampled boundedness of the minimal cubic potential;
- a disclosed positive quartic completion;
- coarse/fine grid agreement and nonlinear stationarity;
- phase-aligned envelope `Gamma` and a larger-domain localization control;
- discrete real-amplitude second variations in symmetric and antisymmetric
  component sectors;
- exact Oracle request, solver, tolerance, unit, and evidence binding;
- negative controls for topology, resonance, dispersion, stabilization,
  localization, stability, and nontrivial concentration.

## Claim boundary

The completed case is a bounded computational operationalization. Its exact
negative conclusion applies only to the frozen scenarios and trial family.
The paper does not supply the quartic term, its coefficient, the real-envelope
restriction, the finite domain, or the tested perturbation class.

The Phase-B to Phase-C mapping is also frozen and auditable: it retains the
admitted three-component cycle and its evidence lineage while replacing the
individual carrier parameters with a normalized equal-envelope surrogate.
That replacement is an assumption of this case, not a derived continuation of
the Phase-B field solution.

The following were open beyond this v1 case:

- asymmetric three-envelope solutions;
- alternative bounded nonlinear completions and parameter ranges;
- complex phase perturbations and broader real-time evolution;
- a positive Phase-C node population and consequent Phase-D collective model;
- empirical comparison with physical observations.

The asymmetric/complex item was subsequently tested in a separate
preregistered bounded extension. See
[`PHASE_C_EXPANDED_SEARCH.md`](PHASE_C_EXPANDED_SEARCH.md). Its negative result
does not modify this frozen v1 artifact.

The unrun complex-phase and time-evolution tests cannot reverse this terminal
result because every tested branch already fails a necessary gate. They remain
required before any future positive objecthood claim.

A subsequent bounded real-time probe now evolves the localized pulse in two
profile-shaped real-amplitude directions. The symmetric deviation grows by
`28.2471607644` at `t=4`, while the antisymmetric control remains bounded. See
[`PHASE_C_DYNAMICS.md`](PHASE_C_DYNAMICS.md). This post-disposition evidence
supports the existing rejection; it is not a new dependency of the frozen
integrated result and does not cover complex or arbitrary perturbations.
