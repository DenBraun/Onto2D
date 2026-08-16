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

The browser-safe `@onto2d/engine/presentation` subpath creates a bounded lazy
view only from a fully verified Model Pack:

```js
import { createVerifiedModelPresentation } from "@onto2d/engine/presentation";

const presentation = createVerifiedModelPresentation(pack, { resolution });
const page = presentation.catalog({ limit: 60 });
const detail = presentation.inspect(page.items[0].id);
```

When `resolution` is supplied, model ID, version, root hash, and manifest hash
must all match. Presentation responses retain that exact identity but are not
semantic artifacts and cannot be used as partial analysis populations.
