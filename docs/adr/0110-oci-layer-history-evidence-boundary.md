# ADR 0110: OCI layer-history evidence and identity boundary

- Status: accepted
- Date: 2026-08-18

## Context

An OCI image can expose several legitimate but non-interchangeable identities.
Its manifest identifies an ordered descriptor document, its configuration binds
an ordered DiffID sequence and native history records, and replaying its layers
produces a filesystem state. Different manifests and layer sequences can
therefore produce the same flattened root filesystem. Whiteouts make this
distinction visible: deleted content disappears from the final state while its
layer evidence remains in the image history.

The case also reports Historical Load. A single unqualified score would conceal
the target, admissible alternatives, and cost function, and would incorrectly
suggest an OCI-defined metric.

## Decision

Pin the case to OCI Image Specification v1.1.1 and a deterministic, committed
OCI image layout containing four native manifests. Verify every manifest,
configuration, and uncompressed tar layer against its descriptor digest and
size before interpretation. Accept only the bounded regular-file, whiteout, and
opaque-whiteout tar profile implemented by the case; do not present it as a
general image, registry, signature, or runtime implementation.

Keep four identity regimes explicit: native manifest identity, the ordered
uncompressed-layer sequence, the deterministically derived normalized rootfs,
and a declared rootfs-based history-equivalence class. Native OCI records and
deterministic projections use distinct evidence classes. A reversed layer order
is retained only as an Onto2D counterfactual and cannot acquire a native
manifest descriptor.

Compute Historical Load only as observed cost minus the minimum cost among the
four verified native histories that reach the exact target rootfs. Publish a
separate answer for each declared cost function: layer count, applied operation
count, changed-byte count, and exact transferred uncompressed-layer bytes. The
result is an Onto2D analysis over this finite candidate space, not an OCI
standard quantity.

Compile this case into a separate `oci-layer-provenance` Model Pack. Model Studio
may consume that exact registered release through its generic verified-pack
path, but the OCI model must not be merged into `causal-emergence` or treated as
evidence for its domain claims.

## Consequences

- Equal final files do not collapse distinct manifests, configurations, or
  ordered layer histories.
- Deleted and overwritten content remains inspectable as native ancestry while
  staying absent from the derived final rootfs.
- Any changed authored input, layout byte, case artifact, mapping, or Model Pack
  release changes an identity or fails a pinned verification step.
- Historical Load has four cost-relative answers and no universal OCI score.
- Compressed layers, links, devices, extended attributes, registry transport,
  signatures, runtime execution, and public image tags remain outside this v1
  case boundary.
