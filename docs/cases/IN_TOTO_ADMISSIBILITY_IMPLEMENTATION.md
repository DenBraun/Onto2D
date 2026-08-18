# in-toto Admissibility — Implementation Plan

Updated: 2026-08-18

Status: implemented · `ANALYSIS_READY`

Exact outputs:

```text
case artifact: cases/in-toto-admissibility/artifacts/in-toto-admissibility.json
Model Pack:    in-toto-provenance / v1-647b20b320a109cc
Explorer:      apps/in-toto-admissibility-explorer/
```

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity

Domain:
    Software supply chain

Evidence profile:
    direct-record
    attested
    cryptographically-verified
    counterfactual
    unknown

Historical Load:
    Bounded candidate

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

Use a real supply-chain framework where allowed process structure is explicitly
declared and actual execution records can be verified against it.

Primary distinction:

```text
same final artifact
    !=
same admissibility of provenance
```

## Outputs

```text
cases/in-toto-admissibility/
apps/in-toto-admissibility-explorer/
models/in-toto-provenance/
docs/cases/IN_TOTO_ADMISSIBILITY_IMPLEMENTATION.md
```

## Phase 0 — Bounded Fixture

Create a minimal local supply-chain fixture with:

```text
source
 -> build
 -> package
 -> final artifact
```

Pin:

- layout;
- keys/identities used for fixture verification;
- link metadata;
- materials/products;
- commands;
- exact final artifact bytes.

The first version should be completely reproducible offline.

## Phase 1 — Extract Native Records

Represent separately:

```text
layout step
inspection
rule
authorized identity
link record
materials
products
command
verification result
```

Preserve native names and hashes.

## Phase 2 — Admissibility Mapping

Map native policy into explicit constraints without losing source semantics.

Constraint examples:

- required step executed;
- authorized signer/actor;
- command matches policy;
- material continuity;
- expected product produced;
- disallowed modification absent.

Every mapped Onto2D constraint must retain a pointer to the native rule.

## Phase 3 — Canonical Experiments

### Experiment A — Valid execution

All policy checks pass.

### Experiment B — Same output, wrong history

Produce byte-identical final output through an execution that violates the
declared policy.

This is the flagship experiment.

### Experiment C — Material continuity violation

Keep final output available while breaking the expected material chain.

### Experiment D — Actor violation

Perform the expected transformation under an unauthorized identity.

### Experiment E — Command violation

Produce the expected product using a command not allowed by the layout.

## Phase 4 — Possible vs Admissible Space

Create an explicit finite counterfactual space.

Classify each path as:

```text
possible
admissible
actual
counterfactual
```

Do not treat all technically executable paths as known possible paths; the
finite space must be explicitly declared.

## Phase 5 — Historical Load

Compare:

```text
shortest free route
vs
shortest policy-conforming route
```

Possible cost functions:

```text
step-count
distinct-actor-count
attestation-count
material-transition-count
```

Historical Load belongs to Onto2D, not to in-toto.

## Phase 6 — Model Pack

Create:

```text
modelId: in-toto-provenance
```

Entities:

- step definition;
- actual step execution;
- material;
- product;
- actor;
- rule;
- verification record;
- evidence relation.

## Phase 7 — Explorer

Core panes:

```text
DECLARED SUPPLY CHAIN
ACTUAL EXECUTION
VERIFICATION
COUNTERFACTUALS
```

Important visual mode:

```text
same artifact bytes
        |
        +-- admissible provenance
        |
        +-- inadmissible provenance
```

## Phase 8 — Negative Tests

Required:

- identical final bytes do not force admissibility equality;
- missing link cannot be silently synthesized;
- unauthorized actor remains distinct from command correctness;
- native policy rule and Onto2D mapped constraint remain traceable;
- counterfactual path is never marked actual;
- verifier failure cannot become `unknown` silently.

## Falsification Criterion

The case fails if Onto2D cannot represent two histories producing the same
artifact while assigning different admissibility status to those histories.

## Definition of Done

A third party can replay the valid and invalid fixtures, obtain the same final
artifact in the flagship comparison, and verify that provenance admissibility
differs for explicit policy reasons.

## Implemented Result

Five deterministic Ed25519-signed execution fixtures reproduce the same final
artifact SHA-256. `valid` passes native verification. `shortcut` fails because
the required build link and material chain are absent; `material-break` fails
the native MATCH rule; and `unauthorized-actor` fails functionary
authorization while retaining the expected command and artifacts.

The command experiment required one correction to the planning shorthand:
in-toto v1.0 treats `expected_command` mismatch as warning-only. Accordingly,
`command-deviation` passes native verification with a warning and fails only
the separately disclosed `onto2d-exact-command-profile-v1`. This preserves the
upstream semantics instead of turning an audit hint into an invented native
constraint.

Historical Load is resolved in the four-route declared space:

```text
step-count                2 - 1 = +1 construction step
distinct-actor-count      2 - 1 = +1 distinct actor
attestation-count         2 - 1 = +1 signed link
material-transition-count 1 - 0 = +1 material transition
```

These are cost-relative Onto2D results, not in-toto metrics. The exact evidence
boundary and its consequences are recorded in
`docs/adr/0111-in-toto-admissibility-evidence-boundary.md`.
