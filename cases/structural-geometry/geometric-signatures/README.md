# Geometric signature controls

The [protocol](PROTOCOL.md), [sources](sources.json) and [requests](controls.json)
were fixed before signature generation. They cover 11 original flow cases,
three supplemental star/bridge controls, five weighted Forman graphs, one
weighted selection and five coverage/termination controls: 25 requests over
18 verified source packs. Earlier source packs and scientific files remain intact.

```sh
npm run structural-geometry:geometric-signature:check
npm run structural-geometry:geometric-signature:report
```

The report verifies source locks, certificates, all descriptors and the property
matrices before printing outcomes. [suite.json](suite.json) records four complete
and 21 indeterminate signatures. A valid early stop still leaves a partial
fixed-horizon trace. Reaching a cap can give complete frame coverage without
convergence. Weighted intervals, empty populations, missing receipts, partial
Ollivier coverage, cycles and degenerate stops all remain explicit.

`measurements.py` generates [measurements.json](measurements.json) directly from
frozen source packs and requests using independent NetworkX 3.2.1 transport and
Decimal/Fraction Forman calculations. It reads no production result. Its source,
protocol and helper hashes are pinned, with the independent algorithm identity.
To repeat that numerical calculation, use a Python environment with the existing
[pinned requirements](../flow/requirements-reference.txt):

```sh
python -B cases/structural-geometry/geometric-signatures/measurements.py --verify
```

`reference.py` uses only the standard library to independently derive features
from the numerical lock: closed-interval feasibility, grouped exact fractions,
degree roles, horizon coverage and backward threshold run lengths. The normal
stage check replays this descriptor reference and validates source hashes; it
does not reinstall or rerun NetworkX. The numerical reference was separately
regenerated and verified for acceptance.

Property controls enumerate 781 interval profiles, 820 short threshold traces
(including exact threshold equality) and 40 observed/partial/unavailable coverage
profiles. Tests replay every artifact in a browser and transport all 25 requests,
including source/edge IDs, induced scopes, initial lengths, presentation and
record order. Expected-source/evidence replay rejects rehashed forgeries.

Deliberate regeneration after source/protocol review uses:

```sh
python -B cases/structural-geometry/geometric-signatures/measurements.py --write
python3 -B cases/structural-geometry/geometric-signatures/reference.py --write
npm run structural-geometry:geometric-signature:build
```

The first command requires pinned NetworkX; the last runs the existing external
transport adapters and writes goldens only after agreement with independent
measurements/descriptors. No control may be tuned to improve observed outcomes.
See the [contract](../../../docs/structural-geometry/SIGNATURES.md#geometricsignature-v1) and
[review](../../../docs/structural-geometry/EVIDENCE.md).
SG2-041 evaluates added value later; these controls do not claim it.
