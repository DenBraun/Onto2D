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

The separately publishable [structural geometry package](../structural-geometry/README.md)
also uses this interface for a bounded external Python Ollivier reference. It has
its own request/response schemas and verifies exact primal/dual transport
certificates. These descriptive geometry responses are not kernel closure Oracle
responses and do not provide admissibility evidence.

An adapter must expose the normalized solver identity fields `id`, `version`,
and `method`, and provide an asynchronous `evaluate(request)` operation. These
fields identify the implementation in the relevant analysis contract.
For kernel Oracle use, `createOracleRequestBinding()` and
`validateOracleResponse()` validate that contract without importing or invoking
an adapter. Other analyses validate their own dedicated contracts.
