# LTEE Evolutionary Contingency

This case freezes the three Ara-3 citrate replay experiments reported by Blount, Borland, and Lenski (2008). It asks one bounded question: how does a recorded source generation condition the observed accessibility of Cit+ under each exact replay protocol?

The repository stores a reviewed projection, not the publisher HTML. `upstream.json` pins the exact retrieved response and `prepare-source.py` deterministically reconstructs the projection when that upstream input is supplied explicitly.

```bash
npm run case:ltee
npm run case:ltee:verify
```

The extraction keeps all three experimental designs separate. `not-observed` is never promoted to `impossible`; a source generation is never promoted to a complete genotype or a unique clone; replay histories are never treated as the original LTEE history; and published P values remain source-attributed rather than recomputed.

LTEE is a priority candidate for a future empirical Historical Load extension, while this exact release intentionally remains `not-evaluated`. The paper provides quantitative history-conditioned reachability evidence, but it does not declare the finite mutation-path space, shared free and history-conditioned admissibility regimes, transition costs, or counterfactual baseline required for `dH(x | F) = aF - a0`. Published generation shifts and P values are therefore not relabelled as Historical Load.
