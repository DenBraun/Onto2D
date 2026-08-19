# Onto2D History Model — Taxonomy and Case Reorganization Plan

Updated: 2026-08-18

## Repository adoption note

This source plan has been adopted in the repository. The validated
[`history-case-registry.json`](../../cases/history-case-registry.json) resolves
the final stable case IDs and maturity values, while this document remains the
authoritative semantic rationale. Where an archived bundle proposed a
source-branded ID such as `getty-artwork-provenance`, `nasa-operational-aging`,
`neon-ecological-memory`, or `gaia-galactic-archaeology`, the registry uses the
stable domain-neutral IDs listed in the repository-structure section. The
pre-existing `slsa-provenance-evidence` ID remains unchanged under the ID freeze.

The adopted registry also adds `matrixPlacements[]`. Multi-valued history modes
and effects cannot safely be multiplied into every possible pair: a mode may
support one effect but not another. Exact placement tuples prevent hybrid cases
from creating scientifically unsupported cells in the 3 x 3 view.

## Purpose

Reorganize the current and planned Onto2D external-case program around a
general model of **history**, rather than around subject domains such as
"IT" and "non-IT".

The existing domain split was useful for discovery, but it is not the right
long-term scientific architecture.

The primary organizing question should no longer be:

> Which domain does this case come from?

It should be:

> **How is history available to the system, and what does that history change?**

The proposed model has two orthogonal axes:

```text
                         HISTORY
                            |
          +-----------------+-----------------+
          |                 |                 |
       Recorded          Embodied        Reconstructed
          |                 |                 |
   explicit records     traces/state      inferred past
   provenance          latent memory      from evidence
   transactions        path-dependent     models/reconstructions
   logs/lineage        physical change
          |
          +-----------------+-----------------+
                            |
                         EFFECT
                            |
          +-----------------+-----------------+
          |                 |                 |
       Identity        Present State        Future
          |                 |                 |
      provenance        microstructure    reachability
      legal status      damage state      failure risk
      lineage class     cell state        adaptation
      natural kind      ecosystem state   response
```

This document defines the semantics of that structure, maps every current and
planned Onto2D case into it, and specifies how the repository and documentation
should be reorganized before more cases are added.

---

# 1. Why the current IT / non-IT split should be retired

The current portfolio contains cases from:

- software;
- chemistry;
- mineralogy;
- biology;
- materials science;
- archaeology;
- ecology;
- law;
- cultural transmission;
- medicine;
- astronomy.

Those domains are useful tags, but they do not describe the scientific
relationship between the cases.

For example:

```text
Git history
Artwork provenance
Chemical synthesis
```

come from unrelated domains, but all primarily test:

```text
Recorded History -> Identity
```

Likewise:

```text
AM-Bench
engine fatigue
ecological disturbance
clinical trajectory
```

all test variants of:

```text
Embodied History -> Present State / Future
```

The new taxonomy therefore makes domain a **secondary metadata dimension**.

The primary scientific dimensions become:

```text
History Access Mode
+
History Effect
```

---

# 2. Axis A — History Access Mode

`Recorded`, `Embodied`, and `Reconstructed` describe **how historical
information is available to an Onto2D case**.

They are not mutually exclusive ontological categories.

A single case may use more than one mode.

For example, LTEE contains:

- recorded sample generations and experiment history;
- embodied genetic changes;
- reconstructed causal interpretation.

The registry must therefore support:

```text
primaryHistoryMode
historyModes[]
```

rather than one exclusive enum.

---

# 3. Recorded History

## Definition

History is **Recorded** when past events or relations are represented by an
external persistent record that can be inspected independently of the current
object state.

Examples:

```text
Git commit parents
Nix derivations
OCI layer sequence
live-bootstrap manifest
in-toto links
SLSA provenance
reaction records
ownership records
clinical event records
process logs
```

Conceptually:

```text
Past event
    |
    v
Persistent record
    |
    v
Current analysis
```

The current object does not need to contain the full history internally.

### Main epistemic risk

Recorded does **not** automatically mean true or complete.

