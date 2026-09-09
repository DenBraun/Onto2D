# Structural Geometry Lab

The [laboratory](index.html) is the D7 presentation of the verified Structural
Geometry tools and biological studies. The [homepage](../../index.html) connects
a distinguishability foundation to canonical identity, network motifs and
historical load, followed by the geometry laboratory.

## Local use and verification

```sh
npm run structural-geometry:site:build
npm run structural-geometry:site:check
node --test apps/structural-geometry-lab/model.test.mjs test/apps/public-site.test.mjs
npm run dev:site
```

Open `http://127.0.0.1:8080/` and
`http://127.0.0.1:8080/apps/structural-geometry-lab/`.
The site check also runs in `npm run build`. Run `npm test` and `npm run build`
for repository validation. Site generation needs the committed reports and
installed workspace dependencies; it does not need ignored native-data caches,
new downloads, Python training or a full biological replay.

`build.mjs` validates D6.5 and its transitive biological dependencies, D6.1,
and the selected independent geometric/comparison references. It projects the
frozen results into `evidence.json`, packages three geometric fixtures and nine
comparison controls into `controls.json`, bundles the browser worker and writes
byte counts and SHA-256 pins to `release.js`. Check mode recomputes these outputs
and requires exact bytes. Generated files must be rebuilt together.

The page verifies both JSON payloads against those release pins. The worker
replays the nine structural comparisons, verifies the selected Forman/Ollivier
and flow receipts, and runs response probes under the selected regime. The
browser recalculates biological model summaries and paired gains from stored
integer rank counts, with equal intervention and group weights. It does not
retrain models or repeat independent reference checks or biological experiments.
The JavaScript and its release descriptor are part of the trusted static site;
a checksum is consistency evidence, not a separate trust authority.

## Interaction and evidence boundaries

The graph pair and selected edges persist through Graph, Geometry, Flow and
Signature. Changing the pair or regime terminates the preceding worker and
rejects stale replies. Animation stops on selection, view changes and page
visibility loss; focusing an edge selector also pauses it so redraws cannot
interrupt keyboard input. There is no automatic animation. Narrow layouts stack graphs;
keyboard tabs, native edge selectors and numeric tables expose the same data.

The geometric metric is fixed separately from the three observation regimes.
Synthetic fixtures use unit Forman, directed predecessor/successor Ollivier with
half idleness, and normalized shadow flow with a maximum of eight iterations.
Screen coordinates never represent metric lengths. A stopped graph retains its
last recorded state with an explicit label. An early fixed point does not fill
missing states in the fixed-horizon geometric signature. Incomplete static
Ollivier evidence remains partial even when that graph has complete flow evidence.

Three compact instrument controls precede the lab. Biological results are a
separate section with all three primary/secondary outcomes, six feature models,
five metric variants, four scope outcomes, parent-degree coverage, null failures,
and unavailable alternative anatomy. Scope comparisons refit both contexts on
the same target rows. Parent-degree coverage is distinct from evaluation coverage.
The synthetic zero is retained as a separate discrimination task. Report links
include semantic hashes, exact file hashes and recorded offline costs.

A failed evidence load clears biological results and disables its selector. A
failed or timed-out worker clears the lab without discarding independently loaded
biological evidence. Reload retries either path. Check both failures, fast regime
switches, early-stop flow, missing measurements, keyboard navigation and
320/390/768/1440 px widths during browser review.

The scientific interpretation and future research belong to the consolidated
[research plan](../../docs/structural-geometry/RESEARCH.md) and
[evidence guide](../../docs/structural-geometry/EVIDENCE.md). This local page does
not constitute an external review, deployment or first published release.
