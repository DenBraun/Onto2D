# Git History Identity — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity

Domain:
    Version control

Evidence profile:
    direct-record
    derived
    counterfactual

Historical Load:
    Not primary

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Not primary
```

Status: **implemented**. The reproducible fixture, result matrix, evidence
boundary, and verification commands are documented in
[`cases/git-history-identity/README.md`](../../cases/git-history-identity/README.md).

## Purpose

Create the smallest rigorous external case showing that identical current state
does not uniquely determine history.

Primary distinction:

```text
same tree state
    !=
same commit identity
    !=
same ancestry
```

This case should become the canonical introductory Onto2D demonstration of
state/history separation.

## Outputs

```text
cases/git-history-identity/
apps/git-history-identity-lab/
docs/cases/GIT_HISTORY_IDENTITY_IMPLEMENTATION.md
```

A registered Model Pack is optional for the first version.

## Scope

Use a deterministic local fixture repository created entirely by test code.

Do not depend on a large public Git repository for the canonical experiment.

The fixture must create at least two histories converging to the same final tree.

## Canonical Fixture

Target:

```text
History A                 History B

A0                        B0
 |                         |
A1                        B1
 |                         |
A2                        B2
  \                       /
   +--- same final tree --+
```

Required:

```text
tree(A2) == tree(B2)
commit(A2) != commit(B2)
ancestry(A2) != ancestry(B2)
```

The fixture builder must record exact object IDs.

## Phase 0 — Deterministic Fixture Builder

Create:

```text
cases/git-history-identity/build-fixture.mjs
```

Tasks:

- initialize a temporary repository;
- set deterministic author/committer identity;
- set deterministic timestamps;
- create histories A and B;
- force the same final file tree;
- export commit, tree, blob and parent identities;
- verify expected invariants.

Prefer plumbing commands where they make identity construction explicit.

## Phase 1 — Extract Git Objects

Create a bounded representation of:

```text
blob
tree
commit
parent relation
ref
```

Every object record must preserve the Git object ID.

Do not reinterpret commit parentage as a generic causal edge; keep the native
relation visible.

## Phase 2 — Identity Regimes

Implement explicit comparison regimes:

### Tree Identity

Two states are equal when the selected tree object is equal.

### Commit Identity

Two states are equal only when commit object identity is equal.

### Ancestry Identity

Compare parent closure and graph structure.

### Historical Equivalence

Allow an explicit regime that collapses different histories when their final
tree is identical.

No regime is "the correct one" globally.

## Phase 3 — Experiments

### Experiment A — Same tree, different ancestry

Canonical experiment.

### Experiment B — Different intermediates, same result

```text
A -> B -> X
A -> C -> D -> X
```

### Experiment C — Merge topology

Create two histories producing the same final tree, one with a merge commit and
one linearized.

Compare:

- tree;
- commit;
- parent graph;
- path length.

### Experiment D — Metadata-only commit identity change

Keep tree unchanged but change commit metadata.

This demonstrates that Git commit identity encodes more than filesystem state.

## Phase 4 — Explorer

Main layout:

```text
LEFT: History A
CENTER: Current-state comparison
RIGHT: History B
```

Controls:

```text
Compare by:
[Tree] [Commit] [Ancestry] [History class]
```

Inspector:

- object ID;
- type;
- parent(s);
- tree;
- source command/fixture step;
- identity result.

The page should communicate the main result in under one minute.

## Phase 5 — Onto2D Mapping

Map only concepts demonstrated by the fixture:

```text
CurrentState
HistoryNode
ParentRelation
IdentityRegime
HistoryEquivalence
```

Do not introduce Historical Load in the first implementation unless a finite
counterfactual construction space is explicitly declared.

## Phase 6 — Negative Tests

Required:

- same tree is detected as identical under Tree Identity;
- same pair is detected as different under Commit Identity;
- parent mutation changes ancestry result;
- metadata-only commit changes commit identity without changing tree identity;
- fixture rebuild is deterministic;
- no UI mode silently changes the underlying object IDs.

## Falsification Criterion

The case fails if Onto2D cannot represent:

```text
same current structure
+
different historical identity
```

without duplicating or corrupting the current-state structure.

## Definition of Done

A third party can run one command, generate the fixture, verify object IDs, and
open the Explorer showing that the same final tree belongs to multiple distinct
commit histories.
