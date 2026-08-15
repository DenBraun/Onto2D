# `@onto2d/scientific-adapter`

```sh
npm install @onto2d/scientific-adapter
```

This package defines the runtime boundary around external numerical and
scientific implementations. It does not contain a solver and does not imply
that claims in the foundational paper are already operationalized.

A bounded case-specific reference implementation is available in the
[Level-0 oscillator case](../../cases/level-0-oscillator/README.md). It remains
outside this package and does not turn the adapter boundary into a general
solver.

An adapter must expose the normalized solver identity fields `id`, `version`,
and `method`, and provide an asynchronous `evaluate(request)` operation. These
fields bind directly to the normative Oracle request/response contract.
The kernel's `createOracleRequestBinding()` and `validateOracleResponse()`
operations validate that contract without importing or invoking an adapter.
