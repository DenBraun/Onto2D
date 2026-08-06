# Onto2D Development Guide

## Prerequisites

- Node.js 20 or newer;
- npm with lockfile v3 support;
- Git.

The workspace uses Node built-ins and npm workspaces only. No global build tool
or external service is required for the bootstrap checks.

## Setup and verification

```sh
npm ci
npm test
npm run check
npm run build
```

`npm ci` materializes local workspace links. `npm test` discovers every
`*.test.js`, `*.test.mjs`, and `*.test.cjs` file outside ignored/generated
directories. `npm run check` performs syntax and manifest validation, package
boundary checks, schema/reference checks, Markdown link/fence checks, and the
golden catalogue audit. `npm run build` runs the same readiness gate and then
confirms that no transpilation is required.

Focused commands:

| Command | Purpose |
|---|---|
| `npm run test:legacy` | Characterize only the root legacy API |
| `npm run test:kernel` | Check canonicalization, loading, and kernel contracts |
| `npm run audit:catalogue` | Print the current catalogue audit snapshot |
| `npm run check:catalogue` | Compare the audit with its reviewed golden |
| `npm run check:schemas` | Parse schemas, resolve references, and verify export coverage |
| `npm run check:docs` | Check local Markdown links and code fences |
| `npm run check:source` | Parse every JSON file and syntax-check JavaScript |
| `npm run check:workspace` | Validate package names, exports, and kernel isolation |

## Working on the legacy runtime

`onto2d.js` remains the compatibility source of truth. Its package wrapper is a
thin re-export. Add characterization tests under `test/legacy/` before changing
observable behavior. Never move or rewrite the legacy catalogue in the same
change as a semantic migration.

## Working on the new kernel

The public architecture is normative. Canonical JSON, domain-separated hashes,
package normalization/validation, primitive/profile identity, rules hash,
depth-basis hash, and exact supplied-candidate graph canonicalization now form
the first runtime layer. Canonical candidate work must preserve node/edge
permutation invariance, the structural-attribute projection, reversible index
mappings, and the hard search budget in
[ADR-0004](adr/0004-refinement-graph-canonicalization.md). The exact boundary
and pending capabilities are listed in
[Kernel Implementation Status](KERNEL_IMPLEMENTATION_STATUS.md).

The bounded reference skeleton enumerator and CandidateStore follow
[ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md). Enumeration
results are scientifically complete only when `status === "complete"`; an open
store or any budget-exhausted result is deliberately non-interpretable.

Add further implementation only with the corresponding schema/type contract,
positive and negative fixture, deterministic artifact rule, and acceptance test
from the [Kernel Refactor Plan](KERNEL_REFACTOR_PLAN.md). Do not bypass the
loader by constructing a “loaded” package manually.

The kernel package may use Node built-ins but has no package dependencies. UI,
catalogue fields, numerical solvers, and filesystem-specific loading belong in
adapters or applications.

## Catalogue golden policy

`test/fixtures/catalogue-audit.expected.json` freezes observations, not desired
scientific answers. A difference may reveal an intentional source edit, an
accidental data regression, or an audit bug. Inspect the exact delta and its
rationale before updating the fixture. In particular, do not normalize the
three weight anomalies or remove cyclic edges merely to restore a green check.

## Generated and run artifacts

`node_modules/`, `coverage/`, package `dist/`, and `runs/*` are ignored. Only
explicitly reviewed fixtures should be committed. Runtime artifacts must
eventually carry the semantic manifest and source hashes required by the
architecture.
