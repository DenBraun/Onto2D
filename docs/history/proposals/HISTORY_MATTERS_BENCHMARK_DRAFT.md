# Onto2D History Matters Benchmark
## Cross-Domain Evaluation of Operational History Dependence

**Status:** Proposed Onto2D core research program and repository update  
**Intended location:** `docs/history/HISTORY_MATTERS_BENCHMARK.md`  
**Project:** Onto2D  
**Scope:** Cross-case benchmark infrastructure, case contracts, reproducible evaluation, public Explorer  
**Primary question:** Does valid historical information add task-relevant information beyond a declared present-state representation?

---

# 1. Executive summary

Onto2D already contains a broad History Atlas spanning software, chemistry, materials, biology, ecology, medicine, law, linguistics, astronomy, cultural heritage, and other domains.

The existing History Atlas asks two independent questions:

```text
HOW is history available?

Recorded
Embodied
Reconstructed
```

and:

```text
WHAT can history change?

Identity
Present State
Future
```

That taxonomy is valuable, but a portfolio of examples is not yet a benchmark.

The next step should be a repository-level program called:

# History Matters Benchmark

Its purpose is to test, case by case, whether adding valid historical information changes the ability to resolve a declared task relative to a controlled present-state representation.

The core contrast is:

```text
PRESENT ONLY
      vs
PRESENT + HISTORY
```

with optional third and null views:

```text
PRESENT + HISTORY + EPISTEMIC PROVENANCE

PRESENT + SHUFFLED / WRONG HISTORY

HISTORY ONLY
```

The benchmark must not produce a single meaningless global "history score" across heterogeneous domains.

Instead, every case declares:

- what counts as the present state;
- what history is legitimately available at the cutoff;
- what target or decision is being evaluated;
- what evaluator is used;
- what metric is primary;
- what data leakage protections apply;
- whether the contrast is semantic, descriptive, predictive, experimental, or causal;
- what conclusion is and is not licensed.

Each case then emits a deterministic, content-addressed benchmark artifact.

The suite can summarize:

```text
History improves task performance
History makes no detectable difference
History degrades performance
Result is indeterminate
Contrast is invalid
Not evaluated
```

without converting any of these states into invented certainty.

The benchmark should be implemented **inside Onto2D**, but outside the locally closed schema-v1 kernel.

Recommended architecture:

```text
cases
  ↓
History Benchmark Contracts
  ↓
@onto2d/history-benchmark
  ↓
kernel canonical identity / null-model primitives
scientific-adapter for external evaluators where required
run-store for exact benchmark runs
  ↓
History Matters Benchmark Explorer
```

The first empirical flagship should be a redesigned full-cohort **Operational Aging / NASA C-MAPSS** contrast.

The first experimental flagship should be **LTEE Evolutionary Contingency**.

A semantic identity sub-suite can immediately use existing Git, OCI, Nix, reproducible-build, in-toto, chemistry, and related cases, but those results must remain explicitly distinct from empirical predictive evidence.

The long-term goal is a defensible statement such as:

> Across multiple independently specified domains, declared present-state representations were sometimes insufficient for identity, present-state discrimination, or future reachability; admissible historical information changed the result under preregistered, replayable, leakage-controlled contrasts.

That is a much stronger and more precise claim than:

> History matters everywhere.

---

# 2. Motivation

Onto2D has reached a point where adding more isolated History cases has diminishing scientific value.

The repository already demonstrates that history can be represented across radically different domains.

The next question is no longer:

> Can Onto2D represent historical information here too?

The next question is:

> What measurable difference does history make?

That requires moving from:

```text
case portfolio
```

to:

```text
benchmark corpus
```

and from:

```text
interesting historical examples
```

to:

```text
controlled contrasts with negative results allowed
```

The History Matters Benchmark is therefore not another case.

It is a layer across cases.

---

# 3. Current Onto2D baseline

The current History case registry already provides the correct high-level taxonomy.

It defines:

```text
historyModes:
    recorded
    embodied
    reconstructed

effects:
    identity
    present-state
    future
```

and tracks separate analysis families:

```text
historicalLoad
historyEquivalence
reachability
reconstruction
```

The benchmark should preserve these concepts rather than replace them.

It should introduce a new independent analysis family:

```text
historyMatters
```

Conceptually:

```text
History Atlas
    ├── taxonomy
    ├── evidence model
    ├── Historical Load
    ├── History Equivalence
    ├── Reachability
    ├── Reconstruction
    └── History Matters Benchmark
```

These analyses answer different questions.

---

# 4. History Matters is not Historical Load

This distinction must be explicit from the beginning.

## Historical Load

Historical Load asks, under a finite declared construction space and cost model:

> How much additional construction difficulty is introduced by historical admissibility constraints relative to a free baseline?

Conceptually:

```text
free admissible construction cost
          vs
history-conditioned construction cost
```

It requires a finite path space, admissibility regimes, and costs.

Many History Atlas cases correctly leave Historical Load undefined because those prerequisites do not exist.

---

## History Matters Benchmark

History Matters asks:

> Does adding legitimate historical information improve or change a declared task relative to a present-only representation?

Conceptually:

```text
task(P)
    vs
task(P + H)
```

It does **not** require a finite construction-cost model.

Therefore:

```text
Historical Load undefined
```

does not imply:

```text
History Matters impossible
```

Operational Aging is a good example.

Its current release cannot define Historical Load, but a properly redesigned full-cohort evaluation can still test whether observed history improves a declared future-outcome task.

---

# 5. History Matters is not History Equivalence

History Equivalence asks whether two artifacts or entities that are equivalent under one identity regime remain equivalent under another.

Example:

```text
same final bytes
different build history
```

This can establish:

```text
content-equivalent
history-distinct
```

History Matters instead asks whether history changes performance or resolution for a declared target.

Some History Equivalence cases can participate in the semantic sub-suite, but equivalence change alone should not be reported as predictive evidence.

---

# 6. Central scientific question

For each benchmark contrast, define:

```text
P = declared present-state information
H = admissible historical information available at cutoff
Y = target / decision / effect
```

Then compare:

```text
Evaluator(P)
```

with:

```text
Evaluator(P + H)
```

The benchmark asks:

> Does H add task-relevant information beyond P for Y under the declared evaluation protocol?

This wording is intentionally conditional.

It does not ask:

> Does history contain metaphysically irreducible information?

It does not ask:

> Can no possible present microstate ever encode the past?

It does not ask:

> Is the system fundamentally non-Markovian?

Those are stronger claims and require different evidence.

---

# 7. Connection to state sufficiency

The benchmark can be framed as an operational state-sufficiency test.

A sufficiently rich state representation should summarize the history relevant to a task.

If a declared present-state representation is sufficient for predicting Y, then adding legitimate historical information should not systematically improve the result.

Therefore:

```text
P + H performs better than P
```

supports the narrower conclusion:

> The declared present representation P was operationally insufficient for this target under this protocol.

It does **not** establish:

> No richer present representation P* could be sufficient.

This distinction protects the benchmark from a common philosophical and scientific objection.

A complete physical microstate may, in principle, encode traces of the past.

The benchmark is concerned with actual observable or declared state representations available to a scientific or engineering system.

---

# 8. Claim ladder

History Matters should define a hierarchy of claims.

This prevents semantic demonstrations from being mixed with empirical evidence.

## HM-0 — Representational history sensitivity

History changes a declared representation or classification.

Example:

```text
same bytes
different provenance identity
```

This is valid and useful, but usually semantic or policy-relative.

---

## HM-1 — Discrimination gain

History helps distinguish entities or states that are ambiguous under the declared present representation.

Example:

```text
two near-identical current machine frames
different operational histories
```

History separates them under a held-out target.

---

## HM-2 — Predictive utility

History improves held-out prediction of an independently defined outcome.

Example:

```text
current sensor frame
    vs
current frame + prior cycles
```

for remaining-life prediction.

---

## HM-3 — Experimental history-conditioned accessibility

Different recorded historical states produce different observed accessibility under a controlled replay or experimental protocol.

LTEE is naturally close to this level.

---

## HM-4 — Causal history effect

A valid causal design establishes that historical intervention itself changes the target.

This requires domain-specific causal identification.

Onto2D must not infer HM-4 from HM-0 through HM-3.

---

## HM-5 — Fundamental historical irreducibility

Claims that no complete present-state description can replace history, or that history adds fundamentally new physical information, are outside the benchmark.

History Matters must not claim HM-5.

---

# 9. Two benchmark families

The suite should be split at the top level into two families.

# 9.1 Semantic History Sensitivity

These cases ask whether history changes identity, admissibility, legal/technical status, or structured interpretation under declared rules.

Examples:

- Git history identity;
- Nix derivation identity;
- OCI layer history;
- reproducible build equivalence;
- in-toto admissibility;
- artwork provenance;
- chemical synthesis identity;
- manuscript transmission;
- cell-lineage identity;
- Seshat epistemic support identity.

These are useful because they are exact and often strongly reproducible.

But the benchmark must label them:

```text
claimClass: semantic
```

or:

```text
claimClass: normative
```

where appropriate.

They are not automatically evidence that history improves empirical prediction.

---

# 9.2 Empirical History Utility

These cases ask whether history improves discrimination, prediction, or future accessibility against an independent target.

Candidate domains:

- operational aging;
- experimental evolution;
- materials;
- ecology;
- clinical trajectories;
- galactic archaeology;
- future reconstructed-history cases.

These should be labeled:

```text
claimClass: empirical
```

with a more specific design:

```text
descriptive
predictive
experimental
causal
```

The public UI must never collapse these design classes.

---

# 10. Core benchmark views

Every evaluation-grade contrast should define at least two views.

## P0 — Present Only

The baseline.

It contains only information declared available at the cutoff as the present representation.

Example:

```text
current machine sensor vector
```

or:

```text
current artifact bytes
```

or:

```text
current measured cell state
```

---

## P1 — Present + History

The same present view plus admissible historical information.

Example:

```text
current sensor vector
+
previous 20 cycles
```

or:

```text
current artifact
+
build provenance
```

---

## P2 — Present + History + Epistemic Provenance

Optional.

Adds provenance/evidence quality information without silently changing the underlying historical claims.

Example:

