# Nix Derivation Identity

This bounded external case demonstrates one precise result:

```text
same verified output bytes
does not imply
same Nix derivation, input closure, or builder environment
```

The flagship pair consists of two native fixed-output derivations. Both point
to one Nix-materialized 61-byte content object with SHA-256
`4a958ba7aa27996b7bee723e819f7871a02733985f2c4088c0484c061340ee45`,
but their native `.drv` store paths, transitive input-closure identities, and
declared builder-environment identities differ.

## Evidence boundary

The committed capture was created with the official Nix 2.31.0
`aarch64-darwin` release archive. Its URL and SHA-256 are recorded in
`capture/metadata.json`. Nix instantiated all nine derivations and emitted both
their derivation JSON and raw ATerm `.drv` bytes. Extraction cross-checks those
representations field by field.

No derivation builder ran. The fixed content object was added with
`nix store add-file` and inspected with `nix path-info`; that is content
evidence, not evidence that either derivation was realized. The input-addressed
control is deliberately unrealized, so output-content and history-class results
for the addressing-mode comparison are `unresolved`.

This boundary follows Nix's documented separation between a derivation's
inputs and outputs, its output addressing method, and the derivation JSON
representation:

- [JSON representation of derivations](https://releases.nixos.org/nix/nix-2.31.0/manual/protocols/json/derivation.html)
- [Input-addressed outputs](https://nix.dev/manual/nix/2.34/store/derivation/outputs/input-address)
- [Content-addressed outputs](https://nix.dev/manual/nix/2.32/store/derivation/outputs/content-address)

## Fixture and projections

The fixture contains nine derivations, eight native direct `inputDrv`
relations, and five transitive-only relations derived by Onto2D. A second-level
shared leaf makes the direct/transitive distinction observable rather than
merely nominal.

Five comparison regimes are versioned in the artifact:

1. verified output-content SHA-256;
2. native `.drv` store path;
3. exact transitive input closure and topology;
4. `builder-env-v1` over system, builder, arguments, and environment;
5. output-relative history equivalence under `output-content-v1`.

The four experiments cover the flagship same-content pair, partially shared
closure, an environment-only mutation, and fixed-content versus
input-addressed output semantics.

## Reproduce and verify

The standard verification path uses the committed native capture and requires
only the repository's Node.js dependencies:

```sh
npm run case:nix-derivation:verify
npm run model:nix-derivations:verify
node --test cases/nix-derivation-identity/tests/*.test.mjs
node --test models/nix-derivations/*.test.mjs
node --test apps/nix-derivation-explorer/*.test.mjs
```

Recapturing requires exactly Nix 2.31.0 on `aarch64-darwin`:

```sh
ONTO2D_NIX_BIN=/absolute/path/to/nix npm run case:nix-derivation:capture:verify
```

`ONTO2D_NIX_LIBRARY_PATH` may be supplied for a relocatable official binary.
The capture uses an isolated root-remapped local store and disables
substituters. A different Nix version or any byte drift fails closed.

## Artifacts

- `capture/` — Nix-native JSON, raw `.drv` bytes, output path evidence, and the
  exact runtime/source lock;
- `artifacts/nix-derivation-identity.json` — deterministic case artifact;
- `schema/nix-derivation-identity.schema.json` — closed transport schema;
- `src/nix-identity.mjs` — independent ATerm verification and identity
  projections;
- `models/nix-derivations/` — separate verified Model Pack;
- `apps/nix-derivation-explorer/` — artifact-hash-pinned light-theme lab.

No Historical Load value is defined. The case has no declared complete finite
counterfactual construction space or cost function, so presenting such a
number would exceed the evidence.

Nix and NixOS do not endorse Onto2D or this interpretation.
