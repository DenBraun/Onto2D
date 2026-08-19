# ADR 0115: Keep language classification, borrowing, and similarity in separate relation layers

Date: 2026-08-18

Status: Accepted

## Context

Historical-language models are not pure trees. Published genealogical
classification supplies vertical structure, while lexical borrowing supplies
horizontal transmission. Surface resemblance can be useful for inspection but
does not by itself establish either cognacy or descent. The WOLD records also
carry different kinds of uncertainty: certainty about a recorded source
relation and confidence that the target form is borrowed are separate fields.

## Decision

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

## Consequences

The graph can show horizontal transmission without corrupting genealogy. A
tree-only view may hide borrowing records but cannot delete them from the
model. Source certainty cannot silently upgrade borrowed-status confidence.
No proto-language, cognate set, or new phylogeny is inferred by this release.
