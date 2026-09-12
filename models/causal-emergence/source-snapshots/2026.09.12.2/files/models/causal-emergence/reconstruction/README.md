# Foundation review and central-graph reconstruction proposal

Date: 2026-09-11. Status: **reviewable research proposal**, not a new active
Model Pack, a frozen classification policy, or independent scientific review.

The supplied texts contain a recognizable construction idea: configurations
become admissible, acquire persistent identity, and provide carriers and
constraints for another round of organization. The missing link is a justified
procedure from those principles to the individual catalogue decisions.
The current catalogue does not yet implement that procedure.

This corrects a potentially misleading reading of the earlier audit. The author's
statement that the catalogue was assembled intuitively does **not** mean the
project had no theoretical principles. The papers and archive supply principles,
definitions and proposed algorithms. They do not supply a replayable selection
history or scientific justification for all 249 current records and 971 edges.

## Scope and reproducibility

- [Source review and archive inventory](source-review.json): complete textual
  review of all 36 pages of
  [topology-of-arising.pdf](../../../references/topology-of-arising.pdf) and all
  ten text members of [Архив.zip](../../../references/Архив.zip). Page 13 was also
  inspected as a rendered page to verify equation signs. This is selected
  mathematical analysis, not certification of every proof.
- A targeted reading of the 101-page
  [Theory of Causal Arisings](../../../references/theory-of-causal-arisings.pdf)
  covers its construction, lifecycle, completeness and applicability passages:
  pages 1, 37–38, 45–48, 57–61, 77–79 and 98–101. Full review of that paper
  remains pending. The original numerical source lock is preserved.
- [Level-0 proposal](level-0-proposal.json): interpretations for all 24 legacy
  cards, 27 proposed definition/class/rule entities, six construction operations,
  twelve claim findings and an inventory of all 84 incoming source relations.
  Those 84 relations remain marked pending for claim-specific classification;
  inventory coverage is not completed scientific review.
- [Read-only checker](verify.py): source and archive hashes, exact node/edge
  coverage, internal references, and five finite mathematical checks.

Run from the repository root:

```sh
python3 models/causal-emergence/reconstruction/verify.py
```

The JSON files are research ledgers with explicit draft formats. They are not
package schemas or executable kernel rule packages. The checker validates their
accounting and the stated witnesses, not the scientific truth of their prose.
Their PDF identities are tied to local bytes. The theory DOI/date were read
from its title page; topology version metadata comes from the existing case
source lock. Zenodo metadata could not be independently rechecked through web
access during this review. A DOI identifies a deposit; it is not peer review.

Validation performed for this review: the read-only checker passed all source
bindings, inventory references and mathematical witnesses; `check:docs` passed
for 173 Markdown files; `git diff --check` passed. The integrated
`npm run case:level-0:verify` also reproduced its frozen v3 artifact, including
the negative objecthood disposition. This rerun is computational replay, not
independent scientific review. The full workspace test/build results from the
earlier baseline audit are not presented as fresh checks of this addition.

Archive locators below refer to member names and 1-based text line numbers.
The machine-readable inventory hashes the original member bytes and records
the full reviewed line range. No archived code or instructions were executed.
Explicit v2/v3 dates are historical labels, not proof of when each idea arose;
the archive does not establish speaker identities for conversational passages.

## What the sources contribute

