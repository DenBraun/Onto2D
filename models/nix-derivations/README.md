# Nix Derivation Identity Model Pack

This directory contains the separate `nix-derivations` external Model Pack.
It preserves native Nix derivation paths, declared outputs, `inputDrvs`,
`inputSrcs`, builders, arguments, and environments from the pinned case capture.

Native direct `inputDrv` relations stay distinct from Onto2D's deterministic
transitive-closure and builder-environment projections. A declared output edge
does not claim that its builder ran. The input-addressed control remains
unrealized, so its output-content comparison is explicitly unresolved.

Build and verify:

```sh
npm run model:nix-derivations
npm run model:nix-derivations:verify
```

The release version is derived from the verified case source and case identity.
Nix and NixOS do not endorse Onto2D or this interpretation.
