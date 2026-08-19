# LTEE Evolutionary Contingency

This case freezes the three Ara-3 citrate replay experiments reported by Blount, Borland, and Lenski (2008). It asks one bounded question: how does a recorded source generation condition the observed accessibility of Cit+ under each exact replay protocol?

The repository stores a reviewed projection, not the publisher HTML. `upstream.json` pins the exact retrieved response and `prepare-source.py` deterministically reconstructs the projection when that upstream input is supplied explicitly.

```bash
npm run case:ltee
npm run case:ltee:verify
```

The extraction keeps all three experimental designs separate. `not-observed` is never promoted to `impossible`; a source generation is never promoted to a complete genotype or a unique clone; replay histories are never treated as the original LTEE history; and published P values remain source-attributed rather than recomputed.

Historical Load is intentionally `not-evaluated`. The paper does not provide a finite universe of mutation paths, transition costs, or a history-free counterfactual baseline.