A recorded relation may be declared, attested, verified, incorrect, partial,
forged, or missing.

Therefore:

```text
Recorded History != Verified History
```

The evidence layer remains separate.

---

# 4. Embodied History

## Definition

History is **Embodied** when previous events alter the present physical,
biological, ecological, or latent state of the system.

```text
history
   |
   v
state transformation
   |
   v
present trace / latent state
```

Examples:

```text
fatigue damage
microstructure
residual stress
genetic background
ecological disturbance legacy
treatment exposure
plastic deformation
seed-bank state
```

This is stronger than ordinary provenance.

```text
ObservableState(A) ~= ObservableState(B)

but

EmbodiedHistory(A) != EmbodiedHistory(B)
```

and therefore potentially:

```text
Future(A) != Future(B)
```

### Main epistemic risk

A measured difference after a historical event does not automatically prove
causal necessity.

Onto2D must distinguish:

```text
preceded-by
correlated-with
mechanistically-supported
experimentally-demonstrated
causal-claim
```

---

# 5. Reconstructed History

## Definition

History is **Reconstructed** when the original sequence is not directly
available and must be inferred from surviving evidence.

```text
present evidence
      |
      v
candidate histories
      |
      v
constraints + model
      |
      v
supported reconstruction(s)
```

Examples:

```text
archaeological reduction sequences
manuscript stemmata
historical linguistics
cell lineage reconstruction
mineral formation interpretation
galactic archaeology
```

Reconstruction may yield:

```text
one strongly supported history
multiple surviving histories
partial ordering
probabilistic lineage
unknown segments
```

Onto2D must never force reconstruction into one exact sequence when evidence
does not justify it.

### Main epistemic risk

```text
best-supported reconstruction
        !=
declared actual history
```

---

# 6. Axis B — History Effect

The second axis describes **what historical information changes in the model**.

A case may have several effects.

Use:

```text
primaryEffects[]
secondaryEffects[]
```

---

# 7. Identity Effect

History affects identity, classification, provenance status, relational status,
or an equivalence class.

Examples:

```text
same Git tree / different commit ancestry
same Nix output / different derivation
same molecule / different synthesis route
same artwork / different ownership provenance
same mineral species / different formation kind
same cell type / different lineage
```

Canonical distinction:

```text
CurrentStateIdentity != HistoricalIdentity
```

Identity is always relative to an explicit regime.

---

# 8. Present-State Effect

History affects current measurable or latent properties.

Examples:

```text
manufacturing history -> microstructure
fatigue history -> damage state
treatment history -> patient state
disturbance history -> ecosystem state
development history -> molecular/cellular state
```

Canonical distinctions:

```text
NominalIdentity != FullCurrentState
```

and:

```text
LimitedObservableState != LatentHistoricalState
```

---

# 9. Future Effect

History affects transitions, risks, responses, or outcomes accessible from the
current state.

Examples:

```text
genetic history -> evolutionary accessibility
fatigue history -> remaining useful life
ecological history -> response to disturbance
clinical history -> treatment response / risk
legal precedent -> admissible future legal reasoning
```

Canonical form:

```text
CurrentObservation
        +
HistoricalState
        ->
FutureReachability
```

This is the strongest form of history dependence in the current program.

---

# 10. Effect is not evidence

Keep separate:

```text
How do we know the history?
```

and:

```text
What does the history change?
```

Example:

```text
Cell lineage

History mode:
    Reconstructed + Embodied

Effect:
    Identity + Present State

Evidence:
    barcode observation + lineage algorithm
```

These dimensions must never be collapsed into one classification field.

---

# 11. Recommended shared registry

Create:

```text
cases/history-case-registry.json
```

Suggested record:

```json
{
  "caseId": "ltee-evolutionary-contingency",
  "title": "LTEE Evolutionary Contingency",
  "domain": "experimental-evolution",
  "status": "planned",
  "primaryHistoryMode": "embodied",
  "historyModes": [
    "recorded",
    "embodied",
    "reconstructed"
  ],
  "primaryEffects": [
    "future"
  ],
  "secondaryEffects": [
    "identity",
    "present-state"
  ],
  "evidenceProfile": [
    "experimental-observation",
    "sample-identity",
    "published-interpretation"
  ],
  "modelId": "ltee-lineage-history",
  "explorerId": "evolutionary-contingency-lab"
}
```

