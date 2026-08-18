# Chemical Reaction Provenance Model Pack

This deterministic Model Pack projects the source-locked Chemical Synthesis
History artifact into Model Studio without collapsing evidence layers.

```sh
npm run case:chemical-synthesis:verify
npm run model:chemical-reactions:verify
```

The pack contains:

- two pinned ORD dataset nodes;
- thirteen selected native reaction records;
- exact source compound-identifier records;
- five derived same-product comparisons;
- two native cross-reaction continuity relations;
- target and route identity profiles;
- one actual and three counterfactual declared routes;
- two bounded Historical Load results.

`shares-exact-product-identifier` is always a derived relation with
`physicalBatchContinuity: false`. Only `native-material-continuity`, backed by
an ORD `reaction_id` reference, represents material transfer between records.

The release version is content-derived from the mapping version, source
identity, and case identity. Any selected source field, evidence rule, or
analysis-space change therefore creates a different release.
