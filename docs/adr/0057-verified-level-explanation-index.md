# ADR-0057: Verified level explanation index

- Status: accepted
- Date: 2026-08-12

## Context

Level closure already embeds the complete census, selector admission,
selected formations, derived profiles, and derived population. Those artifacts
contain candidate explanations, but a consumer must manually join several
arrays and could accidentally combine records from different runs or levels.
The target `explain({ runHash, candidateId })` API cannot safely operate until
an external artifact store is bound; recomputing from ambient package state
would make a plausible answer under the wrong rules.

The kernel needs a deterministic intermediate boundary that makes candidate
lineage directly queryable without introducing filesystem persistence or UI
state.

## Decision

`package-level-explanation-indexer-v1` accepts a loaded package, RunConfig, one
ordinary or depth-aware closed level, any required prior-level chain, and the
same execution limits used by closure. It first performs exact level replay.
An ordinary depth-one level rejects unexpected prior levels; a depth-aware
level reproduces its complete contiguous chain and target depth.

The index binds the package, rules, depth basis, run, level, counting domain,
source population, and the five embedded artifact hashes. It emits exactly one
entry for each candidate in the complete census. Every entry contains:

- the complete local filter and predicate witnesses;
- the final admission decision and selector witnesses;
- the selected formation or `null`;
- the derived-profile result or `null`;
- every derived-element and derivation record caused by that candidate.

Admission, formation, and profile coverage is reconciled before hashing. A
selected candidate must have one formation and one profile result; an
unselected candidate has neither. Derivation links must resolve to materialized
elements and to candidates in the indexed census. Duplicate keys fail.

The complete snapshot is hashed in
`onto2d:package-level-explanation-index:v1`. A candidate query validates the
snapshot's content hash, requires a canonical candidate ID, and returns the
exact stored entry plus its package/rules/run/level/index identity under
`onto2d:package-level-candidate-explanation:v1`. Consumers handling serialized
or untrusted indexes must first use exact reproduction verification; the hash-
only query is a lookup operation, not proof that upstream science was valid.

This contract is independent of presentation. It supplies data that a later
report or visualization may consume, but does not create a UI and does not
activate the post-completion visualization gate.

## Consequences

- Ordinary and arbitrary target-depth candidates have one stable, directly
  queryable explanation lineage.
- Queries cannot silently switch run, rules, level, or source population.
- Empty, rejected, indeterminate, excluded, and selected candidates remain in
  the same complete index; missing formation/profile records stay explicit.
- Full run-bundle persistence, NDJSON storage, source-migration explanations,
  and ambient `runHash` lookup remain separate work.

## Rejected alternatives

- Looking up directly inside a caller-provided level without replay was
  rejected because a self-consistent but stale artifact would be accepted.
- Recomputing a candidate on demand was rejected because it could use different
  rules, source populations, or execution limits than the recorded level.
- Indexing selected candidates only was rejected because rejection and
  indeterminacy explanations are part of the complete scientific result.
- Embedding presentation strings or layouts was rejected because UI state is
  outside the kernel.

## Acceptance artifacts

- ordinary depth-one and verified depth-two lineage fixtures;
- complete candidate/admission/formation/profile/derivation reconciliation;
- exact index replay and tamper rejection;
- unknown-candidate and wrong-prior-chain rejection;
- independent index and query hash reproduction;
- public TypeScript and JSON Schema contracts with runtime conformance;
- Node.js 20/22 repository checks, full suites, and builds.
