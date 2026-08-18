# in-toto Provenance Model Pack

Separate verified Model Pack compiled from
`cases/in-toto-admissibility/artifacts/in-toto-admissibility.json`.

It preserves distinct nodes for the signed layout, native step and inspection
definitions, artifact rules, identities, signed links, actual executions,
native verifier results, optional Onto2D policy results, and declared routes.
Every native rule node carries its source pointer. Counterfactual routes never
become actual execution nodes.

```sh
npm run model:in-toto
npm run model:in-toto:verify
```

Current exact release: `v1-647b20b320a109cc`.
