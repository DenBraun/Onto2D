# `@onto2d/catalog-adapter`

This package loads and audits the existing `scr/level-*.json` catalogue without
changing it. The audit freezes current graph facts needed for Stage R0.

The kernel can now validate and content-address reviewed classification and
node-resolution policies plus caller-supplied independent annotation and blind-
adjudication artifacts. Actual policy authorship, access-controlled view
delivery, annotation collection, semantic relation classification, node
resolution, SCC condensation, and conversion into a kernel package are
intentionally pending. Raw `ParentCode` edges are never silently treated as
generative dependencies.

The adapter now constructs a policy-limited, content-addressed classification
view and, for an already verified caller-supplied annotation chain, emits every
classified relation exactly once plus deterministic `generative` and
`formation-support` SCC partitions. Endpoint substitution, hidden view fields,
and altered upstream artifacts fail. This generic projection is not run on the
current catalogue and does not choose node dispositions or condensation.
