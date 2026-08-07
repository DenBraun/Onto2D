# ADR-0011: Scientific Oracle request and response validation

Status: implemented decision; no solver execution

## Context

The graph kernel must consume externally computed scientific quantities without
embedding a PDE, variational, field-integration, or stability solver. A schema
alone cannot prevent a stale response, changed solver version, altered
parameters, incompatible unit, missing result, unbound evidence source, or
unreviewed partial result from entering predicate or functional evaluation.

The Oracle boundary therefore needs executable request identity and response
validation before any expression evaluator calls an adapter.

## Decision

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

## Consequences

- solver upgrades, method changes, parameter drift, and stale caches fail before
  values reach evaluation;
- compatible unit spellings converge to one request identity;
- external evidence is tied to the exact request and method;
- failed and unapproved partial work remains reportable but scientifically
  unconsumable;
- timing differences do not contaminate semantic cache identity;
- the global request tolerance remains solver protocol input, while executable
  value acceptance uses dimensioned per-quantity targets and an optional
  dimensioned residual guard;
- expression dependency resolution and propagation of accepted/indeterminate
  Oracle values remain separate future evaluator work;
- changing normalization, target comparison, partial acceptance, evidence
  binding, limits, or hash payloads requires a new protocol/validator version.

## Conformance artifacts

- compatible-unit and parameter-order request identity;
- canonical candidate byte/hash verification and duplicate quantity rejection;
- converged value, solver, parameter, unit, semantic, tolerance, provenance,
  and evidence validation;
- failed and default-disallowed partial indeterminate results;
- exact expanded-tolerance acceptance and maximum-residual rejection;
- stale request, solver drift, missing result, and evidence mismatch failures;
- wall-time-independent response and validation hashes;
- JSON Schema, TypeScript, public-kernel, and capability declarations.
