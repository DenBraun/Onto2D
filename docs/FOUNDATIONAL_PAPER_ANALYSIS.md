# Foundational Paper Analysis and Kernel Traceability

Source: [topology-of-arising.pdf](../references/topology-of-arising.pdf)

Source identity used for this analysis:

| Field | Value |
|---|---|
| Title | *Topology of arising and the principle of minimal action in admissibility structures* |
| Author | Denis Britov, Independent Researcher |
| Version | v1.2, published 2026-04-03 |
| DOI | `10.5281/zenodo.19397414` |
| License | CC BY 4.0 |
| Supplied length | 36 PDF pages |
| SHA-256 | `3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7` |
| Analysis status | Complete textual review of pages 1–36 |

This document explains how the paper constrains the Onto2D kernel, which claims can be represented directly, which require external numerical or analytical evidence, and which remain research hypotheses rather than software facts.

## 1. Epistemic scope of the paper

The paper repeatedly states that its equations are **admissibility formalisms and structural proxies**, not established microphysical laws. Its aim is to reconstruct minimal structural conditions under which physical organization becomes admissible before spacetime, particles, and standard physical laws are assumed.

This distinction must survive implementation:

- the kernel MUST NOT label a paper-derived rule as empirically validated merely because it is executable;
- passing a rule-package case means that the encoded formalism produced the declared result;
- it does not prove that the formalism is a law of nature;
- theoretical propositions, computational conformance, external empirical support, and falsification are different evidence states;
- names such as `energy`, `mass`, `particle-like`, and `field` retain the Level-0 structural meanings declared by the paper unless a later package supplies an empirical interpretation.

The supplied PDF contains no bibliography or frozen external dataset. External validation therefore cannot be reconstructed from this file alone.

## 2. Ontological progression in the paper

The paper develops Level 0 through four phases, with two distinct closure segments inside Phase B.

| Paper stage | Pages | Principal constructs | Outcome |
|---|---:|---|---|
| Phase A | 3–5 | proto-field `Omega`, distinguishability, deviation `deltaOmega`, compensation `C`, structural energy `E`, primitive directions `partial_t` and `partial_x` | difference becomes preservable and directional |
| Phase B, oscillatory segment | 5–14 | oscillatory mode `psi`, pseudo-Euclidean signature, hyperbolic operator, scalar closure parameter `m^2`, stationarity `deltaS = 0` | stable oscillatory configurations become selectable |
| Phase B, resonant segment | 15–24 | dyad insufficiency, three-mode balance, coherent resonant triad, density `rho = |Psi|^2`, aggregate `Gamma`, perturbative persistence | first irreducible localized object-like carrier, the CRT-node |
| Phase C | 25–32 | nonlinear CRT Lagrangian, cubic coupling, effective node equation, inter-node couplings, meta-Lagrangian, ontological graph | nodes become formalized carriers and enter a collective admissibility regime |
| Phase D | 32–35 | ensemble-quantum, alternative collective Lagrangians, admissibility functional `F`, variational selection | first fully constituted collective carrier class; Level 0 completes |
| Level 1 threshold | 35–36 | effective field `Phi(X,t)` over ensemble-quanta | a new carrier domain becomes admissible |

The paper's phases are not kernel predicate phases and are not kernel closure depths. The implementation needs three separate coordinates:

```text
ontologyLevel       paper's Level 0, Level 1, ...
ontologyPhase       paper's A, B, C, D and optional segment
derivationDepth     minimum number of kernel closure transitions
```

Conflating any two of these axes would make the computational ladder scientifically uninterpretable.

### 2.1 Alignment with the existing `level-0.json` catalogue

The current catalogue already mirrors much of the paper. `references/descriptions.json` maps numeric phases `0–3` to A–D as Differentiation, Integration, Self-organization, and Threshold transition. All 24 Level-0 records currently have `ScientificStatus: "methodological-placeholder"`, which is consistent with the paper's non-empirical admissibility-formalism status.

