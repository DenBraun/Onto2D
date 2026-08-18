# History Evidence Model

Updated: 2026-08-18

History access and evidence quality are independent. `Recorded` means that a
persistent record exists; it does not mean that the record is complete or true.
`Embodied` means that the past may survive in present state; it does not by
itself establish causation. `Reconstructed` means that one or more pasts are
supported by evidence and a method; it does not declare an actual past.

## Shared evidence states

```text
direct-record
direct-measurement
experimental-observation
sample-identity
attested
cryptographically-verified
published-interpretation
derived
reconstructed
inferred
counterfactual
unknown
contested
```

These are provenance and epistemic labels, not truth values.

## Required separation

```text
source record / measurement
        ↓
deterministic projection
        ↓
published or domain interpretation
        ↓
Onto2D analysis construction
        ↓
counterfactual result
```

Every transition must be inspectable. Missingness remains missing; uncertainty
is preserved; source artifacts are immutable to analysis; and temporal order,
similarity, citation, or correlation cannot silently become causal dependence.

Case-specific evidence types remain allowed. They should enter the shared
vocabulary only after repeated semantics across independent cases.
