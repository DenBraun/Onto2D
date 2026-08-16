# ADR 0108: Portable Scientific Numeric Reporting

- Status: Accepted
- Date: 2026-08-16

## Context

The frozen Phase-C v1 analyses serialized approximate binary64 results directly
after significant-digit rounding. Node 22 and Node 24 could produce different
identity-bearing bytes for converged residual noise and a raw block-`LDL`
minimum pivot. The scientific gate disposition was unchanged, but downstream
canonical hashes and exact-reproduction checks diverged across platforms.

The existing v1 and integrated v2 artifacts are published scientific contracts.
Changing their meaning or bytes in place would erase provenance.

## Decision

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

## Consequences

Node 22 and Node 24 now reproduce the current Phase-C and integrated artifacts
byte-for-byte. Reported residuals must be read as convergence bounds. Values
below the scalar reporting grid can appear as zero and must not be interpreted
as exact mathematical zero. Legacy hashes remain historically valid but are
not the default cross-platform reproduction target.
