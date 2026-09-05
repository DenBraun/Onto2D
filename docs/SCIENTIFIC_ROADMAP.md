# Scientific Roadmap

Status date: 2026-08-25

## Scope

The schema-v1 kernel provides deterministic computation, evidence binding, and
replay. The next scientific work must supply the model assumptions, reviewed
source interpretations, numerical implementations, and empirical evidence that
the kernel deliberately does not invent.

These workstreams are not blockers for publishing the kernel as `v0.1.0` while
its claims remain limited to implementation conformance. They are required
before Onto2D can claim numerical or empirical validation of a scientific case.

## 1. Numerical Level-0 validation

The current `cases/level-0-oscillator` case freezes source identities and open
questions from the complete theory. Its first bounded Phase-B reference
benchmark now supplies a periodic normalized model, an external case solver,
three negative controls, Oracle evidence, and a frozen reproducible report. The
goal remains a numerical test of a precisely stated complete Level-0 model,
including negative and indeterminate outcomes.

Current milestone: the expanded declared Level-0 pipeline is implemented with
an explicit bounded negative result. Phase-B computational conformance passes.
The free cubic Phase-C potential is unbounded below, and the disclosed positive
quartic completion supplies no object-qualified node in either its original or
expanded trial family. Collective Phase D and general Level-0 validation remain
open because no eligible Phase-C population exists.

A first bounded follow-up now adds a disclosed quartic stabilizer and searches
three symmetric real-envelope branches. The localized pulse fails the
real-amplitude stability gate, the stable plateau fails domain-independent
localization, and the uncoupled vacuum fails nontrivial `Gamma`. This closes the
declared trial family with a negative result, not the general Phase-C question.
An additional bounded dynamics probe evolves the localized pulse under the
same three-envelope energy. Its symmetric perturbation grows, its
antisymmetric control remains bounded, and its coupled space-time refinements
agree. A subsequent outcome-independent preregistration freezes one control,
five asymmetric parameter sets, complete real and imaginary block-Hessian
checks, and four broader real/complex time perturbations. All six calculations
converge; the five eligible branches are asymmetric, localized, non-trivial,
and dynamically bounded under the declared probes. None passes the real or
phase Hessian gate. This closes that finite extension without claiming coverage
of the continuous parameter or perturbation space.

The current integrated v2 runner closes this expanded pipeline with the
explicit status `complete-negative-result-within-expanded-declared-model`:
Phase B passes, Phase C supplies no object-qualified node, and Phase D stops
without inventing an eligible population. The next Level-0 extension requires
a new preregistration for an alternative bounded nonlinear completion or a
scientifically justified phase-symmetry policy, plus an independent numerical
comparison for the stability quantities used by the gate. Repeating a denser
version of the same finite grid without that protocol is not the next
milestone.

Required work:

- define the compensation function, field representation, support measure,
  operator class, initial and boundary conditions, units, parameter domains,
  and numerical tolerances;
- define the candidate family, balance, stationarity, localization, dispersion,
  stability, perturbative-identity, and closure tests;
- define the functional terms and coefficient policy, including sensitivity
  ranges, cohort construction, degeneracy handling, and partial convergence;
- state the hypotheses and searched counterexample domain before inspecting the
  final ranking;
- bind every computed value to a solver request, method, version, parameters,
  residual, tolerance, unit, and evidence reference;
- publish the complete case package, normalized solver artifacts, verified run
  bundle, and a report that separates passed, failed, and indeterminate tests.

Completion criteria:

- a clean checkout reproduces every accepted numerical value and final case
  status without editing a fixture;
- the documented equations, units, domains, and tolerances are sufficient for
  an independent implementation;
- convergence, stability, coefficient sensitivity, and selected null tests are
  reported rather than inferred from one successful trajectory;
- the report claims validity only inside the declared model and search domain.

## 2. Reviewed migration of the current catalogue

The catalogue adapter can audit and replay a migration, but it cannot author
the scientific interpretation of `ParentCode` relations. The goal is a
reviewed, loss-preserving migration of the current `references/level-*.json` catalogue
into explicit relation layers and formation-support components.

