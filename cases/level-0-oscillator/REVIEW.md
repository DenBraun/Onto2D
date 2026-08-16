# Independent scientific review packet

Status date: 2026-08-16

This review concerns the bounded Level-0 computational case. Approval means
that its assumptions, calculations, evidence chain, and negative conclusion
are reproducible and correctly delimited. It is not approval of the general
theory, physical validation, or an empirical result.

## Reviewer independence

The reviewer should not be the sole author of the model, solver, and frozen
artifacts. They may use the repository implementation, but the checks below
must include an independent derivation or implementation of the critical
quantities.

Record the exact commit, operating system, CPU architecture, Node.js version,
review date, and reviewer identity or stable pseudonym.

## Reproduce from a clean checkout

```sh
npm ci
npm run check
npm run build
npm run case:level-0:verify
npm run case:level-0:dynamics:verify
npm run case:level-0:expanded:verify
npm test
```

The review must stop if a frozen artifact differs, a dependency cannot be
reproduced, or the source lock fails.

## Scientific checks

1. Verify the source DOI, version, local byte count, and SHA-256 in
   [`source-lock.json`](source-lock.json).
2. Confirm that the Phase-B positive and negative controls match the declared
   dispersion, balance, simple-cycle, and removal rules.
3. Independently derive the Phase-C preflight ray
   `V(r)=3r^2-0.5r^3` and confirm that it is unbounded below.
4. Review the positive quartic completion and confirm that it is labelled as a
   case-added assumption rather than a source-derived term.
5. Review the Phase-B to Phase-C mapping. Confirm that the retained triangle
   skeleton and discarded carrier parameters are stated explicitly.
6. Independently evaluate the continuum pulse
   `u(x)=2/(8/3+sqrt(37/9)*cosh(x))`. Confirm `Gamma` near
   `4.61685467491` and a profile-direction Rayleigh quotient near
   `-0.993260773531` before finite-domain discretization error.
7. Independently derive the upper homogeneous plateau root
   `(4+sqrt(10))/3`, approximately `2.38742588672`, and confirm that the
   numerical peak approaches it.
8. Confirm that enlarging the domain leaves the pulse concentration nearly
   unchanged but increases the plateau concentration and support materially.
9. Confirm that each original tested branch fails at least one necessary
   objecthood gate.
10. Confirm that Phase D receives no eligible node and is not silently run on
    a failed Phase-C candidate.
11. Independently derive the three-envelope time-evolution equation from the
    declared energy and confirm the sign of every nonlinear term.
12. Reproduce the symmetric perturbation amplification, the bounded
    antisymmetric control, and the temporal/spatial refinement comparisons.
13. Confirm that
    [`PHASE_C_EXPANDED_PREREGISTRATION.md`](PHASE_C_EXPANDED_PREREGISTRATION.md)
    and [`phase-c-expanded-search-v1.json`](phase-c-expanded-search-v1.json)
    fix the six scenarios, four perturbations, thresholds, and stopping rule
    independently of the reported outcome.
14. Independently reproduce at least one eligible asymmetric stationary
    solution and compare its residual, `Gamma`, component-asymmetry index, and
    enlarged-domain localization measures.
15. Independently construct the complete discrete real-amplitude and
    imaginary-phase Hessians for at least one eligible scenario. Confirm both
    frozen positive-definiteness dispositions without relying only on the
    repository block factorization.
16. Reproduce all four refined dynamic probes for at least one eligible
    scenario and confirm the control, energy, and refinement gates.
17. Confirm that the bounded dynamic-bank pass does not override either failed
    static stability gate and that Phase D still receives no eligible node.

## Claim audit

The final report may say that the declared case executed completely and
returned a negative result. It must not say that Level 0 is physically
validated, that the general theory is falsified, that all nonlinear
completions were searched, or that the result is empirical.

## Review record

Copy this block into the review issue or pull request and fill every field:

```text
Commit:
Reviewer:
Date:
Environment:
Reproduction commands passed: yes/no
Independent Phase-B check:
Independent cubic boundedness check:
Independent pulse/Gamma/Rayleigh check:
Independent plateau-root/domain check:
Independent real-time dynamics check:
Independent asymmetric stationary check:
Independent real/phase Hessian check:
Independent four-probe dynamics check:
Phase-B to Phase-C mapping accepted: yes/no
Claim boundary accepted: yes/no
Blocking findings:
Non-blocking findings:
Decision: accept bounded computational result / request changes
```

An accepted review record should be linked by commit hash. Do not edit the
scientific result to `reviewed` without preserving that external record.