```text
claim X
+
attested source
+
source conflict
+
measurement age
```

This is particularly useful for Seshat-like epistemic cases.

---

## N0 — Wrong / Permuted History Null

Optional but strongly recommended.

The present state remains unchanged while history is reassigned or permuted under a declared valid null model.

This tests whether:

```text
any extra historical-shaped data
```

helps, or whether the **correct correspondence** between unit and history matters.

---

## H0 — History Only

Optional diagnostic.

This should not replace P0/P1, but can reveal whether the present representation contributes independently.

---

# 11. Why a single global score is forbidden

The benchmark crosses domains with fundamentally different targets.

Examples:

```text
Git:
    identity partition

NASA C-MAPSS:
    remaining life

LTEE:
    Cit+ accessibility

materials:
    residual strain

ecology:
    vegetation state

law:
    precedent-conditioned reachability
```

There is no scientifically meaningful arithmetic operation such as:

```text
Git accuracy
+
RUL RMSE
+
Cit+ frequency
+
residual strain error
```

Therefore the suite must not report:

```text
History Matters Score = 0.73
```

The primary public summary should instead be a structured portfolio.

Example:

| Case | Claim class | Effect | Primary metric | History result |
|---|---|---|---|---|
| Operational Aging | empirical / predictive | Future | held-out RUL error | positive |
| LTEE | empirical / experimental | Future | protocol-specific accessibility | positive / bounded |
| Git | semantic | Identity | partition change | positive |
| Reproducible Builds | semantic | Identity | regime distinction | positive |
| Ecology | empirical / descriptive | Present State | not evaluation-ready | not evaluated |

If later enough comparable empirical contrasts exist, a separate reviewed meta-analysis may be added.

It must not be improvised into v1.

---

# 12. Benchmark result states

Every contrast must end in one of these explicit states:

```text
positive
negative
neutral-within-resolution
indeterminate
invalid
not-evaluated
```

Suggested semantics:

## positive

The preregistered primary contrast favors the history-aware view beyond the declared evaluation threshold or null reference.

## negative

The history-aware view performs worse under the primary contrast.

This is a valuable result and must remain visible.

## neutral-within-resolution

No meaningful difference is resolved at the declared precision/sample level.

This is not the same as proof that history never matters.

## indeterminate

The benchmark cannot interpret the contrast because required evidence, sample size, variance, evaluator completion, or other prerequisites are unresolved.

## invalid

The evaluation contract was violated.

Examples:

- target leakage;
- outcome-aware pair selection;
- future rows included in history;
- stale source binding;
- split contamination.

## not-evaluated

No benchmark run has been performed.

Never render `not-evaluated` or `indeterminate` as zero.

---

# 13. Benchmark maturity

Benchmark maturity should be independent of case maturity.

A case may be:

```text
ANALYSIS_READY
```

while its History Matters evaluation is only:

```text
illustrative
```

Recommended benchmark maturity states:

```text
NOT_ELIGIBLE
ILLUSTRATIVE
CONTRACT_DRAFT
CONTRAST_READY
EVALUATION_READY
EVALUATED
REPLICATED
REVIEWED
```

Definitions:

## NOT_ELIGIBLE

The case does not currently expose a valid P/H/Y contrast.

## ILLUSTRATIVE

Interesting history-sensitive example exists, but outcome-aware selection, missing controls, insufficient cohort, or other limitations prevent evaluation claims.

## CONTRACT_DRAFT

The target, cutoff, views, and metrics are being specified.

## CONTRAST_READY

The deterministic P/H artifacts exist and can be compared, but evaluation protocol is incomplete.

## EVALUATION_READY

Leakage guards, splits, target isolation, metrics, and nulls are frozen.

## EVALUATED

A complete deterministic benchmark result exists.

## REPLICATED

The result has been reproduced independently or on a second valid source cohort.

## REVIEWED

Independent benchmark review is complete.

---

# 14. Benchmark contract

Each contrast should be described by a frozen machine-readable contract.

Suggested shape:

```json
{
  "schemaVersion": "1.0.0",
  "benchmarkId": "operational-aging-rul-v1",
  "caseId": "operational-aging",

  "claimClass": "empirical",
  "designClass": "predictive",

  "historyMode": "embodied",
  "effect": "future",

  "population": {
    "source": "source-locked reference",
    "unitDefinition": "engine endpoint",
    "eligibilityPolicyRef": "sha256:..."
  },

  "cutoffPolicy": {
    "type": "per-unit-observation-end",
    "futureForbidden": true
  },

  "presentView": {
    "viewId": "current-frame-v1",
    "builderRef": "sha256:..."
  },

  "historyView": {
    "viewId": "observed-prefix-v1",
    "builderRef": "sha256:..."
  },

  "targetView": {
    "targetId": "supplied-rul-v1",
    "builderRef": "sha256:..."
  },

  "selectionPolicy": {
    "targetBlind": true
  },

  "splitPolicy": {
    "strategy": "frozen",
    "artifactRef": "sha256:..."
  },

  "evaluator": {
    "evaluatorId": "reference-evaluator-v1",
    "version": "..."
  },

  "primaryMetric": "mae",
  "secondaryMetrics": [
    "rmse",
    "rank-correlation"
  ],

  "nullModels": [
    "history-permutation-v1"
  ],

  "leakageGuards": [
    "no-future-history",
    "target-blind-feature-build",
    "unit-disjoint-splits"
  ]
}
```

The exact schema should be smaller where possible.

The important property is that every choice capable of changing the scientific interpretation is bound before evaluation.

---

# 15. Benchmark artifact pipeline

The implementation should force a visible separation between data stages.

```text
SOURCE LOCK
    │
    ▼
COHORT FREEZE
    │
    ├────────────────────────────┐
    ▼                            ▼
PRESENT VIEW BUILD          HISTORY VIEW BUILD
target-blind                target-blind
    │                            │
    └────────────┬───────────────┘
                 │
                 ▼
             SPLIT FREEZE
                 │
                 ▼
          EVALUATOR PREPARATION
                 │
                 │
TARGET EXTRACTION│
(separate path)  │
        └────────┼────────┐
                 ▼        ▼
             EVALUATION   NULLS
                 │        │
                 └───┬────┘
                     ▼
             BENCHMARK RESULT
                     │
                     ▼
              RUN BUNDLE / UI
```

The target should be structurally unavailable to feature/view construction.

This is stronger than merely documenting that the developer "did not use it."

---

# 16. Leakage firewall

History Matters must treat data leakage as a first-class benchmark failure.

This is critical because adding history creates many subtle opportunities to accidentally expose the target.

The benchmark should implement a leakage firewall at multiple levels.

---

## 16.1 Temporal leakage

For future targets:

```text
history.timestamp <= cutoff
target.timestamp > cutoff
```

No post-cutoff record may enter P or H.

---

## 16.2 Target leakage

The target cannot appear directly or through a trivial proxy in the input view unless explicitly justified by the task.

Example:

```text
provided RUL
```

must never enter an RUL predictor.

---

## 16.3 Selection leakage

Units, pairs, windows, or features used in the evaluation must not be selected using held-out outcomes.

This point is immediately relevant to the current Operational Aging demonstration.

The existing pair of units 25 and 72 is scientifically useful as an illustration because the pair is near in current-frame space but far in supplied RUL.

However, the pair was selected by maximizing RUL separation inside a nearest-current-state subset.

Therefore:

```text
pair 25 / 72
```

must remain:

```text
ILLUSTRATIVE
```

not:

```text
EVALUATION
```

The benchmark must move to a full-cohort or development/test selection design.

---

## 16.4 Preprocessing leakage

Any data-dependent transformation must be fit without access to held-out units.

Examples:

- normalization;
- dimensionality reduction;
- learned embeddings;
- feature selection;
- imputation parameters;
- hyperparameter selection.

---

## 16.5 Unit leakage

Longitudinal records from the same physical or logical unit must not cross training/test boundaries when that would leak identity or trajectory information.

---

## 16.6 Duplicate leakage

Exact or derived duplicate records must be detected across splits.

---

## 16.7 Registry leakage

A developer must not manually choose a "good looking" benchmark case after inspecting its final result and then present it as preregistered primary evidence.

The contract lifecycle needs immutable states.

---

# 17. Contract lifecycle

Recommended lifecycle:

```text
DRAFT
  ↓
SOURCE_LOCKED
  ↓
TARGET_BLIND_VIEWS_FROZEN
  ↓
SPLIT_FROZEN
  ↓
METRICS_FROZEN
  ↓
READY_TO_UNBLIND
  ↓
EVALUATED
  ↓
REVIEWED
```

After:

```text
READY_TO_UNBLIND
```

changes to primary:

- population;
- view definition;
- split;
- target;
- evaluator;
- metric;
- threshold;

must create a new contract identity.

Do not silently update the old benchmark.

---

# 18. Present-state definition

The hardest conceptual issue in the benchmark is:

> What exactly counts as "present"?

The answer must be case-local and explicit.

Examples:

## Operational Aging

```text
current frame:
    current operating settings
    current sensor channels
```

History:

```text
all allowed prior frames up to cutoff
```

---

## Materials

Present might be:

```text
nominal alloy
nominal geometry
declared current measured non-history features
```

History:

```text
build identity
process record
thermal history
machine history
```

Target:

```text
held-out residual strain field
```

---

## Software

Present:

```text
normalized final root filesystem
```

History:

```text
OCI layer sequence
```

Target:

```text
declared identity regime
```

This is a semantic benchmark, not a predictive one.

---

# 19. Present view must not be deliberately crippled

A benchmark can manufacture a history effect by choosing an absurdly weak present representation.

Example:

```text
present = one sensor
history = every other sensor plus all previous values
```

Then "history wins" says very little.

Therefore each empirical benchmark contract must justify why P is a legitimate state representation.

The justification should answer:

- Is P naturally available at decision time?
- Is P commonly used as a current-state representation?
- Are important current variables intentionally omitted?
- Is H adding temporal information rather than merely extra unrelated modalities?
- Could a richer current measurement trivially encode the same information?

The benchmark should record this as:

```text
presentViewJustification
```

---

# 20. History view must be legitimate

Similarly, H must represent history actually available at the decision cutoff.

It cannot include:

