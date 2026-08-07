# ADR-0010: Predicate numeric-policy binding

Status: implemented decision; predicate execution not performed

## Context

`predicate-plan-v1` compiles package-owned predicate metadata and static type
analysis, while `PrecisionPolicy` belongs to the run configuration. Folding a
run policy into package loading would make one predicate plan unusable across
runs; leaving it implicit until evaluation would permit host arithmetic,
rounding, summation order, or tolerance behavior to become a hidden default.

The existing runtime already implements `decimal-rational-v1` and the
`declared-max-tolerance-v1` quantity comparison. A content-addressed bridge is
needed before an evaluator may consume either contract.

## Decision

`predicate-numeric-binding-v1` is a separate post-compilation artifact. The
public `bindPredicateNumericPolicy(plan, precisionPolicy, options)` operation:

1. verifies the closed plan shape, normalized expression, every materialized
   analysis witness, derived pruning metadata, and all declared hashes;
2. normalizes the complete precision policy;
3. materializes the quantity semantic policy, defaulting only an absent value
   to `require-equal`;
4. inventories every compiled numeric operation by normalized JSON path and
   attaches explicit references to the policies it requires;
5. hashes the result under `onto2d:predicate-numeric-binding:v1`.

The binding freezes these policies:

- arithmetic is `decimal-rational-v1`;
- rounding occurs once at a top-level value-expression or aggregate result
  boundary under the declared decimal places and rounding mode; nested
  addition and multiplication remain exact and are not rounded independently;
- selection-derived sums use the declared exact-decimal or compensated-binary64
  algorithm in `canonical-selection-order-v1`;
- quantity comparison uses `declared-max-tolerance-v1`, combines all declared
  absolute and relative operand bounds by their maximum effective bound, and
  treats the tolerance window as closed;
- quantity semantics must match unless the binding explicitly records
  `semanticPolicy: "ignore"`.

The operation inventory distinguishes value addition, multiplication, and
summation; dimensionless numeric comparison; quantity comparison; balance;
and stability-threshold comparison. A balance references arithmetic,
precision, summation, and quantity-comparison policy together. Exact graph
counts and non-numeric scalar equality are not relabelled as scientific numeric
operations.

Dimensionless `number` operands compare after the bound decimal result
quantization. Quantity operands additionally use their declared tolerance
records and the bound semantic policy. Structural integer counts remain exact;
passing them through a non-negative decimal-place policy does not widen their
equality relation.

Paths refer to the already normalized predicate expression. Commutative AST
normalization therefore stabilizes both expression identity and binding paths.
The binding inventory has a fixed ceiling of 10,000 numeric operations so its
canonical artifact stays within the guarded canonical-JSON resource contract.
The inventory is an execution contract, not an evaluator: it does not resolve
candidate attributes, add values, decide a predicate outcome, or construct a
witness.

## Consequences

- one package-level predicate plan can be bound independently to multiple run
  precision policies;
- changing precision, summation, or semantic comparison policy changes the
  binding hash without changing the package plan hash;
- no future numeric predicate evaluator may select host rounding, term order,
  or semantic comparison behavior implicitly;
- altered or internally inconsistent plan artifacts fail before binding,
  including drift in requirements, symbols, persistence/detectability facts,
  statistics, or pruning eligibility;
- functional, selector, profile, Oracle, and level-boundary numeric bindings
  still require their own compiled contracts;
- changing operation discovery, policy references, ordering, or hash payloads
  requires a new binder or hash-domain version.

## Conformance artifacts

- mixed add, multiply, sum, dimensionless compare, quantity compare, balance,
  and stability operation inventory;
- explicit default and overridden semantic policies;
- deterministic binding hashes and deeply frozen output;
- policy binding for a predicate with no numeric operations;
- rejection of altered expression and plan metadata hashes;
- invalid precision policy, semantic policy, and unknown-option failures;
- JSON Schema, TypeScript, public-kernel, and capability declarations.

Actual value-expression and predicate execution remain outside this change.
