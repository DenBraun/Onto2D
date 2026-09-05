# History Benchmark Contract v1 — pilot profile

The [contract schema](../../packages/schemas/schemas/history-benchmark-contract.schema.json)
is closed, as are observation, view, target, split, result, suite and registry
schemas. Runtime validation additionally checks source uniqueness, population
joins, exact bindings, cutoff and event order. Unsupported designs are rejected.

Contracts carry source-byte hashes, canonical observation/target hashes, builder
hash, evaluator implementation hash and version, population, view definitions,
cutoff policy, selection/split policy, oriented metric/resolution, null plan and
interpretation boundary. Changing an interpretation-bearing field changes the
contract identity. Filesystem paths identify source locks inside the repository;
canonical result identity contains no execution timestamp or platform label.

The only evaluator is `identity-partition-v1`: compare equality of P, and of
the tuple (P, ordered H), against equality of separately stored target labels.
Every unordered unit pair is evaluated. Error is the disagreement count divided
by pair count; oriented gain is (P0 errors − P1 errors) / pair count. Integer
counts are authoritative, and the numeric rendering uses ECMAScript binary64.
Resolution is declared in [0,1]; there is no fitted statistical uncertainty.
Ordinal cutoffs establish declared availability order, not physical wall time.

The only split is `complete-census`. No training or held-out predictive claim
is supported. Unit rows are sorted by ECMAScript UTF-16 code-unit ID order before hashing/evaluation;
IDs and absolute ordinals do not enter features. Ordered historical values do.
Target labels can be null, which yields an indeterminate result without metrics.

`history-permutation-v1` sorts donor histories by domain-separated SHA-256
priorities of seed, trial and unit ID. Assignments are bijective and fully
recorded. These hash-priority trials are deterministic diagnostics, not uniform
random samples or a p-value. The null can be diagnostic or required to have a
mean error worse than P1 by more than the declared resolution. A reassigned
history is explicitly a counterfactual control, never admissible source evidence.

| Result | Meaning |
| --- | --- |
| positive | P1 improves beyond resolution, and any required null comparison passes |
| negative | P1 worsens beyond resolution |
| neutral-within-resolution | No difference beyond the declared resolution |
| indeterminate | Missing target, insufficient census, incomplete null or unmet required null comparison |
| invalid | Input binding, population, cutoff or order violation |
| not-evaluated | Registry member without a run; no primary metric |

Malformed shape, unsupported profiles and outcome-aware selection declarations
throw typed validation errors rather than yielding a scientific verdict.
An exhausted null retains any completed primary metric but makes the verdict
indeterminate. Verification recomputes the full result, not merely its hash.
Suite construction replays every member and rejects duplicate benchmark IDs.
Execution options are plain canonical data with an optional integer
`maxNullTrials` in [0,256]. Null budgets, arrays, unknown fields and accessors
are rejected; a malformed budget cannot silently select the full ensemble.

`EVALUATED` means a complete reproducible run exists; it does not mean
`REPLICATED` or `REVIEWED`. The pilot builder can intentionally regenerate
contracts, but `--verify` never writes and rejects any drift. A new frozen
artifact hash does not itself prove preregistration before seeing outcomes.