| Source and locator | Reusable contribution | Disposition and limit |
|---|---|---|
| Topology, pp. 3–5 | Distinguishability, compensation and directional primitives | Formal context and definitions; explicit operational domains remain necessary |
| Topology, pp. 15–24 | Irreducible closure followed by a separate objecthood threshold | Keep resonance, localization and persistence as separate claims and gates |
| Topology, pp. 27–35, especially Eq. (55) | New carriers change the admissibility conditions of the next construction cycle | Represent the carrier interface and rule transition explicitly; its calculation remains open |
| Theory, pp. 37–38, 57–61 | Configurations, typed operators, arising/maintenance/modulation | Separate mechanism, relation semantics, lifecycle role and context |
| Theory, pp. 77–78 | Completeness relative to declared requirements, with separate evidence | A completeness index is not a probability that a graph is true; the text itself states this limit |
| Theory, pp. 98–100 | Direct, effective and not-yet-formalizable descriptions | Do not assign a Lagrangian before state variables and operators are defined |
| `mvp.txt`, lines 5–44, 60–89 | Formula, component, constraint, origin and simulation records | Preserve as distinct scientific objects; defer another DSL implementation until semantics are settled |
| `OntoUML.txt`, lines 11–51, 104–114 | System level versus approximation level; explicit transition objects | Useful modelling distinctions; archived syntax and compatibility are proposals |
| `log.txt`, lines 16–26, 84–146, 440–445 | Candidate gaps, formula decomposition, coarse-graining and invariant tracing | Candidate backlog and traceability requirements; no automatic addition of nodes or equations |
| `LifeSynth Solutions.txt`, lines 25–73 | Functional substitution and continuity under replacement | Research motivation; no evidence of a successful transfer of consciousness |
| `LifeSynth_Solutions_v2.txt`, lines 38–89 | Multi-scale intervention comparison and typed hypergraphs | Reuse the comparison question; repair the mathematical contract |
| `LifeSynth_Solutions_v3.txt`, lines 24–108 | Proof obligations for changes, negative proxy tests, evidence milestones | Useful experimental design ideas; proposed implementations and identity claims remain unverified |
| `Lisy_eng.txt`, lines 25–111 | English version of the v3 concepts | A closely corresponding translation, not an independent result |
| `Research Plan Emergence.txt`, lines 14–43, 49–55 | Necessary-condition, representation and engineering questions | A research agenda; milestone labels are not evidence of completed validation |
| `new layer.txt`, lines 1–71, 175–195, 274–289 | 24 agent/institution and 28 virtual-world candidates, with rule-governed environments | Scenario material. The 52 candidates do not constitute 52 required catalogue omissions |
| `substack.txt`, lines 1–19, 26–118 | Continuity-supporting infrastructure and an editorial programme | Distinguish process, support and interface; keep future scenarios outside established claims |

The archive is useful evidence of the project's intellectual direction. Its
promotional passages, speculative scenarios, and conversational endorsements
should not become evidence entries for the phenomena they discuss. Nor should
the graph's completeness be defined by collecting every archived suggestion.

## Mathematical findings that change representation

### F01 — Conditional geometry, not an unrestricted derivation

Topology pp. 6–10 chooses two primitive directions, a real symmetric bilinear
form, a nondegenerate quadratic derivative action, and restrictions excluding
other operators. Within a sufficiently explicit indefinite bilinear class,
the normal-form argument is meaningful. The assumptions about ordered
asymmetry and compensatory boundedness still need mathematical predicates
before they can establish that the indefinite class is forced.

Represent the assumptions, the conditional result and any physical
identification separately. The present catalogue's `0.16` also combines an
early premetric frame with the later analytic metric. Split those meanings:
otherwise a metric becomes an unexplained prerequisite of the directions from
which the paper later argues for it.

### F02 — An explicit operator/mass sign inconsistency

On p. 13 the paper simultaneously gives:

```text
(24) Box psi + m2 psi = 0
(25) Box = -d2_t + d2_x
(26) m2 = omega^2 - k^2
psi = A exp(i(kx - omega t))
```

Substitution into (24)–(25) gives
`(omega^2 - k^2 + m2) psi = 0`, hence `m2 = k^2 - omega^2`.
For `k=1`, `omega=2`, Eq. (26) gives `m2=3`, but the residual coefficient is
`6`. The conflict also occurs in Eqs. (8)–(9), p. 8.

The existing [Phase-B model](../../../cases/level-0-oscillator/model-v1.json)
uses `d2_t psi - d2_x psi + m2 psi = 0`, which is consistent with its
dispersion relation. It therefore verifies its declared convention, not all
three source equations simultaneously. Repair the source convention across
the metric, action, equation and dispersion together in a future revision;
changing one sign in isolation may move the inconsistency elsewhere.

### F03 — Stationarity, a minimum and stability need separate tests

Topology pp. 14–15 and 33–34 moves between stationary action, minimized action
and stable configurations. These statements are not interchangeable. For the
displayed indefinite quadratic action, variations depending on time and space
can have opposite signs. For example, on a periodic square, the real
variations `epsilon sin(t)` and `epsilon sin(2x)` with `m2=3` contribute
`-4 pi^2 epsilon^2` and `+pi^2 epsilon^2`. The quadratic part is indefinite.
Stationarity eliminates the first variation; it does not make this second
variation positive or prove dynamical persistence.

Keep equation satisfaction, extremum selection and stability as separate
results. A deliberately defined nonnegative selection score may be minimized,
but it is a different mathematical object from the indefinite action.

### F04 — Three is conditional on the closure definition

On pp. 16–17 the dyad is a segment and the triad is the first genuine loop.
That is consistent with an **undirected simple graph without self-loops**.
A finite census of all 11 labelled graphs on one through three vertices
recovers three as the smallest cycle size. Directed graphs admit two-cycles,
and other relation models have different primitives.

