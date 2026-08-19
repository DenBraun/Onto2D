# Galactic Archaeology

This case freezes a bounded Gaia DR3 cohort and tests whether Onto2D can keep a
long reconstruction chain honest:

```text
Gaia catalogue observation
  -> Gaia Apsis parameter estimate
  -> published chemical-cartography orbit estimate
  -> Onto2D deterministic rule profile
  -> candidate historical compatibility
```

The final arrow does not produce a recovered birth site, common ancestry,
accretion origin, or unique formation history.

## Exact source release

The canonical projection contains 64 sources from Gaia DR3. It is balanced
across four deliberately named **rule profiles**, with eight sources satisfying
the paper's High-quality criteria and eight Medium-only sources per profile.
The profile threshold for the two metal-poor selections is `[M/H] <= -0.8 dex`.

`prepare-source.py` executes 33 stored ADQL queries against the Gaia@AIP TAP
mirror. It queries the three authorities separately by `source_id`:

- `gaiadr3.gaia_source` — catalogue quantities and reported measurement error;
- `gaiadr3.astrophysical_parameters` — GSP-Spec estimates and percentile bounds;
- `gaiadr3.chemical_cartography` — published orbital/action estimates and bounds.

Four fixed `source_id` bands make candidate selection spatially less local
without requiring a live random ordering. Every candidate orbital field must
be finite; JSON serialization rejects `NaN`. The generator stores every exact
executed query in the frozen projection.

The release is locked by:

- Gaia DR3 table DOIs `10.17876/gaia/dr.3/1`, `/43`, and `/99`;
- the Chemical Cartography paper DOI `10.1051/0004-6361/202243511`;
- paper PDF SHA-256;
- generator SHA-256 and byte count;
- source-projection SHA-256 and byte count.

Canonical extraction, tests, Model Pack builds, and the Explorer never query a
live service.

## Quality ablation

The Medium view contains 64 sources. Replaying the paper's stricter High
GSP-Spec flag profile leaves 32: eight in every rule profile. This means all
four bounded patterns remain represented, not that any historical
interpretation becomes certain. Median metallicity, alpha enhancement,
azimuthal velocity, eccentricity, and maximum orbital height are recomputed for
both views.

## Evidence ablation

The canonical regimes deliberately withhold downstream claims:

1. observations only — classification and history unresolved;
2. observations plus Gaia estimates — orbit-dependent classification unresolved;
3. through published orbit estimates — rule assignment supported, history withheld;
4. full bounded publication context — candidate compatibility allowed.

## Historical Load

Historical Load is `null` / `not-evaluated`. The case declares no finite path
space, transition cost, or history-free counterfactual baseline. Undefined is
never rendered as zero.

## Reproduce and verify

Rebuilding the live source projection is a deliberate networked operation:

```sh
python3 cases/galactic-archaeology/prepare-source.py \
  cases/galactic-archaeology/source/gaia-dr3-chemical-cartography.json \
  --retrieved-at 2026-08-19T07:20:00Z
```

Normal repository work is offline:

```sh
npm run case:galactic-archaeology:verify
npm run model:galactic-archaeology:verify
node --test cases/galactic-archaeology/tests/galactic-archaeology.test.mjs
node --test models/galactic-archaeology/compiler.test.mjs
node --test apps/galactic-archaeology-lab/galactic-archaeology-model.test.mjs
```
