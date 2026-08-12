# ADR-0056: Generalized depth-aware audited pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0053 through ADR-0055 establish a fail-closed pruning chain for the
primitive depth-one universe: a deterministic canonical monotonicity audit, a
separate authorization controller, pre-admission pruning, an independently
framed raw generator-frontier audit, recursive subtree closure, and exact
differential conformance. Later closure depths already have deterministic
source selection and candidate binding, but reusing a depth-one pruning
artifact would omit the prior-level chain and selected source population from
the authorization identity.

The generalized path must preserve the depth-one algorithm without changing
its existing bytes, while making every later-depth audit, decision, transcript,
and result independently content-addressed and reproducible.

## Decision

The depth-aware pruning APIs accept a loaded package, RunConfig, complete
contiguous `PackageClosedLevel` chain, and explicit `targetDepth`. They first
reproduce `package-depth-candidate-binding-v2`, including the exact
`all-below` or `previous-only` source selection. Every emitted artifact binds:

- `targetDepth`;
- `sourcePopulationHash`, equal to the reproduced depth-source selection hash;
- the package, rules, run, and depth binding hashes;
- a depth-specific artifact version and domain-separated hash.

`package-depth-predicate-monotonicity-auditor-v1` applies the ADR-0053
canonical-prefix falsification model to the complete target-depth canonical
universe. Its controller authorizes only the same statically proven, audited,
reproduced persistent failure as the depth-one controller.

`package-depth-pruned-candidate-generator-v1` applies the prepared controller
before CandidateStore admission and proves exact eligible and indeterminate
set equality against a pruning-disabled depth-aware filter session.

`package-depth-generator-frontier-auditor-v1` observes the actual raw
edge-group traversal and samples reachable complete extensions under the
reproduced target binding. Its controller retains all ADR-0055 frontier
validation and directed-strong connectivity gates.
`package-depth-recursive-pruned-candidate-generator-v1` records exact skipped
subtree and traversal counts, retains canonical-prefix pre-admission checks,
and proves agreement with both the depth-aware pre-admission-only artifact and
the pruning-disabled target-depth universe.

All verification APIs reproduce the full artifact from the supplied package,
RunConfig, prior-level chain, target depth, audit limits, and execution limits.
Schema validity and self-declared hashes are never sufficient. The depth-one
public artifacts retain their original versions and hash domains.

The optimized path is explicit. Ordinary level and ladder closure continue to
use their existing exhaustive generator until a separately reviewed policy
chooses the optimized path; this ADR does not silently change closure results
or budget interpretation.

## Consequences

- Audited pre-admission and recursive edge-group pruning are available at any
  supported target depth with a verified contiguous prior-level chain.
- A pruning artifact cannot be replayed against a different target depth,
  source selection, prior-level result, package, ruleset, run, or kernel
  version.
- Existing depth-one artifact bytes and APIs remain compatible.
- Formation-derived decoration attributes and automatic closure integration
  remain separate gates. ADR-0081 subsequently supplies exact low-level node-
  frontier accounting and replay-resumable traversal; ADR-0082 adds separately
  audited generalized-depth node-growth pruning.

## Rejected alternatives

- Reusing depth-one hash domains was rejected because identical payload
  fragments must not cross semantic depth boundaries.
- Trusting caller-supplied source elements was rejected because source-depth
  semantics and prior-level verification would become bypassable.
- Binding only `targetDepth` was rejected because two prior-level chains may
  select different source populations at the same depth.
- Enabling pruning implicitly inside all closure calls was rejected because it
  would change execution accounting without an explicit integration contract.

## Acceptance artifacts

- target-depth-two fixtures over a verified depth-one closure;
- exact equality among pruning-disabled, pre-admission, and recursive retained
  eligible/indeterminate result sets;
- exact skipped raw-candidate and decoration-state reconciliation;
- target-depth and prior-chain tamper rejection;
- public runtime, TypeScript, and six JSON Schema contracts;
- Node.js 20/22 repository checks, full suites, and builds.
