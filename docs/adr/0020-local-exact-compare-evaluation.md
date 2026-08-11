# ADR-0020: Bound local exact-compare predicate evaluation

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0017 executes verified graph-only plans, ADR-0010 freezes the numeric
policy for a reusable predicate plan, and ADR-0019 combines graph evaluation
with package/run candidate-universe verification. The next local-filter step is
numeric execution, but the complete `ValueExpression` grammar does not yet
have enough runtime contracts to execute honestly:

- an invariant without a unique node-resolution rule has no unambiguous
  candidate value;
- schema-v1 does not bind general attribute values and types into generated
  candidates;
- coefficient binding belongs to functional and sensitivity execution;
- cycle-set selection has no frozen canonical set meaning;
- addition or multiplication of measured quantities needs an explicit rule for
  propagating leaf tolerances and provenance;
- `balance` depends on those attribute-selection and derived-quantity rules.

Treating these gaps as defaults would make numeric verdicts depend on hidden
runtime choices. A useful smaller subset is nevertheless completely determined
by the existing graph, decimal, quantity, and numeric-binding contracts.

## Decision

`local-predicate-evaluator-v1` accepts a verified `PredicatePlan`, a separately
verified `predicate-numeric-binding-v1`, a candidate, and graph
canonicalization options. It reproduces the plan and numeric binding,
canonicalizes the candidate, and preflights the complete normalized expression
before evaluating any branch.

The supported Boolean layer is `all`, `any`, `not`, every complete graph
operator from ADR-0017, and `compare`. A comparison operand may contain only:

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
`onto2d:predicate-local-evaluation:v1`.

`package-candidate-filter-evaluator-v2` supersedes the graph-only v1 filter. It
first verifies all top-level plans are in the local executable subset, derives
one numeric binding per plan from the reproduced run's `invariantPrecision`,
and evaluates all plans without top-level short-circuiting. The expanded filter
artifact uses `onto2d:package-candidate-filter:v2`. Failure still dominates
indeterminate, and local eligibility still does not imply selector admission
or derived-element materialization. Before evaluation, the package filter also
requires every plan attribute to exist in the bound structural node-attribute
alphabet. Because package-driven generation currently rejects non-empty
structural attribute alphabets, an attribute selector is blocked explicitly
instead of interpreting missing candidate data as an empty selected set.

## Consequences

- useful exact comparisons now execute without claiming that the entire
  numeric grammar is implemented;
- changing run precision changes the numeric binding and local evaluation
  identity, and may change a rounded verdict;
- candidate relabeling cannot alter count selections, witnesses, or evaluation
  identity;
- graph-only callers retain the narrower ADR-0017 evaluator, while package
  filtering consistently emits the new local evaluation contract;
- complete runtime invariant/attribute/coefficient binding, compensated sums,
  balance, derived-quantity uncertainty, and substructures remain pending;
- adding any currently rejected feature requires a new reviewed runtime
  contract and, if artifact semantics change, a version/domain change.

## Verification

Fixtures cover mixed graph and comparison plans, canonical node/edge counts,
exact nested arithmetic, boundary-only half-even rounding, precision-dependent
verdicts, canonical SI conversion, declared quantity tolerance, scalar
equality, candidate relabeling invariance, binding-hash reproduction, stale
binding rejection, SI-equivalent decimal-prefix regression, package-filter
attribute-availability preflight and integration, and explicit rejection of
runtime invariants, implicit number/quantity lifting, quantity arithmetic, and
balance, plus aggregate runtime-limit exhaustion.