| Catalogue IDs | Catalogue concepts | Catalogue phase | Paper alignment | Required treatment |
|---|---|---:|---|---|
| `0.15`, `0.16`, `0.0–0.3` | Proto-field, minimal geometry, distinguishability, temporal/spatial distinction, compensation energy | A | Phase A, pages 3–5, plus geometry developed on pages 6–10 | Preserve source metadata; encode assumptions and derived quantities separately |
| `0.4`, `0.5`, `0.17–0.19` | Wave coherence, variational functional, discrete scale, configurational mass, frame-stable selection | B | Oscillatory segment of Phase B, pages 5–15 and selection on page 34 | Map to mode eligibility, evidence, and cohort selection |
| `0.6` | Triadic Resonant Closure | B | Resonant Phase B, pages 15–20 | Map to composite triadic-closure predicate |
| `0.7`, `0.8` | Configurational Density and CRT-Node | C | The paper derives `Gamma` and objecthood before declaring Phase B complete on page 24 | Phase mismatch; require an ADR/mapping decision, never silently rewrite source data |
| `0.9` | Nonlinear CRT Variational Functional | C | Phase C, pages 25–26 | External nonlinear evidence plus local structural claims |
| `0.10–0.12` | CRT ensemble, ensemble functional, synchronization mode | C | Collective regime and meta-Lagrangian, pages 27–32 | Map to coupling, novelty/non-additivity, stability, and selection |
| `0.13`, `0.14` | Ensemble-scale quantum seed and bridge to effective Level-1 field | D | Ensemble-quantum and Level-1 threshold, pages 32–36 | Map to admitted ensemble and explicit carrier promotion |
| `0.20–0.23` | Anisotropy, closure-preserving deformation, directional gradient, transport bias | C/D | Deformation is related to perturbative persistence; the other named properties are not specified directly enough in the paper | Keep as catalogue claims; require separate definitions/evidence before kernel predicates |

The paper and catalogue therefore cannot share one implicit phase field. At minimum, converted records need both `cataloguePhase` and `paperCoordinate`, plus a mapping provenance record.

The catalogue also supplies type-role distinctions that align well with the paper: wave coherence is a process, the triadic condition and variational functionals are patterns, configurational quantities are properties, CRT-node/ensemble/quantum seed are objects, and the Level-1 bridge is an effect. These roles are useful `typeTags`, but their IDs remain catalogue metadata until a rule package declares identity and predicate semantics.

The current parent graph also contains a Level-0 strongly connected component `{0.8 CRT-Node, 0.21 Closure-Preserving Deformation, 0.22 Directional Admissibility Gradient}`. Its mutual support is a legitimate candidate for joint constitution or for one closure-bearing structure distributed across three cards. This could be structurally analogous to the paper's claim that an irreducible loop has no internally prior member. It is not direct textual confirmation: the paper's triad consists of resonant modes, while the catalogue component names a node and two persistence/directionality concepts. Treating them as the same triad without a mapping rule would be a category error.

The hypothesis must therefore be tested through a frozen relation classifier and general node-resolution criteria, without showing eligible annotators SCC membership or whether a label removes a cycle. Because this document publishes the component, prospective blindness requires fresh annotators or a deterministic-precommitted classifier; otherwise the result is marked historically exposed. The source component is then merged or condensed as one depth vertex with undefined internal order, or retained as an explicitly unresolved cluster. Every original relation remains in a typed explanation layer. This preserves the possible joint-arising signal without manufacturing agreement with the paper.

## 3. Formal claims and computational disposition

### 3.1 Phase A: distinguishability and compensation

The paper introduces:

- a proto-field of admissibility `Omega`, without privileged distinctions;
- a local deviation `deltaOmega`;
- a compensation function `C`;
- structural energy `E = C(deltaOmega)` (Equation 1, page 4);
- sequential and directional distinction operators `partial_t` and `partial_x` (page 4);
- an aggregate distortion measure written schematically as an integral of `f^2` (Equation 2, page 5).

Kernel disposition:

- `Omega` is rule-package context, not a generated graph node by default;
- `deltaOmega`, `partial_t`, and `partial_x` may become typed primitives or declared structural axes in a Level-0 package;
- `C` is not defined algorithmically in the paper and cannot be hard-coded;
- `E` may be supplied as a derived quantity only when its computation method, units, tolerance, and evidence artifact are frozen;
- Equation 2 cannot be executed until support, measure, field representation, and normalization are specified.

Phase A is therefore principally a package-assumption and primitive-construction layer. It is not yet a complete enumeration case.

