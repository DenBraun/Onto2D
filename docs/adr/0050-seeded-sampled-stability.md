# ADR-0050: Seeded sampled `stableUnder`

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0049 froze exact stability for finite typed single-edit families but left
sampled execution unavailable. A run seed and a sample-count budget do not by
themselves determine a portable random stream, sampling frame, replacement
policy, treatment of invalid edits, statistical uncertainty, or a three-valued
decision. Reusing the exact ratio on a sample would incorrectly present an
estimate as a proof.

## Decision

The four typed perturbation kinds from ADR-0049 may explicitly select
`sampled-valid-single-edits-v1`. Omitting `enumeration` still selects the exact
`exhaustive-valid-single-edits-v1` default. Registry-only strings remain
non-executable.

The sampled frame is `applicable-single-edit-attempts-v1`: the same canonical,
definition-ordered attempt frame used by exact execution before graph-policy
validation. Sampling uses `with-replacement`; duplicate frame indexes are
independent denominator observations and remain visible in the witness. The
run's `budget.perturbationSamples` is the requested sample count. A non-empty
frame with a zero sample budget is `indeterminate`, while a structurally empty
frame still follows the definition's explicit `emptyPolicy`.

The stream algorithm is `sha256-rejection-counter-v1`. Package execution uses
the content-addressed RunConfig hash as its stream key. For each sample ordinal
and rejection counter, the evaluator hashes this tuple in
`onto2d:perturbation-sample-draw:v1`:

```text
stream algorithm
stream key
perturbation-context hash
predicate-plan hash
current canonical candidate ID
perturbation ID
sample ordinal
rejection counter
```

The SHA-256 digest is interpreted as an unsigned 256-bit integer. For frame
size `F`, values at or above `2^256 - (2^256 mod F)` are rejected; an accepted
value selects `digest mod F`. Thus every frame index has equal probability
without modulo bias. At most 1,024 counter draws are permitted for one sample,
and the witness records the selected frame index and number of stream draws.
Canonical relabelling cannot change the candidate ID or stream.

Each sampled attempt is then processed exactly as in ADR-0049. Invalid edits
remain skipped evidence and do not enter the valid sample denominator. Given
`n` valid sampled draws, `S` passing draws, and `I` indeterminate draws, the
runtime estimates the passing probability and the non-failure probability
`(S + I) / n` separately.

The uncertainty policy is `chebyshev-union-95-v1`. For either Bernoulli mean,
Chebyshev's inequality with variance at most `1/4` and radius
`sqrt(10 / n)` has error probability at most `1/40`. Applying the union bound
to the passing and non-failure means therefore retains at least 95% joint
coverage. The runtime uses only integer arithmetic and a conservative six-
decimal outward bound:

```text
q = 10^6
radius = ceil(sqrt(10 * q^2 / n)) / q
```

Observed proportions are floored for lower bounds and ceiled for upper bounds,
then expanded by `radius` and clamped to `[0, 1]`. The sampled operator passes
when the passing-probability lower bound is at least the exact decimal
threshold, fails when the non-failure-probability upper bound is below it, and
is otherwise `indeterminate`. Zero valid sampled draws are always
`indeterminate` unless the attempt frame itself is known to be empty and
`vacuous-pass` was explicitly selected.

The witness binds the stream contract and key, requested sample count, frame
size, sampling status, 95/100 confidence level, fixed bound precision, radius,
both confidence intervals, empirical exact fractions, every draw, and the
decision rule
`chebyshev-union-95-three-valued-bounds-v1`. Sampling and nested substructure
evaluation share the 10,000-operation ceiling; sampled frame materialization is
also capped at 10,000 entries.

The changed semantics use `local-predicate-evaluator-v16`,
`onto2d:predicate-local-evaluation:v16`,
`onto2d:perturbation-context:v2`,
`package-candidate-filter-evaluator-v17`, and
`onto2d:package-candidate-filter:v17`.

## Consequences

Sampled stability is deterministic for one bound run, invariant under graph
relabeling, independently reproducible from published artifacts, and explicit
about statistical rather than exhaustive evidence. Changing the run seed,
sample budget, package definition, plan, candidate, or sampling contract
changes the relevant content hash and stream.

The confidence rule is deliberately conservative, especially for small valid
sample counts. A sampled result may therefore remain `indeterminate` even when
its empirical ratio is far from the threshold. Passing sampled stability does
not authorize generator pruning and does not become an exhaustive proof.
