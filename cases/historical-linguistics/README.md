# Historical Linguistics

Case ID: `historical-linguistics`. [History case registry](../history-case-registry.json).

- [Historical Linguistics — use and reproduction](#historical-linguistics--use-and-reproduction)
- [Historical Linguistics — source and interpretation](#historical-linguistics--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="historical-linguistics--use-and-reproduction"></a>

## Historical Linguistics — use and reproduction

This case projects one source-locked lexical concept across six WOLD/Lexibank vocabularies and joins each recipient language to its exact Glottolog 5.3 classification path. The result keeps three things separate: published genealogy, expert-curated borrowing annotations, and a deliberately weak surface-form comparison.

The flagship relation is WOLD borrowing row `5`: English `match` is recorded as the immediate source for Manange `miʃʌr`. The source relation is marked certain in that row, while the Manange form itself remains only `3. perhaps borrowed` with score `0.5`. Onto2D preserves both statements instead of flattening them into a single confidence claim. A second English-to-Dutch row shows that borrowing can also occur within a genealogical family.

Run `npm run case:historical-linguistics`, then verify with `npm run case:historical-linguistics:verify` and `node --test cases/historical-linguistics/tests`.

The committed files are small, reviewed projections of Glottolog CLDF 5.3 and Lexibank WOLD CLDF 4.2. `upstream.json` locks the upstream release tags, full source-file hashes, selected identifiers, projection hashes, licenses, and citations. Canonical builds require no live network access.

<a id="historical-linguistics--source-and-interpretation"></a>

## Historical Linguistics — source and interpretation

Implemented release:

```text
Glottolog CLDF: v5.3 / 072ca0d
Lexibank WOLD CLDF: v4.2 / 1df62b9
selection: six recipient languages / LWT 1-87 “the match”
artifact: cases/historical-linguistics/artifacts/historical-linguistics.json
Model Pack: language-transmission@v1-557580b2872e9d7e
Explorer: apps/language-lineage-borrowing-lab/
```

<a id="historical-linguistics--source-and-interpretation--purpose"></a>

### Purpose

Test historical systems in which both vertical inheritance and horizontal
transfer matter.

Primary distinctions:

```text
lexical similarity
    !=
genealogical ancestry
```

and:

```text
history
=
vertical inheritance
+
horizontal borrowing/contact
```

This case complements manuscript stemmatics but operates at the language and
lexical-system scale.

<a id="historical-linguistics--source-and-interpretation--primary-external-sources"></a>

### Primary External Sources

Glottolog:

```text
https://glottolog.org/
```

Use it for stable languoid identifiers and published genealogical
classification.

Lexibank:

```text
https://lexibank.clld.org/
```

Use a pinned released Lexibank dataset for standardized lexical forms and
features.

World Loanword Database (WOLD):

```text
https://wold.clld.org/
```

Use WOLD for expert-curated loanword/source information where the selected
languages are covered.

CLDF should be preferred when a pinned machine-readable release exists.

<a id="historical-linguistics--source-and-interpretation--non-goals"></a>

### Non-goals

Do not:

- reconstruct Proto-Indo-European or another proto-language from scratch;
- infer cognacy from surface similarity alone;
- infer borrowing solely from geographic proximity;
- convert Glottolog classification into unquestionable ground truth;
- claim a universal language phylogeny;
- treat lexical borrowing as genealogical parentage.

<a id="historical-linguistics--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D can represent historical inheritance only as a tree or
cannot distinguish vertical ancestry from horizontal transfer.

<a id="historical-linguistics--source-and-interpretation--implemented-result"></a>

### Implemented Result

The definition of done is satisfied by a deterministic, offline build:

- six WOLD/Lexibank vocabulary records join to Glottolog through exact,
  unique Glottocodes;
- the selected Glottolog paths yield 40 deduplicated, attributed vertical
  classification edges;
- four WOLD source records remain horizontal relations local to one target
  lexical form;
- English → Manange is the flagship cross-family record; its
  `sourceCertain = true` field does not overwrite the target form's
  `3. perhaps borrowed` status and `0.5` score;
- English → Dutch demonstrates borrowing within a shared top-level family;
- four Unicode edit comparisons remain display-only and create zero cognacy
  assertions;
- three language pairs are compared under language-ID, family, lexical-state,
  and transmission-profile equivalence regimes;
- Historical Load is explicitly `null`: the case declares no route space,
  admissibility rule, baseline, or cost function.

The extractor locks both compact projections and the SHA-256 identities of the
full upstream CLDF files from which they were selected. Tests reject borrowing
as genealogy, similarity as cognacy, unstable joins, re-signed derived verdict
changes, and any attempt to replace the undefined Historical Load with zero.
The public verifier also recomputes the nested genealogy identity and admits
only the exact approved `historical-linguistics-v1` case identity, so a caller
cannot replace source locks or records and legitimize them by recomputing the
public content hashes.

<a id="evidence-contract"></a>

## Evidence contract

The `language-transmission` case and Model Pack use five independent layers:

1. Glottolog 5.3 classification paths are attributed
   `published-classification-parent` relations.
2. WOLD/Lexibank 4.2 lexical forms remain source records for one selected
   meaning.
3. Each WOLD borrowing row is represented as a record connected to a donor
   reference and one target form. It never uses the classification-parent
   relation.
4. Unicode edit similarity is a derived, non-evidentiary display signal with
   `cognacyStatus = not-asserted`.
5. Equivalence verdicts are local to one language pair and one named regime.

Glottocode is the cross-dataset join key. Source-specific ISO values remain
visible even when they differ or one source omits them. Historical Load is
`null` because no finite route-cost problem is declared.
