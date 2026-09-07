# History model

History is described along two independent axes: access mode (recorded,
embodied or reconstructed) and effect (identity, present state or future).
A case may occupy several cells. These are analytical placements, not levels
of evidence or mutually exclusive physical folders.

Recorded history comes from records of events or dependencies; embodied history
is retained in a present material/system state; reconstructed history is an
inference from traces and an explicit model. Identity asks which distinctions
count as the same object under a named regime. Present-state and future effects
need their own declared observation or target.

The [case registry](../../cases/history-case-registry.json) owns stable IDs,
mode/effect placements and maturity. [Portfolio](PORTFOLIO.md) provides the
reader-facing index. [History Matters](BENCHMARK.md) asks whether admissible
history improves a fixed task beyond a declared present representation.
Historical Load instead measures finite construction cost under admissibility;
undefined load is not zero and does not prohibit other analyses.

Case maturity runs from DISCOVERED and PLANNED through SOURCE_PINNED,
EXTRACTABLE, REPRODUCIBLE, MODEL_PACK, EXPLORER, ANALYSIS_READY and REVIEWED. These describe deliverables, not scientific proof.
No universal cross-domain history score is defined.

<a id="history-evidence-model"></a>

## History Evidence Model

History access and evidence quality are independent. `Recorded` means that a
persistent record exists; it does not mean that the record is complete or true.
`Embodied` means that the past may survive in present state; it does not by
itself establish causation. `Reconstructed` means that one or more pasts are
supported by evidence and a method; it does not declare an actual past.

<a id="history-evidence-model--shared-evidence-states"></a>

### Shared evidence states

```text
direct-record
direct-measurement
experimental-observation
sample-identity
attested
cryptographically-verified
published-interpretation
derived
reconstructed
inferred
counterfactual
unknown
contested
```

These are provenance and epistemic labels, not truth values.

<a id="history-evidence-model--required-separation"></a>

### Required separation

```text
source record / measurement
        ↓
deterministic projection
        ↓
published or domain interpretation
        ↓
Onto2D analysis construction
        ↓
counterfactual result
```

Every transition must be inspectable. Missingness remains missing; uncertainty
is preserved; source artifacts are immutable to analysis; and temporal order,
similarity, citation, or correlation cannot silently become causal dependence.

Case-specific evidence types remain allowed. They should enter the shared
vocabulary only after repeated semantics across independent cases.

<a id="history-evidence-model--benchmark-evidence"></a>

### Benchmark evidence

[History Matters](BENCHMARK.md) keeps P/H views and targets in
separate artifacts. Semantic regime-derived labels and synthetic targets are
not independent empirical outcomes. Reassigned null histories are counterfactual
diagnostics and never become source evidence. Evaluated, reviewed and replicated
are distinct maturity states; none is a causal interpretation.

<a id="history-identity-regimes"></a>

## History Identity Regimes

Onto2D does not define one universal identity relation. Identity is evaluated
under a declared regime `F`.

```text
CurrentStateIdentity != HistoricalIdentity
NominalIdentity != FullCurrentState
H1 ~F H2
```

A pair may be identical by Git tree and different by commit ancestry; identical
by output bytes and different by Nix derivation; identical by molecular target
and different by synthesis route; or identical by mineral species and different
by formation history.

Every identity or equivalence result must declare:

- the compared objects or histories;
- the regime and its version;
- included and ignored evidence;
- normalization rules;
- whether the result is exact, derived, inferred, or unresolved.

Different history does not automatically imply different identity. History
Equivalence is a separate analysis family from Historical Load.

<a id="history-conditioned-reachability"></a>

## History-Conditioned Reachability

This analysis family asks whether recorded or embodied historical state changes
the futures accessible from a bounded current description.

```text
ReachableFuture(
    current_state,
    historical_state,
    environment_profile
)
```

Primary cases are LTEE Evolutionary Contingency, Operational Aging, Ecological
Memory, and Clinical Trajectories. Their outputs are domain-specific: replay
outcomes, remaining lifetime, later ecological response, or descriptive
longitudinal context.

LTEE is also the portfolio's priority candidate for a future empirical
Historical Load extension. The classifications are not rivals: reachability is
the analysis completed by the current replay artifact, while Historical Load
would require a separately declared finite path space, admissibility regime,
cost function, and free baseline. A change in outcome propensity is not by
itself `dH(x | F) = aF - a0`.

The first implementations stay outside the kernel. They must declare the
outcome, historical-state representation, environment or experiment profile,
evidence, missingness, uncertainty, and analysis version.

`Not observed` is not `impossible`; association is not causation; and clinical
work remains descriptive and non-prescriptive until independently validated.

<a id="history-reconstruction"></a>

## History Reconstruction

Reconstruction starts from surviving evidence and computes or imports a set of
supported candidate histories.

```text
Evidence
   ↓
CandidateHistories
   ↓
constraint / likelihood / scholarly model
   ↓
SupportedHistorySet
```

Valid outputs include a unique supported reconstruction, multiple surviving
reconstructions, a partial order, a probability distribution, or unresolved
history. The best-supported candidate is not silently relabelled as the actual
past.

Primary cases include Lithic Operational History, Manuscript Stemmatics,
Historical Linguistics, Cell Lineage Identity, Galactic Archaeology, and
Mineral Formation History.

Each reconstruction must preserve source evidence, method and version,
interpretive attribution, uncertainty, alternatives, and any evidence ablation.
This family remains separate from forward admissibility closure and Historical
Load.
