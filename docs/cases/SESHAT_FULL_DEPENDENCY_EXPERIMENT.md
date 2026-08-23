# Seshat Full Dependency Experiment — Remaining Work

Updated: 2026-08-23

Status: **PLANNED POPULATION STUDY**

The existing three-polity Explorer is an illustrative mechanism test. The full
experiment is a separate, outcome-blind population study over a frozen cohort.
Its falsifiable hypothesis is:

> Support quantity and structural dependency robustness do not produce the same
> ordering of historical claims.

The hypothesis is allowed to fail. A result with identical orderings and no
discordant pairs is a valid negative result.

## 1. Freeze the study before computing results

Create a versioned preregistration manifest that fixes:

1. one variable or a tightly defined variable family;
2. one pinned public data release and the exact native Codebook boundary;
3. deterministic provenance-completeness and exclusion rules;
4. every eligible polity-time claim satisfying those rules;
5. native-code, range, time-bound, uncertainty, dispute, and derivation
   semantics;
6. source-record-to-source-work grouping rules;
7. group-ablation semantics and uncertainty procedures;
8. the planned tables, plots, and statistical summaries.

The cohort is frozen before any dependency metric or stress result is
calculated. No polity or claim may enter the cohort because its result looks
interesting.

## 2. Build the population support graph

For every eligible claim, preserve a typed, labelled dependency DAG containing
the public records that are actually available:

```text
evidence leaves -> narratives / source works -> coding claim -> derived result
```

When supported by public metadata, the graph may also contain source families,
coders, experts, reviewers, review episodes, and data-propagation episodes.
Unavailable metadata remains unavailable and its metric remains `null`; it is
never replaced with a guessed identity. Multiple citations are not described
as independent supports unless independence is explicitly modelled and
justified.

## 3. Compute the primary quantities

For each claim compute and report the full distributions of:

```text
D_source = number of distinct source-work groups
D_leaf   = number of distinct evidence leaves
R_source = minimum source-work groups removed before the claim becomes unresolved
R_coder  = minimum coder groups removed before the claim becomes unresolved
```

`R_coder` is `null` where the necessary public coder linkage is absent. Do not
replace these quantities with one composite “robustness score”. Exact labelled
DAG identity and simple composition counts remain separate outputs.

## 4. Run declared stressors

Group stressors are primary:

- remove one source work;
- remove one source family;
- where represented, remove one coder, one expert, or one review episode.

Claim stressors are secondary:

- remove one coding claim;
- branch one disputed value;
- turn one inferred claim into an unresolved claim.

Later derivation stressors may change a declared imputation policy, remove
imputed inputs, branch disputed inputs, or widen a numeric range under a fixed
rule. Every stress operation creates a derived analysis artifact and cannot
mutate the frozen source graph. The primary output is the exact numeric delta
or categorical flip, with no hidden `STABLE` / `SENSITIVE` threshold.

## 5. Test quantity versus dependency robustness

For every comparable pair of claims `i` and `j`, mark source-support
discordance when:

```text
D_source(i) > D_source(j) and R_source(i) < R_source(j)
```

or when the reverse ordering holds. Report:

- number of comparable pairs;
- number of discordant pairs;
- discordance fraction;
- uncertainty interval.

Also report the Spearman rank correlation, its confidence interval, and a
scatter/rank plot where appropriate. Do not invent a post-hoc verbal boundary
such as “rho below 0.3 is weak”. The estimate and interval are the result.

A zero discordance fraction counts against the hypothesis for the frozen
cohort. A non-zero fraction shows that source count alone does not totally
order dependency robustness. Representative discordant pairs may be selected
for visualization only after the complete frozen analysis exists.

## 6. Remaining implementation sequence

- [ ] Add a preregistration schema and committed frozen cohort manifest.
- [ ] Extend extraction from three fixtures to every eligible claim in the
  selected variable family.
- [ ] Version source-family and, where available, human-process group mappings.
- [ ] Add scalable exact or explicitly bounded minimum-group-cut computation.
- [ ] Compute `D_source`, `D_leaf`, `R_source`, and nullable `R_coder` for the
  complete cohort.
- [ ] Add pairwise discordance, uncertainty intervals, Spearman intervals, and
  deterministic plots.
- [ ] Publish all eligible claim results, including null and negative results.
- [ ] Update the Explorer with population distributions and post-analysis
  representative pairs while retaining the three-fixture mechanism view.
- [ ] Re-run the epistemic abstraction in a second repository case before
  promoting case-local code into generic packages.

## 7. Optional work after the population result

Only if it adds scientific value and remains reproducible:

- reproduce one published derivation pipeline;
- consider the social-complexity CC/PCA pipeline, a moralizing-gods replication
  pipeline, or a simpler published transformation;
- add imputation/statistical reproduction only after source fidelity and
  derivation provenance are explicit;
- create a Model Pack only if the broader study benefits from it.

## Definition of done

The full experiment is complete only when the cohort and group semantics were
frozen first, all eligible claims were analysed, full distributions and
pairwise discordance were reported, rank association has no arbitrary verbal
threshold, examples were chosen after the complete result, negative findings
remain publishable, and every output can be reproduced from pinned inputs.
