# `@onto2d/kernel`

Dependency-free deterministic runtime for finite Onto2D models. ESM only;
Node.js 22 or newer is required.

```sh
npm install @onto2d/kernel
```

## Smallest useful example

```js
import { canonicalizeCandidate } from "@onto2d/kernel";

const ref = `sha256:${"a".repeat(64)}`;
const result = canonicalizeCandidate({
  domain: "element-exact",
  nodes: [{ ref }, { ref }],
  edges: [{ from: 0, to: 1, role: "supports" }]
});

console.log(result.candidateId);
```

## Public capability groups

- canonical JSON, domain-separated hashes, graph and skeleton identity;
- exact decimals, SI-compatible quantities, typed expressions and predicates;
- bounded candidate generation and audited pruning;
- package/run binding, filtering, censuses, cohorts, functionals, ranking,
  sensitivity, and admission;
- derived profiles/elements, depth closure, ladders, and bounded fixpoints;
- deterministic null models, explanations, and semantic run bundles;
- source-policy and scientific-Oracle validation contracts.

`createKernel()` exposes the configured high-level facade. Lower-level exports
support independent testing and adapter integration. The exact export list is
defined by `src/index.js` and its TypeScript declaration.

## Failure contract

The kernel fails closed. Invalid inputs throw exported kernel errors;
scientific uncertainty and incomplete computation are represented in returned
artifacts as distinct indeterminate or exhausted states. A schema-valid object
is not trusted until the relevant verifier reproduces its prerequisites and
hashes.

See the repository [Architecture](../../docs/KERNEL_ARCHITECTURE.md) and
[Implementation Status](../../docs/KERNEL_IMPLEMENTATION_STATUS.md).