### 3.2 Phase B: oscillatory admissibility

The minimal mode is written as:

```text
psi(x,t) = A exp(i(kx - omega t))
```

The paper then argues for:

- a real nondegenerate two-dimensional bilinear form;
- indefinite signature `(1,1)` as the minimal admissible metric class;
- the corresponding hyperbolic second-order operator, equivalent to the 1+1 d'Alembertian;
- exclusion of first-order drift, non-symmetric, higher-derivative, and nonlinear terms at this minimal stage;
- a unique minimal local quadratic scalar term `m^2 psi* psi`;
- the dispersion/integrability relation `m^2 = omega^2 - k^2` in normalized units;
- `hbar` as a marker of discrete compensatory action rather than an assigned empirical constant;
- stationarity `deltaS = 0` as the admissibility filter.

Kernel disposition:

- the metric signature, operator class, action definition, and normalization belong to a versioned scientific rule package;
- the graph kernel does not derive a PDE operator from first principles;
- a mode primitive may carry `A`, `k`, `omega`, `m2`, action score, and stationarity residual as typed quantities;
- relations such as `m2 = omega^2 - k^2` can be evaluated by typed arithmetic with explicit tolerance;
- stationarity or bounded-solution claims require an analytical certificate or deterministic external solver artifact;
- the finite kernel may select the lowest declared action score among eligible candidates, but it does not silently solve the continuous variational problem.

The paper's uniqueness propositions are theory claims encoded by the case. Successful software execution verifies the encoding and arithmetic, not the philosophical or physical uniqueness proof.

### 3.3 Phase B: why the dyad is insufficient

Pages 15–17 distinguish balance from irreducible closure. A dyad may satisfy:

```text
k1 + k2 = 0
omega1 + omega2 = 0
```

and form a standing or balanced composite, but the paper rejects it as the first irreducible contour because it has:

- one binary support relation;
- no independent closure path;
- no relational overdetermination;
- the topology of a segment rather than a nontrivial loop.

The paper states three conditions for minimal irreducible closure:

1. closed relational support;
2. relational overdetermination;
3. minimal loop structure.

Kernel disposition:

- balance alone MUST NOT admit the dyad as a CRT;
- the graph projection used by the case must require a simple cycle of minimum length three;
- reciprocal directed edges between two nodes MUST NOT count as the paper's minimal loop;
- relational overdetermination needs a declared constraint-rank invariant or an explicit structural surrogate;
- the complete predicate should test the whole closure condition and its removal behavior, not removal alone.

A generic `cycleExists()` without projection and minimum-length parameters can misclassify a directed two-cycle as triadic closure.

### 3.4 Coherent Resonant Triad

For three modes, the paper requires:

```text
k1 + k2 + k3 = 0
omega1 + omega2 + omega3 = 0
```

and asserts that removal of any mode destroys the closure class. The composite is:

```text
Psi = psi1 + psi2 + psi3
```

Computational predicate decomposition:

```text
modeCount(3)
AND balance(k, modes, tolerance_k)
AND balance(omega, modes, tolerance_omega)
AND cycleExists(projection = "undirected-simple", minLength = 3)
AND compare(relationalConstraintRank, gte, requiredRank)
AND irreducibleRemoval(triadicClosure, removal = "node")
```

`relationalConstraintRank`, tolerances, and the exact `triadicClosure` expression are not numerically specified by the paper and must be frozen by the case package.

### 3.5 Configurational density and object status

The paper derives the local scalar:

```text
rho_Psi(x,t) = Psi*(x,t) Psi(x,t) = |Psi(x,t)|^2
```

and the aggregated quantity:

```text
Gamma(t) = integral |Psi(x,t)|^2 dx
```

`Gamma` is explicitly not matter density or probability at this level. It is an aggregate scalar of localized resonant closure.

The CRT becomes an object-like carrier only when all three conditions hold:

1. bounded support;
2. nontrivial invariant concentration represented by `Gamma`;
3. perturbative persistence under small admissible variations.

Kernel disposition:

- triadic closure and CRT objecthood are separate admission gates;
- a triad may be structurally closed without yet being admitted as an object-like node;
- `Gamma` requires support, measure, normalization, time sampling, and threshold definitions;
- bounded support and perturbative identity require certificate or solver evidence;
- `stableUnder` operationalizes perturbative persistence only after the perturbation class, epsilon, identity metric, sample/exhaustive policy, and threshold are declared.

The architecture must not equate “three balanced modes” with a completed object.

### 3.6 Phase C: nonlinear node formalization

The paper introduces the CRT admissibility Lagrangian with:

- a kinetic term in the `(1,1)` pseudo-Euclidean structure;
- emergent node parameter `M^2`;
- cubic resonant coupling `lambda(psi1 psi2 psi3 + c.c.)`;
- an effective nonlinear response involving pair products.

The cubic term represents constitutive nonlinear coherence and self-binding. The node is described as particle-like only in the structural admissibility sense.

Kernel disposition:

- `M2`, `lambda`, nonlinear response residual, boundedness, and stability are derived quantities with evidence;
- the core graph engine does not integrate the nonlinear equation of motion;
- a scientific adapter may produce deterministic solution/certificate artifacts;
- predicates consume hashes and normalized results of those artifacts;
- absence of an external solver protocol makes the Phase C numerical case incomplete, not automatically failed.

### 3.7 Phase C: collective admissibility

The paper distinguishes a mere collection from a new regime:

```text
uncoupled: Stot = sum S[Psi_a]
coupled:   Stot = sum S[Psi_a] + sum V_ab(Psi_a, Psi_b)
```

A new collective regime exists when stability is not reducible to independently admissible node persistence and depends essentially on bounded inter-node coupling.

Computational operationalization:

- nodes are constituents and graph vertices;
- `V_ab` contributes role-labelled coupling edges and derived interaction quantities;
- mere coexistence/disconnected union is rejected;
- `novel(collectiveStability)` checks that the whole has a property absent from individual constituents;
- a non-additivity residual compares total and constituent action contributions;
- perturbation/removal witnesses test dependency on the interaction architecture;
- bounded coupling requires a package-defined admissible range.

The paper says removal or perturbation of one node **may** alter others; it does not require every-node removal to destroy every valid ensemble. A blanket `irreducibleRemoval` predicate would be stronger than the text unless the specific ensemble hypothesis declares that stronger condition.

### 3.8 Completion of Level 0

Pages 28–30 give three necessary and sufficient conditions:

1. **Carrier closure:** constituents are already formed CRT-nodes rather than primitive modes.
2. **Collective admissibility:** stability depends on bounded inter-node coupling.
3. **Effective re-describability:** the ensemble admits a higher-level description as a new carrier domain.

Kernel mapping:

- carrier closure is enforced by allowed constituent depth/type tags;
- collective admissibility is tested by novelty, coupling, non-additivity, and stability predicates;
- effective re-describability is operationalized by extracting a deterministic non-empty compositional profile for the admitted ensemble;
- the profile-collapse test checks whether that profile is sufficient for higher-level substitution;
- promotion to a Level-1 primitive is an explicit artifact, never an implicit mutation of the Level-0 element.

Using a profile as the effective carrier interface is an Onto2D operationalization of the paper's redescription condition. The paper itself does not specify this algorithm, so it remains a falsifiable implementation hypothesis.

### 3.9 Phase D and ensemble-quanta

The paper carefully distinguishes:

- `Psi_a`: an already formed CRT-node;
- `phi_p(x,t)`: a local internal node mode in an ensemble coupling structure;
- `ensemble-quantum`: the minimal indivisible collective unit generated by stable node coupling;
- `Phi(X,t)`: the effective field introduced only at Level 1.

The case data model MUST preserve these identities. Reusing one generic `field` type for all four would erase the central carrier transition.

The paper allows multiple collective Lagrangians, including higher-order, graph-dependent, and nonlocal contributions. Therefore:

- no single Phase D Lagrangian is built into the kernel;
- each Lagrangian family is a separately hashed rule package or package variant;
- output families from different actions are not merged without an explicit comparison protocol.

### 3.10 Variational selection

The paper defines an admissibility functional `F[psi]` combining stability, phase, energy, and closure metrics with coefficients `alpha_i`, followed by:

```text
Psi_selected = arg min_(psi in C) F[psi]
```

