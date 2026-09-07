# Ecological Memory

Case ID: `ecological-memory`. [History case registry](../history-case-registry.json).

- [Ecological Memory — use and reproduction](#ecological-memory--use-and-reproduction)
- [Ecological Memory — source and interpretation](#ecological-memory--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="ecological-memory--use-and-reproduction"></a>

## Ecological Memory — use and reproduction

This case is a source-locked, deterministic comparison of vegetation-height
projections from one Soaproot Saddle LiDAR tile observed before and after the
recorded 2020 Creek Fire context.

<a id="ecological-memory--use-and-reproduction--result"></a>

### Result

The declared projection retains classification-5 high-vegetation returns,
subtracts the shared 2021 DTM, rejects heights outside 0-80 m, and computes
P20, P50, P75, and P90 heights for 10 m cells with at least 50 returns. The
2019 and 2021 surveys yield 7,275 cells that qualify in both years.

All four paired median changes are negative: `-0.311028`, `-0.277956`,
`-0.189277`, and `-0.104390` m from P20 through P90. These are descriptive
changes in the selected projection, not an estimated Creek Fire effect.

Cell 7880 is the lowest-ID one of two cells whose four-quantile signatures
match after rounding to 0.1 m. Its exact values, return counts, sensor protocol,
and recorded event context still differ. Projection-relative equality creates
neither full ecosystem identity nor history identity.

<a id="ecological-memory--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

- Exact public Google Drive file IDs, byte lengths, SHA-256 identities, and two
  exact NEON tutorial Git blobs lock the source cohort. The tutorial bundle is
  not relabelled as a formal NEON release.
- The four height quantiles are a declared projection, not full ecosystem state.
- Four site-event records and the official tutorial's fire-affected-tile
  interpretation provide recorded context. No exact event-perimeter join is
  present in the case artifact.
- The two surveys use different sensors, so measurement protocol is not held
  constant.
- The comparison has no control tile or causal adjustment design. It estimates
  no causal effect.
- Two survey dates provide no recovery trajectory or future prediction.
- Historical Load is not evaluated and remains `null`, not zero.

<a id="ecological-memory--use-and-reproduction--reproduce"></a>

### Reproduce

Create the full source projection from exact downloaded inputs with Python 3,
NumPy 2.0.2, laspy 2.6.1, lazrs 0.6.3, and rasterio 1.4.3:

```sh
python3 cases/ecological-memory/prepare-source.py \
  --lidar-2019 /absolute/path/to/NEON_D17_SOAP_DP1_293000_4100000_classified_point_cloud_colorized_2019.laz \
  --lidar-2021 /absolute/path/to/NEON_D17_SOAP_DP1_293000_4100000_classified_point_cloud_colorized_2021.laz \
  --dtm-2021 /absolute/path/to/NEON_D17_SOAP_DP3_293000_4100000_DTM_2021.tif \
  --output cases/ecological-memory/source/soap-lidar-projection.json
```

Build or verify the committed artifact and Model Pack:

```sh
npm run case:ecological-memory
npm run case:ecological-memory:verify
npm run model:ecological-memory
npm run model:ecological-memory:verify
```

<a id="ecological-memory--source-and-interpretation"></a>

## Ecological Memory — source and interpretation

<a id="ecological-memory--source-and-interpretation--implemented-result"></a>

### Implemented Result

The case locks the exact public files used by the official NEON wildfire LiDAR
tutorial: 2019 and 2021 classified point clouds for SOAP tile
`293000_4100000`, plus the shared 2021 DTM. It also locks the exact Git blobs
for the wildfire tutorial and the official rendered site-event query that
contains four Creek Fire records. File IDs, byte lengths, and SHA-256
identities are verified; this bundle is not relabelled as a formal NEON
release.

Under the declared projection, classification-5 high-vegetation returns are
height-normalized against the shared DTM and summarized as P20, P50, P75, and
P90 in 10 m cells with at least 50 returns. There are 7,275 cells eligible in
both years. Their paired median changes from 2019 to 2021 are `-0.311028`,
`-0.277956`, `-0.189277`, and `-0.104390` m respectively.

Cell 7880 is the deterministic flagship: all four projected values match after
rounding to 0.1 m, while exact values, retained-return counts, sensor protocols,
and recorded history remain different. Therefore equality holds only for one
declared display-signature regime. It does not create exact measurement, full
ecosystem, or history identity.

The before/after result is descriptive. The two years use different sensors,
the case includes no exact fire-perimeter intersection or control tile, and no
causal effect is estimated. Two survey dates do not establish a recovery
trajectory or future response. Historical Load is explicitly `null` because
no alternative-history graph, admissibility rule, route cost, or baseline
route exists in this cohort.

<a id="ecological-memory--source-and-interpretation--purpose"></a>

### Purpose

Use NEON long-term ecological measurements and disturbance/management records
to test ecological memory:

```text
disturbance history
    -> ecological legacy
    -> present ecosystem state
    -> future response
```

Primary distinction:

```text
similar present vegetation snapshot
    !=
same disturbance history
```

and potentially:

```text
same present snapshot
    !=
same future response
```

The second claim requires longitudinal evidence and must not be assumed.

<a id="ecological-memory--source-and-interpretation--primary-external-sources"></a>

### Primary External Sources

NEON Site management and event reporting:

```text
DP1.10111.001
https://data.neonscience.org/data-products/DP1.10111.001
```

This product records land management activities, disturbances, and other
ecologically relevant events across NEON sites.

Candidate state products:

```text
Vegetation structure
DP1.10098.001
https://data.neonscience.org/data-products/DP1.10098.001

Plant presence and percent cover
DP1.10058.001
https://data.neonscience.org/data-products/DP1.10058.001

Soil physical and chemical properties, periodic
DP1.10086.001
https://data.neonscience.org/data-products/DP1.10086.001
```

The first case must pin matching release versions.

<a id="ecological-memory--source-and-interpretation--non-goals"></a>

### Non-goals

Do not initially:

- infer ecosystem causation from observational association;
- compare every NEON site;
- infer unrecorded disturbances;
- predict resilience clinically/operationally;
- define one scalar ecological-memory score;
- call two ecosystems identical because a few measurements match.

<a id="ecological-memory--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot distinguish recorded ecological history,
embodied present state, and observational evidence without treating
correlation as causation.

<a id="evidence-contract"></a>

## Evidence contract

The Ecological Memory case and `ecological-memory` Model Pack keep six layers
independent:

1. exact source-file and tutorial locks;
2. two source-projected LiDAR measurements;
3. one declared four-quantile vegetation-height projection;
4. four recorded Creek Fire event records;
5. the tutorial's separately attributable fire-affected-tile interpretation;
6. analysis results and explicit non-claim boundaries.

Event precedence is a recorded-temporal-context relation, never a causal edge.
The 2019 Optech Gemini and 2021 Teledyne Optech Galaxy Prime protocols remain
different. Equality under the 0.1 m display signature does not promote to exact
measurement equality, full ecosystem identity, or history identity.

Historical Load remains `null`: this cohort defines no finite alternative
history space, admissibility rule, route cost, or baseline route. Reachability
is limited to one observed after-state; no recovery trajectory or future
prediction is inferred.