The registry becomes the source for:

- documentation indexes;
- website navigation;
- case cards;
- cross-case matrices;
- future History Atlas.

---

# 12. Do not reorganize physical folders by category

Do **not** create:

```text
cases/recorded/
cases/embodied/
cases/reconstructed/
```

Many important cases are hybrids.

For example:

```text
AM-Bench
=
Recorded process history
+
Embodied material history
```

The implemented `material-process-history@v1-0ea3ee56fe462eea` release makes
that hybrid boundary concrete: three native AM-Bench builds share one exact
projected nominal P3 recipe, while native build and part identity remain three
classes. Direct residual-strain evidence resolves B7-P3 only; B6-P3 and B8-P3
remain unknown, and no causal edge or Historical Load number is inferred.

The implemented `ltee-lineage-history@v1-e4ff96341b402b13` release makes the
Embodied History → Future axis concrete without inventing determinism. It keeps
sixteen Ara-3 generation labels, three replay protocols, thirty-eight bounded
observations, published statistics, and interpretation boundaries separate.
Cit+ observed from seven labels supports protocol-conditioned accessibility;
the other nine remain unresolved, generation is not promoted to genotype, and
Historical Load remains undefined.

Keep stable paths:

```text
cases/live-bootstrap-provenance/
cases/git-history-identity/
cases/material-process-history/
cases/ltee-evolutionary-contingency/
...
```

Classify them through registry metadata.

This keeps Model Pack IDs, URLs, tests, and citations stable.

---

# 13. Central 3 x 3 case matrix

## Recorded x Identity

Strongest cases:

```text
Git History Identity
Nix Derivation Identity
live-bootstrap Provenance
OCI Layer History
in-toto Admissibility
Reproducible Builds Equivalence
SLSA Provenance
Software Heritage Lineage
Chemical Synthesis History
Artwork Provenance
```

Primary questions:

```text
same current state, different recorded ancestry?
same content, different derivation?
same artifact, admissible vs inadmissible provenance?
which recorded histories count as equivalent?
```

## Recorded x Present State

Strongest cases:

```text
NIST AM-Bench
Operational Aging / C-MAPSS
Clinical Trajectories
LTEE observational timeline
```

Primary question:

```text
which recorded events remain visible in present measurements?
```

## Recorded x Future

Strongest cases:

```text
LTEE replay experiments
Operational Aging / Fatigue
Clinical Trajectories
Legal Precedent
Ecological management/disturbance records
```

Primary questions:

```text
does recorded history condition future transition probabilities?
does prior history constrain admissible future actions?
```

## Embodied x Identity

Initial cases:

```text
Mineral Formation History
Cell Lineage Identity
selected biological lineage cases
```

Treat this cell cautiously. Embodied difference does not automatically mean an
identity-relevant difference.

## Embodied x Present State

Strongest cases:

```text
Material Process History / AM-Bench
Operational Aging / Fatigue
Ecological Memory
Clinical Trajectories
Cell Development / Lineage
```

Primary questions:

```text
what part of past process remains encoded now?
can two nominally identical systems have different latent state?
```

## Embodied x Future

Strongest cases:

```text
LTEE Evolutionary Contingency
Ecological Memory
Operational Aging / Fatigue
Clinical Trajectories
```

Primary questions:

```text
does history change reachable future?
does hidden historical state change failure/adaptation/response?
```

This should become one of the highest-value regions of the Onto2D program.

## Reconstructed x Identity

Strongest cases:

```text
Mineral Formation History
Cell Lineage Identity
Manuscript Stemmatics
Historical Linguistics
Artwork Provenance with provenance gaps
```

Primary questions:

```text
does reconstructed ancestry change classification?
how do multiple possible historical parents affect identity?
```

## Reconstructed x Present State

Strongest cases:

```text
Lithic Operational History
Galactic Archaeology
Mineral Formation History
```