This is a cohort-level operation. It cannot be represented faithfully by evaluating one independent Boolean predicate at a time unless the global minimum is supplied in advance.

Kernel requirement:

```text
GENERATE -> FILTER LOCAL CONDITIONS -> SELECT COHORT EXTREMA -> PROFILE
```

The finite variational stage must declare:

- a type-distinct functional or derived score reference;
- minimize/maximize objective;
- a contested-resource cohort rule;
- a unit-bearing epsilon window;
- retain-all semantic extrema;
- evidence source for continuous scores.

The result is a complete ranked cohort with the full extremum set, degeneracy, degeneracy ratio, oriented gap, and `1 - degeneracy/cohortSize` variational selectivity. Canonical ID orders tied records but does not choose a hidden singular winner. Boolean hard-filter selectivity and variational selectivity form separate report dimensions.

The continuous functional and its `chi_i` metrics are not fully defined in the paper. The kernel can perform deterministic finite-cohort selection only after a package or external solver supplies normalized scores. Every declared `alpha_i` is frozen into the run hash and receives predeclared positive/negative coefficient perturbations; a fragile ranking remains reproducible but is not interpreted as robust variational selectivity.

### 3.11 Transition to Level 1

Level 1 begins when ensemble-quanta, not primitive modes or individual CRT-nodes, become the basic carriers of an effective field `Phi(X,t)`.

Kernel disposition:

- the output profile of an admitted ensemble-quantum becomes the input interface of a new package/ladder segment;
- a `CarrierPromotion` artifact records source element, source ontology coordinate, target coordinate, profile, rule hash, and evidence;
- promotion does not claim a physical quantum field has been derived;
- Level 1 lies beyond the mandatory Level-0 closure case unless a separate package defines its predicates and external evidence.

## 4. Kernel requirements implied by the paper

The paper implies the following kernel requirements.

### 4.1 Three coordinate systems

Every case element and result needs optional domain coordinates distinct from kernel depth:

```ts
interface OntologyCoordinate {
  level: number;
  phase?: "A" | "B" | "C" | "D" | string;
  segment?: string;
}
```

Derivation depth additionally carries a `depthBasis` hash because it is relative to the primitive basis of the run. Ontology level is a declared or profile-collapse-computed partition; ontology phase is a declared partial order, not a metric. Every aggregate names its axis. The bounded profile-collapse error across successive derivation steps is reported as a falsifiable level-boundary diagnostic, but computed minima never overwrite author labels.

### 4.2 Scientific quantities and evidence

Plain `Record<string, number>` is insufficient. A scientific value needs:

- numerical value;
- unit or explicit `dimensionless` marker;
- tolerance/uncertainty policy;
- semantic definition;
- evidence provenance and artifact hash;
- computation method/version when derived.

Tolerance is mandatory for scientific numeric comparison, and raw floating-point equality is not a quantity operation. An external solver failure produces `indeterminate`, not scientific rejection. Partial convergence follows a frozen package policy and, if accepted, records the residual and widened tolerance.

### 4.3 Cohort selector

The engine needs separate cohort-construction, ranking, and sensitivity stages for finite `argmin`/`argmax` operations after local eligibility filtering. The functional is unavailable to generation and cannot prune candidates.

### 4.4 External computation boundary

The core remains declarative and sandboxed. Continuous field integration, PDE solving, variational differentiation, and stability analysis occur in a separately versioned scientific adapter. The kernel verifies input hashes, normalized outputs, residuals, and certificates.

### 4.5 Richer cycle semantics

`cycleExists` needs graph projection, minimum/maximum length, and direction semantics to distinguish the paper's triadic loop from reciprocal dyadic edges.

### 4.6 Carrier promotion and profiles

The transition from node ensemble to Level-1 carrier needs an explicit promotion artifact. Profile extraction is the computational redescription hypothesis and must be independently tested.

### 4.7 Evidence-state separation

Rule packages need claim references and evidence states such as:

- paper assumption;
- paper derivation;
- package operationalization;
- computationally verified fixture;
- externally supported;
- falsified or contradicted.

### 4.8 Source-graph condensation and joint arising

