# ADR-0097: External Level-0 Phase-B solver boundary

Status: implemented decision

## Context

The Phase-B reference solver implemented the scientific-adapter contract but
lived inside one case directory. That made its numerical identity replayable,
but not independently publishable or replaceable as a package.

## Decision

The unchanged `onto2d-level-0-reference-solver@1.0.0` method is owned by
`@onto2d/level-zero-solver`. The package depends only on
`@onto2d/scientific-adapter`; it does not import the kernel. The case owns the
model, source lock, Oracle request construction, validation, and frozen result.

The solver rejects invalid, mismatched, unsupported, and resource-exceeding
requests with distinct structured error codes. Grid, mode, quantity, and
evidence counts are bounded before numerical work begins. The existing
request, response, and analysis identities remain unchanged because moving an
implementation does not change its declared algorithm.

## Consequences

- the Phase-B solver can be published and replaced without a kernel change;
- the kernel still validates responses and never invokes solver code;
- manufactured-mode and convergence checks cover the finite-difference method;
- this package is not a general Level-0 solver, an independent implementation,
  or empirical evidence;
- a method change requires a new solver identity and new frozen case evidence.