Required work:

- freeze the relation-classification policy, examples, node-resolution rules,
  SCC disposition criteria, warning thresholds, and amendment procedure before
  examining topology-dependent outcomes;
- annotate every source relation, retain annotator identity and confidence,
  and adjudicate disagreements without silently forcing all relations into one
  causal meaning;
- review all nontrivial SCCs as possible distributed structures, constitutive
  clusters, or classification problems;
- preserve the original graph and every excluded or reclassified edge in the
  explanation lineage;
- generate the reviewed migration package, condensation graph, diagnostics,
  migration metrics, explanations, and cluster-concentration result;
- obtain independent domain review of the policy and the contested decisions.

Completion criteria:

- every source node and relation is accounted for exactly once in the migration
  record and can be traced back to its original bytes;
- formation-support condensation is acyclic without assigning an invented
  internal order to cluster members;
- all current nontrivial SCCs have explicit reviewed dispositions;
- migration metrics reconcile and the adapter replays the frozen result from a
  clean checkout.

## 3. External numerical solver

`@onto2d/scientific-adapter` defines the trust boundary and intentionally
contains no solver. The separately publishable `@onto2d/level-zero-solver` now
answers the frozen Phase-B requests without importing the kernel. It preserves
the `onto2d-level-0-reference-solver@1.0.0` method identity, enforces explicit
resource limits, and has manufactured-mode, convergence, boundary, and failure
contract checks. The frozen case artifact reproduces without semantic drift.

This is the first bounded implementation milestone, not completion of the
workstream. Phase-C methods remain case-local, platform comparison is not yet
frozen, and the required independent numerical comparison has not been
performed.

Required work:

- choose numerical methods only after the Level-0 equations, domains, and error
  requirements are frozen;
- implement the adapter contract with explicit `id`, `version`, and `method`
  identity and deterministic parameter serialization;
- return normalized quantities, residuals, convergence status, tolerances,
  evidence references, and structured failure information;
- lock the runtime and numerical-library environment and record platform details
  outside semantic hashes;
- add analytic or manufactured-solution checks where possible, convergence
  studies, boundary cases, and independent comparison for critical quantities;
- keep timeout, non-convergence, unsupported requests, and partial convergence
  distinct from a scientifically negative result.

Completion criteria:

- the kernel validates every response against the exact request and rejects
  solver, method, parameter, unit, tolerance, or evidence drift;
- reference problems reproduce within declared error bounds in a clean
  environment;
- at least one independent numerical comparison supports the quantities used by
  the Level-0 acceptance decision;
- the solver can be replaced without changing kernel code or canonical
  identities outside the declared scientific evidence.

## 4. Empirical historical load

The current Historical Load Explorer uses a disclosed finite toy model. The
goal is an empirical study in which historical load is computed from a frozen,
cited dataset and a predeclared formation interpretation, not from illustrative
values.

Required work:

- define historical load operationally and distinguish it from graph depth,
  descendant count, centrality, motif frequency, and ordinary path length;
- select a versioned dataset with stable identifiers, provenance, licensing,
  and enough temporal or formation evidence to support that definition;
- freeze graph conventions, edge semantics, preprocessing, exclusions, missing
  data policy, and the mapping from observations to Onto2D structures;
- preregister the primary comparison, covariates, uncertainty treatment, null
  model, robustness checks, and stopping rule;
- run the analysis through verified case and run artifacts, including all
  indeterminate or data-insufficient objects;
- compare historical load with conventional graph measures and test whether it
  explains a distinct, externally observable outcome;
- publish effect sizes, uncertainty intervals, null distributions, sensitivity
  analyses, and the exact dataset and code versions used by the Explorer.

The *E. coli* network is a useful candidate only if its available evidence can
support the chosen formation-history definition. A directed interaction graph
and its motif counts alone are not sufficient evidence of historical load.

The LTEE Ara-3 citrate replay case is the stronger biological candidate for
this workstream because it directly tests history-conditioned accessibility
using frozen historical samples. Its current source-locked release must still
remain `not-evaluated`: the 2008 replay tables do not enumerate a finite
mutation-path universe, cost its transitions, or define free and
history-conditioned optima in one shared space. The published mutant counts,
mean-generation shifts, and P values quantify contingency but are not
`dH(x | F) = aF - a0`.

