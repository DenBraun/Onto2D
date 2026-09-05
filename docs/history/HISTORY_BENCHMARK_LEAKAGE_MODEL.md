# History Benchmark leakage boundary

The root v0 API implements an exact census profile. A separate
[regression profile](HISTORY_REGRESSION_PREPARATION.md) now implements unit-disjoint
preparation and scoring, with independent review pending for the FD001 case.
Neither profile establishes causal identification.

| Boundary | Mechanical protection | Remaining review obligation |
| --- | --- | --- |
| Target access | P/H builder accepts only a closed observation object; target table joins later | Case projection must not encode a target or proxy into an opaque symbol |
| Availability | Present time equals cutoff; ordered history times are at or before cutoff; future targets are later | Source times and evidence availability must mean what the case declares |
| Population | Complete input hashes, unique IDs, exact target join; pilot regeneration uses every source-fixture unit | Source selection and original case design can still be outcome-aware |
| Source drift | Checker rebuilds all artifacts from exact source bytes and implementation hashes | Hashes bind bytes, not authenticity or truth |
| Split | Only complete census accepted; unsupported held-out claims rejected | Future predictor must enforce unit/duplicate separation and train-only preprocessing |
| Null | Fixed seed, trial count and role; bijective assignments; incomplete ensemble is indeterminate | Exchangeability, statistical uncertainty and useful null semantics are domain-specific |
| Reporting | Registry retains empirical candidates; controls include negative/neutral results | Case inclusion and independent preregistration cannot be proven by local code alone |

P and H values in this pilot are opaque exact symbols. Arbitrary proxy detection
is not claimed. Synthetic labels are designed controls; semantic labels derive
from the identity regime. Neither is evidence of independent predictive utility.
Source records may legitimately be duplicate observations of distinct units;
the census keeps them. Unit IDs themselves cannot be duplicated.

The current Operational Aging source pair used the supplied outcome during
selection. It remains illustrative. Only a new full-cohort pipeline, with
separate target extraction and frozen splits, can support a predictive result.

Tests inject stale history/target bytes, duplicate IDs, extra target fields,
post-cutoff history, reversed events, mismatched populations, metric/seed/code
drift, missing labels and incomplete nulls. Independent review must still check
the meaning and lineage of every feature and target before an empirical claim.
