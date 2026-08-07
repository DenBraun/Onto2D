# ADR-0009: Predicate analysis and compiled plans

Status: implemented decision; runtime execution not performed

## Context

The predicate contract contains graph built-ins, Boolean combinators, typed
value comparisons, dimensional balances, and potentially exponential
substructure operators. A loader that checks only `expr.op` cannot prevent
unknown fields, invalid bounds, undeclared perturbations, incompatible units,
or unsafe partial-pruning claims from reaching candidate generation.

The architecture also distinguishes a declared monotone violation from a
proof. Randomized audits can expose counterexamples but cannot prove universal
monotonicity. Compilation must preserve that distinction before any evaluator
or generator exists.

## Decision

The analyzer version `typed-predicate-expression-v1` supports the fifteen
normative operators: `all`, `any`, `not`, `degree`, `cycleExists`, `connected`,
`componentCount`, `pathExists`, `countRole`, `balance`, `compare`, `minimal`,
`novel`, `stableUnder`, and `irreducibleRemoval`. Every node is a closed data
contract. Boolean depth, node count, argument count, role count, string length,
and substructure nesting have fixed ceilings that callers may lower but not
raise. Shared depth, node, argument/term, role, and string limits are also
applied to embedded value expressions. The same string ceiling covers semantic,
method, and evidence strings inside a balance tolerance quantity.

`all` and `any` require at least one argument and are canonicalized by sorted
normalized child expressions. Role lists are unique and sorted. Bounds are
safe non-negative integers, cycle lengths are positive, lower bounds cannot
exceed upper bounds, thresholds lie in `[0, 1]`, and balance tolerances are
normalized non-negative quantities.

Embedded value operands are analyzed by `typed-value-expression-v1` in a
predicate-only environment. Functional coefficient nodes fail with an explicit
forbidden-capability issue; no coefficient registry is available.
Comparisons require equal numeric dimensions; when both numeric semantics are
known they must agree. String, Boolean, and null operands support only `eq` and
`ne`. A balance attribute may infer its dimension from the explicit tolerance;
a conflicting declared attribute type fails.

The analysis emits:

- a normalized Boolean AST plus expression and analysis hashes;
- referenced invariants, attributes, roles, graph projections, perturbations,
  substructure policies, and embedded value-expression hashes;
- operators and witness kinds required by later evaluation;
- normalized symbol types;
- AST, value-expression, and substructure statistics;
- independent pass/fail persistence and partial-detectability facts.

Persistence inference is deliberately conservative under additive extension:

| Form | Persistent fact |
|---|---|
| upper-only `countRole` | failure after exceeding the maximum |
| lower-only `countRole` | pass after reaching the minimum |
| `cycleExists` / `pathExists` | pass after a witness exists |
| `not(cycleExists)` | failure after a cycle witness exists |
| combined lower/upper range | neither outcome unconditionally |
| balance, compare, component count | neither outcome unconditionally |
| substructure/perturbation combinators | neither outcome unconditionally |

A canonical-index degree selector receives no partial persistence proof because
canonical labels may change before completion. The same restriction applies to
path endpoints selected by canonical index. A lower-bound degree pass over a
selection that can gain nodes is also not persistent. Boolean `not` swaps
pass/fail facts. `all` and `any` propagate a fact only when every child has that
fact, which is conservative but safe.

`predicate-plan-v1` binds predicate ID, phase, depth-reference policy,
`monotoneViolation`, expression-analysis hash, and pruning state under
`onto2d:predicate-plan:v1`. Boolean expressions and their analyses use the
separate `onto2d:predicate-expression:v1` and
`onto2d:predicate-expression-analysis:v1` domains.

Pruning state is:

- `disabled` when the package does not declare a monotone violation;
- `static-proven` when failure persistence and partial detection are both
  established;
- `blocked-unproven` when static failure persistence is absent;
- `blocked-partial-data` when persistence exists but the partial failure cannot
  be observed.

Every declared monotone violation also records `auditRequired: true`.
Successful randomized samples do not promote `blocked-unproven` to pruning
authority. A later audit may only preserve or falsify an already static-safe
plan.

The package loader compiles every predicate against package invariants and
declared perturbation IDs, normalizes its Boolean AST before package/rules
hashing, and emits sorted `predicatePlans` on the loaded package. The plan does
not include explanations or claim text because those do not alter evaluator
instructions; they remain in the normalized rules package and its identities.

## Consequences

- malformed Boolean ASTs and dimension errors fail at package load;
- predicates cannot reach functional coefficients through embedded value
  expressions;
- future generators receive explicit data, graph, witness, and pruning
  requirements instead of reinterpreting raw rule data;
- a monotonicity declaration alone cannot authorize partial pruning;
- package identity retains rule/provenance content while plan identity retains
  compiler-dependent execution structure;
- three-valued evaluation, witness construction, monotonicity audits,
  candidate generation, and actual pruning remain separate capabilities;
- changing operator semantics, normalization, inference, limits, or hash
  payloads requires a new analyzer/compiler or hash-domain version.

## Conformance artifacts

- closed-node validation for all operator families;
- canonical Boolean and role ordering;
- upper/lower/combined bound persistence cases;
- forbidden-cycle, canonical-index degree/path, and growing-selection cases;
- compatible/incompatible numeric comparison and scalar ordering cases;
- dimensional balance and inferred attribute metadata;
- balance-tolerance nested-string limits;
- perturbation references and nested-substructure limits;
- `disabled`, `static-proven`, and blocked pruning plans;
- loader plan ordering, normalization, and hash contracts.

Dynamic execution of these artifacts remains outside the current change.