Catalogue migration needs a typed source-graph protocol in addition to the paper-derived candidate graph. Generative, constitutive, intra-closure-support, evidential, descriptive, and regulatory-feedback relations remain distinct. Classification rules and exposure status are frozen before topology-aware resolution. Nontrivial formation-support SCCs become cluster vertices with undefined internal precedence; condensation supplies the depth DAG without deleting source edges.

Cluster count and size are scientific outputs. They measure where the source ontology encodes joint rather than sequential arising. Their distribution across depth transitions is compared with a bottleneck definition frozen from the Boolean/variational selectivity profile before cluster locations are inspected.

## 5. Proposed Level-0 computational ladder

The exact mapping remains a case-package decision, but this is the minimum faithful decomposition:

| Kernel depth | Ontology coordinate | Input carrier | Admission gate | Output carrier |
|---:|---|---|---|---|
| 0 | Level 0, Phase A context | distinction/axis assumptions and certified quantities | package loading and consistency | admissibility context and mode-generation domain |
| 1 | Level 0, Phase B oscillatory | mode candidates | dispersion, stationarity residual, bounded parameter domain, cohort action selection | admitted oscillatory modes |
| 2 | Level 0, Phase B resonance | admitted modes | triadic balance, length-3 loop, relational overdetermination, removal irreducibility | coherent resonant triads |
| 3 | Level 0, Phase B/C node | triads | bounded support, nontrivial `Gamma`, perturbative persistence, nonlinear coherence evidence | CRT-nodes |
| 4 | Level 0, Phase C/D collective | CRT-nodes | bounded coupling, novelty/non-additivity, collective stability, cohort selection | ensemble-quanta |
| 5 | Level 1 threshold | ensemble-quanta | effective profile/redescription and promotion policy | Level-1 primitive carrier domain |

This mapping gives the selectivity profile scientific labels. Reporting only `[s0, s1, s2]` without the gate definitions would not be meaningful.

## 6. Case acceptance matrix

### 6.1 Oscillatory-mode gate

Required frozen inputs:

- normalized mode population or generation bounds;
- metric/operator package version;
- `A`, `k`, `omega`, `m2`, and units;
- dispersion tolerance;
- action/stationarity evaluation method;
- contested-resource cohort rule;
- unit-bearing degeneracy epsilon;
- coefficient source and sensitivity policy;
- partial-oracle policy.

Acceptance:

- every admitted mode has valid numerical evidence;
- complete cohort ranking and degeneracy are reproducible;
- Boolean and variational selectivity are both reported;
- sensitivity verdict is present and interpretable or explicitly fragile;
- a score or solver change changes the run hash.

### 6.2 Dyad-versus-triad gate

Required frozen inputs:

- graph policy and simple-cycle definition;
- mode values;
- `k`/`omega` tolerances;
- relational constraint-rank definition;
- exact closure expression;
- removal semantics.

Acceptance:

- a balanced dyad remains rejected as non-loop/reducible;
- the intended triad is admitted;
- rejection witnesses identify the missing nontrivial loop or closure condition;
- removing any triad mode destroys the declared triadic closure class.

If the census needs one attribution for the dyad rejection, it should use a named composite closure predicate containing `irreducibleRemoval`. A bare removal test is not enough to distinguish a balanced dyad.

### 6.3 CRT objecthood gate

Required frozen inputs:

- support representation and boundedness metric;
- `Gamma` computation and threshold;
- perturbation classes and epsilon values;
- identity distance and persistence threshold;
- nonlinear coupling/residual evidence where Phase C formalization is claimed.

Acceptance:

- closure-only triads and object-like CRT-nodes are distinguishable;
- all three objecthood conditions have witnesses;
- exact-resonance fine tuning without perturbative persistence is rejected.

### 6.4 Ensemble gate

Required frozen inputs:

- eligible CRT-node set;
- coupling graph and `V_ab` family;
- bounded-coupling criterion;
- total-versus-additive action residual;
- collective stability and perturbation policies;
- effective profile definition;
- cohort admissibility score if Phase D selection is claimed.

Acceptance:

- an uncoupled collection is rejected as mere multiplicity;
- the selected coupled ensemble has a collective property absent from isolated nodes;
- the profile is deterministic and passes bounded profile-collapse testing;
- promotion to a Level-1 carrier is explicit and traceable.

### 6.5 Catalogue SCC and joint-arising gate

Required frozen inputs:

- relation-category decision rules and examples;
- blinded annotation and conflict-adjudication protocol;
- distributed-structure versus constitutive-cluster criteria;
- post-unblinding change approval policy;
- thresholds for descriptive resolution, disagreement, and reclassification warnings;
- bottleneck definition and cluster-concentration statistic.

Acceptance:

- all three raw catalogue SCCs receive complete, edge-preserving dispositions;
- the quotient graph is a DAG and no member is assigned internal precedence;
- the `{0.8,0.21,0.22}` result is reported without forcing analogy to the paper's resonant triad;
- evidential/descriptive/dynamic layers remain traversable in explanations;
- merge, condensation, layer separation, and reclassification shares reconcile numerically;
- concentration, uniformity, and depletion are all reportable terminal outcomes.

## 7. What the supplied paper does not specify computationally

The following are necessary before a fully executable scientific case can exist:

- a computable compensation function `C`;
- the representation and measure of distinguishable support;
- boundary and initial conditions for field equations;
- units and numeric ranges for `A`, `k`, `omega`, `m`, `M`, `hbar`, `lambda`, `kappa`, and other coefficients;
- tolerances for balance, stationarity, localization, and dispersion;
- a concrete family of bounded solutions and a stability algorithm;
- the exact identity metric for perturbative persistence;
- a formal relational-overdetermination or constraint-rank measure;
- explicit inter-node potentials `V_ab` and their boundedness domains;
- definitions of the `chi_stab`, `chi_phase`, `chi_energy`, and `chi_closure` terms in `F`;
- values or selection policy for the `alpha_i` coefficients;
- the contested support/resource equivalence rule that defines each competition cohort;
- the unit and value of the degeneracy epsilon;
- the partial-convergence policy for external numerical work;
- semantic rules for mapping catalogue parent relations to source-relation layers;
- criteria for deciding whether several catalogue cards are one distributed structure;
- a fully covariant selection formalism—the paper explicitly defers Lorentz-covariant derivation;
- an algorithmic criterion for effective higher-level redescription;
- empirical datasets or citations for external validation.

These are not software bugs and should not be filled with hidden defaults. Each becomes a hashed case input, an external evidence artifact, or an explicitly deferred hypothesis.

## 8. Claims that require special caution

The kernel should preserve rather than adjudicate the paper's propositions that:

- indefinite `(1,1)` signature is uniquely forced by the five admissibility conditions;
- the d'Alembertian class is the unique minimal operator;
- `psi* psi` is the unique minimal scalar closure term;
- `|Psi|^2` is the unique minimal local scalar density;
- a triad is the first irreducible contour;
- the three Level-0 completion conditions are necessary and sufficient.

These claims can be encoded as hypotheses and tested within declared model classes. The software must not turn “the alternative was not represented in this package” into “the alternative is universally impossible.” Counterexample-search packages are therefore scientifically valuable conformance cases.

## 9. Consequences for null models

The paper changes what a valid baseline must preserve:

- role shuffle must not destroy numeric mode attributes unless that is the null hypothesis;
- rewiring must state whether it preserves node-internal CRT closure and only randomizes inter-node architecture;
- a uniform model must declare whether it samples modes, structural triads, object-qualified nodes, or ensembles;
- Phase D cohort selection must be rerun independently inside every null trial;
- null distributions from different ontology gates cannot be pooled;
- action scores and solver evidence must be recomputed or transformed under a scientifically justified null operation, not blindly copied.
- a cluster-concentration baseline may permute frozen cluster labels across depth-compatible vertices, but it must never reclassify source edges or change cluster membership.

## 10. Final architectural interpretation

The paper supports the kernel's central closure design but makes the intended research pipeline richer than the original graph-only shorthand:

```text
declared theoretical context
  -> generated finite structural candidates
  -> local structural and numerical admissibility
  -> cohort-level variational selection
  -> irreducible closure
  -> perturbatively persistent carrier
  -> collective novelty and bounded coupling
  -> profile-based effective redescription
  -> next carrier domain
```

Onto2D should implement the finite, deterministic, explainable part of this pipeline and bind external analytical/numerical results through hashed evidence. This preserves the paper's theoretical scope without pretending that a graph enumerator alone has solved its continuous variational physics.
