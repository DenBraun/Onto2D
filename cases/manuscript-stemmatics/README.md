# Manuscript Stemmatics

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
