# Ecological Memory / NEON SOAP LiDAR

This case is a source-locked, deterministic comparison of vegetation-height
projections from one Soaproot Saddle LiDAR tile observed before and after the
recorded 2020 Creek Fire context.

## Result

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

## Evidence boundary

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

## Reproduce

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