- future observations;
- post-outcome metadata;
- hindsight labels;
- manually reconstructed facts unavailable at the time;
- target-derived summaries.

For reconstructed-history cases, the reconstruction method itself must be frozen and evidence-bound.

---

# 21. Matching present states

One powerful History Matters design is to compare units that are equal or near-equal under P.

Conceptually:

```text
P(A) ≈ P(B)
```

but:

```text
H(A) != H(B)
```

and potentially:

```text
Y(A) != Y(B)
```

This creates an intuitive demonstration:

> Similar now, different because of history.

However, pair selection is dangerous.

If Y is used to find the pair, the result is descriptive only.

Evaluation-grade matched comparisons must use one of:

1. target-blind matching;
2. matching designed on training/development data and tested on held-out data;
3. predeclared natural equivalence classes;
4. externally defined matched cohorts.

---

# 22. Population evaluation is stronger than anecdotal matching

Where enough data exist, the primary benchmark should evaluate the entire eligible cohort rather than a hand-selected pair.

Example:

```text
all C-MAPSS test units
```

Then compare the same evaluator family under:

```text
P0
```

and:

```text
P1
```

on the same held-out units.

Matched-pair visualizations can remain secondary explanations.

---

# 23. Evaluator fairness

History benefit can be confounded by evaluator capacity.

If:

```text
P evaluator = simple linear model
P + H evaluator = large transformer
```

the benchmark does not isolate history.

The default rule should be:

> Use the same evaluator family and comparable optimization budget for P0 and P1.

The history-aware evaluator may require a different input shape, but the comparison should remain structurally fair.

Where that is impossible, disclose:

```text
evaluatorConfound: true
```

and lower the claim level.

---

# 24. Evaluator types

History Matters should support multiple evaluator classes.

## 24.1 Deterministic structural evaluator

Useful for semantic cases.

Examples:

- identity partition;
- admissibility;
- equivalence refinement;
- reachable-set comparison.

---

## 24.2 Deterministic nearest-neighbor evaluator

Useful as a transparent empirical baseline.

Example:

```text
current-state nearest neighbors
vs
history-aware nearest neighbors
```

This is especially suitable for the first Operational Aging benchmark because it closely extends the existing case without pretending to solve prognostics.

---

## 24.3 Statistical / ML evaluator

Needed for stronger predictive studies.

These should generally live behind the existing scientific-adapter boundary rather than inside the kernel.

The adapter must bind:

- implementation;
- version;
- parameters;
- training split;
- random seed;
- preprocessing;
- metric calculation.

---

## 24.4 Domain-native evaluator

Some experimental cases already provide a domain-native comparison.

LTEE is an example.

The source experiment itself may be the primary evaluator rather than an Onto2D-trained predictor.

---

# 25. Metric families

There should be no universal metric, but Onto2D can define reusable metric families.

# 25.1 Ambiguity reduction

Applicable to identity and candidate-space tasks.

Example:

```text
candidate identities under P:
    14

candidate identities under P + H:
    3
```

Important:

Smaller is not automatically better.

The correct identity must remain represented where ground truth exists.

---

# 25.2 Indeterminacy reduction

Measure whether history converts legitimate:

```text
indeterminate
```

states into supported determinations.

Again, reduction alone is not enough.

False certainty must be penalized.

---

# 25.3 Discrimination gain

For classification or pair discrimination.

Examples:

- accuracy;
- balanced accuracy;
- AUROC;
- average precision.

Use only where appropriate.

---

# 25.4 Prediction-error gain

For continuous targets.

Examples:

- MAE;
- RMSE;
- rank error.

The contract defines orientation so that public visualizations can consistently show:

```text
better
worse
unchanged
```

without pretending raw units are cross-domain comparable.

---

# 25.5 Ranking gain

Useful when the evaluation asks:

> Does history move genuinely similar outcomes closer together?

Example:

```text
true peer rank under P
vs
true peer rank under P + H
```

---

# 25.6 Reachability-set change

For future-accessibility tasks.

Measure changes in:

- reachable outcome set;
- correct-target retention;
- false reachable states;
- history-conditioned accessibility.

---

# 25.7 Decision stability

Compare how stable the task result is under declared perturbations.

History may improve:

```text
decision stability
```

even if raw accuracy changes little.

---

# 25.8 Evidence efficiency

For cases where history is progressively revealed.

Example:

```text
how much historical evidence is required
before the result resolves?
```

---

# 26. Primary metric discipline

Every evaluation-grade contract must declare exactly one:

```text
primaryMetric
```

before unblinding.

Secondary metrics remain useful, but they are secondary.

This prevents post-hoc metric shopping.

Example:

```json
{
  "primaryMetric": "mae",
  "secondaryMetrics": [
    "rmse",
    "spearman"
  ]
}
```

A benchmark may be scientifically interesting even if the primary result is negative and a secondary result is positive.

The UI must not silently promote the secondary metric.

---

# 27. History Gain

For a given case, the benchmark may calculate a case-local oriented difference:

```text
History Gain =
    performance(P + H)
    -
    performance(P)
```

after metric orientation is normalized so that positive means better.

For error metrics:

```text
gain =
    error(P)
    -
    error(P + H)
```

The raw case-local gain should always remain available.

A normalized gain may be defined only when the metric provides a legitimate normalization.

Do not force every domain into `[0, 1]`.

---

# 28. No automatic cross-case averaging

Even if every case exposes a positive-oriented gain, the suite must not automatically calculate:

```text
mean(historyGain)
```

because:

- units differ;
- targets differ;
- sample sizes differ;
- evaluator families differ;
- claim classes differ;
- cases may not be independent.

The top-level suite should instead summarize:

```text
positive: N
negative: N
neutral: N
indeterminate: N
invalid: N
not evaluated: N
```

separately by:

```text
claim class
history mode
effect
domain
```

---

# 29. Null models

Null models are essential.

History Matters should reuse Onto2D's deterministic null-model discipline where appropriate.

Potential history nulls:

## N-H1 — history permutation

Assign another eligible unit's history while retaining the present state.

Purpose:

> Does correct history correspondence matter?

---

## N-H2 — within-stratum history permutation

Permute history only among comparable units.

This is stronger where obvious confounders exist.

---

## N-H3 — temporal order shuffle

Retain historical values but destroy ordering.

Purpose:

> Does sequence matter, or only aggregate history?

---

## N-H4 — history truncation

Compare:

```text
1 step
5 steps
20 steps
full prefix
```

Purpose:

> How much history is useful?

---

## N-H5 — evidence ablation

Remove one evidence class or source.

Purpose:

> Which historical evidence actually drives the result?

---

## N-H6 — pseudo-history

Generate a deterministic history-shaped input with matched marginal statistics but no true lineage.

This is useful in some numerical cases.

---

# 30. Null interpretation

A positive P1 vs P0 result is stronger when:

```text
P1 true history
```

outperforms:

```text
P0 present only
```

and:

```text
N0 wrong/permuted history
```

does not reproduce the gain.

That pattern suggests the benefit comes from the correct historical association rather than merely increased input dimensionality.

---

# 31. Negative controls

Each empirical case should include at least one negative control where feasible.

Examples:

- random history assignment;
- irrelevant historical channel;
- intentionally unrelated prior unit;
- shuffled temporal order;
- future target that should be unrelated to the selected history under the declared model.

A benchmark without negative controls is easier to overinterpret.

---

# 32. Positive controls

Synthetic or domain-understood positive controls can verify that the benchmark machinery can detect a known history effect.

The repository should include a tiny synthetic canonical case.

Example:

```text
current state:
    identical bit = 0

history A:
    path 0 -> 1 -> 0

history B:
    path 0 -> 0 -> 0

target:
    one deterministic future transition depends on prior path
```

P0 cannot distinguish the units.

P1 can.

This becomes the benchmark golden.

---

# 33. Synthetic canonical benchmark fixture

Recommended fixture:

```text
cases/history-matters-reference/
```

Population:

```text
8 deterministic units
```

Present view:

```text
same current observable state for paired units
```

History:

```text
two distinguishable path classes
```

Future target:

```text
deterministically depends on path class
```

Expected:

```text
P0:
    irreducible ambiguity

P1:
    exact resolution

permuted history:
    no valid gain
```

Purpose:

- schema golden;
- API golden;
- result golden;
- null-model golden;
- Explorer fixture;
- tamper tests;
- budget tests.

It is not scientific evidence.

---

# 34. Exact benchmark artifacts

Suggested artifact types:

```text
HistoryBenchmarkContract
HistoryBenchmarkCohort
HistoryViewArtifact
HistoryTargetArtifact
HistorySplitArtifact
HistoryEvaluatorBinding
HistoryContrastResult
HistoryNullResult
HistoryBenchmarkRun
HistoryBenchmarkSuite
```

All should be immutable and content-addressed.

---

# 35. HistoryViewArtifact

A view artifact binds:

```text
case source identity
unit population
cutoff policy
projection implementation
projection configuration
resulting records
```

Two view artifacts can share the same source cohort:

```text
present-v1
history-v1
```

The target is a separate artifact.

---

# 36. Why target must be a separate artifact

The target should never be part of the input Model Pack merely because it is convenient.

For evaluation, the benchmark needs a real epistemic firewall:

```text
INPUT
    P
    H

HELD-OUT EVALUATION
    Y
```

The target may live in the same repository release but must have a separate artifact identity and explicit evaluation boundary.

This makes leakage auditable.

---

# 37. Model Pack relationship

History Matters should not invent a second meaning for Model Pack.

A Model Pack remains a verified semantic model.

Benchmark contracts may reference exact Model Packs.

Example:

```text
benchmark contract
    ├── source artifact
    ├── modelId
    ├── modelVersion
    ├── rootHash
    └── manifestHash
```

Benchmark results themselves should be semantic run artifacts / benchmark artifacts, not silently inserted into the Model Pack.

---

# 38. Kernel boundary

The schema-v1 kernel is currently locally closed.

History Matters should **not reopen kernel v1** merely to add benchmark convenience.

Initial implementation should live in:

```text
@onto2d/history-benchmark
```

using existing generic primitives.

Possible dependencies:

```text
@onto2d/kernel/canonical
@onto2d/schemas
@onto2d/scientific-adapter
@onto2d/run-store
```

