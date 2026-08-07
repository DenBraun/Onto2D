# ADR-0008: Typed value-expression analysis

Status: implemented decision; runtime execution not performed

## Context

Functionals and cohort rules use declarative `ValueExpression` data. Checking
only that an object has a `kind` field allows malformed operands, undeclared
coefficients, incompatible units, and unbounded recursive structures to reach
later stages. Evaluation cannot be deterministic or safe until the loader can
derive a complete static contract for each expression.

Expression analysis must remain separate from execution. It must not read a
candidate, resolve an Oracle value, perform ranking, or turn unavailable data
into a numeric default.

## Decision

The analyzer version is `typed-value-expression-v1`. It accepts the seven
normative node kinds: `constant`, `invariant`, `count`, `sum`, `add`,
`multiply`, and `coefficient`, together with the normative node/set selectors.
All objects are closed contracts and unknown fields fail.

The environment has independent coefficient, invariant, and attribute symbol
registries. A symbol resolves to one of `number`, `quantity`, `string`,
`boolean`, or `null`. Quantity symbols bind a canonical SI dimension and may
carry semantic text. Actual coefficient and invariant values are accepted as
environment input but only their normalized types enter analysis output.

Inference follows these rules:

| Node | Result |
|---|---|
| scalar constant | its scalar type; finite numbers are dimensionless |
| quantity constant | normalized quantity type and dimension |
| invariant/coefficient | declared symbol type |
| count | dimensionless number |
| sum | declared numeric attribute type |
| add | common operand dimension; quantity if any operand is a quantity |
| multiply | sum of operand dimension exponents; quantity if any operand is a quantity |

Arithmetic rejects string, Boolean, and null operands. Addition rejects mixed
dimensions. Multiplication rejects any result outside the representable unit
grammar. A `sum` attribute must have declared numeric metadata; schema-v1
packages do not yet expose such a registry, so they fail rather than infer a
unit from a name. A `where` selector may infer a scalar attribute type from its
literal equality value, and later declarations must agree.

The analyzer normalizes quantity constants, negative zero, role ordering, and
commutative operand ordering. It emits sorted invariant, coefficient,
attribute, and role requirements plus node/depth statistics. Fixed kernel
ceilings bound recursion, node count, operands, roles, string length, and
dimension exponents. Callers may lower but not raise these ceilings.
The string ceiling includes ordinary string constants, `where` equality
literals, and semantic/method/evidence strings nested in quantity constants or
quantity-backed symbol declarations. Canonical indices are restricted to the
non-negative safe-integer range.

Two new hash domains are used:

- `onto2d:value-expression:v1` hashes the normalized AST;
- `onto2d:value-expression-analysis:v1` hashes the analyzer version,
  expression hash, inferred result, sorted requirements, and referenced symbol
  types.

Unreferenced environment entries and symbol values do not affect the analysis
hash. Values remain present in the normalized rule package and its package or
rules identity where applicable.

During package loading, each functional expression is analyzed against package
invariants and its own coefficients. Its inferred dimension must match the
declared `QuantitySpec`. Cohort key expressions are analyzed against package
invariants. An `invariant-window` value must be numeric and match the
origin/width dimension. Same-named invariants declared by multiple primitives
must have identical dimensions and semantics.

## Consequences

- malformed or dimensionally inconsistent value expressions fail before any
  candidate generation or evaluation;
- normalized commutative expressions receive stable identities independent of
  operand order;
- analysis artifacts expose the exact candidate data and role vocabulary that
  execution will require;
- coefficient values can change without falsely changing the type-analysis
  identity, while package/rules identities still capture rule data;
- Boolean-expression analysis, precision binding, candidate-data resolution,
  arithmetic execution, predicate evaluation, and ranking remain separate
  capabilities;
- changing node semantics, normalization, inference, limits, or hash payloads
  requires a new analyzer or hash-domain version.

## Conformance artifacts

- scalar and normalized quantity constants;
- compatible and incompatible additive dimensions;
- multiplicative derived dimensions;
- invariant/coefficient/attribute/role dependency extraction;
- selector normalization and conflicting inferred attribute types;
- selector-literal and nested-quantity string ceilings;
- stable hashes under commutative and environment-record reordering;
- undeclared symbols, unknown fields, invalid operands, and resource limits;
- functional result and invariant-window dimensional checks;
- conflicting same-named invariant declarations.

Dynamic execution of these artifacts remains outside the current change.
