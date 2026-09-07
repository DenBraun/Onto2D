# OCI Layer History

Case ID: `oci-layer-history`. [History case registry](../history-case-registry.json).

- [OCI Layer History — use and reproduction](#oci-layer-history--use-and-reproduction)
- [OCI Layer History — source and interpretation](#oci-layer-history--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="oci-layer-history--use-and-reproduction"></a>

## OCI Layer History — use and reproduction

This bounded external case demonstrates one precise result:

```text
same normalized final rootfs
does not imply
same OCI manifest or ordered layer history
```

Four deterministic OCI Image Layout references are generated locally under the
OCI Image Specification v1.1.1 profile. Every index, manifest, config, and
uncompressed tar-layer byte is content-addressed. No mutable public tag or
registry response enters the case.

<a id="oci-layer-history--use-and-reproduction--fixture-result"></a>

### Fixture result

`history-a` adds `/a.txt`, adds `/b.txt`, deletes `/a.txt` with the native
`.wh.a.txt` marker, and adds `/c.txt`. `history-b` adds only the two surviving
files. Redundant-mutation and grouped-layer controls reach the same exact final
rootfs as well.

All four histories have distinct manifest and ordered-layer identities. The
bounded evaluator applies native OCI whiteout semantics and derives every
state-after-layer record. Reversing History A changes the final rootfs, but
that reversed route remains explicitly counterfactual and has no native
manifest.

<a id="oci-layer-history--use-and-reproduction--historical-load"></a>

### Historical Load

The reference is `history-a`; the target is its exact final rootfs; the finite
candidate space contains the four verified native histories. Under that one
declared regime:

| Cost function | Observed | Optimum | Historical Load |
| --- | ---: | ---: | ---: |
| Layer count | 4 | 1 | +3 layers |
| Operation count | 4 | 2 | +2 operations |
| Changed-byte count | 26 | 14 | +12 bytes |
| Transferred layer bytes | 7680 | 3072 | +4608 bytes |

These are four different answers to four different cost questions. None is a
universal container-image complexity score.

<a id="oci-layer-history--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

The case pins the [OCI Image Specification v1.1.1](https://github.com/opencontainers/image-spec/releases/tag/v1.1.1).
The layout follows the official [image layout](https://github.com/opencontainers/image-spec/blob/v1.1.1/image-layout.md),
[manifest](https://github.com/opencontainers/image-spec/blob/v1.1.1/manifest.md),
[configuration](https://github.com/opencontainers/image-spec/blob/v1.1.1/config.md),
and [layer/whiteout](https://github.com/opencontainers/image-spec/blob/v1.1.1/layer.md)
contracts. The evaluator deliberately supports only the committed regular-file
and whiteout fixture profile. It is not a general unpacker or container runtime.

<a id="oci-layer-history--use-and-reproduction--reproduce"></a>

### Reproduce

```sh
npm run case:oci-layers:fixture:verify
npm run case:oci-layers:verify
npm run model:oci-layers:verify
node --test cases/oci-layer-history/tests/*.test.mjs
node --test models/oci-layer-provenance/*.test.mjs
node --test apps/oci-layer-history-lab/*.test.mjs
```

The Open Container Initiative does not endorse Onto2D or this interpretation.

<a id="oci-layer-history--use-and-reproduction--history-matters-pilot"></a>

### History Matters pilot

The [frozen benchmark contract](history-benchmark/contract.json) compares the
complete source-fixture census under an exact semantic identity regime.
`npm run history-benchmark:check` replays its P/H/target artifacts, wrong-history
nulls and [result](history-benchmark/result.json). This is a regime-relative
semantic result, not empirical prediction or an independent review.

<a id="oci-layer-history--source-and-interpretation"></a>

## OCI Layer History — source and interpretation

<a id="oci-layer-history--source-and-interpretation--implementation-result"></a>

### Implementation Result


The plan is implemented as `oci-layer-history-v1` against the pinned OCI Image
Specification v1.1.1 profile. One deterministic OCI Image Layout contains four
native, index-referenced image manifests:

- `history-a`: four layers, including a verified `.wh.a.txt` deletion;
- `history-b`: two layers containing only the surviving files;
- `history-redundant`: five layers with replacement and cancelled temporary
  work;
- `history-grouped`: one layer containing both final files.

All four replay to rootfs identity
`sha256:f7bd81becc162480b7cf758bd6f2a95bf8620680d48b5a585aed92b86ccac3df`
while retaining four different manifest identities and four different ordered
layer-sequence identities. Reversing History A produces a different rootfs and
remains counterfactual, with no native manifest assigned to it.

The declared four-history space resolves Historical Load for the History A
reference as:

| Cost | Observed | Optimum | Load |
|---|---:|---:|---:|
| layer-count | 4 | 1 | +3 layers |
| operation-count | 4 | 2 | +2 operations |
| changed-byte-count | 26 | 14 | +12 bytes |
| transferred-byte-count | 7680 | 3072 | +4608 bytes |

The result is deliberately a cost-indexed vector, not one universal OCI
complexity number.

<a id="oci-layer-history--source-and-interpretation--purpose"></a>

### Purpose

Study how different ordered layer histories can produce the same flattened
filesystem state.

Primary distinction:

```text
final rootfs
    !=
layer history
```

This case provides an intuitive real-world model of history being erased by
flattening.

<a id="oci-layer-history--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot preserve hidden layer ancestry after projecting
to the same final filesystem state.

<a id="evidence-contract"></a>

## Evidence contract

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
