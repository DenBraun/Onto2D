# Manuscript Stemmatics

Case ID: `manuscript-stemmatics`. [History case registry](../history-case-registry.json).

- [Manuscript Stemmatics — use and reproduction](#manuscript-stemmatics--use-and-reproduction)
- [Manuscript Stemmatics — source and interpretation](#manuscript-stemmatics--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="manuscript-stemmatics--use-and-reproduction"></a>

## Manuscript Stemmatics — use and reproduction

This case projects a bounded, source-locked part of the New Stemmatics data for
Link 1 and *The Miller's Tale*. The complete upstream NEXUS file records 58
witnesses and 4,032 collation characters. The committed projection selects seven
witnesses, two source-discussed readings, published aggregate counts, and Peter
Robinson's attributed transmission claims.

The flagship is Cx2, Caxton's second edition. The published analysis describes it
as a copy of the Cx1 text corrected from a second, better manuscript. Onto2D
therefore keeps a tree-compatible base-text relation and a separate contamination
relation into Cx2. The better copy remains an unresolved exemplar reference: it is
not promoted to an extant witness and receives no invented identity.

The two displayed readings are deliberately illustrative, not representative of
the whole collation. Their agreement projection cannot create ancestry. The
published 207-reading correction profile and the scholarly claim remain separate
evidence records, and ablation never rewrites the source analysis.

Build with `npm run case:manuscript-stemmatics` and verify the committed artifact
with `npm run case:manuscript-stemmatics:verify`.

<a id="manuscript-stemmatics--source-and-interpretation"></a>

## Manuscript Stemmatics — source and interpretation

Exact release:

```text
case: manuscript-stemmatics-v1
case identity: sha256:f434de7c96b481ee68abcf13f4b50e216af99ce8710014061b5a7ff7ac574629
artifact: cases/manuscript-stemmatics/artifacts/manuscript-stemmatics.json
model: manuscript-transmission@v1-4581c6819fd2ab28
explorer: apps/textual-transmission-lab/
```

<a id="manuscript-stemmatics--source-and-interpretation--result"></a>

### Result

The selected tradition is Link 1 and *The Miller's Tale* from the New
Stemmatics data page. The source describes 54 manuscript witnesses and four
pre-1500 print editions. Its NEXUS file contains 59 taxa including the
collation base and 4032 transposed characters.

The bounded explanation projects seven witnesses and two explicitly discussed
reading sites. Those sites are selection-biased examples, not a representative
sample of the complete collation. Exact agreement over them creates neither a
copying relation nor ancestry.

Robinson's published analysis supports the flagship non-tree result:

```text
Cx1 ----------------------> Cx2 ----------------------> Pn
                              \\-----------------------> Wy
unresolved better copy ----> Cx2
```

The first input supplied the base text; the second is an attributed correction
source and is explicitly non-tree-compatible. Its physical identity remains
unresolved. Every transmission relation is a published interpretation, never a
directly observed historical event.

The published quantitative profile reports 207 differences between Cx2 and
Cx1 whose Cx2 reading also appears in more than three witnesses. This supports
the correction interpretation in the published analysis. It is not a count of
copying events and is not a Historical Load result.

Four exact ablations make evidence sensitivity inspectable. Removing only the
207-reading profile downgrades the correction source to attributed-only;
removing the multiple-exemplar claim withholds both bounded inputs into Cx2.
Removing the two displayed example sites does not remove the published
transmission relations, because those relations are not inferred from the
miniature display slice.

These outcomes are replayed by the extractor from an explicit relation-evidence
policy: missing required attribution evidence withholds a relation, while
missing corroborating evidence downgrades it to attributed-only. The values in
the analysis profile are regression expectations and are rejected if they
disagree with the independently derived result. The public verifier repeats
that replay, recomputes every witness identity, and admits only the exact
approved `manuscript-stemmatics-v1` case identity.

Historical Load is `null`, not zero: the source provides no finite admissible
reconstruction space, route-cost functional, or baseline route. The bounded
reconstruction status is `partial`, the central rooting is unresolved, and no
candidate actual past is invented.

<a id="manuscript-stemmatics--source-and-interpretation--purpose"></a>

### Purpose

Use manuscript textual traditions to test reconstruction of cultural ancestry
and, critically, histories that are not necessarily trees.

Primary distinctions:

```text
text similarity
    !=
copy ancestry
```

and:

```text
one witness
may inherit from
multiple exemplars
```

The second distinction is important for Onto2D because it tests multiple
historical parents and contamination/horizontal transmission.

<a id="manuscript-stemmatics--source-and-interpretation--primary-external-source"></a>

### Primary External Source

The New Stemmatics datasets:

```text
https://textualscholarship.org/newstemmatics/data/
```

The site publishes collations for several textual traditions and associated
expert scholarly analyses.

The implemented corpus is the site's Link 1 and *The Miller's Tale* dataset:

```text
MI.nex
sha256:b6b7b2114119a48cedad400bc1d2cfea80013e71bcf3d70b2e2f3a0ada6ce7b5

MIanal.pdf
sha256:55c0d2c1f50e844b1c465626ca1a5ff21b4d6d79ea10ff23cf450b7ecd8456b9
```

It was selected because the machine-readable collation is accompanied by a
page-located published analysis of Cx2's multiple-exemplar transmission. Exact
upstream byte counts, HTTP metadata, the data-page hash, and the source licence
statement are retained in `cases/manuscript-stemmatics/upstream.json`.

<a id="manuscript-stemmatics--source-and-interpretation--non-goals"></a>

### Non-goals

Do not:

- claim to recover the actual lost archetype automatically;
- treat textual similarity as direct ancestry;
- force the tradition into a tree;
- infer contamination without scholarly or explicit algorithmic evidence;
- invent missing witnesses;
- treat an editorial stemma as direct observation.

The following phase record is retained as the implementation and review
checklist. Every phase is complete for `manuscript-stemmatics-v1`.

<a id="manuscript-stemmatics--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D requires all historical ancestry to be a tree or
cannot keep textual evidence distinct from reconstructed transmission history.

<a id="evidence-contract"></a>

## Evidence contract

The Manuscript Stemmatics case and `manuscript-transmission` Model Pack keep
four independent layers:

1. selected NEXUS readings remain source-projected collation records;
2. exact selected-site agreement remains a selection-biased derived result
   that creates neither copying nor ancestry;
3. copying and base-text relations remain attributed published-analysis
   relations, never direct observations;
4. the better-copy correction source remains an attributed-contamination
   relation with `treeCompatible = false`.

The better copy is represented as an unresolved exemplar reference with no
invented shelfmark, extant witness identity, or exact identifier. Evidence
ablation partitions relations into supported, attributed-only, and withheld
sets without mutating the source claims. Historical Load remains `null` because
no finite reconstruction space, admissibility rule, route cost, or baseline is
declared.