An LTEE Historical Load extension should be a new preregistered case revision,
not a reinterpretation of the current scalar fields. It must source-lock the
additional clone/genotype and intervention evidence, declare path resolution,
target phenotype and replay environment, specify free and background-
conditioned admissibility, predeclare biologically interpretable costs and
sensitivity analyses, propagate polymorphism and unobserved-path uncertainty,
and validate the result against an external replay outcome. Failure to close
that path space must yield `unresolved`, not a convenient number.

The live-bootstrap provenance case is also not an empirical Historical Load
result. It is a reproducible methods case over one pinned manifest and a
complete, explicitly finite three-path construction space. Its results test
source/evidence separation, cost sensitivity, admissibility, and ablation, but
they do not estimate a naturally observed distribution or validate the metric
against an external outcome.

Airflow Dependency Constraints is now an implemented independent engineering
case. It is not folded into Nix: the Nix case tests derivation and output
identity, whereas Airflow tests the cost of an externally published,
release-specific admissibility filter. Its source-locked v1 scope is a complete
five-requirement Airflow Core 3.3.1 / Python 3.12 projection, not a complete
Airflow installation. Across 17 projects and 24 candidates, exhaustive
enumeration finds 64 valid solutions and one official-constraint solution.
Predeclared costs yield `dH` values of +144,596 compatible-wheel bytes, +7
changes from the declared valid baseline, and zero selected wheels. Resolver
assignments and rejections remain diagnostics; wheel payloads are not vendored
and pip installation or runtime is not replayed. A broader package-index or
full-install result therefore requires a new case revision.

The [History Case Portfolio](history/HISTORY_CASE_PORTFOLIO.md) extends that
methods work across 24 registered cases. The portfolio is organized by history
access (Recorded, Embodied, Reconstructed) and history effect (Identity,
Present State, Future), with domain retained as secondary metadata. Each case
has a separate falsification criterion and implementation plan; `PLANNED`
pages are navigation and documentation, not scientific evidence.

Completion criteria:

- a clean run reproduces the analysis table and Explorer data from the frozen
  source and preprocessing specification;
- the reported quantity has a documented interpretation, uncertainty, and
  falsifiable external comparison;
- results are labelled empirical only where the source evidence supports the
  formation claim; all other views remain explicitly illustrative;
- at least one independent reviewer can trace a displayed value back through
  preprocessing, model inputs, and verified run artifacts.

## History Matters benchmark workstream

The [History Matters v0 pilot](history/HISTORY_MATTERS_BENCHMARK.md) now adds
controlled P/P+H comparisons outside Historical Load. Three synthetic controls
and three semantic contrasts replay exactly; Operational Aging and LTEE retain
unevaluated outcome status. Operational Aging now has source-verified full-cohort
preparation, unit-disjoint predictions and an age sensitivity baseline. Next work
is independent review and held-out scoring, protocol-specific LTEE contracts,
and independent review before benchmark v1.

## Dependencies and order

The four workstreams can overlap, but their evidence dependencies are:

1. Freeze the Level-0 numerical specification before choosing its solver
   methods.
2. Build the external solver and the Level-0 case together against the frozen
   request/response boundary.
3. Freeze and independently review the catalogue policy before producing the
   current-catalogue migration.
4. Define historical load before selecting a convenient dataset; use the
   catalogue migration or another dataset only when its evidence matches that
   definition.

The local live-bootstrap trace exporter and focused Explorer satisfy the
engineering prerequisites for a possible upstream-neutral trace discussion.
No upstream contact should occur until stable public output, a public demo or
screenshots, and a small analysis-independent proposal are ready.

Each completed study should add a source lock, case README, machine-readable
inputs, reproducible commands, expected artifacts, limitations, and an
independent review record. Scientific evidence belongs in `cases/` and adapter
artifacts; reusable deterministic operations belong in the kernel only when
their semantics are case-independent.
