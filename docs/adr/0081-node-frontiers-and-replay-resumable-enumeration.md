# ADR-0081: Node frontiers and replay-resumable enumeration

- Status: accepted
- Date: 2026-08-12

## Context

The decorated candidate enumerator already traversed node assignments
recursively, but exposed auditable frontiers only after every node had been
assigned. Its exhaustion cursor identified a location but did not contain
enough branch state to continue in a new process. Treating that diagnostic
cursor as a checkpoint would either skip work or duplicate semantic effects.

The kernel needs two distinct foundations: exact incomplete-node subtree
accounting for later audited pruning, and an interruption contract that can be
verified without trusting serialized executable stacks or engine-specific
generator state.

## Decision

`decorated-candidate-enumerator-v5` exposes internal strict node-assignment
frontiers after at least one and before all skeleton nodes are assigned. Every
frontier binds the skeleton, assigned and total node counts, remaining node
assignments, the exact raw edge completions per full node assignment, and the
exact total reachable raw candidates. Counts use closed integer combinatorics
and fail before exceeding the JSON safe-integer artifact boundary.

The low-level traversal can observe those frontiers without changing ordinary
output. An internal pruning hook may close a node subtree and then records
separate node-frontier and skipped-raw counts; `logicalRawCandidates` remains
the exact sum of visited raw leaves, edge-frontier skips, and node-frontier
skips. This hook alone does not authorize package predicate pruning. Package
controllers must first receive a separate incomplete-node audit contract.

`resumable-decorated-candidate-enumerator-v1` adds a public, engine-independent
checkpoint protocol over the ordinary raw-leaf order. A bounded step hashes
each raw candidate into a chained prefix transcript. When its step ceiling is
reached it publishes:

- the exact next raw-candidate ordinal;
- input and enumeration-option hashes;
- the prefix transcript and prior-checkpoint link; and
- a domain-separated checkpoint hash.

Continuation deterministically replays the prefix, verifies the transcript,
and only then advances the next window. This is deliberately
`deterministic-prefix-replay-v1`, not an O(1) serialized VM stack. It trades
repeated navigation for portable, inspectable state and introduces no new
semantic ordering.

The per-step ceiling is an operational pause boundary only. It never resets or
bypasses `maxRawCandidates`, `maxCandidates`, `maxDecorationStates`, or
canonicalization limits. Exhausting one of those semantic budgets is terminal
`budget-exhausted`, not a resumable pause. When the raw universe ends, the
coordinator returns the ordinary complete v5 enumeration; no separately
merged candidate store is trusted. Stored step artifacts require exact
reproduction from the same input, options, checkpoint, and step ceiling.

## Consequences

- interruption state is content-addressed and portable across processes;
- a modified input, execution option, ordinal, transcript, or checkpoint link
  fails before continuation;
- completed resumable output is byte-identical to ordinary enumeration;
- small step sizes may replay substantial prefixes and are therefore a
  correctness mechanism, not yet a constant-time performance cursor;
- incomplete-node descendant accounting is executable; ADR-0082 subsequently
  freezes its separate predicate audit/controller and differential generator;
- `POST-CLOSURE-VIS-01` remains scheduled after the full kernel closure gate.

## Verification

Conformance covers exact two-node frontier counts, authorized internal subtree
skips with raw-census reconciliation, three-step pause/resume completion,
prefix replay counts, terminal equality with ordinary enumeration, checkpoint
tampering, exact step replay, semantic budget non-bypass, configured-kernel
exposure, TypeScript declarations, strict Draft 2020-12 schemas, and Node.js
20/22 execution.
