# Three-node motifs

This frozen case asks whether an Onto2D-canonical catalogue and an independently
reproducible motif census recover the published three-node result for the
*E. coli* transcription network.

The case contains all 13 weakly connected, loopless directed triad classes.
`motif-catalog.json` is the authoritative list of edge sets, Davis–Leinhardt
triad codes, mFinder IDs, human names, and Onto2D candidate canonical IDs.

## Frozen external comparison

The selected network is the original ColiNet 1.0 dataset accompanying
Shen-Orr et al. (2002). The analyzed file is the unsigned 519-edge version with
autoregulation removed. Its raw columns are `target, source, value`; import
therefore reverses the first two columns. The full 424-entry dictionary defines
the node universe, including isolated operons.

The primary comparison is Milo et al. (2002): 40 observed feed-forward loops,
`7 ± 3` in 1,000 randomized networks, printed `Z = 10`, and no other significant
connected three-node motif at `P < 0.01`. Exact citations and the agreement
criteria frozen before execution are in `published-reference.json`.

Raw source files are intentionally not republished because the archived author
README states no redistribution license. `source-lock.json` records original
URLs, archival snapshots, byte lengths, and SHA-256 hashes.

## Reproduce

Node.js 22 or newer is required; this case has no npm dependency.

```sh
node cases/three-node-motifs/scripts/fetch-sources.mjs
node cases/three-node-motifs/run.mjs
```

The second command performs 1,000 deterministic degree-preserving null trials
and writes `artifacts/analysis.json`. Use `--trials N` only for a smoke test;
such output is not the frozen comparison artifact.

## Method boundary

The Onto2D kernel canonicalizer supplies the 13 graph identities. Network-wide
triad enumeration and random edge switching live in this case because the
kernel's current null-model APIs randomize finite candidate populations, not a
large external graph. The switcher reproduces the mFinder 1.2 ensemble and
proposal/rejection policy while replacing its wall-clock-seeded RNG with a
frozen deterministic stream. It is an ensemble reproduction, not a replay of
the authors' unavailable random draws.
