# OCI Layer History Model Pack

This directory contains the separate `oci-layer-provenance` Model Pack. It
preserves verified native OCI index, manifest, config, layer-descriptor, and tar
entry evidence separately from deterministic filesystem states and
context-sensitive layer operations.

All four native histories end at the same normalized rootfs while retaining
distinct manifest and ordered-layer identities. Historical Load is published
only for the exact four-history candidate space and its four declared cost
functions.

Build and verify:

```sh
npm run model:oci-layers
npm run model:oci-layers:verify
```

The Open Container Initiative does not endorse Onto2D or this interpretation.
