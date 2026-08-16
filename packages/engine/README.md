# `@onto2d/engine`

```sh
npm install @onto2d/engine
```

The engine is a headless facade over verified Model Packs. It provides stable
model queries, deterministic graph traversal, exact version resolution,
isolated Workspace state, explicitly registered analyses, and structural
model diffs. Registered lineage is content-addressed and must match the actual
ordered release diff. The engine does not contain a catalogue, adapter,
filesystem loader, network resolver, UI state, or alternative kernel semantics.

```js
import { Onto2D } from "@onto2d/engine";

const onto = await Onto2D.create({
  models: [verifiedPack],
  model: "example@1.0.0"
});

onto.model.get("a");
onto.model.children("a");
```

The user-facing root `onto2d` facade supplies the bundled Causal Emergence
Model Pack. Direct engine users compose packs explicitly.

The separate [`@onto2d/cli`](../cli/README.md) composes this API with the
bounded Node source loader for split directories and ZIP archives. Filesystem
access, archive parsing, and command-line state remain
outside the engine package.

Browser applications can compose a verified pack through
`@onto2d/model-pack/browser` before creating an engine or presentation view.
Fetch policy, response limits, and browser state likewise remain outside the
engine.
