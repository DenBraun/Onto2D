# Kernel Architecture

This document is the architectural overview for schema v1. Exact data shapes
live in `@onto2d/schemas`, executable semantics in `@onto2d/kernel`, and
individual decisions in [ADRs](adr/).

## Purpose

Onto2D evaluates finite, declared construction domains. Given an ontology,
graph policy, primitives, predicates, functionals, selectors, and explicit
budgets, it produces deterministic candidate, census, selection, closure, and
artifact records.

The kernel is designed for replay and falsification. It does not infer missing
scientific meaning, execute an undeclared solver, or turn an incomplete search
into a scientific result.

## Scope

The kernel owns:

- normalized semantic inputs and content identity;
- finite graph generation and canonicalization;
- typed numeric and graph-predicate evaluation;
- complete censuses, cohort construction, scoring, ranking, and admission;
- derived profiles/elements and bounded multi-level closure;
- deterministic null-model execution;
- replayable explanations and semantic run artifacts.

The kernel does not own:

- user interfaces or presentation state;
- source-catalogue parsing and policy authorship;
- filesystem or remote persistence;
- numerical solver implementations;
- empirical validation of a theory or case.

Those responsibilities belong to applications, adapters, stores, and reviewed
case packages.

## Dependency rule

```text
cases / applications
        |
        v
catalog adapter   scientific adapter   run store
        \                |                /
         +---------------+---------------+
                         |
                         v
                    kernel + schemas
```

`@onto2d/kernel` is dependency-free. Outer layers may translate or persist
verified values but cannot redefine kernel identity or semantics.

## Core model

### Element

An `Element` is a content-addressed constituent at a declared ontology
coordinate and derivation depth. Its structural identity is separate from
evidence and alternate derivation lineage.

### Profile

A `Profile` is an explicit equivalence class used when a package permits
quotient construction. Profile representatives are deterministic, but member
consensus is required before member data can be treated as profile data.

### Candidate

A candidate is a finite directed multigraph over exact elements or allowed
profiles. Direction, role, graph policy, and declared structural attributes
participate in identity. Input labels and serialization order do not.

### Package and run

A rule package declares ontology axes, primitives, graph policy, predicates,
functionals, cohorts, selectors, evidence requirements, and optional profile or
formation policies. A run config supplies the finite domain, precision policy,
depth selection, null models, and semantic/execution budgets.

Loading and run binding normalize these inputs and close every reference before
candidate work begins.

## Identity and canonicalization

Semantic artifacts use guarded canonical JSON and domain-separated SHA-256
hashes. Graph identity uses canonical node/edge ordering rather than caller
order. Skeleton identity excludes policy-controlled decorations; candidate
identity retains all declared structural information.

Every verifier recomputes prerequisite identities. A supplied hash is evidence
to check, not authority to trust. Canonicalization has a deterministic search
budget; exhaustion is explicit and non-interpretable.

Operational values such as timestamps, host labels, wall time, and memory use
never enter semantic hashes.

## Execution pipeline

An ordinary level follows this order:

1. Load and normalize the rule package and run config.
2. Materialize the selected source population.
3. Bind the finite candidate alphabet and graph policies.
4. Enumerate and canonicalize candidates under declared budgets.
5. Evaluate all top-level predicates and construct the complete census.
6. Partition eligible candidates into declared cohorts.
7. Evaluate functionals, rank selectors, run sensitivity, and combine
   admissions.
8. Materialize selected formations, derived profiles, and the next element
   population when the package enables them.
9. Execute declared null models against the same semantic pipeline.
10. Build explanations, integrated censuses, and the semantic run bundle.

Stages are separate content-addressed artifacts. Later stages verify earlier
ones by replay; they do not accept hand-built objects that merely resemble
validated output.

## Predicate and numeric semantics

Expression analysis, numeric-policy binding, and evaluation are separate.
Dimensions, units, summation order, rounding, tolerances, and evidence are
declared rather than inferred from ambient runtime behavior.

