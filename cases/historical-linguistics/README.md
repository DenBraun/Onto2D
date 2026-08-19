# Historical Linguistics

This case projects one source-locked lexical concept across six WOLD/Lexibank vocabularies and joins each recipient language to its exact Glottolog 5.3 classification path. The result keeps three things separate: published genealogy, expert-curated borrowing annotations, and a deliberately weak surface-form comparison.

The flagship relation is WOLD borrowing row `5`: English `match` is recorded as the immediate source for Manange `miʃʌr`. The source relation is marked certain in that row, while the Manange form itself remains only `3. perhaps borrowed` with score `0.5`. Onto2D preserves both statements instead of flattening them into a single confidence claim. A second English-to-Dutch row shows that borrowing can also occur within a genealogical family.

Run `npm run case:historical-linguistics`, then verify with `npm run case:historical-linguistics:verify` and `node --test cases/historical-linguistics/tests`.

The committed files are small, reviewed projections of Glottolog CLDF 5.3 and Lexibank WOLD CLDF 4.2. `upstream.json` locks the upstream release tags, full source-file hashes, selected identifiers, projection hashes, licenses, and citations. Canonical builds require no live network access.
