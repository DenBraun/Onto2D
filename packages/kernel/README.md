# `@onto2d/kernel`

Dependency-free deterministic runtime for finite Onto2D models. ESM only;
Node.js 22 or newer is required for the complete entrypoint.

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

Browser code that only needs the canonical JSON and domain-separated hash
surface can use the portable subpath. It has no Node imports and uses the same
guarded canonicalization and SHA-256 identity contract as the full kernel:

```js
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";

const bytes = canonicalize({ b: 2, a: 1 });
const hash = hashCanonical("onto2d:artifact:v1", { b: 2, a: 1 });
```

Graph matching also has a portable entrypoint:

```js
import { canonicalizeCandidate, canonicalizeSkeleton }
  from "@onto2d/kernel/graph-canonicalizer";
```

It exports the existing graph operations, option normalizer and default policies
directly, with the same types, limits and results as the full kernel. Browser
bundles can use it without importing Node-only Oracle validation. Candidate
matching retains directed edge roles and declared attributes; skeleton matching
uses its established undirected simple-graph contract. This is export routing,
not an additional kernel operation or an altered canonical identity policy.

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
