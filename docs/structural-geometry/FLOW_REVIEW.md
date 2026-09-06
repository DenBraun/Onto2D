# Shadow flow implementation review

Date: 2026-09-06.
Scope: computational stage 5 under the [adopted flow contract](SHADOW_FLOW.md).

## Findings and corrections

- Used the shortest endpoint distance in the curvature denominator and update.
  Applied exact metric closure before normalization, including at state zero;
  arbitrary positive initial lengths cannot silently become a different metric.
- Kept all updates simultaneous and all lengths separate from verified source
  records. Full source verification precedes induced-scope selection. Source
  snapshots and normalized input are captured before awaiting the solver.
- Extended the external transport algorithm to rational costs while retaining
  integer mass units. Every state carries an exact primal/dual witness. The
  shared private process helper preserves the existing Ollivier protocol.
- Distinguished exact fixed points, period-two recurrence, finite tolerance,
  iteration caps and proposed zero lengths. No artificial epsilon, clamping or
  convergence claim conceals a failed or degenerate step.
- Made final cuts strict and analytical. Isolates and both weak/strong component
  memberships remain visible, and cuts never alter flow or source edges.
- Bound the full requested history before solving, and bounded exact-number
  growth and artifact size. Python validates every problem before optimization;
  its rational syntax and digit limits agree with the portable verifier.
- Included per-step solver, request, metric and previous-state bindings. Full
  replay rejects forged objectives, altered lengths, false stopping decisions,
  missing/extra states and rehashed fabrications.
- An initial test expected the flow byte-limit code for a single oversized
  string, which is rejected earlier by the canonical codec. Changed that test
  to bounded individual strings whose combined request exceeds the pipe limit.
- Exported all seven closed schemas, both public subpaths and readonly types.
  Updated the workspace schema census from 175 to 182.

## Computational evidence

The focused check passes 23 tests covering normalization, exact path evolution,
fixed points, a period-two cycle, zero-length proposals, both convergence deltas,
strict cuts, scope boundaries, source immutability, permutation/reversal/Unicode
invariance, malformed inputs and certificates, process failures, engine opt-in,
all schemas and full published-history verification in a browser bundle.

All 11 frozen runs replay byte for byte: 68 states / 1089 edge calculations.
The separate Python `Fraction` recurrence from Ni et al., Appendix E, matches
every length, transport value and curvature in the 17-state `G(3,2)` trajectory.
A final threshold of 2 recovers the three known four-node groups. The finite
run correctly retains its `iteration-limit` stopping reason.

NetworkX 3.2.1 was executed in an isolated local environment. Dijkstra paths and
integer-scaled network simplex independently reconstructed every state,
normalization trace, stopping record and final cut. All results agree exactly;
the frozen output identifies the algorithm source hash. CI includes a fresh
NetworkX check for both Ollivier and flow, in addition to ordinary replay.

Final local validation on Node 24.19.0 / Python 3.9.6 / macOS:

- `npm test`: 1303 passed, 0 failed, 0 skipped (203.46 seconds).
- `npm run build`: all repository checks passed, including foundation replay,
  72 metric experiments, the 40-run Ollivier suite and the 11-run flow suite.
- All 182 JSON schemas, 16 workspace export boundaries and published TypeScript
  declarations passed; the kernel remains at 195 implemented capabilities.
- Both independent NetworkX reference commands passed: 40 Ollivier runs and
  11 complete flow trajectories.
- Documentation validation passed for 306 Markdown files.
- The public README flow example executed and its artifact verified against
  the unchanged source. A separate numeric-growth probe rejected oversized
  reduced results before starting the solver, with no partial artifact.
- Package dry run contains both flow subpaths, readonly declarations, the
  shared process helper and both Python files (28 packaged files).
- `git diff --check` passed; the preserved original roadmap hash is unchanged.

The CI matrix and fresh independent-reference checks are configured. Remote CI
and other operating systems were not executed as part of this local validation.

## Limits and remaining work

This is a bounded computational reference, with no claim of independent
scientific review, empirical utility or general directed convergence. The two
Causal Emergence fragments each stop at their six-step cap. Long runs can exceed
the rational digit bound even on small graphs; full-model scale, iterative
surgery and approximate scalable solvers need separate policies.

This review records the completed legacy flow stage. The subsequent
[research revision](REVISED_ROADMAP.md) adds flow control coverage and places
providers, distinguishability and response/comparison work before persistence.
Source semantics, kernel evidence rules and browser applications keep their
existing contracts. Both user-supplied proposals remain preserved as research input.
