# Phase-C asymmetric and complex search preregistration

Status date: 2026-08-16

## Question

Does any member of a fixed six-scenario extension of the stabilized
three-envelope model satisfy every declared trial-objecthood gate after equal
real envelopes, real-only perturbations, and profile-only dynamics are
removed from the search restriction?

This protocol is frozen before the new solver is executed. It does not predict
the outcome and does not authorize adding a parameter point or deleting a
failed perturbation after inspecting results.

## Fixed search

The machine-readable authority is
[`phase-c-expanded-search-v1.json`](phase-c-expanded-search-v1.json). It fixes:

- one symmetric control and five eligible component-asymmetric parameter sets;
- independent stationary real envelopes `u_1`, `u_2`, and `u_3`;
- coarse, fine, and enlarged-domain grids;
- complete discrete real-amplitude and imaginary-phase block-Hessian checks;
- four dynamic probes: common phase, relative phase, an off-center real
  Gaussian, and a complex wave packet;
- paired controls plus temporal and spatial refinement for every probe;
- numerical quality, localization, stability, and amplification thresholds;
- a stopping rule after exactly six scenarios and four probes.

The positive primary outcome requires one eligible scenario to pass every
gate. Failure of every eligible scenario is a bounded negative result. A
non-converged or refinement-sensitive calculation is indeterminate rather than
negative.

## Model boundary

The complex energy, component-specific mass parameters, quartic completion,
finite Dirichlet domain, and perturbation bank are explicit case assumptions.
They are not derived uniquely from the source paper and do not represent an
empirical physical system. Even a positive result would establish only trial
objecthood inside this finite model and perturbation bank.

The existing Phase-C `v1` objecthood and dynamics artifacts remain immutable.
This extension depends on them and will produce a separate artifact and a new
integrated disposition.