Only genuinely domain-independent functionality proven useful across multiple analysis families should later be proposed as a kernel revision.

---

# 39. New package proposal

Create:

```text
packages/history-benchmark/
```

Responsibilities:

- validate History Benchmark Contracts;
- bind exact sources and Model Packs;
- verify view separation;
- validate cutoff constraints;
- validate split artifacts;
- execute deterministic built-in evaluator profiles;
- call external evaluator adapters;
- execute declared null models;
- calculate declared metrics;
- create contrast artifacts;
- create suite summaries;
- produce explanation indexes.

It must not:

- define domain semantics;
- invent case targets;
- infer causal interpretation;
- choose a primary metric after seeing results;
- repair invalid source data.

---

# 40. Suggested package structure

```text
packages/history-benchmark/
│
├── src/
│   ├── contract/
│   │   ├── validate-contract.js
│   │   └── bind-contract.js
│   │
│   ├── cohort/
│   │   └── verify-cohort.js
│   │
│   ├── views/
│   │   ├── verify-present-view.js
│   │   ├── verify-history-view.js
│   │   └── verify-target-separation.js
│   │
│   ├── leakage/
│   │   ├── temporal.js
│   │   ├── unit-split.js
│   │   ├── duplicates.js
│   │   └── target-access.js
│   │
│   ├── evaluators/
│   │   ├── identity-partition.js
│   │   ├── nearest-neighbor.js
│   │   ├── ranking.js
│   │   └── reachability.js
│   │
│   ├── nulls/
│   │   ├── history-permutation.js
│   │   ├── temporal-shuffle.js
│   │   └── history-truncation.js
│   │
│   ├── metrics/
│   │
│   ├── result/
│   │   ├── build-result.js
│   │   └── explain-result.js
│   │
│   └── suite/
│       └── build-suite.js
│
├── README.md
└── package.json
```

---

# 41. Schema changes

Add new Draft 2020-12 schemas to `@onto2d/schemas`.

Suggested schemas:

```text
history-benchmark-contract.schema.json
history-benchmark-view.schema.json
history-benchmark-target.schema.json
history-benchmark-split.schema.json
history-benchmark-result.schema.json
history-benchmark-suite.schema.json
```

Avoid an excessively large single schema.

---

# 42. History case registry update

The current history-case registry should remain the authority for the History Atlas taxonomy.

Add a compact benchmark summary rather than embedding the complete benchmark contract.

Recommended optional field:

```json
{
  "historyMatters": {
    "status": "ILLUSTRATIVE",
    "claimClasses": [
      "empirical"
    ],
    "contractIds": [
      "operational-aging-rul-v1"
    ]
  }
}
```

Then maintain a dedicated registry:

```text
cases/history-benchmark-registry.json
```

This prevents `history-case-registry.json` from becoming overloaded.

Because this changes the registry schema, bump:

```text
schemaVersion:
    1.1.0
        ↓
    1.2.0
```

provided no other concurrent registry migration supersedes this version.

---

# 43. History benchmark registry

Suggested shape:

```json
{
  "schemaVersion": "1.0.0",
  "suiteId": "history-matters",
  "contracts": [
    {
      "benchmarkId": "operational-aging-rul-v1",
      "caseId": "operational-aging",
      "status": "ILLUSTRATIVE",
      "claimClass": "empirical",
      "designClass": "predictive",
      "historyMode": "embodied",
      "effect": "future",
      "contractPath": "cases/operational-aging/history-benchmark.json"
    }
  ]
}
```

This registry describes benchmark membership.

It does not contain benchmark results.

---

# 44. New registered analysis family

Extend case metadata from:

```text
historicalLoad
historyEquivalence
reachability
reconstruction
```

to include:

```text
historyMatters
```

Recommended values should reflect role, not result:

```text
primary
secondary
candidate
possible
not-primary
```

Result status stays elsewhere.

This preserves the current design principle that analysis priority is not equivalent to completed evaluation.

---

# 45. Result artifact

Example:

```json
{
  "schemaVersion": "1.0.0",

  "benchmarkId": "operational-aging-rul-v1",
  "contractHash": "sha256:...",

  "inputs": {
    "presentViewHash": "sha256:...",
    "historyViewHash": "sha256:...",
    "targetHash": "sha256:...",
    "splitHash": "sha256:...",
    "evaluatorHash": "sha256:..."
  },

  "runs": {
    "presentOnly": {
      "runHash": "sha256:..."
    },
    "presentPlusHistory": {
      "runHash": "sha256:..."
    }
  },

  "primary": {
    "metric": "mae",
    "presentOnly": 0.0,
    "presentPlusHistory": 0.0,
    "orientedGain": 0.0
  },

  "verdict": "positive",

  "nulls": [
    {
      "nullId": "history-permutation-v1",
      "resultHash": "sha256:..."
    }
  ]
}
```

Actual numeric precision should use existing Onto2D numeric policy conventions.

---

# 46. External evaluator boundary

Some serious empirical benchmarks will require Python or scientific libraries.

Do not embed those implementations into the kernel.

Use the existing scientific-adapter architecture.

The request should bind:

```text
benchmark contract
view artifact hashes
split hash
solver / evaluator ID
version
parameters
seed
precision
```

The response should return:

```text
predictions
metrics
diagnostics
execution identity
```

and be validated before admission into the benchmark artifact.

---

# 47. Determinism versus statistical learning

History Matters must distinguish:

```text
deterministic benchmark artifact
```

from:

```text
deterministic scientific outcome
```

A stochastic model can still produce a reproducible benchmark run if:

- implementation is pinned;
- seed streams are pinned;
- data order is pinned;
- environment is pinned where necessary;
- all outputs are bound.

Reproducibility does not turn a statistical result into certainty.

---

# 48. Multiple seeds

For stochastic evaluators:

```text
one lucky seed
```

must not become the benchmark result.

The contract should define:

```text
seed set
aggregation rule
primary statistical summary
```

before evaluation.

Seed identities remain part of the execution protocol.

---

# 49. Confidence intervals and uncertainty

Confidence intervals, bootstrap intervals, permutation distributions, or domain-native statistical summaries may be included.

They must remain:

```text
statistical evidence
```

not Onto2D truth values.

The benchmark verdict can be:

```text
indeterminate
```

when the declared test cannot resolve the direction.

---

# 50. Benchmark explanation model

Every result should answer:

```text
What was compared?
What counted as present?
What counted as history?
What was the target?
Was the target available during view construction?
How were units selected?
What was the primary metric?
What nulls were run?
What changed?
What does the result license?
What does it not license?
```

The Explorer should obtain this from generated explanation artifacts, not reconstruct it from page-specific code.

---

# 51. Public Explorer

Create:

```text
apps/history-matters-benchmark/
```

This should be a new top-level History Atlas analysis surface.

The interface should not look like a leaderboard.

Recommended views:

---

## 51.1 Portfolio matrix

Rows:

```text
Recorded
Embodied
Reconstructed
```

Columns:

```text
Identity
Present State
Future
```

Each cell shows benchmark evidence status, not merely case count.

Example:

```text
Embodied × Future

Evaluated:
    LTEE

Illustrative:
    Operational Aging

Candidate:
    Clinical Trajectories
    Ecological Memory
```

---

## 51.2 Claim-class filter

```text
Semantic
Empirical
Predictive
Experimental
Causal
```

This is mandatory.

---

## 51.3 Contrast card

Example:

```text
Operational Aging

P0:
current sensor frame

P1:
current frame + observed prefix

Target:
held-out RUL

Status:
ILLUSTRATIVE

Reason:
current selected pair was outcome-aware
```

---

## 51.4 Result comparison

For evaluated cases:

```text
PRESENT ONLY          PRESENT + HISTORY

metric X              metric X
0.42                  0.31

                     ↑ improvement
```

alongside null results.

---

## 51.5 Leakage panel

Show:

```text
✓ cutoff verified
✓ future rows excluded
✓ target separated
✓ split unit-disjoint
✓ preprocessing train-only
✓ contract frozen before evaluation
```

If any required gate fails:

```text
INVALID
```

must dominate the display.

---

## 51.6 Negative-result visibility

Negative and neutral results should receive the same visual prominence as positive results.

No green-only marketing dashboard.

---

# 52. No result cherry-picking in History Atlas

Once a benchmark contract reaches:

```text
READY_TO_UNBLIND
```

it should remain registered even if the result is negative.

This is critical.

Otherwise the History Atlas could become a publication-bias machine:

```text
positive cases published
negative cases disappear
```

The registry should make disappeared preregistrations detectable.

---

# 53. Operational Aging as the first empirical flagship

The current NASA C-MAPSS case is an excellent starting point.

Current result:

```text
100 test endpoints
4,950 unordered endpoint pairs

units 25 and 72:
current-frame rank = 78
current-frame distance ≈ 0.0821

supplied RUL:
145
50
```

Adding history changes similarity context:

```text
last-20-cycle mean rank:
1439

complete-prefix mean rank:
1072
```

This is a powerful illustration.

However, it is not evaluation-grade because the pair was chosen by maximizing RUL difference among close current-frame pairs.

History Matters v1 should preserve the current artifact exactly and label it:

```text
ILLUSTRATIVE
```

Then create a new evaluation contract.

---

# 54. Operational Aging benchmark redesign

Recommended new benchmark:

```text
operational-aging-history-matters-v1
```

Target:

```text
supplied RUL
```

Cutoff:

```text
each test unit endpoint
```

P0:

```text
current-frame settings + selected sensor channels
```

P1 variants:

```text
current frame
+
last-K observed history
```

for preregistered K values such as:

```text
5
20
full observed prefix
```

Do not choose K after inspecting test RUL.

---

# 55. Operational Aging evaluator v1

The first evaluator does not need to be a sophisticated deep prognostics model.

Use a transparent deterministic baseline.

Possible primary design:

```text
nearest-neighbor RUL regression
```

with training normalization fitted only on training data.

Compare:

```text
P0 representation distance
```

with:

```text
P1 representation distance
```

on the same held-out test endpoints.

Advantages:

- close to the existing case;
- easy to inspect;
- deterministic;
- no claim of state-of-the-art prognostics;
- isolates representation value.

A later benchmark can add external prognostics models.

---

