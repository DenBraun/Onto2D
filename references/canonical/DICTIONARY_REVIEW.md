# Dictionary and quantitative interpretation review

Edition `2026.09.12.4` completes R3a, an internal semantic review of the 112
records in [the original dictionaries](../descriptions.json). Each record has
an exact source pointer, an unchanged original, a scoped working definition,
a finding, a disposition and decisions for every original top-level field.
The [ledger](dictionary-review.json) contains 929 such field decisions; a
decision on a compound field applies to its complete nested contents. This
does not claim empirical verification of every nested scientific statement.
The [policy](dictionary-policy.json) was written after inspecting the draft:
this is retrospective work, with no independent or blinded review claimed.

The active graph remains 56 nodes and 60 connections. Dictionary records are
vocabulary, not additional physical entities. The release adds no scientific
review coverage to the historical cards or relations: 30 cards and 106
assertions have internal decisions; 219 cards and 865 assertions remain pending.

## Scope and decisions

| Dictionary | Records | Adopted interpretation |
| --- | ---: | --- |
| InteractionModes | 5 | Scoped interaction vocabulary; stability and threshold shortcuts withheld |
| CausalDirections | 6 | Relative description-scale labels; no automatic causal interpretation |
| TypeRoles | 5 | Nonexclusive modeling roles; undocumented Causality pairs remain uninterpreted |
| LevelPhases | 4 | Descriptive A–D labels; no universal required chronology |
| DependencyTypes | 13 | Contextual dependency roles; no default necessity or calibrated weight |
| CarrierGroups | 6 | Project carrier families; no common counting unit or universal threshold |
| CarrierTypes | 14 | Individuation requirements; every historical numerical default withheld |
| ComplexityLevels | 14 | Eight historical display groups and six dictionary-only proposals |
| Ontologicals | 45 | Nonexclusive subject tags; original Type classifications supply no scientific evidence |

Dictionary identity is `(group, Id)`; historical node identity is `Level.Id`.
The original schema's descriptions incorrectly suggest globally unique node
IDs and refer to inconsistent dictionary names. The policy records the actual
`ComplexityLevels`, `TypeRoles`, `CausalDirections` and `InteractionModes`
names, plus the lowercase `InteractionModes[1].validation` spelling variants.
These aliases repair interpretation in the reconstruction; they do not rewrite
the original schema, manufacture evidence or validate the aliased predictions.
The unspecified axes of `TypeRoles.Causality` pairs are not guessed.
`CommonConfusions` is not treated as a typed causal-reference list.

Levels 8–13 have no corresponding source catalogues. Technological, planetary,
civilizational, spacefaring, cosmic and upper-speculative labels remain
dictionary-only proposals. Their order is neither cosmological chronology nor
an established physical hierarchy. The phase labels similarly do not generate
nodes or prove changes in physical laws.

## Corrections with executable counterexamples

The [witness module](../../models/causal-emergence/canonical/dictionary-witnesses.mjs)
executes ten small examples during every build. Its finite arithmetic checks
accompany the following algebraic arguments; no nonlinear simulation or
empirical model validation is implied.

| Check | Reason the original shortcut fails |
| --- | --- |
| `feedback-sign` | In `x[n+1] = g x[n]`, `g=1/2` decays and `g=-2` grows in magnitude. Positive/negative sign is different from gain magnitude. |
| `time-domain` | `g^n` and `exp(g t)` give opposite stability classifications for these same two coefficients. The time domain is part of the model. |
| `unit-circle-boundary` | The identity and a size-two Jordan block both have eigenvalues 1. The latter's nth power has off-diagonal entry n, by induction; spectral radius one alone does not establish boundedness. |
| `inactive-inequality` | Minimizing `x^2` subject to `x <= 1` gives `x=0`. Replacing the inequality by equality changes the solution to `x=1`. |
| `cubic-sign` | `V(x)=x^3` is unbounded below along `x=-n`. A positive cubic coefficient does not prove a stable cooperative state. Lagrangian and potential signs also require a convention. |
| `horizontal-asymmetry` | Two vertices at the same display level can have one directed edge. Level equality does not require reciprocal influence. |
| `stable-cross-level-loop` | A two-variable discrete model with every matrix entry `1/4` has eigenvalues `1/2,0`. Cross-level feedback can be stable. |
| `cycle-count-unit` | An isolated directed three-ring has one simple cycle modulo rotation, three edges and three vertices. These are different quantities. |
| `normalized-weight-not-necessity` | AND and OR mechanisms can carry the same two weight annotations `1/2,1/2`, while removal of one input has different outcomes. Normalization identifies neither necessity nor a causal effect. |
| `token-individuation` | `A,A,B` has three occurrences and two symbol types. Even an integer count needs an explicit individuation rule. |

