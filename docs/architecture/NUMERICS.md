# Numerics

Current contracts. The local evaluator supports scalar and Quantity expressions,
attribute sums, explicit products, invariant resolution, balance and substructure
composition. Package filtering binds their inputs; package functionals also bind
coefficients and eligible candidates. Missing values and undeclared semantics
fail explicitly. Exact version identifiers and result shapes are exported by
[the kernel](../../packages/kernel/README.md) and its public schemas.

- [Multiplicative SI quantities](#multiplicative-si-quantities)
- [Deterministic decimal arithmetic](#deterministic-decimal-arithmetic)
- [Typed value-expression analysis](#typed-value-expression-analysis)
- [Predicate analysis and compiled plans](#predicate-analysis-and-compiled-plans)
- [Predicate numeric-policy binding](#predicate-numeric-policy-binding)
- [Scientific Oracle request and response validation](#scientific-oracle-request-and-response-validation)
- [Bound local exact-compare predicate evaluation](#bound-local-exact-compare-predicate-evaluation)
- [Exact scalar structural-attribute sums](#exact-scalar-structural-attribute-sums)
- [Unrounded compensated scalar-attribute sums](#unrounded-compensated-scalar-attribute-sums)
- [Quantity-valued structural-attribute sums](#quantity-valued-structural-attribute-sums)
- [Derived Quantity addition](#derived-quantity-addition)
- [Derived Quantity scaling](#derived-quantity-scaling)
- [Element-exact runtime invariant resolution](#element-exact-runtime-invariant-resolution)
- [Local balance evaluation](#local-balance-evaluation)
- [Profile-wide invariant consensus](#profile-wide-invariant-consensus)
- [Package-bound finite functional evaluation](#package-bound-finite-functional-evaluation)
- [Complete coefficient-sensitivity execution](#complete-coefficient-sensitivity-execution)
- [Scalar invariant resolution and candidate-local uncertainty](#scalar-invariant-resolution-and-candidate-local-uncertainty)
- [Package-authored scalar invariant values](#package-authored-scalar-invariant-values)
- [Explicit profile-invariant aggregation](#explicit-profile-invariant-aggregation)
- [Explicit-semantic local Quantity products](#explicit-semantic-local-quantity-products)
- [Formation-functional profile invariants](#formation-functional-profile-invariants)
- [Package-driven scalar candidate attributes](#package-driven-scalar-candidate-attributes)
- [Package-driven Quantity candidate attributes](#package-driven-quantity-candidate-attributes)
- [Role-dependent edge candidate attributes](#role-dependent-edge-candidate-attributes)
- [Package-functional structural-attribute sums](#package-functional-structural-attribute-sums)
- [Formation-functional candidate-attribute carry-forward](#formation-functional-candidate-attribute-carry-forward)
- [Nested substructure invariant resolution](#nested-substructure-invariant-resolution)
- [Functional coefficient-role and sensitivity closure](#functional-coefficient-role-and-sensitivity-closure)
- [Portable Scientific Numeric Reporting](#portable-scientific-numeric-reporting)

<a id="multiplicative-si-quantities"></a>

## Multiplicative SI quantities

The first quantity runtime uses the versioned grammar
`si-multiplicative-v1`. A unit expression is a product or quotient of known
symbols with optional non-zero integer exponents. Whitespace, parentheses,
affine conversions, logarithmic units, arbitrary user symbols, and executable
conversion hooks are excluded.

The registry contains:

- SI bases `m`, `kg`, `s`, `A`, `K`, `mol`, and `cd`;
- `g`, `rad`, `sr`, `Hz`, `N`, `Pa`, `J`, `W`, `C`, `V`, `F`, `ohm`, `S`,
  `Wb`, `T`, `H`, `lm`, `lx`, `Bq`, `Gy`, `Sv`, and `kat`;
- the accepted non-SI units `min`, `h`, `d`, and `L`;
- decimal prefixes from yocto through yotta, written with ASCII `u` for micro.

`1` is the only canonical dimensionless unit. Parsing produces a seven-axis
dimension vector, a multiplicative scale to SI bases, and a canonical base-unit
expression. Expressions are limited to 128 characters, 32 factors, absolute
factor and combined base exponents of 64. The shared exponent ceiling ensures
that every emitted canonical base-unit expression is accepted when parsed
again.

Package quantities and structural candidate attributes normalize to canonical
SI bases before content hashing. Value and absolute tolerance are multiplied by
the same absolute conversion factor; relative tolerance is unchanged.
Quantity specifications normalize their unit expression even when they do not
carry a value.

Unit-scale composition is retained internally as a reduced rational. When the
resulting conversion has a terminating decimal expansion, value and absolute
tolerance are multiplied in `decimal-rational-v1` before a single conversion to
the public binary64 quantity field. This prevents intermediate binary64
products such as `0.1 * 0.1` from separating equivalent SI inputs. A genuinely
non-terminating rational conversion is converted once under the existing
binary64 policy rather than being labelled an exact decimal.

A tolerance is non-empty by value, not merely by property name: at least one
of `absolute` or `relative` must be defined, finite, and non-negative.
Quantity semantics, evidence identifiers, and method identifiers are
normalized and may not carry leading or trailing whitespace. Package
validation performs the same conversion as the normalizer so conversion
overflow is reported as a package validation issue before identity hashing.

Comparison requires dimensional compatibility. It also requires equal semantic
labels unless the caller explicitly selects `semanticPolicy: "ignore"`.
The comparison algorithm is named `declared-max-tolerance-v1` at the public
runtime boundary so compiled numeric bindings can reference it without copying
its implementation.
`require-equal` is selected only when `semanticPolicy` is absent; null, empty,
or otherwise invalid supplied values fail instead of falling through to the
default.
For normalized operands `a` and `b`, the effective tolerance is:

```text
max(
  absolute_a,
  absolute_b,
  relative_a * max(abs(a), abs(b)),
  relative_b * max(abs(a), abs(b))
)
```

`eq` passes inside that closed window, `ne` outside it, strict inequalities
must clear the window, and inclusive inequalities include it. Comparison emits
the normalized values, difference, effective tolerance, raw relation, semantic
policy, and Boolean outcome.

All conversion and comparison operations reject non-finite results. A non-zero
value or absolute tolerance that would underflow to binary64 zero also fails
explicitly, as does a non-zero relative comparison bound that underflows to
zero. Public quantity fields retain the repository's existing binary64 number
policy; the exact rational/terminating-decimal conversion step only removes an
avoidable intermediate-rounding artifact. General expression accumulation is
still governed separately by Deterministic decimal arithmetic.

<a id="deterministic-decimal-arithmetic"></a>

## Deterministic decimal arithmetic

The version `decimal-rational-v1` represents a finite decimal as:

```text
coefficient * 10^(-scale)
```

`coefficient` is a `BigInt` internally and a canonical signed integer string at
the public boundary. Trailing coefficient zeroes are removed together with the
corresponding scale. Zero is always `{ coefficient: "0", scale: 0,
canonical: "0" }`.

Inputs may be normalized decimal strings, finite binary64 numbers, `bigint`
values, or an already validated `DecimalValue`. A number enters the decimal
domain through its ECMAScript shortest round-trippable `toString()` form. This
is deterministic but represents the published binary64 value, not an
unavailable pre-conversion source literal.

The input grammar accepts an optional minus sign, an integer part, an optional
non-empty fractional part, and an optional decimal exponent. Leading integer
zeroes, whitespace, `NaN`, infinity, hexadecimal notation, separators, and
locale formats are rejected.

Addition, subtraction, and multiplication are exact within resource limits.
Division computes the integer coefficient at the declared `decimalPlaces` and
applies the declared rounding rule once. General rounding also occurs once at
the result boundary:

- `toward-zero` discards the remainder;
- `half-up` moves away from zero when the discarded magnitude is at least one
  half;
- `half-even` moves to the nearest value and resolves an exact half toward an
  even retained coefficient.

`exact-decimal` summation aligns powers of ten and accumulates `BigInt`
coefficients. It rounds only the final sum. `compensated-binary64` uses the
Neumaier compensated algorithm in the declared term order, then converts and
rounds the final finite result through the same decimal boundary. The latter is
not labelled exact; callers must supply canonical term order when the source
collection is unordered.

Unrounded compensated scalar-attribute sums separates those phases for nested runtime expressions.
`accumulateDecimals` requires the algorithm explicitly and returns the
canonical unrounded value plus its algorithm-derived exactness state.
`sumDecimals` consumes that artifact internally and retains its existing
policy-bound final rounding behavior.

The fixed resource limits are part of the arithmetic version:

| Limit | Value |
|---|---:|
| input characters | 256 |
| input significant digits | 1,024 |
| result significant digits | 2,048 |
| absolute scale | 1,024 |
| decimal places | 256 |
| power-of-ten exponent | 4,096 |
| summation terms | 100,000 |
| canonical result characters | 4,096 |

Exhausting a limit, dividing by zero, producing a non-finite compensated sum,
or converting a decimal outside finite binary64 produces an explicit
`KernelError` at stage `DECIMAL`. A non-zero decimal that would underflow to
binary64 zero fails with `DECIMAL_NUMBER_UNDERFLOW`; it is not silently
converted to zero. No partial numeric value is returned.

<a id="typed-value-expression-analysis"></a>

## Typed value-expression analysis

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
grammar. A `sum` attribute must have declared numeric metadata; package analysis supplies its explicit numeric registry and fails when the
requested metadata is absent, rather than inferring units from attribute names. A `where` selector may infer a scalar attribute type from its
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

<a id="predicate-analysis-and-compiled-plans"></a>

## Predicate analysis and compiled plans

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

<a id="predicate-numeric-policy-binding"></a>

## Predicate numeric-policy binding

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

<a id="scientific-oracle-request-and-response-validation"></a>

## Scientific Oracle request and response validation

The protocol version is `oracle-protocol-v1`. The public
`createOracleRequestBinding(request)` operation:

- verifies that candidate bytes are a closed canonical candidate payload in
  canonical UTF-8 JSON, reproduce their `onto2d:candidate:v1` hash, and bind
  the correct policy-independent skeleton projection;
- normalizes quantity specifications and quantity-valued parameters to
  canonical SI units;
- requires unique normalized quantity identifiers and sorts specifications by
  ID;
- closes and normalizes solver identity, parameters, and the global tolerance
  target;
- hashes the complete normalized request under `onto2d:oracle-request:v1`.

Candidate JSON bytes are not accepted merely because their JSON encoding and
hash agree. The validator reconstructs graph canonicalization using every
structural attribute present in the payload and rejects alternate node/edge
numberings that would give one logical candidate multiple Oracle request keys.

The request hash includes candidate canonical bytes, requested quantity
specifications, parameters, target tolerance, and solver ID/version/method. It
is the provenance source for every returned Oracle quantity and changes when
any semantic request field changes.

`oracle-response-validator-v1` accepts only a verified request binding. It
requires exact request hash, solver identity, and normalized solver-parameter
matches. Returned quantity IDs cannot exceed the requested set. Every returned
value is normalized and must match its requested unit dimension and semantic;
its provenance must be `oracle`, cite the request hash and solver method, and
contain at least one evidence identifier. When an evidence registry is
supplied, every cited identifier must resolve in it.

A `converged` response must return every requested quantity and each returned
effective tolerance must be no larger than its per-quantity target at the
returned magnitude. Missing values or a violated target contradict the
convergence claim and are integrity errors.

A `failed` response produces a validation result with status `indeterminate`,
reason `oracle-failed`, and no accepted values. A `partial` response must carry
a non-negative residual. The default policy also produces `indeterminate` and
does not consume partial values.

Under `accept-expanded-tolerance`:

- the response must contain every requested value before it can be accepted;
- an optional maximum residual is checked by dimension-compatible,
  tolerance-aware comparison;
- each requested tolerance target is multiplied through exact decimal
  arithmetic by the declared multiplier;
- returned uncertainty must fit inside the expanded target;
- accepted values carry the expanded target, while the artifact records both
  original and effective tolerance.

An incomplete partial response, failed residual guard, or unmet expanded
target remains traceably `indeterminate`; it is not a malformed-response crash
and is never coerced to rejection or a default value.

Semantic response identity uses `onto2d:oracle-response:v1`; validation identity
uses `onto2d:oracle-validation:v1`. `wallTimeMs` remains in the returned
operational record but is excluded from both hashes. Returned diagnostics,
residual, solver metadata, policy, accepted values, adjustments, and reasons
remain content-bound through the response and validation hashes.

Protocol limits cap quantity specifications/results, parameters, evidence
registries, and identifier length. The kernel validates protocol artifacts but
never imports or invokes a scientific adapter.

<a id="bound-local-exact-compare-predicate-evaluation"></a>

## Bound local exact-compare predicate evaluation

`local-predicate-evaluator-v19` accepts a verified `PredicatePlan`, a separately
verified `predicate-numeric-binding-v1`, a candidate, and graph
canonicalization options. It reproduces the plan and numeric binding,
canonicalizes the candidate, and preflights the complete normalized expression
before evaluating any branch.

The supported Boolean layer is `all`, `any`, `not`, every complete graph
operator from Verified graph-predicate evaluation and partial-failure detection, and `compare`. A comparison operand may contain only:

- a JSON scalar constant;
- one direct constant `Quantity`;
- `count` over selected canonical nodes or role-filtered canonical edges;
- `add` and `multiply` whose entire recursively inferred value is a
  dimensionless `number`.

Node and edge count selections use the canonical candidate. An empty selection
has exact count zero. Implicit lifting between a dimensionless `number` and a
dimensionless `Quantity`, cycle-set counts, `sum`, runtime invariants, coefficients,
quantity-valued addition/multiplication, `balance`, and substructure operators
fail the preflight with a stable feature path and reason; they do not produce a
partial evaluation artifact.

The preflight also caps aggregate value-expression nodes and count-selection
witnesses at 10,000 each across the complete plan. This closes the gap between
per-expression analyzer limits and a predicate containing many comparisons;
resource exhaustion emits no partial evaluation artifact.

Dimensionless constants and counts enter `decimal-rational-v1`. Nested
addition and multiplication remain exact, and each comparison operand is
rounded once at the bound `value-expression-result-v1` boundary. Comparisons
use the rounded canonical decimal relation. Structural integer counts remain
exact under every allowed non-negative decimal-place policy.

A direct constant quantity is normalized to canonical SI bases. Rational unit
scales with terminating decimal results are applied in exact decimal arithmetic
before its value is rounded once under the same bound precision policy; the
resulting quantity is compared using `declared-max-tolerance-v1` and the
binding's semantic policy. No derived quantity is constructed, so no tolerance
or provenance propagation rule is implied. String, Boolean, and null
comparisons use the already type-checked `eq`/`ne` relation.

The content-addressed result records the plan hash, numeric-binding hash,
candidate ID, effective graph policy, complete graph/compare witnesses, exact
and rounded decimal operands, direct quantity comparison evidence, and every
canonical node/edge selection used by a count. Its domain is
`onto2d:predicate-local-evaluation:v19`.

The package filter verifies every plan, binds numeric policy from the reproduced
run and evaluates all plans without top-level short-circuiting. Failure dominates
indeterminate; local eligibility is separate from selector admission. Every
required attribute must belong to the bound node or edge alphabet and have a
verified package-derived value; absence fails before evaluation.

<a id="exact-scalar-structural-attribute-sums"></a>

## Exact scalar structural-attribute sums

`local-predicate-evaluator-v19` extends the Bound local exact-compare predicate evaluation evaluator for `sum` over a
node or edge `SetSelector` when the verified predicate plan declares the
attribute as `number`.

- Nodes and edges are selected from the canonical candidate. Node selectors
  retain their existing canonical-index, all, and scalar-where semantics; edge
  role lists retain their normalized semantics.
- Every selected item must own the requested structural attribute and its
  runtime value must be a finite JavaScript number. Missing and mismatched
  values fail with stable errors before an evaluation artifact is emitted.
- Values are parsed into `decimal-rational-v1` and accumulated in increasing
  canonical node or edge index order. The empty sum is exactly zero.
- `exact-decimal` and `compensated-binary64` use their explicit accumulation
  contracts. Compensated sums carry approximate exactness state and fixed order.
- A sum may participate in the already supported dimensionless `add` and
  `multiply` tree. All nested operations remain exact, and the complete
  comparison operand is rounded once at `value-expression-result-v1`.
- At most 5,000 values may enter one aggregation. This specialized limit is
  reached before the general canonical-JSON entry guard for supported graph
  shapes.
- Selection witnesses record the expression path, canonical indexes, optional
  normalized roles, attribute name, and `summation: "exact-decimal"`.

Package filtering
continues to reject a predicate attribute absent from its bound decoration
universe before local execution, comparing node and edge requirements against
their respective structural alphabets.

<a id="unrounded-compensated-scalar-attribute-sums"></a>

## Unrounded compensated scalar-attribute sums

The decimal runtime adds `accumulateDecimals(values, algorithm)` and the
`decimal-unrounded-accumulation` schema. The operation requires one explicit
algorithm, enforces the existing 100,000-term decimal limit, and returns:

- `decimal-rational-v1` as the representation contract;
- the selected `exact-decimal` or `compensated-binary64` algorithm;
- the term count;
- an `exact` Boolean fixed by the algorithm;
- the canonical, unrounded decimal representation of the accumulated result.

Exact accumulation aligns arbitrary decimal coefficients and scales.
Compensated accumulation uses the existing reviewed Neumaier-style binary64
path and converts its final finite result once to a canonical decimal. Binary64
overflow and non-zero underflow remain explicit decimal errors. The operation
does not claim that a compensated result is mathematically exact.

`sumDecimals` is reimplemented on this operation and retains its existing
rounded public artifact and policy semantics.

`local-predicate-evaluator-v19` accepts either bound summation algorithm for a
finite numeric structural-attribute `sum`. The selected values remain ordered
by canonical node or edge index. A numeric evaluated value now distinguishes:

- `unrounded`, the decimal passed to the single result boundary;
- `rounded`, the value after the bound precision policy;
- `exact`, which is false if any nested compensated sum contributed.

Each sum witness records its algorithm and `accumulationExact` flag. Exact
decimal addition and multiplication around an approximate accumulated decimal
cannot promote the enclosing result back to exact.

Quantity-valued sums use the separately defined tolerance and provenance rules
below. Package-authored scalar and Quantity attribute derivations supply values
through their own verified source contracts.

<a id="quantity-valued-structural-attribute-sums"></a>

## Quantity-valued structural-attribute sums

`local-predicate-evaluator-v19` admits a structural-attribute `sum` when the
verified plan declares a Quantity descriptor with both a canonical unit and an
explicit semantic label.

- Selected node or edge values are read in canonical index order under the
  existing 5,000-value limit. Every selected item must contain a valid
  Quantity. Its normalized SI unit and semantic label must match the verified
  attribute descriptor.
- Values accumulate with the bound `exact-decimal` or
  `compensated-binary64` algorithm. The accumulation remains unrounded until
  the `value-expression-result-v1` boundary and exposes its algorithm-derived
  exactness state.
- Input uncertainty is converted to an effective absolute bound per operand:

  ```text
  max(absolute, relative * abs(value))
  ```

  Missing tolerance components contribute zero. These non-negative bounds are
  summed with exact decimal arithmetic in canonical selection order under the
  named `sum-effective-absolute-bounds-v1` policy. The public binary64
  tolerance is rounded outward when its shortest decimal representation would
  otherwise fall below the exact accumulated bound.
- The aggregate Quantity carries only that absolute tolerance. The existing
  `declared-max-tolerance-v1` comparison then combines it with the other
  comparison operand without recursively reinterpreting the source relative
  bounds.
- Aggregate provenance is `computed` with method
  `local-quantity-attribute-sum-v1`. Its evidence is the canonical sorted union
  of selected input evidence identifiers. The evaluation's `candidateId` binds
  the complete source quantities, including declared or Oracle provenance that
  is not flattened into the computed Quantity.
- An empty selection returns typed zero in the descriptor's unit and semantic,
  with zero absolute tolerance and empty computed evidence. A quantity
  attribute without a declared semantic remains unsupported, so empty sums do
  not invent scientific meaning.
- Selection witnesses distinguish scalar and quantity sums. Quantity witnesses
  bind the canonical unit, semantic label, accumulation algorithm and exactness,
  and the tolerance-aggregation policy.

Numeric evaluated values now use the same representation for direct constants
and aggregates: `unrounded`, `rounded`, and an algorithm-derived `exact`
Boolean. The comparison-facing Quantity contains the rounded value plus its
declared or aggregated tolerance and provenance.

Quantity addition, scaling and invariant resolution follow the typed contracts
below. Package-authored scalar and Quantity sources require their own verified
derivation specifications.

<a id="derived-quantity-addition"></a>

## Derived Quantity addition

`local-predicate-evaluator-v19` recursively evaluates Quantity-valued `add`
expressions whose complete operands are direct Quantity constants,
Quantity-valued structural-attribute sums, or other supported Quantity adds.

- Every operand must have the same canonical SI unit and the same explicit
  semantic label. A statically inconsistent or missing semantic fails preflight.
  Implicit lifting between a dimensionless number and a dimensionless Quantity
  remains unsupported.
- Each recursive node carries an unrounded canonical decimal value, an
  algorithm-derived exactness flag, one exact-decimal effective absolute
  tolerance bound, canonical evidence, and canonical selection witnesses.
- Direct constants enter the recursive path through their normalized SI value.
  Their effective absolute bound is
  `max(absolute, relative * abs(value))`.
- A structural sum contributes the value/tolerance result defined by Quantity-valued structural-attribute sums.
  An add sums child values with exact decimal addition and sums child bounds
  with exact decimal accumulation. It cannot become exact again if a nested
  compensated sum made any child approximate.
- No child is rounded. The complete comparison operand rounds once at the
  existing `value-expression-result-v1` boundary. The final public absolute
  tolerance uses the same outward binary64 conversion as Quantity-valued structural-attribute sums.
- A derived result has computed provenance method `local-quantity-add-v1` and
  the canonical sorted union of all child evidence identifiers. Direct
  constants evaluated without arithmetic retain their original declared,
  computed, or Oracle provenance and tolerance shape.

Dimensionless scalar scaling, element-exact invariants and general Quantity
products use distinct typed runtime paths; the package-functional runtime
supports general products under the declared unit grammar.

<a id="derived-quantity-scaling"></a>

## Derived Quantity scaling

`local-predicate-evaluator-v19` recursively evaluates a `multiply` as Quantity
scaling only when exactly one child is Quantity-valued and every other child is
a supported dimensionless number expression. The Quantity child may be a
constant, structural-attribute sum, compatible add, or another supported
scale.

- The result preserves the sole Quantity child's canonical SI unit and explicit
  semantic label. Multiple Quantity-valued children require the explicit product semantic
  contract described below; dimensions alone do not supply scientific meaning.
- Child values remain unrounded. Number children are multiplied with exact
  decimal operations into a point-valued scalar `s`; the Quantity value `v`
  becomes `s * v`. The complete comparison operand still rounds once at the
  existing `value-expression-result-v1` boundary.
- If the Quantity child has effective absolute scientific bound `delta`, the
  scaled bound is `abs(s) * delta`. A negative scalar therefore cannot produce
  a negative tolerance, and an exact zero scalar produces a zero bound.
- The result is exact only when the Quantity child and every scalar child are
  exact. A compensated scalar or Quantity sum propagates `exact: false`.
  Computational approximation remains distinct from declared scientific
  uncertainty and does not acquire an invented error bound.
- The result has computed provenance method `local-quantity-scale-v1` and
  preserves the Quantity child's canonical evidence union. Number expressions
  do not invent scientific evidence. Selection witnesses from all children are
  retained in normalized expression order.
- A multiply containing only number children retains the existing dimensionless
  behavior. Implicit number/Quantity addition remains unsupported.

Element-exact runtime invariant resolution permits the sole Quantity child to
come from an exact element invariant under the same scaling rules.

<a id="element-exact-runtime-invariant-resolution"></a>

## Element-exact runtime invariant resolution

`local-predicate-evaluator-v19` evaluates a Quantity-valued `invariant` only
against an explicit element-exact invariant context.

- The context names the reproduced primitive source-population hash and
  contains exactly one entry for every distinct element reference in the
  candidate. Entries contain the available required invariant names and their
  normalized Quantity values. Unknown elements, extra invariant names, duplicate entries,
  malformed quantities, and context/candidate drift fail before evaluation.
- Package filtering derives this context from the verified
  `primitive-depth-population-v1`; it never accepts caller-substituted package
  values. Direct local-evaluator callers must provide the same explicit context,
  and the resulting artifact binds its source-population hash and resolved
  values.
- An explicit invariant `node` selector must select exactly one canonical node.
  An omitted selector is accepted only for a singleton candidate. Empty or
  multi-node resolution fails instead of selecting an arbitrary element or
  aggregating values.
- The selected element must declare the requested invariant. Its normalized SI
  unit and semantic must match the verified plan symbol. Scalar invariants use the separately typed scalar resolution contract below.
- A direct invariant retains the source Quantity's declared/computed/Oracle
  tolerance and provenance. It enters derived addition and scalar scaling
  through the unrounded path established by Derived Quantity addition and Derived Quantity scaling.
- Every compare witness carries canonical invariant-resolution records with the
  expression path, invariant name, canonical node index, element ID, and
  normalized source Quantity. The local artifact additionally records
  `invariantSourcePopulationHash` whenever invariant resolution is used.
- Profile-quotient invariants require complete class-wide consensus or the
  explicitly declared aggregation policy. A formation representative is never
  a scientific consensus policy.

Runtime coefficients, profile-domain invariant consensus, general Quantity
products, balance, cycle-set selection, and substructure operators remain
unsupported.

Local balance evaluates complete node/edge attribute sums under the same
numeric policy.
Profile-wide invariant consensus adds the separately proved identical-Quantity profile-consensus case;
representative selection remains forbidden for scientific invariant values.

<a id="local-balance-evaluation"></a>

## Local balance evaluation

`local-predicate-evaluator-v19` evaluates `balance` on a complete canonical
candidate for node and edge sets. Cycle-set selection remains unsupported.

- The runtime forms the same synthetic attribute `sum` already verified by the
  predicate analyzer. Selection order, missing-value failures, selected-value
  limits, exact-decimal or compensated-binary64 accumulation, and selection
  witnesses follow Exact scalar structural-attribute sums through Quantity-valued structural-attribute sums.
- The signed aggregate remains unrounded through accumulation and rounds once
  at the bound result boundary. Balance compares the absolute magnitude of that
  rounded aggregate with the normalized non-negative `tolerance.value` using
  `lte`; the tolerance window is closed.
- For a scalar number attribute, the aggregate magnitude is lifted only for
  this comparison into a dimensionless Quantity with zero scientific
  tolerance and the balance tolerance's explicit semantic. The public
  aggregate remains a number, and computational approximation does not invent
  a scientific error bound.
- For a Quantity attribute, values normalize to the plan's canonical SI unit
  and one explicit semantic, and their effective absolute bounds and evidence
  aggregate under `sum-effective-absolute-bounds-v1`. If balance analysis
  inferred a dimensioned attribute without semantic metadata, the balance
  tolerance's explicit semantic supplies the runtime attribute semantic;
  selected values must match it.
- The normalized balance tolerance is the right comparison operand, including
  its own declared/computed/Oracle tolerance and provenance. The aggregate's
  scientific bound and the threshold's scientific bound combine through the
  already bound `declared-max-tolerance-v1` policy. The numeric binding's
  `semanticPolicy` applies to the Quantity comparison.
- An empty supported selection produces the typed zero defined by the existing
  sum contracts. It is not changed to `indeterminate` or treated as missing
  data.
- A balance witness records its expression path, outcome, attribute, signed
  evaluated aggregate, normalized threshold Quantity, tolerance-aware
  comparison, and canonical selection witness. Runtime data errors fail
  explicitly rather than becoming a Boolean verdict.

Package filtering executes balance only when the verified generation binding
provides all required structural attributes; missing data fails the preflight.

<a id="profile-wide-invariant-consensus"></a>

## Profile-wide invariant consensus

`local-predicate-evaluator-v19` admits a Quantity-valued `invariant` for a
`profile-quotient` candidate only through the frozen
`identical-normalized-quantity-v1` consensus policy.

- The explicit invariant context contains the source-population hash, every
  source element belonging to the candidate's referenced profile classes, and
  the exact profile-to-member partition. Profile IDs must equal the distinct
  canonical candidate references. Classes are non-empty and disjoint, and the
  context element IDs must equal their complete member union.
- Invariant selection still resolves exactly one canonical candidate node. An
  omitted selector remains valid only for a singleton candidate.
- Every member of the selected profile class must provide the requested
  invariant. Each value is normalized through the existing multiplicative-SI
  Quantity contract. The complete normalized records must then have identical
  canonical JSON, including value, canonical unit, tolerance, semantic,
  provenance kind/source/method, and evidence.
- Dimensionally equivalent source units may therefore agree after
  normalization. Different tolerance or evidence does not silently agree even
  when nominal values match. This version performs no averaging, tolerance
  union, provenance synthesis, or representative fallback.
- A successful resolution witness records the expression path, invariant name,
  canonical node, profile hash, sorted complete member-element IDs, consensus
  policy, and common normalized Quantity. Element-exact witnesses retain their
  existing element-ID shape.
- Missing member values fail with
  `PREDICATE_LOCAL_INVARIANT_CONSENSUS_UNAVAILABLE` and reason
  `member-values-missing`; any normalized disagreement uses the same error with
  reason `member-values-disagree`.
- Package filtering constructs the context only from the reproduced primitive
  depth population and its verified profile classes. The separately disclosed
  formation representative does not participate in invariant resolution.

Balance witness selections must carry attribute, value-kind, summation-algorithm, and
accumulation-exactness fields. Quantity selections continue to require their
unit, semantic, and tolerance-aggregation policy. The schema and TypeScript type require these fields.

<a id="package-bound-finite-functional-evaluation"></a>

## Package-bound finite functional evaluation

`package-functional-evaluator-v1` evaluates one normalized package functional
for one verified eligible package candidate.

- The evaluator independently verifies the loaded package, reproduces the
  package candidate binding, and exactly reproduces the supplied filter
  artifact from its embedded candidate. A changed filter hash, predicate
  witness, candidate, package, run, or execution limit fails before functional
  execution. A reproduced verdict other than `eligible` is rejected because
  functionals execute only after local filtering.
- The normalized functional expression is reanalyzed under the package's
  complete invariant declarations and normalized coefficient record. Runtime
  expression bytes and the reproduced expression/analysis hashes enter the
  functional artifact.
- The finite runtime supports numeric/Quantity constants, canonical
  node/edge/directed-cycle-edge counts, scalar/Quantity structural-attribute
  sums, Quantity coefficients, element-exact or identical-profile-consensus
  Quantity invariants, addition, and multiplication. Package-functional structural-attribute sums supplies the
  normalized candidate-attribute environment to analysis and freezes shared
  functional/cohort-key sum execution.
- Values remain unrounded through the complete expression and round exactly
  once under the bound run precision policy. A number result is lifted to the
  dimensionless result Quantity. A Quantity result must have the functional's
  analyzed result dimension; its final unit and semantic come from the
  normalized result specification.
- Functional addition may combine dimension-compatible terms with different
  input semantic labels because the authored functional and its result
  specification explicitly declare the synthesized result semantic. The input
  Quantities and evidence remain visible in coefficient/invariant witnesses;
  this does not weaken the stricter same-semantic rule for local predicate
  Quantity addition.
- General multiplication combines canonical units multiplicatively and
  propagates effective absolute interval bounds. For accumulated point `a`
  with bound `da` and next point `b` with bound `db`, the new conservative
  bound is `abs(a) * db + abs(b) * da + da * db`. Computational exactness and
  declared scientific uncertainty remain separate.
- The computed score has provenance method `finite-functional-expression-v1`
  and the sorted union of evidence from constants, coefficients, and resolved
  invariants. Coefficient witnesses record the expression path, coefficient
  name, and normalized source Quantity. Invariant and set-selection witnesses
  reuse the existing canonical local contracts.
- The computed effective absolute bound must meet the functional result's
  declared `toleranceTarget` at the rounded score. If it does not, the artifact
  is `indeterminate` with reason `result-tolerance-target-unmet` and exposes the
  diagnostic calculation but no score eligible for ranking.
- Missing or ambiguous invariant resolution and unavailable/disagreeing
  profile member values also produce a content-addressed `indeterminate`
  artifact with a stable reason and details. Invalid package, binding, filter,
  expression, unit, or coefficient state remains a hard contract error.

The artifact is hashed in
`onto2d:package-functional-evaluation:v1`. It records package/rules/binding,
filter/candidate, functional/expression/analysis identities, result
specification, run precision, status, score or indeterminate reason, diagnostic
calculation, and complete witnesses. Operational timing is excluded.

<a id="complete-coefficient-sensitivity-execution"></a>

## Complete coefficient-sensitivity execution

`package-selector-sensitivity-evaluator-v1` consumes an independently
reproduced complete base selector ranking.

- A sensitivity run replays the package, census, cohort partition, and base
  ranking. It accepts neither caller-provided base leaders nor perturbed
  scores.
- `one-at-a-time` creates, for each amplitude, the negative and positive
  multiplicative variant of every listed coefficient. `cartesian` creates the
  complete lexicographically ordered sign product over all listed
  coefficients. Factors are calculated exactly as `1 - amplitude` and
  `1 + amplitude` before conversion to normalized coefficient Quantities.
- A positive factor scales the coefficient value and absolute tolerance;
  relative tolerance and provenance remain unchanged. Unlisted coefficients
  remain byte-equivalent to their normalized package values.
- The complete number of variants is checked before evaluation against the
  run's `perturbationSamples` budget and a separate hard functional-evaluation
  ceiling. An insufficient budget emits an indeterminate report and performs
  no partial sweep. Required counts beyond the JSON safe-integer range remain
  exact canonical decimal strings in the report.
- Each variant evaluates every member of every reproduced cohort through a
  prepared verified functional session, then applies the same dense-ranking,
  epsilon-extremum, gap, and indeterminacy semantics as the base ranker. Full
  perturbed cohort rankings and coefficient witnesses remain in the artifact.
- Each variant identifier binds the package/rules and base-ranking hashes in
  addition to the selector, functional, amplitude, sweep, and direction
  definition, so a perturbation cannot be mistaken for the same variant under
  another semantic basis.
- For each amplitude the comparison denominator is exactly
  `requiredVariants * rankedCohorts`. Leader-set stability counts exact equality
  of complete sorted semantic-extremum sets. Presentation-leader stability
  compares the deterministic first presentation member. Top-K stability
  compares the sorted set of the first `min(topK, cohortSize)` score-ordered
  members.
- If a base ranking is indeterminate or any required perturbed cohort is
  indeterminate, the report is indeterminate and stability ratios are `null`;
  evaluated variants remain inspectable and the denominator is not reduced.
  An empty base ranking or an empty `sensitivityCoefficients` list is explicit
  `not-applicable`, not false robustness.
- A complete verdict is `robust` only when every amplitude meets both the
  leader-set and top-K thresholds. Otherwise it is `fragile`.
- The artifact binds every prerequisite hash, normalized policy, coefficient
  list, exact variant definition, perturbed ranking, comparison, denominator,
  execution budget, point, verdict, and reason in
  `onto2d:package-selector-sensitivity:v1`. Stored reports require exact replay.

<a id="scalar-invariant-resolution-and-candidate-local-uncertainty"></a>

## Scalar invariant resolution and candidate-local uncertainty

`local-predicate-evaluator-v19` executes scalar invariant symbols supplied
through the explicit local invariant context.

- `number` values must be finite, normalize negative zero to zero, participate
  in the existing exact-decimal arithmetic path, and round only at the bound
  operand boundary.
- `string`, `boolean`, and `null` values retain their exact JSON scalar value
  and are executable only through the comparisons admitted by the verified
  typed expression.
- Context values must match the verified invariant descriptor exactly. A type
  mismatch remains `PREDICATE_LOCAL_INVARIANT_CONTEXT_INVALID`.
- Successful witnesses record either a normalized Quantity or a typed scalar
  `valueKind` and `value`. Exact-element witnesses retain the source element.
  Profile scalar witnesses require identical canonical scalar values from
  every class member and bind `identical-normalized-scalar-v1`; Quantity
  witnesses retain `identical-normalized-quantity-v1`.
- Package-authored scalar invariant values accepts the same scalar value kinds
  in schema-v1 primitive and
  materialized-element invariants and carries them through package runtimes.

Four resolution failures now produce a candidate-local `indeterminate`
comparison witness rather than aborting evaluation:

- `invariant-node-ambiguous`;
- `invariant-value-unavailable`;
- `profile-invariant-member-values-missing`;
- `profile-invariant-member-values-disagree`.

Both comparison operands are evaluated so that up to two invariant failures
can be retained in deterministic left/right order. Each failure records its
operand, stable reason, and the original structured resolution details. The
indeterminate witness deliberately omits fabricated operand values,
comparisons, selections, and successful invariant resolutions. All other
errors—including malformed contexts, stale bindings, type mismatches,
Quantity unit/semantic mismatches, and resource exhaustion—remain hard
failures.

Package filtering therefore classifies these local results as
`filter-indeterminate`, and complete candidate censuses retain them in their
existing denominator and threshold accounting. No averaging, representative
substitution, interval union, or non-identical profile aggregation is added.

The local evaluator and identity domain move to
`local-predicate-evaluator-v19` and
`onto2d:predicate-local-evaluation:v19`. The depth-one package filter embeds
the changed local artifact and moves to
`package-candidate-filter-evaluator-v20` and
`onto2d:package-candidate-filter:v20`.

<a id="package-authored-scalar-invariant-values"></a>

## Package-authored scalar invariant values

Schema-v1 `PrimitiveDefinition.invariants` and `Element.invariants` admit one
`InvariantValue = Quantity | number | string | boolean | null` per normalized
invariant name.

- Numeric values must be finite and normalize negative zero to zero.
- String values retain their exact content and are limited to 1,024 UTF-16 code
  units, matching the typed-expression ceiling.
- Boolean and null values retain their exact JSON representation.
- Quantity values keep the existing SI normalization, tolerance, semantic,
  provenance, and evidence rules.
- Arrays and other composite values are rejected. Package validation reports
  stable scalar-value issues before identity construction.
- Every declaration with the same invariant name must have the same runtime
  kind. Quantity declarations additionally require the same dimensions and
  semantic label. Number and dimensionless Quantity remain different kinds.
- Primitive identity includes the normalized scalar value. Quantity identity
  continues to exclude evidence provenance, while the complete normalized
  package still includes it.

One internal invariant normalizer supplies package loading, expression-symbol
construction, runtime kind checks, and identity projection. Materialized
primitive elements therefore carry the normalized values without an adapter-
specific representation.

The existing package runtimes consume the extended values as follows:

- `package-candidate-filter-evaluator-v20` supplies package-authored values to
  `local-predicate-evaluator-v19`; exact and identical-profile scalar
  comparisons use the Scalar invariant resolution and candidate-local uncertainty witnesses and candidate-local indeterminacy.
- `package-functional-evaluator-v1` admits numeric scalar invariants into exact
  number arithmetic. String, Boolean, and null values remain non-numeric and
  therefore cannot become functional scores unless used by a future typed
  functional form. Runtime witnesses retain `valueKind` and `value`.
- `package-cohort-partitioner-v1` admits all scalar kinds as exact
  `shared-support` or ordered `profile-role` atoms. `invariant-window` remains
  numeric/Quantity-only by its analyzed rule contract.
- Profile-quotient resolution validates every member against the reproduced
  descriptor before testing canonical equality. It binds
  `identical-normalized-scalar-v1` for scalars and never substitutes the
  representative element.

`Profile.invariantVector` remains Quantity-valued, so derived elements may
continue to expose only Quantity invariants until a separate formation-
dependent scalar derivation contract exists. Non-identical profile
aggregation is not introduced.

The package, functional, cohort, and filter identity domains do not change.
This is an additive accepted-input extension: every package accepted before
this decision retains identical normalized bytes and runtime artifacts, while
scalar values must be validated before a package identity is assigned.
Their normalized scalar values and typed witnesses are already included in the
existing hashed bases.

<a id="explicit-profile-invariant-aggregation"></a>

## Explicit profile-invariant aggregation

An invariant `ValueExpression` may opt in with:

```json
{
  "kind": "invariant",
  "name": "length",
  "profileAggregation": "arithmetic-mean-conservative-v1"
}
```

Omitting `profileAggregation` preserves strict identical normalized consensus.
The policy is valid only for declared `number` and `Quantity` invariant types.
String, Boolean, and null invariants remain consensus-only. In an
`element-exact` candidate the expression resolves the selected element
unchanged; aggregation applies only to a complete `profile-quotient` class.

Every profile member MUST provide the invariant. Missing values remain a
candidate-local `indeterminate` result. Every supplied value MUST match the
reproduced symbol descriptor. Quantity members MUST already share the
descriptor's canonical unit and semantic label; type, unit, or semantic drift
is a hard error. The policy never drops a member, substitutes a representative,
or coerces a nonnumeric scalar.

Member IDs are processed in canonical sorted order. Point values are summed by
`exact-decimal` arithmetic and divided by the member count under the bound
run's invariant precision (`decimalPlaces` and `rounding`). The witness records
the complete precision policy, member count, exact summation method, rounded
mean as a `DecimalValue`, and whether the division was exact. Predicate numeric
bindings inventory this as `profile-invariant-arithmetic-mean` with
`arithmetic` and `precision` policy references.

For a Quantity member `i`, let `b_i` be its effective absolute bound, the
maximum of its declared absolute tolerance and `relative * abs(value)`. The
aggregate point is the arithmetic mean. Its conservative absolute tolerance is
the sum of:

```text
outward(sum(b_i) / n)
+ one decimal quantum when point division is inexact
+ decimal-to-reported-number conversion displacement
```

The first division is rounded upward at the decimal runtime's maximum supported
256 places. This makes no independence or cancellation assumption. Evidence is
the canonical sorted union of all member evidence. The resulting Quantity uses
computed provenance method `profile-invariant-arithmetic-mean-v1`; its witness
uses uncertainty policy `mean-effective-bounds-plus-rounding-v1` and records
the effective decimal bound and evidence union.

The same shared aggregation runtime is used by local predicate evaluation,
package functionals, and cohort-key construction. Exact/profile basis,
consensus/aggregation policy, aggregate diagnostic, and result value are all
retained in published witnesses. The changed local artifacts use
`local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`.

<a id="explicit-semantic-local-quantity-products"></a>

## Explicit-semantic local Quantity products

A `multiply` value expression may declare `resultSemantic`:

```json
{
  "kind": "multiply",
  "resultSemantic": "work energy",
  "factors": [
    { "kind": "constant", "value": { "...": "force Quantity" } },
    { "kind": "constant", "value": { "...": "length Quantity" } }
  ]
}
```

The field is a normalized non-empty string. It is permitted only when the
multiply node has at least two directly Quantity-valued operands. A single-
Quantity scale continues to preserve that operand's semantic and rejects a
semantic override. A nested Quantity product closes its own semantic boundary;
if it is later multiplied by another Quantity, the outer multiply node also
requires its own `resultSemantic`.

Value-expression analysis adds dimensions exactly as before and records the
declared result semantic in the inferred type, normalized expression, and
content hashes. An expression with multiple Quantity operands but no
`resultSemantic` remains analyzable for contexts such as package functionals,
whose result specification supplies the meaning, but it fails local-predicate
runtime preflight. Thus the field is explicit where local execution needs it
without creating two equivalent spellings for ordinary scalar scaling.

Local evaluation multiplies all point values in canonical factor order with
exact decimal arithmetic. Units multiply through `si-multiplicative-v1`. For
current accumulated point `x` and absolute bound `a`, and next point `y` and
bound `b`, the next conservative bound is:

```text
abs(x) * b + abs(y) * a + a * b
```

This is the full interval-product envelope and makes no sign or independence
assumption. Exactness is the conjunction of factor arithmetic exactness;
evidence is the canonical union of Quantity-factor evidence. The emitted
Quantity has computed provenance method `local-quantity-product-v1` and the
declared `resultSemantic`. Scalar-only factors have zero uncertainty. Rounding
still occurs once at the existing operand result boundary.

Package functionals retain their existing general-product behavior and result-
specification semantic source. Missing `resultSemantic` remains rejected only
at the local-predicate support boundary. The changed local artifacts use
`local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`.

<a id="formation-functional-profile-invariants"></a>

## Formation-functional profile invariants

Add the opt-in `profileDefinition.kind = "residual-slots-v2"`. It retains the
v1 base profile, residual-slot, derived-type-tag, and claim semantics and adds
a canonical `derivedInvariants` list. Each entry binds:

- one unique profile `semantic` not present in the base invariant vector;
- one declared package `functional`;
- one positive normalized `quantization` Quantity.

At package load, the functional reference must resolve, its result semantic
must equal the profile semantic, and its result unit must be dimensionally
compatible with the quantization unit. Quantization semantic must also match.
Definitions are normalized by semantic and functional ID and remain part of
the rules and package hashes.

`package-derived-profile-extractor-v3` evaluates every declared functional for
every selected formation against that formation's already reproduced eligible
filter and exact package/run binding. A scored result becomes the normalized
profile coordinate; its declared quantization is retained. The output embeds
every complete functional-evaluation artifact, and its claim/evidence union
includes the functional result, functional claims, quantization, base profile,
definition, and formation lineage.

Evaluation is all-or-nothing. Every declared functional is executed even when
another is indeterminate. If any result is indeterminate, the formation emits
`profile-derived-invariant-indeterminate`, the complete list of evaluation
hashes/reasons, no capacity consumptions, no profile, and therefore no partial
derived population. Successful derived coordinates are composed with the base
invariant vector before the profile and element identities are computed.

`residual-slots-v1` remains accepted and produces no functional-derived
coordinates. Generic slot guards, formation-derived ontology coordinates,
formation-derived type rules beyond the existing fixed type tags, and derived
candidate structural attributes remain separate contracts. Formation-derived type classification
defines the former with Quantity-threshold rules over these exact
derived coordinates.

<a id="package-driven-scalar-candidate-attributes"></a>

## Package-driven scalar candidate attributes

Rule packages now normalize a closed, rules-hash-bearing
`candidateAttributes` registry. Version 1 contains two derivation sources:

- `constant-scalar-v1` assigns one finite JSON scalar to every selected node or
  every selected edge variant;
- `element-invariant-scalar-v1` copies one package-authored scalar invariant to
  a node variant and requires that invariant on every primitive at package
  load and every selected source element at generation time.

Attribute names are globally unique. A normalized RunConfig structural node or
edge attribute must resolve to a definition with the same target. Only selected
definitions enter the finite alphabet and therefore candidate identity.
Definitions are also supplied as the attribute type environment when package
predicates, functionals, and cohort expressions are compiled.

In `element-exact`, each node variant receives its exact source element value.
In `profile-quotient`, every member of the complete profile class must have the
same canonical scalar value. Member-dependent values fail the binding with
`PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE`; a representative is never
used as a shortcut. Missing values at a generalized or current-level source
also fail before partial enumeration.

Edge v1 attributes are constant because an edge has no single source element.
Quantity-valued constants/invariants remain a separate contract defined by [Package-driven Quantity candidate attributes](#package-driven-quantity-candidate-attributes).
Role-dependent edge derivations are defined by
[Role-dependent edge candidate attributes](#role-dependent-edge-candidate-attributes).
Formation-functional carry-forward is defined by
[Formation-functional candidate-attribute carry-forward](#formation-functional-candidate-attribute-carry-forward).
Dynamic
type classification is defined under Formation-derived type classification.

The extended finite universe is published as `package-candidate-binding-v2`,
`package-depth-candidate-binding-v2`, and
`package-current-level-candidate-binding-v2`; their generators are v5, v3, and
v3 respectively. Existing predicate pruning may consume the resulting
canonical partial graphs, but it receives no new authorization merely because
an attribute is present.

<a id="package-driven-quantity-candidate-attributes"></a>

## Package-driven Quantity candidate attributes

The normalized `candidateAttributes` registry accepts two additional closed
source kinds:

- `constant-quantity-v1` assigns one normalized Quantity to every selected
  node or edge variant;
- `element-invariant-quantity-v1` copies one normalized Quantity invariant to
  an exact node variant. It is node-only and requires the named Quantity on
  every primitive at load time and every selected generalized/current-level
  source element at binding time.

Constant quantities are normalized through the same SI unit, tolerance,
semantic, and provenance rules as all other package values. Their evidence IDs
must resolve in the package evidence registry. Element-invariant definitions
must reference object-valued Quantity invariants; the scalar and Quantity
discriminators cannot be interchanged. Both source kinds enter the rules hash
and provide Quantity type metadata to predicate, functional, and cohort
expression analysis.

`element-exact` binds each exact element's complete normalized value. A
`profile-quotient` node variant is admitted only when every member of the
complete profile class has the same canonical normalized Quantity, including
provenance. Disagreement fails before enumeration with
`PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE`; the disclosed class
representative is never substituted for consensus.

A Quantity selected as a structural graph attribute contributes its complete
normalized record, including provenance, to candidate canonicalization. Thus
equal physical values with different evidence IDs have distinct candidate
identities. Derived-element identity keeps its existing structural projection:
value, unit, tolerance, and semantic remain structural while evidence
provenance is retained in the derivation index rather than the element ID.
Consequently distinct provenance-complete candidate derivations may reconcile
to one derived element without losing their formation records. This is an
intentional boundary, not an accidental omission.

Primitive, arbitrary-depth, and bounded current-level bindings share the same
variant derivation function. The existing binder and generator version labels
remain unchanged because their artifact layout, canonicalization algorithm,
and execution policy do not change; the new source discriminators and values
are already identity-bearing through the package rules hash and binding input.

Role-dependent edge sources are defined by
[Role-dependent edge candidate attributes](#role-dependent-edge-candidate-attributes).
Formation-functional candidate attributes are not inferred from this decision
and remain fail-closed at this boundary; Formation-functional candidate-attribute carry-forward defines their acyclic
next-depth carry-forward path.

<a id="role-dependent-edge-candidate-attributes"></a>

## Role-dependent edge candidate attributes

The normalized `candidateAttributes` registry accepts two edge-only sources:

- `edge-role-scalar-v1` contains a non-empty finite `values` map from role ID
  to one JSON scalar;
- `edge-role-quantity-v1` contains a non-empty finite `values` map from role ID
  to one normalized Quantity.

Role IDs are normalized identifiers and maps are limited to 256 entries. Every
scalar entry in one map must have the same JSON scalar type. Every Quantity
entry must have compatible SI dimensions and one semantic; individual
tolerances and evidence provenance may differ and remain part of the selected
value. Quantity evidence references close through the package evidence
registry. Authored map order is non-semantic.

A selected role-dependent definition must cover every role in the normalized
RunConfig `roleAlphabet`. Missing coverage fails binding before enumeration
with `PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_UNAVAILABLE`. Extra package roles remain
identity-bearing rules but do not enter a run that did not select them. Node
targets are invalid because a node has no unique generating edge role.

Edge variants are derived independently for each normalized run role. The
selected scalar or complete normalized Quantity participates in candidate
canonicalization exactly like constant decorations. Primitive, profile-
quotient, arbitrary-depth, and bounded current-level bindings share the same
variant derivation and coverage check.

The attribute map contributes one homogeneous expression type to package
analysis. This decision does not enable same-candidate formation-functional
decoration or lift any separately fail-closed structural-sum runtime boundary.

Existing binding and generator version labels remain unchanged: artifact
layout and traversal do not change, while the new source discriminator, map,
rules hash, and resulting edge variants already disclose the semantic
expansion.

<a id="package-functional-structural-attribute-sums"></a>

## Package-functional structural-attribute sums

The verified package value runtime executes structural `sum` expressions over
the canonical node, edge, or directed-cycle selection returned by the existing
set-selector contract.

For numeric scalar attributes, values accumulate in canonical selection order
under the RunConfig summation policy. `exact-decimal` is exact;
`compensated-binary64` remains explicitly approximate. Missing, non-finite, or
wrongly typed selected values are hard replay errors because a verified binding
must already have fixed the candidate attribute alphabet.

For Quantity attributes, every selected value is normalized and must match the
analyzed canonical unit and semantic. Values use the run summation policy,
effective absolute tolerance bounds add exactly, and evidence IDs form a
canonical union. The selection witness records attribute, value kind,
summation algorithm, exactness, unit, semantic, and
`sum-effective-absolute-bounds-v1` tolerance aggregation.

The same runtime serves package functionals and evaluated cohort-key
expressions. Formation-derived profile functionals can therefore materialize
verified invariants from candidate structural sums at primitive, generalized-
depth, and current-level closure boundaries.

`package-functional-evaluator-v1` remains the artifact label because the
published expression and selection-witness schemas already included this
operation and its exact output shape; this decision closes a fail-closed
execution branch without changing artifact layout or existing evaluations.

This decision does not feed new attributes back into the same formation being
scored. Formation-functional candidate-attribute carry-forward defines an acyclic later-depth carry-forward
contract through derived profile and `Element` invariants.

<a id="formation-functional-candidate-attribute-carry-forward"></a>

## Formation-functional candidate-attribute carry-forward

Formation-functional candidate attributes use this next-depth carry-forward
pipeline. No same-candidate `formation-functional-*` candidate-attribute source
kind is introduced.

A carried Quantity is identified by one invariant name/semantic across the
three declared boundaries:

1. the primitive invariant fixes the candidate-attribute expression type;
2. a `residual-slots-v2` or `residual-slots-v3` derived-invariant definition
   binds that semantic to one package functional and compatible quantization;
3. `element-invariant-quantity-v1` copies the resulting derived `Element`
   invariant into node variants at later generalized depths or current-level
   rounds.

The loader rejects a matched carry-forward path when its primitive and
formation-functional Quantity dimensions or semantics disagree. The candidate
binder also requires every selected source element to expose one identical
runtime type descriptor: JSON scalar kind, or Quantity canonical unit and
semantic. This detects drift before enumeration and before a partial candidate
universe exists.

The full computed Quantity, including uncertainty and functional evidence,
enters next-depth candidate identity under Package-driven Quantity candidate attributes. Derived-element identity
continues to project evidence provenance into the separate derivation index.
Profile-quotient generation still requires complete canonical member
consensus.

<a id="nested-substructure-invariant-resolution"></a>

## Nested substructure invariant resolution

An invariant below a substructure combinator is a constituent invariant of the
node selected in the currently evaluated canonical graph. It is resolved from
the same immutable, source-population-bound invariant context as the whole
candidate.

The following rules are normative:

1. Every node selector is reevaluated against each canonical retained,
   constituent, or perturbed graph. A `canonical-index` selector therefore
   addresses that graph, not the parent graph.
2. Resolution uses the selected node's retained `ref`. Node removal makes only
   that removed reference unavailable; retained references keep their original
   values.
3. Edge deletion, edge-role replacement, and structural numeric-attribute
   displacement do not recompute or mutate constituent invariants.
4. `element-exact` resolution still requires the exact source element.
   `profile-quotient` resolution still requires complete class membership and
   either identical normalized consensus or an explicitly declared supported
   aggregation policy. A representative is never a value shortcut.
5. Missing values, a selector resolving zero or multiple nodes, and profile
   disagreement remain structured `indeterminate` comparison evidence.
   Malformed contexts and type, unit, or semantic drift remain hard errors.
6. Existing whole/substructure witnesses retain the nested invariant witness
   together with canonical-to-parent mappings, so the selected source can be
   audited after each canonicalization.
7. A local artifact with invariant requirements binds the sorted non-empty
   `invariantNames` list alongside `invariantSourcePopulationHash`. This keeps
   the dependency explicit even when every stability attempt is skipped and no
   nested comparison witness is produced.

No graph-dependent invariant recomputation, missing-node imputation, profile
subset aggregation, or mutation of the bound invariant context is introduced.

The changed artifacts use `local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`.

<a id="functional-coefficient-role-and-sensitivity-closure"></a>

## Functional coefficient-role and sensitivity closure

`Functional` accepts an optional closed `coefficientRoles` record with one of
`fixed`, `free`, or `fitted` for each declared coefficient.

When the record is explicit, the loader requires:

- exactly one valid role for every declared coefficient;
- no role for an undeclared coefficient;
- `sensitivityCoefficients` to equal exactly the set of all `free` and
  `fitted` coefficients.

For backward-compatible schema-v1 inputs that omit `coefficientRoles`, the
package syntax itself supplies the declaration: each named sensitivity
coefficient normalizes to `free`, and every other coefficient normalizes to
`fixed`. Omission therefore selects the declared default role. All normalized
functionals carry the complete sorted role record, and the rules/package/run
hash chain binds it.

The kernel does not infer whether an author's scientific role assertion is
true; that remains reviewable package content, like coefficient provenance.
It does prove that the executable sweep is complete for the asserted roles.

<a id="portable-scientific-numeric-reporting"></a>

## Portable Scientific Numeric Reporting

- Introduce `portable-numeric-reporting-v1` only through solver version 2 and
  new model and analysis domains.
- Represent any successfully converged Newton residual below the declared
  tolerance as that tolerance, explicitly meaning an upper bound rather than a
  measured machine-noise remainder.
- Quantize other approximate scalar results on a model-declared absolute grid
  before Oracle serialization and canonical hashing.
- Quantize visualization traces separately because their display precision is
  not a scientific measurement precision.
- Exclude raw symmetric and antisymmetric objecthood `LDL` minimum pivots from
  identity-bearing quantities. Preserve the stable positive-definite flags and
  Rayleigh witnesses used by the declared gates.
- Preserve every v1 and integrated v2 model, runner, and artifact. Publish new
  objecthood, dynamics, and expanded-search v2 artifacts and bind them into a
  new integrated Level-0 v3 contract.