Primary questions:

```text
which historical processes best explain present traces?
how much history can be recovered from current structure?
```

## Reconstructed x Future

This cell is currently less populated and should remain an explicit research
gap rather than being filled artificially.

Potential later candidates:

```text
reconstructed clinical history -> prognosis
reconstructed ecological disturbance -> future resilience
reconstructed evolutionary history -> accessibility
```

---

# 14. Reclassification of current software / engineered cases

## live-bootstrap Provenance

```text
Primary history mode: Recorded
Secondary mode: Reconstructed/inferred where dependency evidence is incomplete
Primary effect: Identity
Role: constrained construction ancestry
```

## Git History Identity

```text
Primary history mode: Recorded
Primary effect: Identity
Role: canonical same-state / different-history case
```

## Nix Derivation Identity

```text
Primary history mode: Recorded
Primary effect: Identity
Role: content identity vs construction identity
```

## OCI Layer History

```text
Primary history mode: Recorded
Primary effect: Identity
Secondary effect: Present State
Role: history erased by flattening
```

## in-toto Admissibility

```text
Primary history mode: Recorded
Primary effect: Identity / normative admissibility
Role: same artifact, different provenance admissibility
```

## Reproducible Builds Equivalence

```text
Primary history mode: Recorded
Primary effect: Identity
Role: different history does not necessarily mean different identity
```

## SLSA Provenance Evidence

```text
Primary history mode: Recorded
Primary effect: Identity
Primary scientific role: epistemic evidence
Role: history vs claim vs attestation vs verification
```

## Software Heritage Lineage

```text
Primary history mode: Recorded
Primary effect: Identity
Role: real-world many-to-many ancestry at scale
```

---

# 15. Reclassification of current physical / scientific cases

## Chemical Synthesis History

```text
Primary history mode: Recorded
Primary effect: Identity
Role: same molecular target, different synthesis route
```

## Mineral Formation History

```text
Primary history mode: Reconstructed
Secondary mode: Embodied
Primary effect: Identity
Secondary effect: Present State
Role: same conventional mineral species, different formation history
```

Use `Embodied` only where present mineral properties actually preserve
measurable formation traces in the selected case.

## LTEE Evolutionary Contingency

```text
Primary history mode: Embodied
Secondary modes: Recorded, Reconstructed
Primary effect: Future
Secondary effects: Present State, Identity
Role: historical genetic background changes evolutionary accessibility
```

Flagship:

```text
Embodied History -> Future
```

## Material Process History / AM-Bench

```text
Primary history mode: Embodied
Secondary mode: Recorded
Primary effect: Present State
Role: processing history becomes microstructure / residual state / properties
```

Flagship:

```text
Embodied History -> Present State
```

## Cell Lineage Identity / scGESTALT

```text
Primary history mode: Reconstructed
Secondary mode: Embodied
Primary effect: Identity
Secondary effect: Present State
Role: current cell state vs developmental lineage
```

The CRISPR barcode is an embodied historical record while the complete lineage
tree is reconstructed.

## Lithic Operational History / ReViBE

```text
Primary history mode: Reconstructed
Primary effect: Present State / historical explanation
Role: present artefacts -> evidence-constrained operational history
```

Do not force this case into Historical Load initially.

---

# 16. Reclassification of additional planned directions

## Artwork Provenance

```text
Primary history mode: Recorded
Secondary mode: Reconstructed when ownership gaps exist
Primary effect: Identity
Secondary effect: legal / relational status
Role: same physical artwork, different provenance status
```

Flagship:

```text
Recorded History -> Relational Identity
```

## Legal Precedent

```text
Primary history mode: Recorded
Primary effect: Future
Secondary effect: Identity / normative status
Role: historical decisions constrain future admissible reasoning
```

Distinct form:

```text
Normative History -> Future
```

## Manuscript Stemmatics

```text
Primary history mode: Reconstructed
Primary effect: Identity
Role: textual state vs transmission ancestry, multiple historical parents
```

Flagship test for:

```text
non-tree historical parentage
```

## Historical Linguistics

