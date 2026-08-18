# in-toto Admissibility case

This case freezes a small, offline in-toto Specification v1.0.0 supply chain
and asks whether byte-identical final artifacts can retain different provenance
admissibility.

## Reproduce

```sh
npm run case:in-toto:fixture:verify
npm run case:in-toto:verify
npm run model:in-toto:verify
```

All keys are deterministic, non-secret fixture material. The project-owner
layout and every functionary link are signed with Ed25519. The extractor checks
the exact fixture inventory and bytes before interpreting them.

## Frozen supply chain

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

## Historical Load

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

## Evidence boundary

- Native: signed layout, signed links, native SHA-256 artifact records,
  functionary authorization, artifact rules, and warning semantics.
- Deterministically derived: verification checks and verdicts.
- Declared Onto2D analysis: optional exact-command policy, finite routes, and
  Historical Load.
- Unknown: intent, host trust outside the signed records, and whether the
  owner-authored layout is a good security policy.

The evaluator implements only the documented subset exercised by this exact
fixture. It is not presented as a general replacement for `in-toto-verify`.
