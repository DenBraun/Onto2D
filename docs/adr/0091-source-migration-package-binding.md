# ADR-0091: Closed source-migration package and run binding

- Status: accepted
- Date: 2026-08-12

## Context

The catalogue adapter already provides deterministic, fully replayable source
classification projection, reviewed node resolution, lossless condensation,
reconciliation, metrics, concentration, and explanation-index artifacts. The
kernel package schema and condensed-cluster identity branch existed, but the
loader rejected every `sourceMigration` and `condensed-cluster` input. A
reviewed migration therefore could not become a primitive depth population or
enter a verified run bundle.

The kernel cannot safely reproduce adapter algorithms from `ArtifactRef`
labels alone: an artifact reference authenticates external bytes but does not
contain those bytes. It can, however, close the package trust boundary by
requiring every result in the documented migration chain, binding exact
references, and checking all provenance visible in the package.

## Decision

Schema v1 defines `SourceMigrationBinding` as one closed manifest containing:

- the semantic classification `policyHash` and blindness status;
- classification/risk policies, classification view, annotations,
  adjudication, post-unblinding amendments, and effective classified
  relations;
- node resolutions, condensation, member projections, and exactly six typed
  relation-layer artifacts;
- reconciliation, metrics, explanation index, and optional concentration.

The package loader requires all mandatory roles, rejects unknown fields,
validates every `ArtifactRef`, requires a distinct content hash for every
migration role, and requires an exact matching reference in the root
`sourceArtifacts` inventory. Typed relation layers are normalized by hash.

Every condensed-cluster primitive requires this binding. Its classification
policy hash and classification, node-resolution, and condensation artifact
references must match the bound migration exactly. One source member cannot
occur in more than one condensed-cluster primitive. Normalized member and
internal-relation order remains identity-insensitive.

The normalized binding is hashed under
`onto2d:source-migration-binding:v1`. The loaded package semantic manifest
records `sourceMigrationHash`, and its depth basis records the bound
condensation artifact hash. Verified run bundles copy `sourceMigrationHash`
and add `normalized-input/source-migration.json` as a sixteenth input artifact;
packages without a migration retain the original fifteen-input manifest.

The loader does not claim that an `ArtifactRef` proves the scientific content
of unavailable bytes. The catalogue adapter remains responsible for exact
upstream replay and node/edge conservation before an application constructs
this package manifest. Authorship, access-controlled annotation, reviewed
dispositions, and application to the current catalogue remain external
research/application inputs rather than pending kernel algorithms.

## Consequences

- Reviewed condensed clusters can enter the same deterministic population,
  closure, artifact-bundle, and replay paths as ordinary primitives.
- Package and run identities change when any migration reference or the
  condensation basis changes.
- A partial, unbound, duplicated, or provenance-drifting migration fails before
  element identity or candidate generation.
- Generic source classification, resolution, condensation, and explanation
  construction remain in `@onto2d/catalog-adapter`, preserving dependency
  direction; the kernel owns only the executable package/run boundary.
- The absence of current-catalogue authored inputs does not make this kernel
  contract partial and must not be represented as a pending kernel capability.

## Verification

Acceptance coverage includes complete binding load, order-invariant package
identity, condensed-cluster depth materialization, missing and mismatched
artifact rejection, cluster provenance drift, overlapping-member rejection,
schema conformance, explicit run-manifest propagation, canonical artifact-byte
materialization, serialized bundle replay, and the full repository suite.
