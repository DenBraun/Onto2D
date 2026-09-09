# Documentation

Onto2D is in development, before its first project release. These documents
describe current contracts, evidence and planned work. Git preserves development
history; resolved fixes and completed implementation diaries do not need
separate documents.

## Choose a starting point

| Need | Guide |
|---|---|
| Install, run, test or review | [Development](DEVELOPMENT.md) |
| Find current priorities and remaining work | [Roadmap](ROADMAP.md) |
| Find the owning package or directory | [Project structure](PROJECT_STRUCTURE.md) |
| Understand deterministic kernel semantics | [Kernel](architecture/KERNEL.md) |
| Understand identity and bounded graph generation | [Identity](architecture/IDENTITY.md) |
| Understand numeric policies and expressions | [Numerics](architecture/NUMERICS.md) |
| Understand filtering, admission, closure and pruning | [Execution](architecture/EXECUTION.md) |
| Understand verified artifacts and null-model evidence | [Evidence](architecture/EVIDENCE.md) |
| Review catalogue classification and source migration | [Source policy](architecture/SOURCE_POLICY.md) |
| Integrate Model Packs, engine, loaders, cache or Studio | [Engine](architecture/ENGINE.md) |
| Import and map RDF with the closed SHACL profile | [RDF](architecture/RDF.md) |
| Understand the foundational paper and its limits | [Foundations](architecture/FOUNDATIONS.md) |
| Explore the history model and examples | [History](history/README.md), [portfolio](history/PORTFOLIO.md) |
| Understand the History Matters benchmark | [Benchmark](history/BENCHMARK.md) |
| Explore the Structural Geometry page and reproduce its data | [Lab guide](../apps/structural-geometry-lab/README.md) |
| Work on Structural Geometry | [Structural Geometry](structural-geometry/README.md) |
| Review the unimplemented Model Pack format proposal | [Model Pack v2](model-pack-v2/README.md) |

## Documentation ownership

Each subject has one authoritative guide. Package READMEs explain local API
entrypoints; case READMEs own source provenance, reproduction and interpretation;
app READMEs own operation of the interface. They link to shared contracts rather
than duplicate them. The roadmap owns priorities and status, not API definitions.

A frozen experiment protocol beside its source lock is a scientific input.
Preserve its bytes when a checksum binds it, even when a later study asks a new
question. Publish the new study with its own protocol. Keep actual negative
results, source limitations, attribution and reproducibility instructions.

Update the relevant guide for a contract change. Create a new document only for
a distinct owner or a separately frozen experimental input; do not add a new
ADR, review report, revision analysis or implementation-stage diary.
