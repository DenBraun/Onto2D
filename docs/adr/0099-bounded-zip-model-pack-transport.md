# ADR-0099: Bounded ZIP Model Pack transport

Status: implemented decision

Date: 2026-08-16

## Context

The Node boundary could verify a transparent split Model Pack directory, but a
single-file local transport required either ad hoc extraction or bypassing the
loader. General ZIP readers also expose a larger feature and resource surface
than this fixed JSON layout needs.

## Decision

`@onto2d/model-pack/node` accepts a deliberately narrow, single-disk ZIP32
profile. An archive contains the same root-relative required files as a split
pack, optional known directory entries, and an optional `bundle.json`. Stored
and Deflate entries are accepted. ZIP64, encryption, data descriptors,
multi-disk archives, links, alternative Unicode path fields, duplicate or
unexpected paths, and unreferenced local bytes are rejected.

The loader bounds archive bytes, entry count, compressed entry bytes,
uncompressed entry bytes, total uncompressed bytes, and per-entry compression
ratio. It cross-checks central and local headers before asynchronous bounded
inflation, then checks declared length, CRC-32, UTF-8, and JSON. It never writes
extracted content to disk. The resulting values pass the existing Model Pack
reconstruction and identity verification.

`loadModelPackPath` dispatches only from the inspected filesystem type: a real
directory uses the directory loader and a real regular file uses the archive
loader. Symbolic links and other entry types fail closed. The CLI composes this
source loader and therefore accepts either representation without duplicating
transport logic.

## Consequences

- ordinary local ZIP archives can carry the transparent Model Pack layout;
- compressed bytes, timestamps, order, comments, and compression method are
  transport details and do not create a new model identity;
- CRC-32 detects ZIP transport corruption but is not semantic authority; the
  manifest hashes and full pack reconstruction remain authoritative;
- the profile does not promise general archive compatibility, remote fetching,
  caching, archive creation, executable content, or automatic repair;
- the browser transport is specified separately by ADR-0100; worker transport
  still requires its own protocol and resource model.