```text
Primary history mode: Reconstructed
Secondary mode: Recorded modern lexical evidence
Primary effect: Identity
Role: similarity vs ancestry; vertical inheritance vs horizontal borrowing
```

## Ecological Memory

```text
Primary history mode: Embodied
Secondary mode: Recorded disturbance history
Primary effects: Present State, Future
Role: disturbance legacy / hysteresis / resilience
```

Flagship:

```text
Embodied History -> Present State + Future
```

## Operational Aging / Fatigue

```text
Primary history mode: Embodied
Secondary mode: Recorded operational cycles
Primary effects: Present State, Future
Role: latent damage + remaining useful life
```

Clean demonstration:

```text
same observable frame
!=
same historical state
!=
same future lifetime
```

## Clinical Trajectories

```text
Primary history mode: Embodied
Secondary mode: Recorded
Primary effects: Present State, Future
Role: patient snapshot vs longitudinal state
```

High value, but causal claims require the strictest evidence firewall.

## Galactic Archaeology

```text
Primary history mode: Reconstructed
Primary effect: Present State / historical explanation
Role: present stellar traces -> candidate galactic history
```

Extreme-scale reconstruction case.

---

# 17. New top-level program structure

Retire as primary navigation:

```text
IT External Cases
Non-IT External Cases
```

Use:

```text
HISTORY MODEL
|
+-- Recorded History
|   +-- Identity
|   +-- Present State
|   +-- Future
|
+-- Embodied History
|   +-- Identity
|   +-- Present State
|   +-- Future
|
+-- Reconstructed History
    +-- Identity
    +-- Present State
    +-- Future
```

Cases are references inside this structure, not physically owned by one branch.

---

# 18. Proposed documentation structure

Create:

```text
docs/history/
  README.md
  HISTORY_MODEL_TAXONOMY.md
  HISTORY_CASE_PORTFOLIO.md
  HISTORY_EVIDENCE_MODEL.md
  HISTORY_IDENTITY_REGIMES.md
  HISTORY_REACHABILITY.md
  HISTORY_RECONSTRUCTION.md
```

Recommended case documentation location:

```text
docs/cases/
  LIVE_BOOTSTRAP_PROVENANCE_IMPLEMENTATION.md
  GIT_HISTORY_IDENTITY_IMPLEMENTATION.md
  NIX_DERIVATION_IDENTITY_IMPLEMENTATION.md
  ...
```

The old:

```text
EXTERNAL_CASES_PROGRAM.md
NON_IT_EXTERNAL_CASES_PROGRAM.md
```

should eventually become discovery/archive indexes or short pointers to:

```text
docs/history/HISTORY_CASE_PORTFOLIO.md
```

Do not maintain two competing primary taxonomies.

---

# 19. Proposed repository structure

Keep stable case directories:

```text
cases/
  live-bootstrap-provenance/
  git-history-identity/
  nix-derivation-identity/
  oci-layer-history/
  in-toto-admissibility/
  reproducible-build-equivalence/
  slsa-provenance/
  software-heritage-lineage/
  chemical-synthesis-history/
  mineral-formation-history/
  ltee-evolutionary-contingency/
  material-process-history/
  cell-lineage-identity/
  lithic-operational-history/
  artwork-provenance/
  legal-precedent-history/
  manuscript-stemmatics/
  historical-linguistics/
  ecological-memory/
  operational-aging/
  clinical-trajectories/
  galactic-archaeology/
```

Add:

```text
cases/history-case-registry.json
```

Do not move case folders when their taxonomy changes.

---

# 20. Proposed website reorganization

Add a top-level entry:

```text
History
```

Future app:

```text
apps/history-atlas/
```

Primary view:

```text
                         IDENTITY     PRESENT STATE     FUTURE

RECORDED                 [cases]        [cases]        [cases]

EMBODIED                 [cases]        [cases]        [cases]

RECONSTRUCTED            [cases]        [cases]        [research gaps]
```

Each case card should show:

```text
title
domain
history modes
effects
status
evidence profile
Model Pack
Explorer
```

Filters:

