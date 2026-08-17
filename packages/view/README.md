# `@onto2d/view`

`@onto2d/view` is the browser-safe presentation boundary for Onto2D model
data. It creates deterministic catalogue, neighborhood, and SVG-ready layout
projections from explicit node and edge arrays. It has no DOM, filesystem, or
package dependencies.

```js
import { createModelView, layoutNeighborhood, wrapGraphNodeLabel } from "@onto2d/view";

const view = createModelView({ nodes, edges });
const catalogue = view.catalog({ search: "field", levels: [0] });
const neighborhood = view.neighborhood({
  focusId: catalogue.items[0].id,
  depth: 1,
  direction: "both"
});
const layout = layoutNeighborhood(neighborhood, {
  width: 960,
  height: 620,
  nodeWidth: 156,
  nodeHeight: 58
});
const label = wrapGraphNodeLabel(neighborhood.focus.name, {
  maxCharacters: 22,
  maxLines: 3
});
```

`nodeWidth` and `nodeHeight` are maximum card dimensions. Dense layouts may
reduce card width deterministically to keep lanes separated. The returned
dimensions are the exact values to render and route against.
`wrapGraphNodeLabel()` returns bounded text lines and ellipsizes only the last
visible line when the complete label does not fit.

The package validates only the presentation input and graph references. It
does not authenticate a Model Pack, assign scientific meaning to relations,
or replace `@onto2d/model-pack` and `@onto2d/engine` as semantic authorities.
Layout coordinates and edge routes are derived output and never enter model
identity.

For large verified models, `@onto2d/view/lazy` materializes only the requested
presentation projection:

```js
import { createLazyModelPresentation } from "@onto2d/view/lazy";

const presentation = createLazyModelPresentation({
  identity: { modelId, modelVersion, rootHash, manifestHash },
  nodes,
  edges
});
const firstPage = presentation.catalog({ limit: 60 });
const graph = presentation.neighborhood({ focusId: firstPage.items[0].id });
const fullRecord = presentation.inspect(firstPage.items[0].id);
```

Catalogue and graph projections omit complete source records. Only `inspect()`
returns one full node record. Direct view construction validates shape but does
not prove that the supplied identity belongs to the arrays. Applications that
start from Model Packs should use `createVerifiedModelPresentation()` from
`@onto2d/engine/presentation`; it verifies the complete pack and can bind a
registry resolution before creating this session. Lazy presentation is not a
partial semantic model or an analysis input.
