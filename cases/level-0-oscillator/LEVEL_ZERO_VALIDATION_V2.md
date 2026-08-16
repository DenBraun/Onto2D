# Integrated Level-0 numerical validation v2

Status date: 2026-08-16

## Result

The expanded declared case executed completely and produced a negative result:

```text
complete-negative-result-within-expanded-declared-model
```

Level 0 remains unvalidated because neither the original Phase-C trial family
nor the preregistered asymmetric and complex extension supplies a branch that
passes every necessary objecthood gate. Phase D is not run because it has no
eligible CRT-node input.

| Stage | Result | Consequence |
|---|---|---|
| Frozen integrated v1 | exact reproduction | original negative disposition retained |
| Expanded stationary search | 5 asymmetric eligible branches converge | all are localized and non-trivial |
| Real-amplitude Hessian | 0 of 5 pass | every eligible branch is rejected |
| Complex-phase Hessian | 0 of 5 pass | every eligible branch is rejected |
| Four-probe dynamics | all runs below `10x` and pass refinement checks | necessary dynamic gate passes, but is not sufficient |
| Phase D | not run | no qualified node exists |

This result is stronger than v1 only in its declared coverage. It does not
turn a bounded search into a general or empirical conclusion.

## Reproduction chain

The v2 runner computes both dependencies afresh before integrating them. It
does not trust hashes copied into stored JSON.

| Dependency | Status | Analysis hash |
|---|---|---|
| Integrated Level-0 v1 | `complete-negative-result-within-declared-model` | `sha256:f9c7cb2b7364aece577dc8bd6e0b97375213c7d2974ff78cc6cc66b6979d6d8d` |
| Expanded Phase-C search | `completed-preregistered-bounded-extension` | `sha256:c5cb34687b813fa04026ef9bb5b59eeb06700326b1610ee510ee324a8aab83af` |

The v2 identities are:

- source DOI: `10.5281/zenodo.19397414`, version `v1.2`;
- model hash: `sha256:4b5c2a1fcbea65d864888b830db595c28d06724258a673748614b1d225f0a05b`;
- analysis hash: `sha256:608ce4895ae17cb5cb1b74fed9fa63daefd8f9f8e7b23c47c4cdcb8194d8e176`.

Run the non-mutating full reproduction with:

```sh
npm run case:level-0:verify
```

The v2 specification is
[`level-zero-validation-v2.json`](level-zero-validation-v2.json), and the
integrated artifact is
[`artifacts/level-zero-validation-v2.json`](artifacts/level-zero-validation-v2.json).
The original v1 runner and artifact remain reproducible through
`npm run case:level-0:v1:verify` and
[`LEVEL_ZERO_VALIDATION.md`](LEVEL_ZERO_VALIDATION.md).

## Scientific interpretation

The extension resolves the next question declared by the previous report:
allowing component-specific masses and independent envelopes does produce
asymmetric localized solutions. Their rejection is not caused by failed
stationarity, zero concentration, box dependence, solver drift, or a missing
dynamic run. It is caused by the two preregistered static stability gates.

That separation matters. The calculation does not say that asymmetric
solutions do not exist; it says that the five specified asymmetric solutions
are not admissible trial objects under the frozen full-sector stability rule.

The full phase sector contains neutral relative-phase directions, while the
preregistered gate requires strict positive definiteness without quotienting
them out. A future symmetry-reduced phase policy therefore needs a new protocol
rather than a post-hoc reinterpretation. The negative v2 disposition does not
depend on that policy choice alone: every eligible real-amplitude Hessian also
fails its independent gate.

## Claim boundary and next dependency

The result applies only to the v1 case plus the six-scenario, four-perturbation
extension. It does not cover the continuous parameter space, alternative
nonlinear completions, different phase-symmetry policies, unbounded evolution,
or observed physical systems. The general theory is neither validated nor
falsified, and independent scientific review remains pending.

A further Level-0 claim should not enlarge the same grid informally. It needs a
new preregistration and at least one independent numerical comparison for the
critical stability quantities. A positive Phase-C population remains required
before Phase D can be specified or executed.
