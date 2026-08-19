# Mineral Formation History — Implemented Release

Updated: 2026-08-19

Status: `ANALYSIS_READY`

```text
caseId:      mineral-formation-history
modelId:     mineral-formation-history
model:       v1-cefaa83457ac222c
explorer:    apps/mineral-history-explorer/
case:        sha256:10b59cb71e26bb07e7a88139f639d5a416d20674b63ff5165a75d03d1b23cf9c
model root:  sha256:759b271dd0da6434e97290d22876b34a7258c27991d0fc4fe158d60e2af72820
```

## Result

The first release uses one bounded sedimentary pyrite-nodule cohort:

```text
1 conventional species key: Pyrite / FeS2
10 native sample records
95 retained LA-ICP-MS analysis rows
3 reviewed, sample-specific published formation profiles
7 samples with no mapping in this bounded release
```

It demonstrates that conventional species identity, physical sample identity,
direct measurement, and formation-history interpretation can coexist without
overwriting one another.

## History Model Metadata

```text
History modes:
    Reconstructed
    Embodied

Primary effects:
    Identity

Secondary effects:
    Present State

Domain:
    Mineralogy

Evidence profile:
    direct-measurement
    sample-identity
    published-interpretation
    reconstructed
    unknown
    contested

Historical Load:
    Not evaluated

History Equivalence:
    Possible

Reachability:
    Not primary

Reconstruction:
    Primary
```

## Source Lock

The source projection is generated from Mendeley Data DOI
[`10.17632/h2n4b8cczy.1`](https://doi.org/10.17632/h2n4b8cczy.1), version 1,
CC BY 4.0:

| File | Bytes | SHA-256 | Role |
|---|---:|---|---|
| `Table 1 sample information.xlsx` | 14,509 | `e1e7cee4f5a400b0b3a4edb44ea3e8736f0f3620823b0b750aa44022608af58a` | sample ID, age, locality, stratigraphy, description |
| `Appendix 3 LA-icpms data.xlsx` | 118,563 | `dfd1fecb72ab8dc75e29dc0ca55a3ca32c3407b88962171594e629d377dcbf6c` | 95 measurement rows |

The normal repository build uses the frozen JSON projection and requires no
network access. `prepare-source.py` uses only the Python standard library and
rejects input whose hash differs.

The sample-specific formation interpretations come from Gregory et al. (2019),
*Geochimica et Cosmochimica Acta* 259, 53–68, DOI
[`10.1016/j.gca.2019.05.035`](https://doi.org/10.1016/j.gca.2019.05.035).
The accepted manuscript is separately locked to 783,712 bytes and SHA-256
`4c3e40b01a5f319bbb367258663589bd0b52ae2495d9a86820b764f88ebd5118`.

Hazen and Morrison (2022), DOI
[`10.2138/am-2022-8099`](https://doi.org/10.2138/am-2022-8099), is used only
as conceptual authority for complementary conventional and paragenetic
classification. It supplies no sample-specific claim in this case.

## Reviewed Formation Claims

| Sample | Published profile retained by the case | Qualifier | Exact locator |
|---|---|---|---|
| `DD86WRL1-681` | pervasive growth with minor later margin growth | predominantly | Figure 1 caption, accepted-manuscript text lines 733–745 |
| `PETR14` | concentric growth | predominantly | Figure 2 caption, accepted-manuscript text lines 746–757 |
| `79990` | pervasive centre with later margin infill | interpreted | section 5 discussion of Figure 3, accepted-manuscript text lines 352–359 |

The claim layer preserves the authors’ qualifiers. Onto2D does not strengthen
`predominantly` or `interpreted` into proven, unique, or necessary mechanisms.

The other seven samples remain `unmapped-within-bounded-case`. This means no
reviewed mapping is included in this release. It does not claim that their
formation histories are globally unknowable.

## Evidence Layers

```text
sample-record
    native identifier, age, locality, stratigraphy, description

direct-measurement
    exact LA-ICP-MS rows and reported uncertainties

published-interpretation
    qualified sample-specific claim plus article locator

species-classification
    bounded Pyrite / FeS2 comparison key

onto2d-analysis
    identity regimes, unresolved mappings, and non-claims
```

The source workbook repeats the heading `Pb_Py` in columns X, Y, and Z. The
projection retains the source column letters and does not invent isotope labels.

## Identity Regimes

### Conventional species

All ten samples form one bounded `Pyrite / FeS2` class.

### Sample record

The native sample IDs form ten distinct classes.

### Published formation profile

Three reviewed representatives form three supported profile classes and seven
samples remain unresolved. The regime does not manufacture a catch-all
formation class for unknown records.

## Canonical Experiments

1. **Same species, different formation profiles.** Compare `DD86WRL1-681`,
   `PETR14`, and `79990` without changing their common species key.
2. **Evidence trace.** Follow each mapped sample through its measurement series,
   qualified article claim, and exact locator.
3. **Unknown boundary.** Verify that seven source samples receive no generated
   claim from their age, locality, description, or chemistry.
4. **Classification toggle.** Reproject one immutable cohort as 1 species class,
   10 sample classes, or 3 supported profiles plus 7 unresolved records.

## Historical Load

Historical Load is:

```json
{
  "status": "not-evaluated",
  "value": null
}
```

The sources do not define a finite universe of admissible formation paths,
explicit transitions, transition costs, or a history-free baseline. A numeric
value—especially zero—would therefore be fabricated.

## Model Pack

The 30-node / 48-edge Model Pack contains:

- one source-cohort node and one conventional species node;
- ten sample nodes and ten attributable measurement-series nodes;
- three published-interpretation nodes;
- three identity-regime nodes;
- unresolved-mapping and Historical Load boundary nodes.

Measurement edges explicitly carry `causalFormationClaim: false`. Only the
three article-attributed claim nodes use `interprets-sample`; Onto2D generates
zero causal formation edges.

## Explorer

The light-theme Mineral Formation History Explorer provides:

1. exact release metrics;
2. an identity-regime switcher;
3. three published-interpretation cards;
4. a complete ten-sample inspector with mapped/unmapped filtering;
5. descriptive log-scale trace-element series by sample;
6. the five-layer evidence chain;
7. explicit Historical Load and epistemic boundaries.

The trace chart preserves source order and reports numeric ranges. It is a
visualization, not a formation classifier.

## Negative Guarantees

Automated tests reject or detect:

- input workbooks with unexpected bytes;
- added fields outside the artifact schema;
- missing or duplicated sample/analysis identities;
- renamed ambiguous lead columns;
- formation claims inferred from locality, age, or trace elements;
- strengthened publication qualifiers;
- generated causal formation relations;
- a numeric Historical Load without a declared path-and-cost model;
- Model Pack, registry, and browser artifact hash drift.

## Reproduce

```sh
npm run case:mineral-formation-history:verify
node --test cases/mineral-formation-history/tests/mineral-formation-history.test.mjs

npm run model:mineral-formation-history:verify
node --test models/mineral-formation-history/compiler.test.mjs

node --test apps/mineral-history-explorer/mineral-formation-model.test.mjs
npm run check:history-registry
npm run check:registry
```

## Falsification Criterion

The case fails if historical classification can be represented only by
overwriting conventional species identity, or if absent reviewed mappings are
silently replaced by generated claims. The implemented artifact and Model Pack
make both changes detectable.
