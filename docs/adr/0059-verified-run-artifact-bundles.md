# ADR-0059: Verified run artifact bundles and bound explanation lookup

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0057 provides an exactly replayed per-level candidate explanation index,
and ADR-0058 provides a compact final level census. The target
`explain({ runHash, candidateId })` interface still cannot safely choose one of
those indexes unless the caller supplies an external artifact store that binds
the requested run to the exact package, RunConfig, prior-level chain, and
semantic outputs. Recomputing from ambient package state can answer a real
candidate under the wrong rules.

The post-completion visualization gate also requires byte-exact source
artifacts rather than manually copied values. Filesystem I/O is application
policy and must not enter the deterministic kernel, but the kernel must define
the bytes, paths, hashes, and verification boundary that a writer persists.

## Decision

`package-run-artifact-bundle-v1` accepts one loaded package, normalized
RunConfig, a non-empty contiguous ordinary/depth-aware level chain, and the
execution ceilings used to create it. It exactly reproduces every level, then
derives the ADR-0057 explanation index and ADR-0058 final census for every
depth. The bundle embeds the normalized package/run inputs and records:

- one deterministic semantic manifest for the target run;
- every level, final census, and explanation index;
- normalized input projections for package, sources, primitives, predicates,
  functionals, cohorts, selectors, claims, evidence, Oracle policy, ontology
  axes, perturbations, profile definition, identity policy, and RunConfig;
  when present, the normalized source-migration binding is an additional input
  whose semantic hash is copied into the manifest;
- sorted logical artifact paths, media types, schema versions, canonical byte
  lengths, semantic hashes, and byte hashes;
- per-level run, level, census, and explanation-index identities.

Artifact references use the raw SHA-256 of their exact bytes, so external
writers can verify them with standard tooling. Semantic manifest, bundle,
store, materialization, and run-level explanation identities each use separate
framed Onto2D domains.
`materializePackageRunArtifact` returns the exact canonical JSON bytes in
base64 for one verified reference. It does not write a file.

`package-run-artifact-store-v1` verifies every serialized bundle and constructs
a total unique `runHash -> bundle/level/census/explanationIndex` index. A
duplicate run hash is rejected even if it occurs in a different bundle.
`createKernel({ artifactStore })` verifies the store against the configured
kernel version before exposing it. `kernel.explain({runHash,candidateId})`
looks up only inside that bound snapshot and returns a separately hashed
run-level explanation. An unbound kernel fails explicitly.

Freshly created or fully verified results are deeply frozen and may be reused
within the same process without repeating replay. This optimization uses
object identity only; parsed, cloned, or otherwise external objects always
undergo complete reproduction before entering the trusted set.

This closes `artifact-bundle-index` and ambient candidate explanation lookup.
Source-migration explanations remain unavailable because their underlying
classification, resolution, and condensation artifacts are not complete at
this ADR boundary; ADR-0067 later adds them for a complete verified migration
chain.

## Consequences

- A writer, CLI, or browser publisher receives exact bytes and cannot silently
  choose a different serialization.
- Every run hash has one unambiguous verified explanation index inside a store.
- Multi-depth bundles preserve earlier run hashes as separately queryable
  entries, while the bundle target run remains the final depth.
- Operational timestamps, platform data, and filesystem state remain outside
  semantic hashes.
- Future GitHub Pages output can consume verified bundle artifacts directly,
  but `POST-CLOSURE-VIS-01` remains deferred until the kernel closure gate.

## Rejected alternatives

- Letting the kernel write directly to a repository or filesystem was rejected
  because storage location and atomicity are application concerns.
- Trusting an `ArtifactRef` hash without materializing and replaying its source
  artifact was rejected as a self-consistent-label failure.
- Selecting an explanation index by candidate ID alone was rejected because a
  candidate may exist under multiple runs.
- Accepting duplicate run hashes with first/last-wins resolution was rejected
  because store order must never change scientific lookup.
- Treating an arbitrary frozen caller object as verified was rejected; only
  creator/verifier outputs enter the process-local trusted cache.

## Acceptance artifacts

- complete ordinary-plus-depth-aware two-level bundle fixture;
- exact serialized-clone reproduction and tamper rejection;
- canonical byte materialization with independent byte-length/hash checks;
- store run-index uniqueness, wrong-run, wrong-kernel, and tamper failures;
- bound and unbound `kernel.explain` behavior;
- public TypeScript and five JSON Schema contracts;
- Node.js 20/22 full repository suites, checks, and builds.
