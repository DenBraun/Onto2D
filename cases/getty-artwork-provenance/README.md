# Getty Artwork Provenance

This case projects a deliberately small, source-locked Getty Provenance Index cohort into Onto2D. Four exact `HumanMadeObject` records (`A1981`–`A1984`) share one purchase activity; `A1983` also carries a later sale, two stock-book records, and current-context relations.

The extractor keeps source statements, derived comparisons, reconstructed missingness, and unknown content separate. A Getty `transferred_title_of`, `current_owner`, or source-record co-occurrence is preserved as the relation encoded by Getty; none is promoted to a legal-title determination. Dates remain intervals, the post-1938 transition remains an explicit gap, and no alternative chain is invented.

Run `npm run case:artwork-provenance`, then verify with `npm run case:artwork-provenance:verify` and `node --test cases/getty-artwork-provenance/tests`.

The committed source snapshots are CC0 Getty data. See `upstream.json` for exact entity URLs, retrieval metadata, byte counts, SHA-256 locks, source documentation, and attribution guidance.