This is a relative structural minimum. It does not prove that every stable
physical object needs three components, that a three-body system is necessarily
irreducible in the required dynamical sense, or that a support triangle models
an irreducible three-way interaction. A three-way coupling may need a hyperedge
or an explicit rule instance; its pairwise projection loses joint semantics.

### F05–F06 — Balance and density do not establish localized closure

The balance conditions on pp. 19–20 and 25 are insufficient on their own.
Take amplitudes one, `k=(1,2,-3)` and `omega=(2,3,-5)`. Both sums vanish,
but the sum of the three plane waves is spatially periodic. At every fixed
time its squared norm per `2pi` interval is `6pi`; over the whole line the
norm diverges. Removing any one mode leaves `4pi` per period, not zero.
Thus balance does not imply localization, and `|Psi|^2` does not necessarily
collapse when a constituent of the proposed closure is removed.

This counterexample targets the claimed sufficiency of the balance equations.
It does not purport to solve an independently specified nonlinear self-binding
model. Such a model is precisely an additional obligation.

Split `0.7` into local density `rho` and integrated quantity `Gamma`, with
support, measure, normalization and transformation group. For fixed support
and measure, global phase invariance is directly justified. Conservation in
time, localization and persistence require additional dynamics and evidence.

### F07 — Nonlinear coupling is a model proposal with negative case evidence

Topology pp. 25–26 defines `Psi=sum psi_i` while writing a cubic term in the
individual fields. The independent variation variables, constraints and
projection to a single effective equation must be specified. Neither the name
of the coupling nor a stationary equation establishes bounded stable solutions.

The existing [boundedness preflight](../../../cases/level-0-oscillator/PHASE_C_PREFLIGHT.md)
has a negative result for its declared free cubic potential. Stabilized
follow-ups use additional model assumptions; the
[integrated portable study](../../../cases/level-0-oscillator/LEVEL_ZERO_VALIDATION_V3.md)
admits no object-qualified CRT candidate. This supports rejection within those
specified models, not a theorem that every possible completion fails.

The proposed graph preserves the CRT carrier **class and hypothesis** but
does not manufacture a successful instance or feed failed candidates into the
ensemble gate.

### F08–F12 — Coordinates and later steps remain explicit obligations

- `0.7` and `0.8` are in catalogue Phase C; the paper develops density and
  objecthood by the end of Phase B, then formalizes nodes in Phase C and later
  refers to nodes formed there. Preserve the two source coordinates and the
  ambiguity. Neither is automatically kernel derivation depth.
- `E=hbar omega` and `p=hbar k` do not, by themselves, make continuous
  frequencies or wave numbers discrete. `0.17` needs a separate spectrum or
  admissibility rule.
- A nonzero inter-node coupling does not automatically prove collective
  stability. A list of nodes, an ensemble and a promoted carrier are distinct
  objects of evaluation.
- The p. 34 selector leaves metric definitions and coefficients open. A
  selected candidate needs a specified cohort and uncertainty/sensitivity
  record; tied minima remain alternatives.
- The named `0.20–0.23` directional branch has no sufficiently specific
  derivation in the fully reviewed topology paper. Perturbative persistence
  supplies a related question for `0.21`, not a proof of the full branch.
  Keep these proposals available with their missing definitions recorded.

## Archive issues to resolve before reuse

| Locator | Finding | Consequence |
|---|---|---|
| `log.txt`, lines 84–146 | Formula and component IDs occupy overlapping numeric namespaces; the table mixes a 3+1 metric with 1+1 actions and points from a kinetic-only action to a massive equation | Preserve namespaces, variable bindings, dimensions, term provenance and actual derivation steps |
| `log.txt`, lines 203–249 | Adds epsilon connections solely between successive phases and normalizes arbitrary weights; a zero-outdegree row stays zero | This can define a declared navigation model, but it does not infer physical transitions; the zero row is not stochastic |
| `log.txt`, lines 256–296 | Infers autonomy and arising dynamics from SCCs and a Markov representation | SCC membership alone supplies neither objecthood nor a measured temporal transition law |
| `log.txt`, lines 30–36 | Proposes closure/information criteria and claims a completeness score diagnoses scientific adequacy | Define context, target and thresholds; completeness is relative to the selected vocabulary, and directed information is not automatically an intervention effect |
| LifeSynth v2, line 64; v3, lines 40–50; English v3, lines 41–50 | Uses an inverse abstraction map without defining invertibility or a lifting distribution; calls the condition bisimulation; lists KL divergence as a metric | Use a common output space and forward maps; distinguish distribution agreement from a transition-by-transition bisimulation. KL is a divergence, not a metric |
| LifeSynth v3, lines 65–67 | Proxy collisions are proposed as negative tests | Preserve this useful design, while keeping subjective continuity distinct from proxy/task equivalence |
| `OntoUML.txt`, lines 23–24, 89–93 | Declares a process to be a subtype of Relator and asserts export compatibility | Require a semantic translation and conformance evidence. gUFO distinguishes reified relationships from events/processes |
| `OntoUML.txt`, lines 188–194; `log.txt`, lines 84–96; LifeSynth v3, lines 5, 69–77 | Level and phase labels differ between drafts; the v3 source-code references are unversioned | Use source-qualified coordinates and versioned node references; level numbers cannot be treated as shared measurements |
| `mvp.txt`, lines 64, 82, 123–131, 254–261; research plan, lines 49–55 | Reliability-by-count, strong completion claims and priority claims lack attached validation | Preserve the plans without converting them into scientific status |
| `log.txt`, lines 308–435; `new layer.txt`; `substack.txt` | Speculation about cosmological cognition, gravity, digital subjects and future societies | Treat as hypotheses/scenarios; neither endorsement nor conceptual compatibility establishes a causal relation |

