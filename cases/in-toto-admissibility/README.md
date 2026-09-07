# in-toto Admissibility

Case ID: `in-toto-admissibility`. [History case registry](../history-case-registry.json).

- [in-toto Admissibility — use and reproduction](#in-toto-admissibility--use-and-reproduction)
- [in-toto Admissibility — source and interpretation](#in-toto-admissibility--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="in-toto-admissibility--use-and-reproduction"></a>

## in-toto Admissibility — use and reproduction

This case freezes a small, offline in-toto Specification v1.0.0 supply chain
and asks whether byte-identical final artifacts can retain different provenance
admissibility.

<a id="in-toto-admissibility--use-and-reproduction--reproduce"></a>

### Reproduce

```sh
npm run case:in-toto:fixture:verify
npm run case:in-toto:verify
npm run model:in-toto:verify
```

All keys are deterministic, non-secret fixture material. The project-owner
layout and every functionary link are signed with Ed25519. The extractor checks
the exact fixture inventory and bytes before interpreting them.

<a id="in-toto-admissibility--use-and-reproduction--frozen-supply-chain"></a>

### Frozen supply chain

```text
src/main.txt
    -> build (authorized builder)
    -> build/app.bin
    -> package (authorized packager)
    -> dist/app.bin
    -> final-product client inspection
```

The five actual fixture executions all expose the same final bytes:

| Execution | Native result | Exact-command profile | Distinguishing reason |
|---|---:|---:|---|
| `valid` | accepted | accepted | all checks pass |
| `shortcut` | rejected | rejected | required build link and continuity absent |
| `material-break` | rejected | rejected | package material does not match build product |
| `unauthorized-actor` | rejected | rejected | package signer is not authorized |
| `command-deviation` | accepted with warning | rejected | native command mismatch is warning-only |

The last row is deliberate. The [in-toto v1.0 specification](https://github.com/in-toto/specification/blob/v1.0/in-toto-spec.md)
states that `expected_command` mismatches should warn rather than fail
verification. `onto2d-exact-command-profile-v1` is therefore modeled as a
separate optional Onto2D policy, never as a native in-toto rule.

<a id="in-toto-admissibility--use-and-reproduction--historical-load"></a>

### Historical Load

The declared finite route space contains one actual baseline and three
counterfactual alternatives. For each of the four declared costs:

```text
Historical Load = cheapest native-policy-admissible route
                - cheapest technically possible route
                = 2 - 1
                = +1
```

The units are construction steps, distinct actors, signed links, or material
transitions. Client inspection is excluded from construction cost. These are
four bounded Onto2D results, not in-toto metrics, security scores, or universal
supply-chain complexity measures.

<a id="in-toto-admissibility--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

- Native: signed layout, signed links, native SHA-256 artifact records,
  functionary authorization, artifact rules, and warning semantics.
- Deterministically derived: verification checks and verdicts.
- Declared Onto2D analysis: optional exact-command policy, finite routes, and
  Historical Load.
- Unknown: intent, host trust outside the signed records, and whether the
  owner-authored layout is a good security policy.

The evaluator implements only the documented subset exercised by this exact
fixture. It is not presented as a general replacement for `in-toto-verify`.

<a id="in-toto-admissibility--source-and-interpretation"></a>

## in-toto Admissibility — source and interpretation

Exact outputs:

```text
case artifact: cases/in-toto-admissibility/artifacts/in-toto-admissibility.json
Model Pack:    in-toto-provenance / v1-647b20b320a109cc
Explorer:      apps/in-toto-admissibility-explorer/
```

<a id="in-toto-admissibility--source-and-interpretation--purpose"></a>

### Purpose

Use a real supply-chain framework where allowed process structure is explicitly
declared and actual execution records can be verified against it.

Primary distinction:

```text
same final artifact
    !=
same admissibility of provenance
```

<a id="in-toto-admissibility--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot represent two histories producing the same
artifact while assigning different admissibility status to those histories.

<a id="in-toto-admissibility--source-and-interpretation--implemented-result"></a>

### Implemented Result

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
`cases/in-toto-admissibility/README.md`.

<a id="evidence-contract"></a>

## Evidence contract

1. Freeze deterministic JSON metablocks, Ed25519 fixture identities, target
   bytes, evaluation time, layout, and five signed execution scenarios.
2. Fail closed if any committed fixture byte or expected file differs before
   interpretation.
3. Record native verifier checks and warnings separately from their aggregate
   verdict.
4. Model `onto2d-exact-command-profile-v1` as an optional derived constraint;
   it may reject a native warning, but it is never labeled an in-toto rule.
5. Keep actual execution sets separate from the declared route space. Only the
   valid route is both a route-space baseline and mapped from an actual record;
   every route labeled counterfactual has `actual: false`.
6. Define Historical Load only over four enumerated routes and four named cost
   functions. It belongs to Onto2D and carries no general in-toto meaning.
7. Describe the evaluator as a bounded implementation of the exercised v1.0
   semantics, not a general in-toto verifier.
