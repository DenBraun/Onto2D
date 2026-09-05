# Model Pack v2 proposal review

Date: 2026-09-05. Scope: the format proposal, draft schemas, synthetic examples
and documentation reference checks. This is an author review, not independent
format approval, release-golden acceptance or a runtime implementation review.

## Reviewed boundaries

| Concern | Finding and disposition |
|---|---|
| Repacking identity | Logical collection hashes exclude layout. One-file, split and annotated examples have the same root and three distinct manifests. |
| Partial trust | A deliberately inconsistent logical hash can coexist with individually valid manifest-bound chunks. Complete verification rejects it; the proposal explicitly disclaims root membership proofs. |
| Global closure | Gaps, overlaps, duplicate record IDs, count drift and dangling edges fail reference checks. No partial population is accepted as an engine Model. |
| Lineage cycles | Existing lineage-v1 endpoints contain roots and versions only. The target manifest hash is forbidden; the artifact descriptor is hashed after roots and before the manifest. |
| Historical claims | A supported lineage artifact needs local normalization and target binding. Actual structural diff validation and independent scientific review remain separate. |
| Optional data | Missing/corrupt data prevents whole-release success. Core-only verification remains explicit and uses rebuilt indexes; it cannot silently repair a failed release request. |
| Schema scope | Both draft transport schemas close their envelopes; semantic records retain v1 extension fields. Ordering, path pairing, hashes and closure are additional semantic checks. |
| Transport safety | Manifest-derived paths retain strict directory/ZIP/HTTP controls. Decoded byte lengths are distinct from compressed HTTP transfer lengths. |
| Resource claims | Chunking does not remove full-analysis memory costs or canonical limits. Cumulative budgets, overflow checks and concurrency ceilings are specified. |
| Compatibility | Current v1 verification still succeeds on a normal v1 pack and rejects draft v2 with `MODEL_PACK_COMPATIBILITY_UNSUPPORTED`. Registry/cache/worker need explicit version changes. |

Review corrected an ambiguity between optional index failure and core-only
verification: only a requested index is interpreted, and analysis uses indexes
rebuilt from complete semantic data. The v1 rejection test now checks the stable
error code instead of assuming an error-message spelling.
Review also added the local UTF-16 identifier bound: a JSON Schema length check
alone counts Unicode code points and can accept an identifier that v1 rejects.

## Reproduction and limits

```sh
node --test docs/model-pack-v2/proposal.test.mjs
npm test
npm run build
```

Validation results:

- Full repository run: 1,195 tests passed, zero failures, about 171 seconds.
- Final focused run: 34 checks passed, including the additional Unicode-bound
  regression added during review after the full run had started.
- `npm run build`: passed all integrated repository checks, including the
  existing 158 published schemas, release registry, catalogue and worker bundle.
- `npm run check:docs`: passed for 282 Markdown files after the review edits.
- All 63 pre-existing changed files remained byte-identical to the task baseline.

The repository test runner discovers the focused suite automatically.
SHA-256 replay uses Node's crypto implementation and
the existing kernel canonicalization; the example root hashes are also compared
with kernel SHA-256. A separate local Python standard-library calculation also
replayed all five ASCII/integer examples with 57 hash/length assertions. That
cross-check does not cover general Unicode or floating-point canonicalization.
These examples remain small author-generated vectors, not independent
conformance goldens.

The reference checks cover in-memory examples and adversarial mutations. They do
not implement or test a v2 transport, scheduling, persistent cache, worker state
machine, engine integration or a streaming canonical hash. Those require the
implementation milestones in the [proposal](README.md). There are no public v2
exports and no release fixtures or v1 runtime changes in this task.
