# OCI Layer History

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

## Fixture result

`history-a` adds `/a.txt`, adds `/b.txt`, deletes `/a.txt` with the native
`.wh.a.txt` marker, and adds `/c.txt`. `history-b` adds only the two surviving
files. Redundant-mutation and grouped-layer controls reach the same exact final
rootfs as well.

All four histories have distinct manifest and ordered-layer identities. The
bounded evaluator applies native OCI whiteout semantics and derives every
state-after-layer record. Reversing History A changes the final rootfs, but
that reversed route remains explicitly counterfactual and has no native
manifest.

## Historical Load

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

## Evidence boundary

The case pins the [OCI Image Specification v1.1.1](https://github.com/opencontainers/image-spec/releases/tag/v1.1.1).
The layout follows the official [image layout](https://github.com/opencontainers/image-spec/blob/v1.1.1/image-layout.md),
[manifest](https://github.com/opencontainers/image-spec/blob/v1.1.1/manifest.md),
[configuration](https://github.com/opencontainers/image-spec/blob/v1.1.1/config.md),
and [layer/whiteout](https://github.com/opencontainers/image-spec/blob/v1.1.1/layer.md)
contracts. The evaluator deliberately supports only the committed regular-file
and whiteout fixture profile. It is not a general unpacker or container runtime.

## Reproduce

```sh
npm run case:oci-layers:fixture:verify
npm run case:oci-layers:verify
npm run model:oci-layers:verify
node --test cases/oci-layer-history/tests/*.test.mjs
node --test models/oci-layer-provenance/*.test.mjs
node --test apps/oci-layer-history-lab/*.test.mjs
```

The Open Container Initiative does not endorse Onto2D or this interpretation.
