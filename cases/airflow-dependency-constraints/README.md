# Airflow Dependency Constraints

Status: implemented bounded case (`airflow-dependency-constraints-v1`)

This case measures the cost of Apache Airflow's official versioned constraint
file inside one explicit finite dependency-resolution projection. It is not a
complete Airflow installation benchmark.

## Frozen scope

- `apache-airflow==3.3.1` and `apache-airflow-core==3.3.1` PyPI metadata;
- official `constraints-3.3.1/constraints-no-providers-3.12.txt` bytes;
- Python 3.12 on manylinux x86_64;
- five exact native Airflow Core requirements: `jsonschema`, `pydantic`,
  `requests`, `sqlalchemy[asyncio]`, and `typing-extensions`;
- their closed 17-project in-scope transitive projection;
- 24 exact PyPI release candidates and compatible wheel records.

The 27 source files are byte-locked in `sources/source-lock.json`. The wheel
records retain exact filenames, sizes, URLs, and PyPI SHA-256 values, but wheel
payload bytes are not vendored.

## Result

Exhaustive enumeration considers 128 candidate assignments:

- 64 complete solutions;
- 64 rejected assignments caused by the two mismatched
  `pydantic`/`pydantic-core` pairings;
- one solution admitted by every official selected constraint pin.

Historical Load in this declared projection is:

| Cost | Free optimum | Constrained optimum | `dH` |
|---|---:|---:|---:|
| Compatible wheel download bytes | 7,676,228 | 7,820,824 | +144,596 bytes |
| Version changes from the declared valid baseline | 0 | 7 | +7 changes |
| Selected wheel count | 17 | 17 | 0 wheels |

The zero control is retained. Resolver assignments, rejections, runtime, and
backtracking are diagnostics and never enter these costs.

`typing-extensions` is reused by six independent consumers. Relaxing only
`pydantic` or only `pydantic-core` admits no second solution because their exact
pairing remains active; relaxing the pair admits two. This makes dependency
coupling visible rather than treating version pins as independent toggles.

## Reproduce

```sh
npm run case:airflow-constraints:verify
npm run model:airflow-constraints:verify
node --test cases/airflow-dependency-constraints/tests/airflow-dependency-constraints.test.mjs
```

Source refresh is a separate networked action:

```sh
node cases/airflow-dependency-constraints/fetch-sources.mjs
```

Ordinary verification is fully offline.

## Boundary

The measured universe is complete for the declared projection, not for all
Airflow dependencies or all PyPI releases. Airflow's constraint file is a
tested release configuration, not proof that excluded combinations are broken,
unsafe, or unsupported. No performance claim about pip is made.
