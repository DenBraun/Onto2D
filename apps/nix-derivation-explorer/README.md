# Nix Derivation Identity Lab

This static, light-theme laboratory reads the bounded artifact in
`cases/nix-derivation-identity/`. Before rendering, it verifies the artifact's
exact raw SHA-256 and then validates its native/derived evidence boundary in the
browser model.

The four frozen experiments can be compared under five regimes: output
content, native derivation, transitive input closure, builder environment, and
the explicitly defined output-content history class. An unrealized output is
shown as `UNRESOLVED`; it is never silently treated as equal or different.

Run locally from the repository root:

```sh
npm run dev:site
```

Then open `/apps/nix-derivation-explorer/`. Focused tests:

```sh
node --test apps/nix-derivation-explorer/*.test.mjs
```