For an autonomous finite-dimensional linear discrete model, asymptotic
stability follows when every eigenvalue has modulus below one: each Jordan
block power is a polynomial in n times a decaying exponential. Conversely,
an eigenvector with eigenvalue of modulus at least one does not decay. For
continuous linear dynamics, the condition is strictly negative real parts;
the reviewed primary textbook passage is
[Astrom and Murray, Chapter 4, Theorem 4.1, p. 106](https://www.cds.caltech.edu/~murray/books/AM08/pdf/am08-dynamics_10Aug12.pdf).
Neither condition applies unchanged to arbitrary nonlinear or delayed loops.

The constrained-optimization correction uses all KKT conditions, not just a
stationary augmented expression. For differentiable convex objectives and
inequalities with affine equalities, these conditions suffice for optimality;
under Slater regularity they are also necessary. The selected original
passages are [Boyd and Vandenberghe, Sections 5.5.2–5.5.3, pp. 242–244](https://web.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf).
This establishes no convexity or regularity for the author's field action.

Chemical catalysis is distinguished from thermodynamic feasibility, using the
[IUPAC catalyst entry C00876](https://goldbook.iupac.org/terms/view/C00876).
The fifth-edition entry and metadata were available through the indexed
primary text; direct HTML access returned HTTP 403. The entry does not justify
the draft's universal critical count of two active sites. Macro/micro labels
remain conditional on state maps and compatible interventions, as required by
the already reviewed [Rubenstein et al. method](https://arxiv.org/abs/1707.00819v1).

## Quantitative census and admission boundary

The compiler derives a separate census from all eight original level files.
Each of the 971 entries preserves its source pointer, Weight, Necessity and
complete Quantization object. No new scientific relation decisions are made
by that computation.

| Finding | Count |
| --- | ---: |
| Historical weights | 971 |
| Numeric N_min | 971 |
| Numeric N_crit / null N_crit | 967 / 4 |
| Null N_sat | 971 |
| Carrier type/group conflicts | 164 across 37 cards |
| Conflicts at levels 0 / 2 / 3 / 5 | 16 / 4 / 1 / 143 |
| Nonempty parent lists whose weights do not sum to one | 3 |
| Legacy quantitative admissions | 0 |

The anomalous nonempty weight sums belong to `0.2` (1.9), `0.9` (0.9) and
`0.18` (0.9), using tolerance `1e-9`. A parentless card is not a normalization
failure. Passing normalization would still not establish scientific meaning.

The census reports the carrier group expected by the original type dictionary,
but never substitutes it as a scientifically corrected choice. For example,
`5.1 -> 5.18` declares group 5 and type 1: type 1 names a field excitation and
belongs to group 0. Replacing 5 with 0 would fix the lookup while leaving
unanswered what is being counted in that optical-interface assertion. All 164
conflicts remain marked `unresolved-mechanism-review`; apparently consistent
lookups are also scientifically unverified. R3 and the domain batches remain
open for this work, especially R10's Level-5 mechanisms.

Future quantity admission must specify what is measured or derived, its bearer,
unit/reference, procedure, conditions and provenance. Counts additionally need
an occurrence/type distinction, membership and identity rules, and a sampling
boundary/window. Estimated means, concentrations, amounts, loop counts and
particle counts cannot be interchanged merely because a field contains a
number. These requirements apply the terminology of
[VIM 1.8](https://jcgm.bipm.org/vim/en/1.8.html),
[measurement 2.1](https://jcgm.bipm.org/vim/en/2.1.html) and
[measurand 2.3](https://jcgm.bipm.org/vim/en/2.3.html)
as an explicit project admission policy.

Uncertainty needs a value and interpretation, or an explicit unavailable or
not-applicable reason; see [VIM 2.26](https://jcgm.bipm.org/vim/en/2.26.html).
An unexplained historical null is not zero, infinity or an established lack of
saturation. A minimality claim additionally needs a target property, candidate
universe, removal operations and search limits. A threshold needs an
operational criterion, comparison protocol and calibration or derivation.
The source schema admits no new numerical defaults in this edition. Admitting
actual values requires a subsequent scoped source-contract revision and evidence.
The six existing retinal source rows retain their own quantity roles and
preparation boundaries; they calibrate no legacy weights or carrier thresholds.

## Derivatives and verification

The pack includes the complete ledger and policy, a safe vocabulary projection,
all ten witness results and the 971-entry quantitative census. Model Studio
provides a dictionary selector, original field decisions, citations and a
download of the exact selected pack's census. Historical releases without this
review do not display the new panel. The prior routing edition replays from
its 36-file source snapshot.

```sh
node --test test/workspace/canonical-dictionaries.test.mjs
npm run check:canonical
```

The [validation record](../../models/causal-emergence/canonical/VALIDATION-2026.09.12.4.md)
records the completed checks and exact release identities. A successful build
verifies consistency and provenance constraints, not the truth of all prose.