# 56. Operational Aging safeguards

Mandatory:

```text
unit ID excluded from features
future rows excluded
provided RUL excluded from features
normalization fit on training data only
history windows stop at cutoff
K frozen before test evaluation
primary metric frozen
all 100 eligible test units evaluated
```

If the official dataset split is used, preserve its intended training/test semantics.

---

# 57. Operational Aging primary claim

A valid positive result would license:

> Under the declared C-MAPSS FD001 representation and reference evaluator, observed operational history improved held-out RUL estimation relative to the current frame alone.

It would not license:

> Historical information is universally required for machine prognostics.

It would not license:

> RUL is caused by the selected history representation.

---

# 58. LTEE as the first experimental flagship

The current LTEE case already asks a history-conditioned future-accessibility question.

The three Ara-3 citrate replay protocols preserve:

- source generation;
- protocol identity;
- Cit+ observations;
- negative observations without converting them into impossibility;
- published statistical evidence as attributed evidence.

This is highly valuable for History Matters.

Unlike C-MAPSS, the history variable is part of an experimental replay design rather than merely an observed time series.

---

# 59. LTEE benchmark contract

Possible benchmark:

```text
ltee-history-conditioned-accessibility-v1
```

P0:

A deliberately history-collapsed view of replay units, preserving protocol but removing source-generation historical position where scientifically legitimate.

P1:

The same replay evidence with exact source-generation history.

Target:

```text
observed Cit+ accessibility under the exact replay protocol
```

The exact design must follow the source experiment rather than inventing a new statistical model.

---

# 60. LTEE interpretation

A positive result can support:

> In the declared Ara-3 replay experiments, accessibility of Cit+ was conditioned by the recorded source-generation history.

It must not claim:

- complete mutation-path reconstruction;
- unique genotype history;
- Cit+ impossibility where not observed;
- Historical Load;
- universal evolutionary contingency.

---

# 61. Material Process History candidate

The AM-Bench case is conceptually ideal for:

```text
history -> present state
```

because multiple parts share a nominal IN718 recipe while retaining distinct build histories.

The current limitation is evidence coverage.

The committed residual-strain field is available for B7-P3, not symmetrically for all comparison parts.

Therefore current benchmark status should remain:

```text
ILLUSTRATIVE
```

or:

```text
CONTRACT_DRAFT
```

depending on the exact target.

A future benchmark becomes strong if comparable present-state measurements can be obtained across multiple parts/build histories.

---

# 62. Materials benchmark target

Potential future target:

```text
residual-strain field
```

P0:

```text
nominal material
nominal part geometry
nominal recipe
```

P1:

```text
P0
+
exact build / process history
+
available process observations
```

The target must be held out from the history representation.

---

# 63. Ecological Memory candidate

The current NEON SOAP case provides:

```text
7,275 paired cells
2019 vegetation projection
2021 vegetation projection
recorded Creek Fire context
```

but currently lacks:

- control tile;
- exact fire-perimeter join;
- measurement-protocol constancy;
- enough dates for a recovery trajectory.

Therefore it should not become a causal History Matters benchmark in its current form.

Potential future roles:

```text
descriptive history sensitivity
```

or, after dataset expansion:

```text
future vegetation-state prediction
```

with spatially separated train/test regions and explicit sensor harmonization.

---

# 64. Clinical Trajectories candidate

The current MIMIC-IV Demo case already separates:

```text
24-hour bounded current observation frame
```

from:

```text
longer prior record sequence
```

This is structurally ideal for History Matters.

However, the five-subject demo is far too small for a predictive benchmark.

Recommended status:

```text
CONTRACT_DRAFT
```

for architecture only.

A future serious benchmark would require a larger permitted cohort, careful patient-disjoint splits, task-specific clinical methodology, and much stronger domain review.

The project must remain a research benchmark, not a clinical decision tool.

---

# 65. Software semantic sub-suite

The software cases can form an exact first sub-suite while empirical cases are being upgraded.

Suggested cases:

```text
Git History Identity
Nix Derivation Identity
OCI Layer History
in-toto Admissibility
Reproducible Build Equivalence
Live Bootstrap Provenance
```

Core question:

> Does a present-content-only representation preserve the same identity/admissibility result as a history-aware representation?

These can often produce exact deterministic answers.

---

# 66. Software sub-suite limitations

A result such as:

```text
same rootfs
different OCI history identity
```

may be partly definitional because the history-aware identity regime was explicitly designed to include history.

Therefore the public claim should be:

```text
semantic history sensitivity
```

not:

```text
empirical predictive utility
```

This sub-suite is still important because it demonstrates exact operational consequences of discarding history.

---

# 67. Reconstructed history

Reconstructed-history cases require additional care because H is not a direct record.

Examples:

```text
galactic archaeology
historical linguistics
manuscript stemmatics
mineral formation
cell lineage
```

The benchmark must preserve:

```text
source evidence
reconstruction method
reconstruction uncertainty
```

as separate layers.

A reconstructed past must never be silently promoted to actual history.

---

# 68. Reconstructed → Future gap

The current History Atlas intentionally has no flagship case for:

```text
Reconstructed × Future
```

This is a valuable research gap.

History Matters should preserve it rather than fill it with a weak case for matrix completeness.

A future flagship should have:

```text
present traces
    ↓
multiple reconstructed histories
    ↓
history-conditioned future outcome or reachability
```

with explicit uncertainty.

This could become one of the most important later benchmark contributions.

---

# 69. Seshat and epistemic provenance

The Seshat direction is useful for a different benchmark dimension:

> Does preserving epistemic provenance change downstream identity, grouping, or inference compared with values alone?

Potential views:

```text
P0:
coded values only

P1:
coded values + support provenance

P2:
coded values + support provenance + epistemic states
```

This should be treated as an epistemic/semantic benchmark unless an independent empirical target is defined.

---

# 70. Three-level ablation model

For cases with evidence provenance, use:

```text
A0:
present only

A1:
present + history

A2:
present + history + epistemic provenance
```

This isolates two different effects:

```text
history effect
```

and:

```text
evidence-quality effect
```

They should not be conflated.

---

# 71. History length curve

For sequential cases, the benchmark should not reduce history to:

```text
none
vs
all
```

when intermediate prefixes are meaningful.

Recommended profile:

```text
P0
P + H1
P + H5
P + H20
P + Hall
```

This creates a **history utility curve**.

It can reveal:

- minimum useful history;
- saturation;
- degradation from stale history;
- long-memory requirements.

---

# 72. History utility curve interpretation

Possible outcomes:

```text
history helps immediately and saturates
history helps only after long context
short history hurts but long history helps
history never helps
history benefit is unstable
```

All are scientifically interesting.

---

# 73. Evidence-age curve

Where records have meaningful age:

```text
recent history
older history
full history
```

can be compared separately.

This is distinct from history length.

---

# 74. History composition

Some domains have multiple historical channels.

Example:

```text
operating history
maintenance history
environment history
ownership history
```

The benchmark can support factorial ablations:

```text
P
P + H_operating
P + H_maintenance
P + H_environment
P + all history
```

Only after each channel is independently justified.

---

# 75. Cross-case suite summary

The History Matters suite should display a structured table.

Example:

| Case | Mode | Effect | Claim | Status | Primary conclusion |
|---|---|---|---|---|---|
| Git | Recorded | Identity | Semantic | Evaluated | history changes identity regime |
| OCI | Recorded | Identity | Semantic | Evaluated | normalized content does not preserve layer history |
| Operational Aging | Embodied/Recorded | Future | Predictive | Illustrative → planned evaluation | full-cohort benchmark pending |
| LTEE | Embodied/Recorded | Future | Experimental | Candidate | history-conditioned accessibility |
| Materials | Embodied | Present State | Empirical | Illustrative | more outcome coverage required |
| Ecology | Embodied/Recorded | Present/Future | Descriptive | Illustrative | causal/predictive design absent |
| Clinical | Embodied/Recorded | Future | Predictive | Contract draft | cohort too small |
| Galactic | Reconstructed | Present State | Reconstruction | Analysis ready | not yet a History Matters prediction benchmark |

No row should be forced into a positive/negative result when its design does not permit one.

---

# 76. Suite verdict

The suite itself should **not** have:

```text
verdict = history matters
```

Instead:

```json
{
  "evaluatedContrasts": 0,
  "positive": 0,
  "negative": 0,
  "neutral": 0,
  "indeterminate": 0,
  "invalid": 0,
  "byClaimClass": {},
  "byEffect": {},
  "byHistoryMode": {}
}
```

A human-readable synthesis may discuss patterns.

The machine artifact remains descriptive.

---

# 77. Meta-analysis

A formal meta-analysis should be a future independent analysis family.

Requirements would include:

- sufficiently comparable effect sizes;
- independence/dependence modeling;
- preregistered inclusion criteria;
- domain heterogeneity analysis;
- publication-bias protections.

Do not create a pseudo-meta-analysis by counting hand-picked positive examples.

---

# 78. Preregistration artifact

Create:

```text
HistoryBenchmarkPreregistration
```

or include equivalent frozen fields in the contract.

It should bind:

```text
scientific question
population
cutoff
P
H
Y
primary metric
evaluator
nulls
exclusion criteria
interpretation boundary
```

before unblinding.

This can reuse Onto2D's content-addressed artifact infrastructure.

---

# 79. Interpretation boundary

Every benchmark contract must contain a machine-readable interpretation block.

Example:

```json
{
  "supports": [
    "history improves held-out RUL estimation under evaluator E"
  ],
  "doesNotSupport": [
    "causal effect of history",
    "universal prognostic superiority",
    "fundamental historical irreducibility"
  ]
}
```

The Explorer should display this directly.

---

# 80. Tamper resistance

Benchmark verification must reject:

- changed source bytes;
- changed contract after evaluation;
- changed primary metric;
- changed split;
- changed target projection;
- changed view builder;
- stale result hashes;
- results from another Model Pack version.

---

# 81. Independent review

A benchmark release should eventually have a review process analogous to canonical identity goldens.

Review checklist:

```text
source lock correct?
cutoff correct?
present view legitimate?
history view legitimate?
target separated?
pair/cohort selection target-blind?
splits clean?
primary metric frozen?
nulls correct?
interpretation conservative?
artifact replay exact?
```

