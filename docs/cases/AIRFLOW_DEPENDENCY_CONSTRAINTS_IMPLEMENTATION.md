# Airflow Dependency Constraints — Implementation

Updated: 2026-08-25

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Future

Domain:
    Python dependency resolution

Evidence profile:
    direct-record
    cryptographically-verified
    derived
    counterfactual
    unknown

Historical Load:
    Primary

History Equivalence:
    Secondary

Reachability:
    Secondary

Reconstruction:
    Not primary
```

## Result

The v1 case measures Historical Load in a finite dependency-resolution
projection whose admissibility filter was published by Apache Airflow rather
than designed by Onto2D.

The exact profile is:

```text
Airflow Core       3.3.1
Python             3.12
platform           manylinux x86_64
constraint file    constraints-no-providers-3.12.txt
root projection    five selected native Airflow Core requirements
closed universe    17 projects / 24 exact PyPI release candidates
```

Exhaustive enumeration considers 128 assignments. Sixty-four are complete
solutions; sixty-four are rejected by the exact `pydantic` / `pydantic-core`
dependency pairing. The selected official constraint pins admit exactly one of
the 64 solutions.

For the same free solution set `H0` and official-constraint subset `HF`:

| Declared cost | Free optimum `a0` | Constrained optimum `aF` | `dH = aF - a0` |
|---|---:|---:|---:|
| Compatible wheel download bytes | 7,676,228 B | 7,820,824 B | +144,596 B |
| Changes from the declared valid baseline | 0 | 7 | +7 |
| Selected wheel count, structural control | 17 | 17 | 0 |

The zero control is retained as a result. No resolver assignment, rejection,
backtracking, runtime, or memory count contributes to any cost above.

## Why This Is a Separate Case

Nix Derivation Identity asks whether equal outputs retain different
construction identities. Airflow Dependency Constraints asks whether a
recorded, versioned release-testing result restricts future install solutions
and changes the cheapest admitted solution under declared costs.

The distinction matters:

```text
resolver search effort != solution-path cost
constraint exclusion != proof that an excluded version is broken
bounded projection != complete Airflow installation
```

## Upstream Contract

The case preserves the exact official Airflow constraint bytes and raw PyPI
JSON used to derive its candidate metadata. The interpretation follows three
upstream contracts:

- [Airflow installation from PyPI and release constraints](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html)
- [pip dependency resolution and backtracking](https://pip.pypa.io/en/stable/topics/dependency-resolution/)
- [pip constraints-file semantics](https://pip.pypa.io/en/stable/user_guide/#constraints-files)

Airflow describes its constraints as a tested release configuration. pip
constraints restrict versions but do not cause packages to be installed.
Neither fact supplies Onto2D's candidate universe or cost functions; those are
declared case-local analysis choices.

## Source Freeze

The source lock contains 27 byte-addressed files:

- one official Airflow constraint file with 121 entries;
- 26 raw PyPI project/version JSON records;
- exact retrieval URLs, byte counts, media types, and SHA-256 digests.

Seventeen official pins apply to the in-scope project closure. Candidate wheel
records retain filename, URL, size, hash, compatibility, and yanked status.
The source identity is:

```text
sha256:6c29dc66a658c6a6d88f71bbf007c1d1cf8933069995de33af9441ab967d50ca
```

`fetch-sources.mjs` is the explicit networked capture step. Normal extraction,
tests, Model Pack construction, and `--verify` runs use only committed bytes.

## Finite Analysis Contract

For the exact root projection `x`:

```text
H0(x)       all metadata-compatible complete assignments in the frozen universe
F           equality with the selected official Airflow pins
HF(x)       { h in H0(x) : F(h) = true }
c(h)        one declared cost profile
a0(x)       min c(h), h in H0(x)
aF(x)       min c(h), h in HF(x)
dH(x | F)   aF(x) - a0(x)
```

`HF` is derived as a subset of the already enumerated `H0`. The profile,
candidate inventory, metadata interpretation, and root requirements cannot
change between the two minima.

The projection begins with five exact native Airflow Core requirements:
`jsonschema`, `pydantic`, `requests`, `sqlalchemy[asyncio]`, and
`typing-extensions`. Their declared in-scope transitive closure contains 17
projects. The claim of completeness applies only to that closed projection.

## Costs

### Wheel download bytes

Sum the recorded size of one compatible selected wheel for every project in a
solution. This measures the size of the named wheel set; the actual wheel
payloads are not vendored or installed.

### Environment-change actions

Count selected project versions that differ from one declared valid baseline
environment. The result is relative to that baseline, not a universal install
cost.

### Selected-wheel count

Count selected projects. Every complete solution contains 17, so this is a
predeclared zero-load structural control rather than a discarded metric.

## Diagnostics and Shared Structure

The enumerator records 128 considered assignments, 64 accepted solutions, and
64 rejected assignments. The two rejection classes each contain 32 assignments
and arise from mismatched exact `pydantic-core` requirements.

These are resolver diagnostics. They describe the exhaustive enumeration but
never populate `c(h)`.

Shared dependencies are represented once. `typing-extensions` has six in-scope
consumers; `attrs`, `referencing`, and `rpds-py` each have two. This preserves
real subgraph reuse without multiplying one dependency into unrelated trees.

## Counterfactual Ablations

Eight deterministic ablations relax selected pins while retaining the same
source bytes and free universe. They are Onto2D counterfactuals, not Airflow
recommendations.

Relaxing only `pydantic` or only `pydantic-core` admits no additional solution
because their exact pair must remain compatible. Relaxing both admits two
solutions and lowers environment-change Historical Load from 7 to 5. The
interaction is visible only because the complete bounded solution set is
available.

## Evidence Layers

The artifact keeps these layers separate:

```text
official Airflow release and constraint record
raw source-locked PyPI metadata
declared finite candidate projection
exhaustively derived solutions and conflicts
predeclared cost results
Onto2D counterfactual constraint ablations
```

Every selected version, wheel fact, compatibility edge, solution identity,
filter verdict, and cost component is traceable to source metadata or a named
derivation rule.

## Outputs

```text
cases/airflow-dependency-constraints/
models/airflow-dependency-constraints/
apps/airflow-constraint-resolution-lab/
docs/cases/AIRFLOW_DEPENDENCY_CONSTRAINTS_IMPLEMENTATION.md
```

The release includes:

- a 27-file content-addressed source lock;
- a schema-validated analysis artifact with all 64 solutions and eight
  ablations;
- a verified 118-node / 1,247-edge Model Pack,
  `airflow-dependency-constraints@v1-e702da2bbcc24ac5`;
- the Airflow Constraint Resolution Lab with exact optima, solution witnesses,
  shared dependencies, resolver diagnostics, and scope boundaries.

## Verification

```bash
npm run case:airflow-constraints:sources:verify
npm run case:airflow-constraints:verify
npm run model:airflow-constraints:verify
node --test cases/airflow-dependency-constraints/tests/airflow-dependency-constraints.test.mjs
node --test models/airflow-dependency-constraints/compiler.test.mjs
node --test apps/airflow-constraint-resolution-lab/airflow-constraint-model.test.mjs
```

Verification fails on source drift, incomplete or altered enumeration,
free/constrained universe mismatch, cost drift, missing zero results, use of
resolver diagnostics as cost, source attribution changes, or Model Pack drift.

## Explicit Limits

- This is not a complete `apache-airflow` installation or global PyPI census.
- Only the declared five-requirement projection is exhaustively closed.
- Exclusion by the official constraint is not labelled incompatibility,
  breakage, or unsafety.
- Wheel payload bytes are not vendored; no offline `pip install` or pip runtime
  benchmark is claimed.
- PyPI metadata supplies recorded wheel size and hash, while artifact-byte
  verification is limited to the committed metadata and constraint sources.
- The environment-change result depends on its declared baseline.
- Ablations change Onto2D's analysis filter, never upstream Airflow evidence.

## Falsification Criterion

The Historical Load result fails if the declared candidate projection is not
complete, if `HF` is not a subset of the same `H0`, if a cost is changed after
inspection, if a required optimum is absent, or if the non-zero signal is
resolver search work. Outside the declared projection the result is
`unresolved`, not extrapolated.
