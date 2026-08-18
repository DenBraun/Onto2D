# Git History Identity Lab

This focused interface reads the exact committed artifact from
`cases/git-history-identity/`. Before rendering, it checks the raw artifact
SHA-256 pinned in `git-history-lab.js` and validates all commit, tree, parent,
history, comparison, and regime references through the pure browser model.

The four experiments cover independent convergent histories, different
intermediate path lengths, merge versus linear topology, and a metadata-only
commit change. In every comparison the final Git tree is equal and the native
commit object differs. Parent-closure identity differs in the first three and
remains equal in the metadata-only experiment.

The interface changes only the selected projection. It never modifies the
object IDs or treats Git parentage as a generic causal relation.

Run the focused tests with:

```sh
node --test cases/git-history-identity/tests/*.test.mjs
node --test apps/git-history-identity-lab/*.test.mjs
```