---

# 82. CI architecture

Recommended commands:

```sh
npm run history-benchmark:check
npm run history-benchmark:test
npm run history-benchmark:goldens
npm run history-benchmark:registry
```

Full empirical evaluations may be too expensive for every PR.

Use layers.

---

# 83. CI tier 1 — structural

Every PR:

- schemas;
- registry integrity;
- contract validation;
- hash bindings;
- fixture tests;
- leakage-unit tests;
- tamper tests;
- canonical golden replay.

---

# 84. CI tier 2 — compact reference evaluations

Run small deterministic reference cases:

- synthetic History Matters fixture;
- one semantic identity fixture;
- compact empirical fixture where licensed.

---

# 85. CI tier 3 — full benchmark reproduction

Scheduled or release-gated:

- full C-MAPSS evaluation;
- external scientific adapters;
- larger empirical cases;
- null-model ensembles.

The exact release commit must bind full results.

---

# 86. Leakage tests

Add explicit negative tests.

Examples:

```text
future row inserted into H
    -> FAIL

target column inserted into P
    -> FAIL

same unit appears in train and test
    -> FAIL

feature scaler fit on complete cohort
    -> FAIL where detectable

result contract hash stale
    -> FAIL
```

These tests are part of the scientific architecture, not optional QA.

---

# 87. Outcome-aware selection test

Add a specific contract field:

```text
selectionPolicy.targetBlind
```

For evaluation-grade contracts:

```text
targetBlind = true
```

must be required.

An illustrative contract may declare:

```text
targetBlind = false
```

and automatically be prevented from reaching:

```text
EVALUATION_READY
```

This directly encodes the Operational Aging lesson.

---

# 88. Missing-data policy

Each case must declare:

```text
missing-data policy
```

Possible states:

```text
complete-case
explicit-missing-category
train-fitted imputation
no imputation
domain-native method
```

Missing history must not become:

```text
history = zero
```

unless zero is genuinely the declared value.

---

# 89. Indeterminate evaluation

If missingness prevents a valid comparison, the result should be:

```text
indeterminate
```

rather than silently dropping enough records to manufacture significance.

Any exclusion must be governed by the frozen eligibility policy.

---

# 90. Sample-size discipline

History Matters should not invent a universal minimum sample size.

Instead the contract must justify:

```text
cohort size
```

relative to:

- evaluator;
- metric;
- target prevalence;
- variance;
- domain.

Small cases may remain:

```text
descriptive
```

or:

```text
experimental bounded evidence
```

without pretending to support broad prediction claims.

---

# 91. Effect independence

Multiple contrasts from one source dataset are not automatically independent cases.

Example:

```text
C-MAPSS H5
C-MAPSS H20
C-MAPSS Hfull
```

are one benchmark family, not three independent confirmations.

Suite summaries must preserve:

```text
case family
dataset family
source family
```

---

# 92. Domain independence

Similarly:

```text
Git
Nix
OCI
in-toto
```

are different engineering cases but share software-domain assumptions.

They must not be counted as four independent proofs of a universal history principle.

---

# 93. Benchmark corpus organization

Suggested repository tree:

```text
cases/
├── history-benchmark-registry.json
│
├── history-matters-reference/
│   ├── benchmark-contract.json
│   ├── source/
│   ├── expected/
│   └── tests/
│
├── operational-aging/
│   ├── history-benchmark/
│   │   ├── contract.json
│   │   ├── views/
│   │   ├── splits/
│   │   ├── expected/
│   │   └── tests/
│   └── ...
│
└── ltee-evolutionary-contingency/
    ├── history-benchmark/
    │   └── ...
```

Keep benchmark files with the case that owns the domain semantics.

---

# 94. Root documentation

Add:

```text
docs/history/HISTORY_MATTERS_BENCHMARK.md
docs/history/HISTORY_BENCHMARK_CONTRACT.md
docs/history/HISTORY_BENCHMARK_REVIEW_GUIDE.md
docs/history/HISTORY_BENCHMARK_LEAKAGE_MODEL.md
```

The current document can become the first of these.

---

# 95. README integration

The root README should eventually gain a short section:

```text
History Matters Benchmark
```

with:

- precise one-sentence purpose;
- number of evaluation-grade contrasts;
- no inflated global claim;
- link to Explorer;
- link to method document.

Do not place detailed benchmark tables in the root README.

---

# 96. History Atlas integration

History Atlas should add a filter:

```text
Evidence mode:
    Portfolio
    History Matters
```

or an equivalent link into the dedicated Benchmark Explorer.

The original 3×3 taxonomy remains unchanged.

Benchmark status is a view over the same registered cases.

---

# 97. Model Studio integration

Model Studio does not need to execute cross-domain benchmarks.

It may expose:

```text
History Matters metadata
benchmark contract link
benchmark result link
```

for a selected Model Pack.

Do not turn Model Studio into a benchmark dashboard.

---

# 98. Engine integration

Potential engine analysis registration:

```text
history-matters-contrast
```

should be considered only for **single-model deterministic semantic contrasts**.

Cross-dataset empirical evaluation belongs in `@onto2d/history-benchmark`.

Avoid forcing every benchmark through the headless model API if the benchmark's target is external to the Model Pack.

---

# 99. Run-store integration

Each evaluated benchmark should produce a verified run bundle.

Store:

```text
contract
input artifact hashes
evaluator binding
predictions / structural results
metrics
null results
explanations
result hash
```

Operational execution logs remain overlays.

---

# 100. Reproducibility

A benchmark claim is publishable only when another environment can reproduce:

```text
exact contract
exact source projection
exact P view
exact H view
exact target
exact split
exact evaluator
exact result
```

or, for externally unavailable licensed data, reproduce all allowed artifacts from an explicitly supplied exact source.

---

# 101. Source availability classes

Add benchmark metadata:

```text
sourceAvailability:
    committed
    reconstructable
    user-supplied
    restricted
```

A restricted source does not invalidate a case, but lowers independent reproducibility unless an approved derived projection is sufficient.

---

# 102. Benchmark licenses

Each benchmark contract should bind source-license status separately from Onto2D code licensing.

Do not infer permission from public accessibility.

This is already consistent with current case discipline.

---

# 103. Research question templates

To keep cases comparable in structure, use templates.

## Identity

> Given present representation P, does valid history H change the admissible identity partition or improve recovery of an independently defined identity target?

## Present State

> Given present representation P, does history H improve estimation or discrimination of a held-out present-state property Y?

## Future

> Given information available at cutoff t, does history H improve prediction or restrict valid reachability of a future outcome Y?

---

# 104. Historical mode templates

## Recorded

H consists of persistent records available independently of current physical state.

## Embodied

H is represented by traces or accumulated state carried by the present system.

Important:

An embodied-history benchmark must avoid putting the target itself into H merely because both are current measurements.

## Reconstructed

H is generated by a frozen reconstruction method from present and recorded evidence.

Reconstruction uncertainty must remain explicit.

---

# 105. Embodied-history subtlety

Embodied history is conceptually difficult because history may already be encoded in P.

Example:

```text
microstructure
```

may itself be a product of manufacturing history.

If P includes complete microstructure, then adding explicit process history may add little.

That is not a benchmark failure.

It is an informative state-sufficiency result:

> This present representation already captured the useful historical information for the declared target.

This is exactly why negative results matter.

---

# 106. Recorded-history subtlety

Recorded history may contain information that is correlated with the target for administrative rather than mechanistic reasons.

Example:

```text
maintenance event code
```

may proxy an already recognized failure.

Such features require domain review.

A predictive gain is not automatically a mechanistic history effect.

---

# 107. Reconstructed-history subtlety

Reconstruction may itself use variables close to the target.

Therefore:

```text
reconstruction pipeline
```

must be target-blind where the claim is predictive.

Otherwise the benchmark becomes circular.

---

# 108. Semantic versus empirical visual style

The Explorer should visually distinguish:

```text
SEMANTIC
```

from:

```text
EMPIRICAL
```

and:

```text
EXPERIMENTAL
```

A user should not need to read fine print to know the evidence type.

---

# 109. History Matters and epistemic states

The shared History Evidence Model already distinguishes evidence classes such as:

```text
direct-record
direct-measurement
experimental-observation
attested
cryptographically-verified
derived
reconstructed
inferred
counterfactual
unknown
contested
```

History Matters should preserve those labels.

The benchmark result must not flatten them into a single confidence percentage.

---

# 110. Confidence is not evidence composition

Example:

```text
80% direct
20% inferred
```

must not become:

```text
confidence = 0.8
```

unless a case-specific reviewed statistical model defines that mapping.

The benchmark can report evidence composition descriptively.

---

# 111. Counterfactual ablation

For structural cases, one useful question is:

> If this historical fact were removed, would the result change?

This produces:

```text
history necessity profile
```

Example:

```text
remove build step B
    identity unchanged

remove provenance root R
    identity becomes indeterminate
```

This is distinct from empirical prediction but valuable for explanation.

---

# 112. Minimum sufficient history

A future generic analysis could ask:

> What smallest historical subset preserves the P1 result?

This would produce:

```text
minimal history witness
```

or:

```text
multiple minimal witnesses
```

This is potentially a strong Onto2D-native analysis because it can be expressed as a bounded finite search in suitable cases.

Do not add it to kernel v1 prematurely.

---

# 113. History sufficiency frontier

Across history-length or evidence-ablation runs, define a case-local frontier:

```text
history amount
        vs
task resolution
```

This can reveal where additional history stops changing the result.

---

# 114. Relation to active perception and Worldline Engine

History Matters and Worldline Engine should remain separate projects, but they share a principle.

Worldline Engine asks:

```text
which past object histories remain admissible?
```

History Matters asks:

```text
does adding past information improve a declared task?
```

A future Worldline case could itself become a History Matters benchmark:

```text
current observation only
vs
current observation + persistent worldline history
```

for identity under occlusion.

This would be a particularly clean future cross-project demonstration.

---

# 115. Benchmark anti-goals

History Matters is not:

- a Kaggle-style leaderboard;
- a single global score;
- a proof of new physics;
- a proof that Markov models are wrong;
- a causal inference engine;
- a Historical Load replacement;
- a generic AutoML framework;
- a collection of cherry-picked pairs;
- a requirement that every History Atlas case show a positive effect;
- an excuse to move domain-specific statistics into the kernel.

