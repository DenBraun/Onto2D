# Onto2D

Onto2D is a JavaScript toolkit for deterministic, finite admissibility-closure
models. It turns declared structures, rules, and construction steps into
content-addressed artifacts that can be replayed and compared.

## Status

The schema-v1 kernel is locally closed: its public capability registry has no
pending kernel operations, and the repository includes conformance tests,
independent canonicalization goldens, JSON Schemas, and TypeScript declarations.
The implementation baseline passes the supported CI matrix. Tagging `v0.1.0`
still requires independent review of the canonical identity fixtures and a
green run on the exact release commit.

The repository does not include a general scientific solver or empirical
validation of the foundational theory. Those claims require explicit external
evidence through the scientific-adapter boundary.

## Try the studies

- [Historical Load Explorer](https://denbraun.github.io/Onto2D/apps/historical-load-explorer/)
  uses a disclosed finite toy model ([source notes](apps/historical-load-explorer/README.md)).
- [Three-Node Motif Explorer](https://denbraun.github.io/Onto2D/apps/three-node-motif-explorer/)
  projects a frozen reproduction of the published *E. coli* motif result
  ([source notes](apps/three-node-motif-explorer/README.md)).
- [Canonical Identity Lab](https://denbraun.github.io/Onto2D/apps/canonical-identity-lab/)
  replays tested candidate-identity fixtures
  ([source notes](apps/canonical-identity-lab/README.md)).

The [Level-0 Numerical Validation](https://denbraun.github.io/Onto2D/apps/level-zero-validation/)
presents the bounded negative result as an artifact-backed gate sequence and
interactive branch comparison
([source notes](apps/level-zero-validation/README.md)).

Run the static site:

```sh
npm run dev:site
```

Then open `http://127.0.0.1:8080/`, or use the
[published GitHub Pages site](https://denbraun.github.io/Onto2D/).

## Verify the repository

Node.js 22 or newer is required; Node.js 24 LTS is recommended.

```sh
npm ci
npm test
npm run check
npm run build
```

`npm run build` is a validation build; packages run from source and no `dist/`
tree is generated. See the [Development Guide](docs/DEVELOPMENT.md) for focused
commands and fixture policy.

## Packages

| Package | Responsibility |
|---|---|
| [`@onto2d/kernel`](packages/kernel/README.md) | Deterministic model, identity, evaluation, closure, and artifacts |
| [`@onto2d/schemas`](packages/schemas/README.md) | JSON Schema Draft 2020-12 transport contracts |
| [`@onto2d/catalog-adapter`](packages/catalog-adapter/README.md) | Source-catalogue audit and reviewed migration replay |
| [`@onto2d/scientific-adapter`](packages/scientific-adapter/README.md) | Boundary for external numerical implementations |
| [`@onto2d/run-store`](packages/run-store/README.md) | Verified local persistence of semantic run bundles |

Research inputs and reproductions live in [`cases/`](cases). The
[Level-0 oscillator case](cases/level-0-oscillator/README.md) contains a bounded
Phase-B numerical reference benchmark and a negative Phase-C boundedness
preflight plus a bounded objecthood search; the
[three-node-motif case](cases/three-node-motifs/README.md) is an executable,
frozen empirical reproduction.

## Documentation

- [Architecture](docs/KERNEL_ARCHITECTURE.md) explains the system boundaries and
  execution model.
- [Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) separates the
  closed kernel from remaining external work.
- [Scientific Roadmap](docs/SCIENTIFIC_ROADMAP.md) defines the numerical,
  catalogue-migration, solver, and empirical work that follows kernel closure.
- [Project Structure](docs/PROJECT_STRUCTURE.md) defines dependency and ownership
  rules.
- [Foundational Paper Analysis](docs/FOUNDATIONAL_PAPER_ANALYSIS.md) records
  theory traceability and scientific limitations.
- [Review Guide](docs/REVIEW_GUIDE.md) defines the independent golden review
  required for release.
- [ADRs](docs/adr) preserve decisions that affect identity, evidence, or package
  boundaries.
- [Release Checklist](docs/RELEASE_CHECKLIST.md) lists release evidence.

## License

Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue
project and is distributed under the [MIT License](LICENSE).
