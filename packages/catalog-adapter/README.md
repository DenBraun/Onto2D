# `@onto2d/catalog-adapter`

This package loads and audits the existing `scr/level-*.json` catalogue without
changing it. The audit freezes current graph facts needed for Stage R0.

Semantic relation classification, blind annotation, node resolution, SCC
condensation, and conversion into a kernel package are intentionally pending
reviewed migration policy. Raw `ParentCode` edges are never silently treated as
generative dependencies.
