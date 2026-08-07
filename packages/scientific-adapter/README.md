# `@onto2d/scientific-adapter`

This package defines the runtime boundary around external numerical and
scientific implementations. It does not contain a solver and does not imply
that claims in the foundational paper are already operationalized.

An adapter must expose the normalized solver identity fields `id`, `version`,
and `method`, and provide an asynchronous `evaluate(request)` operation. These
fields bind directly to the normative Oracle request/response contract.
Requests and responses are validated against `@onto2d/schemas` by the
orchestration layer.
