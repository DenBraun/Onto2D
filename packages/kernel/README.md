# `@onto2d/kernel`

This package is the dependency-free boundary of the Onto2D closure kernel. Its
implemented foundation provides:

- guarded canonical JSON with deterministic limits;
- domain-separated SHA-256 content identities;
- versioned model and error contracts;
- deterministic package defaults and normalization;
- structural, reference, quantity, profile, stratification, cohort, selector,
  and ontology-axis validation;
- primitive element IDs, profile hashes, rules hash, identity-policy hash, and
  depth-basis hash;
- exact supplied-candidate and policy-independent simple-skeleton
  canonicalization;
- bounded connected-unlabeled skeleton enumeration through six nodes;
- a fixed-domain CandidateStore with deterministic deduplication and explicit
  completion/budget state;
- a versioned multiplicative SI unit grammar, canonical quantity conversion,
  and tolerance-aware quantity comparison;
- canonical exact decimals, declared rounding, rounded division, and exact or
  compensated accumulation;
- recursive typed value-expression normalization, dimensional inference,
  dependency extraction, and content-addressed analysis;
- package-load checks that expression dimensions match functional and cohort
  quantity contracts;
- strict Boolean predicate analysis with typed comparisons, dimensional
  balances, graph/data/witness requirements, and conservative pruning facts;
- content-addressed predicate plans emitted by package loading;
- `createKernel().loadPackage()`, graph operations, quantity/decimal
  operations, value/Boolean analysis, and predicate-plan compilation as the
  current public runtime boundary.

Candidate decoration, partial pruning, integrated candidate enumeration,
value-expression and predicate evaluation, cohort execution, ranking, closure,
explanations, and sensitivity execution remain explicit pending capabilities.
Calls to pending APIs fail with `KERNEL_NOT_IMPLEMENTED`; no placeholder result
is returned.

The normative behavior is defined in
[Kernel Architecture](../../docs/KERNEL_ARCHITECTURE.md). Implementation work
must preserve the dependency direction documented in
[Project Structure](../../docs/PROJECT_STRUCTURE.md).
