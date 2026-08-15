# Phase-C stabilized envelope search

Status date: 2026-08-15

## Outcome

No branch in the frozen trial family satisfies localization, nontrivial
concentration, and real-amplitude stability at the same time. This is a
negative result inside a declared bounded computational model. It is not a
universal disproof of CRT objecthood.

| Scenario | Stationary | Nontrivial `Gamma` | Intrinsically localized | Amplitude-stable | Trial gate |
|---|---|---|---|---|---|
| `localized-pulse` | pass | pass | pass | fail | reject |
| `stable-plateau` | pass | pass | fail | pass | reject |
| `uncoupled-vacuum` | pass | fail | fail | pass | reject |

Because no paper-qualified CRT-node is produced, the Phase-D collective search
terminates as `not-run-no-object-qualified-nodes`. It does not manufacture an
ensemble from a failed Phase-C input.

## Declared model

The case restricts three complex modes to equal real envelopes in a
phase-aligned resonant frame. On `[-L,L]`, with homogeneous Dirichlet boundary
conditions, it evaluates

```text
E = integral [
  0.5 sum_i ((dx u_i)^2 + m2 u_i^2)
  - 2 lambda u1 u2 u3
  + 0.25 g (sum_i u_i^2)^2
] dx.
```

On the symmetric branch `u_1=u_2=u_3=u`, the stationary equation is

```text
-d2_x u + m2 u - 2 lambda u^2 + 3 g u^3 = 0.
```

The positive `g` term is an explicit case-added stabilization. The source
paper motivates a cubic resonant coupling but does not derive this quartic
completion or its coefficient. The case therefore tests one falsifiable
completion and does not present it as the theory's unique dynamics.

The composite-envelope concentration is frozen as

```text
Gamma = integral |u_1 + u_2 + u_3|^2 dx = 9 integral u^2 dx.
```

This is evaluated in the declared phase-aligned envelope frame. It is not
silently identified with matter density, probability, or an empirically
measured observable.

The input mapping is explicit. It retains the admitted Phase-B candidate's
three components, simple-cycle skeleton, and evidence lineage. It does not
retain its individual amplitudes, wave numbers, signed frequencies, or
mass-squared values. Replacing those values with equal normalized envelopes is
a case assumption, not a derivation from Phase B or the paper.

## Numerical method

The external solver uses second-order central differences and damped Newton
iteration. The base interval has half-width `8`, with `128` and `256`
subintervals. The domain control has half-width `12` and `384` subintervals,
which preserves the fine-grid spacing.

The localization gate requires both `Gamma` and the central 90-percent support
radius to change by at most five percent after the domain is enlarged.
Real-amplitude stability requires positive-definite discrete Hessians in the
symmetric and both degenerate antisymmetric component sectors. Complex phase
perturbations and time evolution are outside this model, so even a passed trial
gate would not by itself establish the paper's complete persistence claim.

Those unrun perturbation classes do not weaken the terminal result for the
current scenarios. Each branch already fails a necessary objecthood gate. A
negative real-amplitude direction is sufficient to reject the pulse; a
complex-phase calculation cannot make the plateau intrinsically localized or
make the vacuum's `Gamma` nonzero. Additional perturbation classes become
mandatory if a future branch passes all earlier gates.

## Results

### Localized pulse

- fine-grid residual: `8.79106102967e-14`;
- `Gamma`: `4.61616961549` on the base domain and `4.61624418058` on the
  extended domain;
- relative domain change: `0.0000161527612103`;
- 90-percent support radius: `1.9375` on both domains;
- profile-direction Rayleigh quotient: `-0.99330785572`.

The negative Rayleigh quotient is an explicit descending perturbation
direction. The pulse is localized and numerically stationary but is not a
local minimum of the declared energy.

### Stable plateau

- fine-grid residual: `9.84101689028e-13`;
- `Gamma`: `734.740946104` on the base domain and `1145.12671636` on the
  extended domain;
- relative domain change: `0.358375858662`;
- 90-percent support radius: `6.5` then `10.0625`;
- both real-amplitude Hessian sectors are positive definite.

The plateau is stationary and stable within the tested amplitude class, but
its concentration and support grow with the box. The boundary creates finite
support; the state does not pass the intrinsic-localization control.

### Uncoupled vacuum

With `lambda=0`, the unique tested branch has `Gamma=0`. It provides the
nontriviality control: numerical stationarity and positive curvature do not
create an object-like carrier from the zero field.

## Frozen identities

- source DOI: `10.5281/zenodo.19397414`, version `v1.2`;
- source SHA-256: `sha256:3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7`;
- Phase-B reference: `sha256:ecb9e32e8564e00f639c4a2f57b3a612f087b41ad3110cfde53957cacdf38483`;
- boundedness preflight: `sha256:3a1a052cd01f2932428ab4c2e0d50dde1c20a0eca7e482a44cc10dd4a66b1c90`;
- model hash: `sha256:337f605b262cc32cc3e86e7b9324d9300f9220f3762eb96cb8a57351f6ea718c`;
- analysis hash: `sha256:c3c13e3682ed27a81653f38f6bb52befb84d1539bb873a5b9ef87ed3837e9bc5`;
- solver: `onto2d-level-0-phase-c-objecthood@1.0.0`, method
  `dirichlet-central-difference-newton-v1`.

The complete machine-readable specification is
[`phase-c-objecthood-v1.json`](phase-c-objecthood-v1.json). The exact Oracle
requests, responses, gate witnesses, and terminal Phase-D status are frozen in
[`artifacts/phase-c-objecthood-v1.json`](artifacts/phase-c-objecthood-v1.json).

## Limits and next falsifiable step

This search covers one symmetric real-envelope family, two domain sizes, and
real-amplitude second variations. It does not cover asymmetric envelopes,
alternative bounded potentials, complex phase modes, real-time persistence,
or all parameter values.

The next admissible extension is a preregistered parameter and asymmetric-
profile search with complex-phase and time-evolution perturbations. A positive
claim requires a branch that passes every gate; a wider search finding none
remains a bounded negative result, not a universal impossibility theorem.
