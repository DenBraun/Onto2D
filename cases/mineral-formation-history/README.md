# Mineral Formation History

This case freezes a bounded published cohort of ten sedimentary pyrite-nodule
samples and asks a regime-relative identity question:

```text
one conventional species (pyrite / FeS2)
  -> ten native sample records
  -> 95 attributable LA-ICP-MS analysis rows
  -> three qualified, sample-specific published formation profiles
  -> seven deliberately unmapped samples in this release
```

Species equality and formation-history equality are complementary views. The
case does not replace conventional mineral classification, infer mechanism
from locality or age, or turn trace-element values into automatic causal
claims.

## Exact sources

The projection is locked to Mendeley Data DOI
`10.17632/h2n4b8cczy.1` (CC BY 4.0):

- `Table 1 sample information.xlsx`, SHA-256
  `e1e7cee4f5a400b0b3a4edb44ea3e8736f0f3620823b0b750aa44022608af58a`;
- `Appendix 3 LA-icpms data.xlsx`, SHA-256
  `dfd1fecb72ab8dc75e29dc0ca55a3ca32c3407b88962171594e629d377dcbf6c`.

The three bounded interpretations come from Gregory et al. (2019), DOI
`10.1016/j.gca.2019.05.035`, at the exact figure/discussion locators recorded
in `analysis-profile.json`. Hazen and Morrison (2022), DOI
`10.2138/am-2022-8099`, supplies only the complementary-classification
principle, not sample-specific claims.

## Evidence discipline

All 95 analysis rows remain present. The source workbook gives the same
`Pb_Py` heading to columns X, Y, and Z; the projection therefore retains source
column letters and does not invent isotope labels. Seven samples have no
case-local reviewed formation mapping. That means unresolved in this release,
not globally unknowable.

Historical Load is `null` / `not-evaluated`: the sources do not define a
finite path universe, admissibility relation, transition costs, or a
history-free baseline.

## Reproduce and verify

```sh
python3 cases/mineral-formation-history/prepare-source.py \
  --table '/path/to/Table 1 sample information.xlsx' \
  --analyses '/path/to/Appendix 3 LA-icpms data.xlsx' \
  --output cases/mineral-formation-history/source/gregory-2019-pyrite-nodules.json

npm run case:mineral-formation-history:verify
node --test cases/mineral-formation-history/tests/mineral-formation-history.test.mjs
```

Normal case, Model Pack, and Explorer builds are offline.