Predicate results are three-valued: pass, fail, or indeterminate. Missing data,
incompatible evidence, and exhausted work do not become failures. Complete
censuses retain every verdict and expose selectivity without erasing the
indeterminate population.

Substructure operators such as minimality, novelty, irreducible removal, and
stability bind their complete finite domain and witnesses. Sampled stability
uses a named deterministic stream and conservative bounds; it is not confused
with exhaustive proof.

External numerical results enter only through content-bound Oracle requests and
validated responses that identify solver, version, method, parameters,
tolerance, and evidence.

## Finite execution and pruning

All combinatorial work has explicit semantic and execution budgets. Semantic
budget exhaustion means the requested domain was not completed. An execution
budget may stop work operationally but cannot authorize interpretation of a
partial semantic population.

Pruning authority is stronger than detecting a likely failure. It requires a
frozen proof/audit artifact, a separately prepared controller, exact skipped
subtree accounting, and differential conformance with unpruned enumeration.
When proof is absent, the kernel evaluates rather than guesses.

Resumable enumeration verifies its prefix and never bypasses an exhausted
semantic budget.

## Selection and closure

Filtering answers local admissibility. Ranking compares eligible candidates
within complete cohorts. Sensitivity evaluates declared coefficient variants.
Admission combines complete selector results. These steps are not interchangeable
and keep separate identities.

Selected formations retain exact constituent and claim lineage. Derived
profiles and elements are all-or-nothing: unresolved capacity, typed partner
guards, invariant disagreement, or functional evidence produces an explicit
indeterminate result rather than a partial next level.

Depth-aware closure verifies a contiguous chain of prior levels and an explicit
source policy such as `all-below` or `previous-only`. Ladders and current-level
fixpoints are bounded and have explicit complete, empty, fixpoint,
indeterminate, or exhausted terminal states.

## Null models

Null models are declared per run and operate on a verified carrier. Planning,
proposal generation, trial filtering, trial selection, and baseline statistics
are separate artifacts. Independent named streams make proposals reproducible.
Duplicate sampled occurrences remain distinct observations through the entire
pipeline.

Undefined statistics, zero variance, insufficient runs, and disabled models
are represented explicitly; the kernel does not fabricate a Z-score.

## Source migration

The catalogue adapter preserves source relations and applies only reviewed,
content-addressed classification and node-resolution inputs. Policies must be
frozen before topology-aware unblinding. Disagreement, amendments, SCC
projections, condensation, metrics, and explanations remain replayable
artifacts.

The kernel and adapter do not author current-catalogue classifications or infer
dispositions from a desired DAG. That scientific work remains external.

## Artifacts and persistence

A semantic run bundle contains normalized inputs, verified stage artifacts,
canonical bytes, inventories, and a run hash. `@onto2d/run-store` publishes
such bundles atomically and reconstructs them through full kernel replay.

Execution records are append-only operational overlays bound to a run hash.
They cannot modify semantic artifacts. Symbolic links, unexpected files,
non-canonical bytes, stale bindings, and partial overwrites fail closed.

Explanation indexes are generated only after replay of the complete level or
source-migration chain. Presentation code queries them instead of reconstructing
semantic joins.

## Security and resource isolation

Input sizes, recursion, canonicalization search, enumeration, perturbations,
null trials, and artifact bytes are bounded. Canonicalization rejects accessors,
prototype-sensitive keys, non-finite numbers, and malformed Unicode. Stores
reject path escapes and unverified filesystem entries.

The kernel performs no network or filesystem access. External I/O remains in
explicit adapters and applications.

## Conformance

Acceptance requires:

- permutation and serialization invariance tests;
- independent canonical-byte and skeleton fixtures;
- positive, negative, tamper, and budget tests;
- schema conformance for emitted artifacts;
- optimized-versus-exhaustive differential tests;
- exact replay of stored and displayed fixtures;
- supported-platform CI and independent review for release.

See [Implementation Status](KERNEL_IMPLEMENTATION_STATUS.md) for the current
boundary and [Review Guide](REVIEW_GUIDE.md) for review order.