```text
History mode
Effect
Domain
Evidence type
Status
Historical Load support
Model Pack availability
```

Do not implement the History Atlas until the registry exists.

---

# 21. Model Studio role

Model Studio remains model-centric.

```text
History Atlas
      |
      v
select case/model
      |
      +----> Case Explorer
      |
      +----> Model Studio
```

Model Studio should not hard-code `Recorded`, `Embodied`, or `Reconstructed`
unless those classifications arrive through model/case metadata.

---

# 22. Analysis families under the new taxonomy

## Historical Load

Historical Load is no longer the organizing concept.

It is one analysis applicable to selected finite history spaces.

Best candidates:

```text
live-bootstrap
chemistry
OCI
in-toto
selected bounded material-process cases
```

Do not compute it merely because a case contains history.

## History Equivalence

Second major analysis family.

Core form:

```text
H1 ~F H2
```

Primary cases:

```text
Git
Reproducible Builds
Nix
OCI
Chemical Synthesis
```

Question:

```text
Under regime F, which historical differences matter?
```

## History-Conditioned Reachability

Distinct analysis family for:

```text
Embodied History -> Future
```

Primary cases:

```text
LTEE
Ecological Memory
Operational Aging
Clinical Trajectories
```

Core form:

```text
ReachableFuture(
    current_state,
    historical_state,
    environment_profile
)
```

Do not promote it to the kernel yet.

## Reconstruction Analysis

Distinct family for:

```text
Reconstructed History
```

Primary cases:

```text
Lithic Operational History
Manuscript Stemmatics
Historical Linguistics
Cell Lineage
Galactic Archaeology
Mineral Formation
```

Core form:

```text
Evidence
   |
   v
CandidateHistories
   |
   v
Constraint / likelihood model
   |
   v
SupportedHistorySet
```

Possible outputs:

```text
unique supported reconstruction
multiple surviving reconstructions
partial order
probability distribution
unresolved
```

Keep this separate from ordinary forward admissibility closure.

---

# 23. Cross-cutting evidence model

Initial evidence states:

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

These are not truth values.

Example:

```text
historyMode: reconstructed
evidenceStatus: published-interpretation
effect: identity
```

is valid.

---

# 24. Case maturity levels

Add standard status values:

```text
DISCOVERED
PLANNED
SOURCE_PINNED
EXTRACTABLE
REPRODUCIBLE
MODEL_PACK
EXPLORER
ANALYSIS_READY
REVIEWED
```

This is more useful than grouping by domain.

---

# 25. Immediate reorganization plan

## Phase 0 — Freeze IDs

Do not rename existing case IDs unless necessary.

Stable IDs become part of external references.

## Phase 1 — Add taxonomy

Create:

```text
docs/history/HISTORY_MODEL_TAXONOMY.md
```

This document can serve as the initial content.

## Phase 2 — Add registry

Create:

```text
cases/history-case-registry.json
```

Register every existing and planned case.

A case may be registered while still `PLANNED`.

## Phase 3 — Migrate program docs

Update:

```text
EXTERNAL_CASES_PROGRAM.md
NON_IT_EXTERNAL_CASES_PROGRAM.md
```

to state that domain grouping is secondary.

Make:

```text
docs/history/HISTORY_CASE_PORTFOLIO.md
```

the authoritative portfolio view.

## Phase 4 — Update implementation-plan headers

Add to every case implementation document:

```text
History modes:
Primary effects:
Domain:
Evidence profile:
Historical Load:
History Equivalence:
Reachability:
Reconstruction:
```

Example:

```text
History modes: Embodied, Recorded, Reconstructed
Primary effects: Future
Domain: Experimental evolution
Evidence profile: Experimental observation, sample identity, published interpretation
Historical Load: Not primary
History Equivalence: Possible later
Reachability: Primary
Reconstruction: Secondary
```

## Phase 5 — Registry validation

Add tests:

- every case ID is unique;
- every referenced implementation doc exists;
- every history mode is valid;
- every effect is valid;
- primary mode is included in history modes;
- status is valid;
- a Model Pack path resolves when the status claims it exists;
- an Explorer path resolves when the status claims it exists.