---

# 116. Publication discipline

Any article based on the benchmark should separate:

```text
preregistered primary contrasts
exploratory secondary contrasts
illustrative examples
```

The Operational Aging 25/72 pair belongs in the illustrative section unless an independent target-blind selection reproduces the phenomenon.

---

# 117. Negative-result policy

A negative result should be considered successful benchmark execution.

Example:

> For present representation P, adding the declared history H did not improve the held-out target under evaluator E.

This may mean:

- P already summarizes the relevant past;
- H is irrelevant to Y;
- H is too noisy;
- the evaluator cannot use H;
- sample size is insufficient.

The benchmark must not invent which explanation is true.

---

# 118. Invalid-result policy

An invalid run should remain stored as an operational failure but should not enter the scientific result suite.

Example:

```text
target leakage detected
```

The UI may show:

```text
INVALID RUN
```

with diagnostics.

It must never fall back to an older successful-looking result without explicit version selection.

---

# 119. Benchmark release versioning

Recommended independent suite release:

```text
history-matters/v1
```

The suite release binds:

```text
benchmark registry
contract identities
result identities
Explorer data
documentation revision
```

Adding a new case can create:

```text
v1.1
```

without changing prior result identities.

Changing an evaluated contract creates a new contract version.

---

# 120. Proposed initial release composition

History Matters v0 should contain:

## Infrastructure

- schemas;
- registry;
- package;
- synthetic golden;
- Explorer skeleton;
- leakage tests.

## Semantic exact contrasts

At least:

- Git;
- OCI;
- reproducible builds.

## Empirical

- Operational Aging remains `ILLUSTRATIVE`;
- new full-cohort contract frozen but not necessarily unblinded until review.

## Experimental

- LTEE contract draft.

The first release should not claim broad empirical confirmation.

---

# 121. Proposed v1 composition

History Matters v1 should require:

1. synthetic canonical fixture;
2. at least three reviewed semantic contrasts;
3. at least one evaluation-grade empirical contrast;
4. at least one deterministic null model;
5. independent review of benchmark contract and leakage boundary;
6. public Explorer;
7. exact replay from release commit.

Operational Aging is the recommended empirical requirement.

---

# 122. Proposed v1.1 / v2 expansion

Add:

- LTEE experimental contrast;
- material-process empirical contrast if symmetric measurements become available;
- expanded ecological dataset;
- expanded clinical cohort if methodologically and legally appropriate;
- reconstructed-history evaluation;
- cross-project Worldline identity contrast.

---

# 123. Implementation roadmap

## Phase 0 — specification

Create:

```text
docs/history/HISTORY_MATTERS_BENCHMARK.md
docs/history/HISTORY_BENCHMARK_CONTRACT.md
docs/history/HISTORY_BENCHMARK_LEAKAGE_MODEL.md
```

No code changes yet.

---

## Phase 1 — schemas and registry

Implement:

```text
history-benchmark-registry.json
history-benchmark-*.schema.json
```

Update:

```text
history-case-registry.json
```

with optional benchmark summary.

Add registry checks.

---

## Phase 2 — synthetic fixture

Implement the small deterministic reference benchmark.

Freeze:

- source;
- P;
- H;
- Y;
- expected contrast;
- expected null;
- expected hashes.

---

## Phase 3 — `@onto2d/history-benchmark`

Implement:

- contract verification;
- artifacts;
- deterministic evaluator profiles;
- nulls;
- result construction;
- explanations.

Do not change kernel v1.

---

## Phase 4 — Explorer

Create:

```text
apps/history-matters-benchmark/
```

Initially show:

- synthetic fixture;
- semantic exact cases;
- existing empirical candidate statuses.

---

## Phase 5 — Operational Aging full-cohort evaluation

Write and freeze the evaluation contract.

Run target-blind view construction.

Review leakage guards.

Then unblind and publish the result regardless of direction.

---

## Phase 6 — LTEE

Convert the existing bounded replay evidence into a formally registered History Matters experimental contrast.

Preserve source protocol semantics.

---

## Phase 7 — broader empirical corpus

Expand materials, ecology, clinical, and other cases only when each reaches evaluation-grade design.

---

# 124. File-level implementation plan

Suggested additions:

```text
docs/history/HISTORY_MATTERS_BENCHMARK.md
docs/history/HISTORY_BENCHMARK_CONTRACT.md
docs/history/HISTORY_BENCHMARK_LEAKAGE_MODEL.md
docs/history/HISTORY_BENCHMARK_REVIEW_GUIDE.md

cases/history-benchmark-registry.json

cases/history-matters-reference/
cases/history-matters-reference/benchmark-contract.json
cases/history-matters-reference/source/
cases/history-matters-reference/expected/
cases/history-matters-reference/tests/

packages/history-benchmark/
packages/history-benchmark/src/
packages/history-benchmark/README.md

apps/history-matters-benchmark/
```

Schema additions under the current schemas package.

---

# 125. Existing files to modify

Likely updates:

```text
README.md
package.json
cases/history-case-registry.json
docs/history/HISTORY_CASE_PORTFOLIO.md
docs/history/HISTORY_EVIDENCE_MODEL.md
apps/history-atlas/
apps/model-studio/
scripts/check-history-case-registry.mjs
test/
```

Exact files should be confirmed against the implementation commit before coding.

---

# 126. Suggested npm commands

```json
{
  "scripts": {
    "history-benchmark:check": "...",
    "history-benchmark:test": "...",
    "history-benchmark:goldens": "...",
    "history-benchmark:registry": "...",
    "history-benchmark:reference": "...",
    "history-benchmark:operational-aging": "..."
  }
}
```

Keep expensive full empirical runs separate from the normal fast `npm test` path where appropriate.

---

# 127. API sketch

```js
import {
  loadHistoryBenchmarkContract,
  runHistoryBenchmark
} from "@onto2d/history-benchmark";

const contract = await loadHistoryBenchmarkContract(
  "./cases/operational-aging/history-benchmark/contract.json"
);

const result = await runHistoryBenchmark(contract, {
  sources,
  evaluator
});

console.log(result.verdict);
console.log(result.primary);
console.log(result.nulls);
console.log(result.runHash);
```

The production API should be narrower after implementation review.

---

# 128. Result explanation API

```js
result.explainPrimaryContrast()
```

might return:

```text
Present-only:
    metric = ...

Present + history:
    metric = ...

Difference:
    ...

Null:
    ...

Interpretation:
    ...

Limitations:
    ...
```

The final API should use immutable plain-data envelopes rather than mutable class state if that better matches current engine conventions.

---

# 129. Built-in reference evaluator profiles

Initial package should implement only transparent evaluators.

Recommended:

```text
identity-partition-v1
nearest-neighbor-regression-v1
nearest-neighbor-classification-v1
rank-comparison-v1
reachable-set-v1
```

Avoid turning the package into an ML framework.

---

# 130. Scientific-adapter evaluators

External profiles can later include:

```text
linear-regression
random-forest
gradient-boosting
sequence model
domain-native solver
```

but their implementations stay outside the kernel and are fully content-bound.

---

# 131. Benchmark tamper golden

Freeze a benchmark result and test mutations.

Mutations:

```text
change cutoff
change one history row
change target row
change split membership
change primary metric
change evaluator version
change null seed
change source hash
```

Every mutation must change identity or fail verification as appropriate.

---

# 132. Permutation invariance

Where unit order is semantically irrelevant:

```text
input unit permutation
```

must not change the benchmark result identity.

Where temporal order is semantically meaningful:

```text
history event permutation
```

must change the history artifact or be rejected.

This distinction is important.

---

# 133. Budget semantics

Full benchmark runs may be expensive.

Any semantic enumeration used by a benchmark must obey existing Onto2D rules:

```text
semantic exhaustion
    !=
valid complete result
```

An evaluator timeout may produce an operational failure.

It must not be converted into:

```text
neutral
```

or:

```text
history does not matter
```

---

# 134. Statistical null exhaustion

If a declared null ensemble is incomplete:

```text
nullStatus = exhausted
```

then any verdict requiring the full null distribution must become:

```text
indeterminate
```

unless the contract explicitly defines a valid conservative bound.

---

# 135. Benchmark review questions

An independent reviewer should be able to ask:

### Ontology

- Are P, H, and Y conceptually distinct?
- Does H actually represent history?

### Evidence

- Is H recorded, embodied, or reconstructed correctly?
- Are epistemic labels preserved?

### Evaluation

- Is Y independent of view construction?
- Is pair/cohort selection target-blind?
- Is the evaluator fair?

### Reproducibility

- Are all bytes and versions pinned?
- Can the result be replayed?

### Interpretation

- Is the claim class correct?
- Is a semantic result being marketed as empirical?
- Is correlation being marketed as causality?
- Is a negative result preserved?

---

# 136. Falsification criteria for the benchmark program

The History Matters research program should explicitly accept outcomes that weaken its motivating thesis.

Examples:

## F1

Across multiple strong empirical domains, P1 repeatedly fails to outperform well-designed P0 representations.

Interpretation:

> The selected histories add little beyond competent present-state representations.

---

## F2

Apparent gains disappear under target-blind selection and leakage controls.

Interpretation:

> Earlier examples were selection artifacts.

---

## F3

Permuted or unrelated history performs as well as true history.

Interpretation:

> Gains may come from extra dimensionality or confounding rather than correct lineage.

---

## F4

Richer present-state representations eliminate the history advantage.

Interpretation:

> History was useful as a proxy for missing state, not necessarily independently necessary.

This is an important scientifically valid result.

---

## F5

History-aware models improve in-sample results but not held-out evaluation.

Interpretation:

> History increased fitting capacity without generalizable information.

---

## F6

Reconstructed history adds apparent value only when the reconstruction method has target leakage.

Interpretation:

> Reconstruction result is invalid for prediction.

---

# 137. Strong positive pattern

The most compelling empirical pattern would be:

```text
P0 < P1

P1 true history > permuted history

gain persists on held-out units

gain persists across reasonable P definitions

gain persists across more than one evaluator

result reproduced on another cohort
```

This would support a serious operational history-dependence claim.

