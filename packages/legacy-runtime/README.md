# `@onto2d/legacy-runtime`

Compatibility wrapper around the repository-root `onto2d.js` module. It keeps
the current ontology/world validator importable while the new kernel is built
beside it. The wrapper must not import `@onto2d/kernel` and must not reinterpret
legacy catalogue edges.
