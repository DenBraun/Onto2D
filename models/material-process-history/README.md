# Material Process History Model Pack

This compiler maps the exact AMB2022-01 case artifact into a compact graph. It
keeps all native build, process, part, and measurement identities while
representing the 2,248-point residual-strain field as 24 deterministic height
slice nodes. The complete points remain available in the case artifact.

The graph creates no causal edge, copies no B7-P3 measurement to a sibling,
repairs no source filename, and makes no complete-process-space claim.

```sh
npm run model:material-process-history
npm run model:material-process-history:verify
node --test models/material-process-history/compiler.test.mjs
```