---

# 138. Strong negative pattern

An equally valuable result would be:

```text
P0 ≈ P1

permuted history ≈ true history

richer P fully absorbs history advantage
```

This would indicate that the selected present representation is already close to history-sufficient for the task.

The benchmark must be designed to discover this.

---

# 139. Relationship to "history is part of the object now"

The benchmark provides a clean way to separate two statements.

Statement A:

> History has left traces in the present.

Statement B:

> Explicit access to history adds information beyond the declared present measurement.

For embodied history, A may be true while B is false.

Example:

```text
microstructure fully captures process history relevant to Y
```

Then:

```text
P already sufficient
```

and explicit process records add no gain.

This is not a contradiction.

It is exactly the distinction the benchmark should reveal.

---

# 140. Relationship to strong Historical Load arguments

The History Matters Benchmark should not convert empirical history utility into Historical Load.

Example:

```text
history improves RUL prediction
```

does not imply:

```text
dH > 0
```

Historical Load has different prerequisites.

Keep both analyses independent.

---

# 141. Relationship to causal emergence

History Matters may eventually provide empirical evidence relevant to broader Onto2D theory, but the benchmark itself should remain agnostic.

A positive history effect is not automatically:

- emergence;
- causal emergence;
- irreducibility;
- new physical law.

It is an operational result about a declared representation and task.

This conservative boundary makes later theoretical interpretation stronger.

---

# 142. Suggested public wording

Good:

> History Matters tests whether valid historical information changes identity, present-state discrimination, or future prediction beyond a declared present-state view.

Good:

> Positive results show operational insufficiency of the tested present representation for the declared task.

Avoid:

> History cannot be reduced to the present.

Avoid:

> We proved that the past fundamentally exists in the object.

Avoid:

> History always improves prediction.

---

# 143. Suggested Explorer subtitle

> **Same present. Different past. Does the difference change what we can know?**

Alternative:

> **Measure what history adds beyond the present.**

---

# 144. Why this materially strengthens Onto2D

Without History Matters, the repository can demonstrate:

```text
many domains can be modeled
```

and:

```text
history can be represented carefully
```

With History Matters, Onto2D can begin to demonstrate:

```text
history changes measurable task outcomes
```

under explicit falsification criteria.

That turns History Atlas from a portfolio into a research instrument.

---

# 145. Recommended first implementation decision

Do **not** start by modifying all 24 cases.

Start with:

```text
1 synthetic reference
3 semantic exact contrasts
1 empirical flagship
1 experimental candidate
```

Specifically:

```text
history-matters-reference
Git
OCI
Reproducible Builds
Operational Aging
LTEE
```

This is enough to validate the architecture.

---

# 146. Recommended first empirical priority

Operational Aging should be first because:

- current and historical views already exist;
- the current case already exposed a striking history-sensitive pair;
- the existing documentation already admits the selection bias;
- there is an independently supplied future target;
- the case is computationally manageable;
- a transparent full-cohort evaluator can be implemented without pretending to be state of the art.

It is almost perfectly positioned to become the first rigorous History Matters benchmark after redesign.

---

# 147. Recommended second empirical priority

LTEE should follow because it adds a qualitatively different evidence mode:

```text
experimental replay
```

rather than observational prediction.

This reduces the risk that the entire benchmark becomes "time-series ML with different datasets."

---

# 148. Recommended third priority

Acquire or extend a strong:

```text
Embodied × Present State
```

case with symmetric outcome measurements.

Material Process History is conceptually ideal if sufficient measurement coverage can be obtained.

---

# 149. Recommended fourth priority

Find the first credible:

```text
Reconstructed × Future
```

case.

Do not choose it merely to fill the matrix.

It should become a flagship only when reconstructed historical alternatives genuinely constrain a later independent outcome or reachable future.

---

# 150. Definition of success for History Matters v1

History Matters v1 is successful when:

1. benchmark contracts are content-addressed and replayable;
2. target leakage is mechanically guarded;
3. present/history/target artifacts are independent;
4. a synthetic golden proves the pipeline;
5. semantic and empirical claims are visibly separated;
6. at least one empirical contrast reaches `EVALUATED`;
7. negative results are preserved;
8. null history is tested;
9. no global score is invented;
10. the exact release can be independently replayed.

The success criterion is not:

```text
every case shows a positive history effect
```

The benchmark is successful if it can reliably discover when history does **not** help.

---

# 151. Final design principle

The benchmark should embody the same epistemic discipline already present in Onto2D:

```text
source
    !=
interpretation

history
    !=
causation

missing
    !=
false

not evaluated
    !=
zero

positive benchmark
    !=
universal law

semantic difference
    !=
predictive advantage

predictive advantage
    !=
causal effect
```

The central benchmark operation is simple:

```text
Freeze the present.
Add only legitimate history.
Hold the target outside both.
Measure what changes.
Try to destroy the result with nulls.
Keep the result even when history loses.
```

That is the History Matters Benchmark.

---

# Appendix A — Proposed status for selected current cases

| Case | Current History Matters role | Recommended status | Main work required |
|---|---|---|---|
| Git History Identity | semantic identity | CONTRAST_READY | formal benchmark contract |
| Nix Derivation Identity | semantic identity | CONTRAST_READY | formal benchmark contract |
| OCI Layer History | semantic identity / present secondary | CONTRAST_READY | formal contrast + null |
| in-toto Admissibility | semantic admissibility | CONTRAST_READY | formal contrast |
| Reproducible Build Equivalence | semantic identity | CONTRAST_READY | formal contrast |
| Live Bootstrap Provenance | semantic provenance | CONTRAST_READY | define P0/P1 precisely |
| Chemical Synthesis History | semantic identity | CONTRACT_DRAFT | distinguish route-history semantics from empirical chemistry |
| Operational Aging | empirical future | ILLUSTRATIVE | full-cohort target-blind evaluation |
| LTEE Evolutionary Contingency | empirical experimental future | CONTRACT_DRAFT | formal replay contrast |
| Material Process History | empirical present state | ILLUSTRATIVE | symmetric outcome measurements |
| Ecological Memory | empirical/descriptive present | ILLUSTRATIVE | controls / harmonization / more dates |
| Clinical Trajectories | empirical future candidate | CONTRACT_DRAFT | larger cohort + domain review |
| Galactic Archaeology | reconstructed present | CONTRAST_READY for reconstruction, not predictive HM | independent target required |
| Mineral Formation History | reconstructed identity | semantic / reconstruction | independent empirical target required |
| Cell Lineage Identity | reconstructed identity | semantic | define independent target if moving beyond identity regime |
| Historical Linguistics | reconstructed identity | semantic | avoid circular genealogy target |
| Manuscript Stemmatics | reconstructed identity | semantic | explicit transmission target required for empirical HM |
| Legal Precedent | recorded future / normative | semantic/normative | distinguish legal reachability from empirical prediction |
| Seshat Epistemic Provenance | recorded/reconstructed identity | epistemic semantic | define P0/P1/P2 contrast |
| Airflow Dependency Constraints | recorded future / engineering | semantic reachability | define history-specific P/H distinction |

---

# Appendix B — Proposed new analysis metadata

Example addition to a case:

```json
{
  "analyses": {
    "historicalLoad": "not-primary",
    "historyEquivalence": "not-primary",
    "reachability": "secondary",
    "reconstruction": "not-primary",
    "historyMatters": "primary"
  },

  "historyMatters": {
    "status": "ILLUSTRATIVE",
    "claimClasses": [
      "empirical"
    ],
    "contractIds": [
      "operational-aging-rul-v1"
    ]
  }
}
```

The `analyses` field describes scientific role.

The `historyMatters.status` field describes benchmark maturity.

Neither contains the benchmark result.

---

# Appendix C — Minimal benchmark contract fields

The smallest acceptable evaluation contract should contain:

```text
benchmarkId
caseId
claimClass
designClass
historyMode
effect

source identity
population definition
cutoff policy

present view
history view
target view

selection policy
split policy

evaluator
primary metric

null models
leakage guards

interpretation boundary
```

Anything affecting primary interpretation must be frozen before evaluation.

---

# Appendix D — External methodological references

The benchmark is compatible with a broad literature on state sufficiency and history representations.

Useful conceptual references include:

1. Singh, Littman, Jong, Pardoe & Stone — *Learning Predictive State Representations* (ICML 2003). Predictive State Representations formalize state as a statistic of history sufficient for future prediction.
2. Wingate & Singh — *Exponential Family Predictive Representations of State* (NeurIPS 2007). Discusses state as a sufficient statistic of history in partially observable systems.
3. Kulesza, Jiang & Singh — *Spectral Learning of Predictive State Representations with Insufficient Statistics* (AAAI 2015). Shows that practical restricted history/test representations may be insufficient and that representation choice materially changes prediction quality.
4. Kapoor & Narayanan et al. — *Leakage and the Reproducibility Crisis in Machine-Learning-Based Science* (Patterns, 2023). Provides a useful taxonomy for leakage from data collection through evaluation.
5. TRIPOD reporting guidance — useful for explicit predictor/outcome definition, separation, and evaluation reporting in predictive studies.

History Matters does not adopt these methods wholesale.

They support two important methodological principles:

```text
a good state should summarize task-relevant history
```

and:

```text
evaluation is meaningless if the target leaks into representation design
```

---

# Appendix E — One-page summary

## Question

```text
Does history add anything beyond the present?
```

## Contrast

```text
P0 = present only
P1 = present + valid history
N0 = present + wrong/permuted history
```

## Effects

```text
Identity
Present State
Future
```

## History modes

```text
Recorded
Embodied
Reconstructed
```

## Claim classes

```text
Semantic
Empirical
Predictive
Experimental
Causal
```

## Mandatory protections

```text
target outside P/H
cutoff enforced
target-blind selection
clean splits
frozen primary metric
null history
exact replay
negative results retained
```

## Forbidden output

```text
one global History Matters Score
```

## First empirical flagship

```text
Operational Aging / C-MAPSS
```

## First experimental flagship

```text
LTEE Evolutionary Contingency
```

## Core interpretation

```text
If P1 beats P0 under a valid protocol:

P is operationally insufficient for Y
under this declared domain and evaluator.

Nothing stronger is implied automatically.
```