The named Level-5/6/7 references in LifeSynth v3 do resolve to current labels
for endocrine regulation, sleep–wake cycles, neurovascular coupling, social
norms, digital social networks and cultural transmission. This verifies label
alignment only, not the proposed applications or the 2025 historical versions.

The process/relator distinction can be checked against the project's intended
external vocabulary: [gUFO Relator and Event definitions](https://nemo-ufes.github.io/gufo/).
That specification supports semantic review; it does not certify this proposed
OntoUML extension.

## Proposed graph representation

Keep one linked scientific record with several explicit projections. Its
central unit should be a **claim about a transition under conditions**, with
the concepts and mechanisms needed to express that claim.

| Record | What it identifies | What must accompany it |
|---|---|---|
| Concept or carrier class | A type of phenomenon, process, property or configuration | Operational definition, identity conditions, scope and original catalogue mapping |
| Configuration instance | A particular measured or simulated system | Actual constituents, relation instances, parameters, environment, state and provenance |
| Construction rule | A proposed way to generate/evaluate candidates | Typed inputs, multiplicities, joint/alternative conditions, operators, declared outputs and version |
| Claim | A proposition about a concept, relation, parameter or rule | Source passage, assumptions, evidence role, counterexamples and review disposition |
| Rule application | A rule applied to specified inputs | Candidate identity, evaluation method, outcome and rejection/missing-evidence witnesses |
| Effective interface | A proposed representation at another scale | State map, interaction ports, valid operations, error bounds and relevant history |

The existing five phenomenon type roles remain useful. Add record kinds such
as formula, rule and evidence around them; do not silently redefine `TypeRole`
to mean database record kind. Likewise, the six source relation kinds and
the three lifecycle roles describe different axes. A rule can be a mathematical
derivation without asserting physical genesis; a real interaction can support
both formation and maintenance in different contexts. Preserve these statements
even if a display chooses a dominant lifecycle label.

The presentation can show a compact carrier progression while expanding a
transition into an AND/OR rule with evidence. This avoids turning the number
of terms in a formula into the number of physical constituents.

```mermaid
flowchart TD
    A[Declared primitives and model assumptions] --> B[Generate mode candidates]
    B --> C[Evaluate mode and joint resonance rules]
    C --> T[Triad configuration candidates]
    N[Nonlinear model and measurement protocol] --> O[Objecthood evaluation]
    T --> O
    O -->|all required gates pass| U[Admitted CRT instance]
    O -->|fails or lacks evidence| R[Recorded rejection or unresolved candidate]
    U --> E[Collective coupling and persistence evaluation]
    E --> M[Effective description and substitution test]
    M -->|passes within declared scope| P[New carrier interface and effective rules]
    P --> B2[Next construction domain]
```

This is the proposed workflow. The current portable CRT study takes the
rejection branch; the success arrows are conditional, not reported results.
The proposal maps all 24 old cards, including assumptions, quantities and
directional hypotheses, without requiring all of them to remain carrier nodes
on this projection.

Formula syntax, a hypothesis-dependency graph, and the physical interaction
graph must remain distinguishable. Feedback belongs in the appropriate
dynamical projection. Joint construction can be represented by a rule with
several inputs; it need not be forced into a temporal ordering of its members.
Source SCCs should still be handled under the existing
[classification and resolution policy](../../../docs/architecture/SOURCE_POLICY.md).

## What “minimal” should mean

Choose the target property and comparison regime before searching. A useful
support formulation is:

```text
P(H; context, dynamics, observation protocol) holds
and no admissible proper subconfiguration H' of H preserves that P.
```

This is **inclusion minimality**. A smallest cost or cardinality solution is a
separate global optimization within a declared candidate universe. Testing
only single deletions does not prove global minimality when predicates are
non-monotone or substitutions are allowed. A minimal predictive description
is different again; its cost concerns retained information or description,
not necessarily physical constituent count. Stationary action is a fourth
notion and cannot stand in for the other three.

Every minimality claim needs: candidate universe, target, scope and boundary,
allowed edits/substitutions, cost or partial order, evaluation protocol,
search bounds, and all surviving tied alternatives. None may be inferred from
an attractive geometry score or the current catalogue's size.

An external methodological precedent is the minimal predictive representation
in [Shalizi and Crutchfield, Theorem 2](https://arxiv.org/html/cond-mat/9907176v2).
Their complexity measure and predictive-sufficiency assumptions are essential;
the result does not establish a universal minimum of physical components or
identify intervention mechanisms from a time series.

## How stable complexity can supply effective rules

The paper's strongest constructive idea is Eq. (55), p. 32: the completed
configuration changes the admissibility domain for the next cycle. Make that
change a record that can fail verification.

For a proposed macro state `y=q(x)`, start with the obligation

```text
q(T(x,u)) approximately equals T_macro(q(x), omega(u))
```

on a declared domain and time scale. `q` maps states, `omega` maps the allowed
inputs/interventions, and `T_macro` must predict without consulting discarded
microstate information. When different microstates with the same `q(x)` have
different relevant futures, refine the macro state, preserve relevant history,
or report that this effective description is not closed. A useful macro
coordinate also needs a task/observable and comparison with simpler alternatives;
an arbitrary constant map would otherwise pass a vacuous closure test.

For probabilistic causal models compare the forward-mapped distribution
`q_* P_micro(. | do(u))` with `P_macro(. | do(omega(u)))` in the same macro
space. Specify supported intervention sets, sampling uncertainty and tolerance.
Do not assume an inverse of a many-to-one map. This design is motivated by
[Rubenstein et al., Section 4.3](https://arxiv.org/abs/1707.00819), whose exact
transformations also require a surjective order-preserving intervention map.
Our approximate contract remains a proposal and does not inherit their exact
theorem merely by using similar notation.

The checker contains a deliberately small constructive illustration. With
micro-update `(a,b)->(b,b)`, `q(a,b)=b` admits the macro rule `y->y`.
For `q(a,b)=a`, states `(0,0)` and `(0,1)` have the same macro state but
different next macro states; none of the four deterministic binary macro
functions works. This illustrates how to accept or reject an effective rule,
not the emergence of CRTs, consciousness or a new physical law.

The promoted interface should record its carriers, valid operations,
constraints and scope of approximation. It may restrict or enable higher-level
interactions through the organization of the underlying system. Modification
of a fundamental law is a stronger hypothesis requiring separate evidence.
Boundary conditions, effective parameters, emergent dynamical laws and changes
to a software rulebook must not be conflated.

Structural geometry can then help propose configurations, measure their
organization and compare alternatives. It becomes part of the test only after
its relation semantics and lengths have a defined interpretation. The present
shadow flow changes lengths on a fixed source topology; it supplies neither
the nonlinear CRT dynamics nor the missing empirical construction law.

## Next central-data work

1. **Resolve foundational claims before freezing rules.** Reconcile signs,
   independent variation variables, support/measure and the four minimality
   notions. Keep operational hypotheses explicit and bind current negative
   results to the appropriate claims. A complete theory proof is not required
   to retain a clearly labelled hypothesis.
2. **Pilot the claim/rule representation.** Use the full Level-0 mapping here
   and the existing optical/retinal empirical pilot. Specify AND/OR conditions,
   carrier instances and formation/maintenance contexts. Test whether a reader
   can reconstruct a decision from its sources without the old graph layout.
3. **Implement the revised source contract and release lineage.** Preserve the
   historical source and numerical cases; build a new graph version from the
   reviewed claims. Definitions and evidence must survive compilation.
4. **Review every incoming relation and expand through the existing batches.**
   Use archive gap suggestions as candidates with inclusion criteria. Preserve
   alternatives, unsupported statements and missing evidence explicitly.

The current deliverable completes the requested topology/archive analysis and
provides a concrete Level-0 representation proposal. Mathematical reconciliation,
full review of the second paper, claim-specific classification of the 84
Level-0 edges, the empirical pilot and migration of the active central graph
remain open in the [roadmap](../../../docs/ROADMAP.md).
