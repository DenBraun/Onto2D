# Mineral Formation History Model Pack

The compiler maps the approved case artifact into separate graph layers for:

- one conventional pyrite species key;
- ten native sample records;
- ten sample-attributed measurement series containing all 95 analysis IDs;
- three qualified published formation interpretations;
- seven explicit case-local unresolved mappings;
- three identity regimes and an undefined Historical Load boundary.

No edge infers a formation mechanism from age, locality, or chemistry. The
compiler also refuses artifacts whose approved epistemic audit has changed.

```sh
npm run model:mineral-formation-history
npm run model:mineral-formation-history:verify
node --test models/mineral-formation-history/compiler.test.mjs
```
