# `@onto2d/scientific-adapter`

```sh
npm install @onto2d/scientific-adapter
```

This package defines the runtime boundary around external numerical and
scientific implementations. It does not contain a solver and does not imply
that claims in the foundational paper are already operationalized.

The separately publishable
[`@onto2d/level-zero-solver`](../level-zero-solver/README.md) implements the
bounded Phase-B reference method. It remains outside this package and does not
turn the adapter boundary into a general solver.

An adapter must expose the normalized solver identity fields `id`, `version`,
and `method`, and provide an asynchronous `evaluate(request)` operation. These
fields bind directly to the normative Oracle request/response contract.
The kernel's `createOracleRequestBinding()` and `validateOracleResponse()`
operations validate that contract without importing or invoking an adapter.
