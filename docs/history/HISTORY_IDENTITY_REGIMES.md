# History Identity Regimes

Updated: 2026-08-18

Onto2D does not define one universal identity relation. Identity is evaluated
under a declared regime `F`.

```text
CurrentStateIdentity != HistoricalIdentity
NominalIdentity != FullCurrentState
H1 ~F H2
```

A pair may be identical by Git tree and different by commit ancestry; identical
by output bytes and different by Nix derivation; identical by molecular target
and different by synthesis route; or identical by mineral species and different
by formation history.

Every identity or equivalence result must declare:

- the compared objects or histories;
- the regime and its version;
- included and ignored evidence;
- normalization rules;
- whether the result is exact, derived, inferred, or unresolved.

Different history does not automatically imply different identity. History
Equivalence is a separate analysis family from Historical Load.