## Phase 6 — Reorganize navigation

Replace IT/non-IT as primary sections with:

```text
History
  Recorded
  Embodied
  Reconstructed
```

Keep domain as a filter.

## Phase 7 — Build History Atlas

Only after registry and metadata stabilize.

The Atlas must be generated from registry data, not maintained separately.

---

# 26. Recommended implementation priorities after reorganization

## Priority A — Recorded -> Identity

```text
Git
Nix
live-bootstrap
Chemistry
Artwork Provenance
```

Establishes the clean identity/history foundation.

## Priority B — Embodied -> Present State

```text
AM-Bench
Operational Aging
Ecological Memory
```

Moves Onto2D beyond provenance.

## Priority C — Embodied -> Future

```text
LTEE
Operational Aging
Ecological Memory
```

Tests the strongest historical effect: history-conditioned reachability.

## Priority D — Reconstructed -> Identity

```text
Mineral Formation
Cell Lineage
Manuscript Stemmatics
Historical Linguistics
```

Tests identity under uncertain/reconstructed ancestry.

## Priority E — Reconstruction from traces

```text
Lithic Operational History
Galactic Archaeology
```

Tests inversion from present evidence to candidate pasts.

---

# 27. What not to do

Do not:

- move case directories according to taxonomy;
- make domains primary again inside the registry;
- force every case into one history mode;
- force every case into one effect;
- treat reconstructed history as actual history;
- treat embodied history as automatically causal;
- make Historical Load mandatory;
- create one universal history metric;
- move Recorded/Embodied/Reconstructed into the kernel yet;
- build a generic importer before several cases prove common semantics.

---

# 28. Target conceptual model

```text
                         OBJECT / SYSTEM
                               |
                               v
                         CURRENT STATE
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
      CURRENT IDENTITY                   HISTORY MODEL
                                                |
                              +-----------------+-----------------+
                              |                 |                 |
                           Recorded          Embodied        Reconstructed
                              |                 |                 |
                              +-----------------+-----------------+
                                                |
                                                v
                                           HISTORY SET
                                                |
                    +---------------------------+---------------------------+
                    |                           |                           |
                    v                           v                           v
                 Identity                 Present State                  Future
                    |                           |                           |
             provenance class             latent state                 reachability
             natural kind                 microstructure               risk
             lineage/status               damage state                 adaptation
                    |
                    +---------------------------+---------------------------+
                                                |
                                                v
                                        EVIDENCE / UNCERTAINTY
```

History is no longer one scalar or one relation.

History has:

```text
mode of access
evidence status
effect
identity regime
possible alternatives
uncertainty
```

---

# 29. Expected scientific result

If the reorganized program succeeds, Onto2D should distinguish:

```text
Recorded history:
    the past survives as an explicit external record.

Embodied history:
    the past survives as present internal state.

Reconstructed history:
    the past is inferred from surviving evidence.
```

and independently:

```text
Identity effect:
    history changes classification or equivalence.

Present-state effect:
    history changes what the system is now.

Future effect:
    history changes what the system can do next.
```

Domains become test environments.

The history model becomes the scientific structure.

---

# 30. Definition of done

The reorganization is complete when:

- [ ] `HISTORY_MODEL_TAXONOMY.md` exists;
- [ ] every current and planned case appears in `history-case-registry.json`;
- [ ] existing case IDs remain stable;
- [ ] IT/non-IT are demoted to domain/discovery tags;
- [ ] each case declares history modes and effects;
- [ ] each case declares its evidence profile;
- [ ] implementation docs use the common metadata header;
- [ ] website navigation can be generated from registry metadata;
- [ ] Model Studio remains independent of taxonomy;
- [ ] Historical Load is one optional analysis family;
- [ ] History Equivalence is a separate analysis family;
- [ ] History-Conditioned Reachability is a separate analysis family;
- [ ] Reconstruction is a separate analysis family;
- [ ] no taxonomy category is hard-coded into case directory paths.

At that point new cases can be added without creating another domain-specific
program document or reorganizing the repository again.
