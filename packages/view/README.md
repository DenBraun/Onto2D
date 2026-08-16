# `@onto2d/view`

`@onto2d/view` is the browser-safe presentation boundary for Onto2D model
data. It creates deterministic catalogue, neighborhood, and SVG-ready layout
projections from explicit node and edge arrays. It has no DOM, filesystem, or
package dependencies.

```js
import { createModelView, layoutNeighborhood } from "@onto2d/view";

const view = createModelView({ nodes, edges });
const catalogue = view.catalog({ search: "field", levels: [0] });
const neighborhood = view.neighborhood({
  focusId: catalogue.items[0].id,
  depth: 1,
  direction: "both"
});
const layout = layoutNeighborhood(neighborhood, { width: 960, height: 620 });
```

The package validates only the presentation input and graph references. It
does not authenticate a Model Pack, assign scientific meaning to relations,
or replace `@onto2d/model-pack` and `@onto2d/engine` as semantic authorities.
Layout coordinates and edge routes are derived output and never enter model
identity.
