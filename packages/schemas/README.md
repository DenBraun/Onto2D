# `@onto2d/schemas`

Machine-readable JSON Schema Draft 2020-12 contracts for rule-package inputs,
normalized quantities, canonical decimals, accumulation results, and evidence,
primitives/profiles, typed value and Boolean expressions, predicates,
compiled predicate plans and numeric-policy bindings,
functionals/cohorts/selectors, scientific-Oracle requests, request bindings,
responses, and validation results, source migration,
frozen source-classification policies, independent annotations, blind
adjudication, and node-resolution policies,
canonical candidates/skeletons, enumeration/store state, run configuration,
and reproducibility artifacts.

Quantity and quantity-spec unit fields use the lexical subset of the
`si-multiplicative-v1` grammar. Runtime validation additionally checks the
symbol registry, dimensional exponents, conversion range, and compatibility.
Tolerance objects require at least one bound. Quantity semantic, evidence, and
method identifiers use normalized non-empty strings, matching the direct
runtime contract. Candidate and skeleton indices are limited to JavaScript
safe integers, and canonical skeleton edge tuples are unique.
Run precision policies select the bounded `decimal-rational-v1` rounding and
summation behavior; schema validation limits `decimalPlaces` to the runtime
maximum but does not execute arithmetic.
The recursive value-expression contract fixes every supported node and
selector shape. Executable analysis additionally resolves declared symbols,
infers dimensions, applies resource limits, and checks result compatibility.
Schema-v1 bounds scalar strings to the analyzer ceiling and canonical node
indices to the JavaScript safe-integer range.
The Boolean-expression schema fixes all built-in and substructure combinator
shapes. Runtime analysis additionally resolves data/perturbation references,
checks comparison and balance dimensions, and derives conservative pruning
facts; the predicate-plan schema records the resulting compiled contract.
The predicate numeric-binding schema records a verified plan identity, one
normalized run precision policy, canonical summation order, versioned
quantity-comparison behavior, and the numeric operations that consume them.
The Oracle binding/result schemas separate normalized semantic request and
response identities from operational wall time and record accepted versus
indeterminate convergence handling.
The source-policy schemas record complete category/disposition vocabularies,
authorship and exposure declarations, a closed classification-visible local
field vocabulary, realizable classifier bounds, risk thresholds, forbidden
inputs and criteria, and lossless edge/cluster invariants. Runtime freezing
additionally checks cross-field exposure coherence, required inputs, and
canonical set ordering; schema validity alone does not authorize a catalogue
decision.
The annotation/adjudication schemas retain the complete classifier-by-relation
matrix, view identity, exposure declarations, raw disagreement, final decisions,
ordered freeze/unblinding times, and disagreement-risk metrics. Runtime
freezing reproduces the upstream policy and annotation hashes and prevents
unanimous results from being silently overwritten.
The classification-view schema binds the exact policy-visible relation payload.
The classified-relations schema preserves every final typed edge and both
directed SCC partitions, including full component membership, internal edge
references, self-loop cyclicity, and upstream policy/view/annotation hashes.

The schemas are a versioned contract surface aligned with the first executable
kernel loader. Passing schema validation is necessary but does not prove
scientific validity or kernel conformance; cross-record references,
stratification, phase acyclicity, structural identity, and other invariants are
executable checks in the kernel and adapters.
