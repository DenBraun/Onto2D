# Legal Precedent

Case ID: `legal-precedent-history`. [History case registry](../history-case-registry.json).

- [Legal Precedent — use and reproduction](#legal-precedent--use-and-reproduction)
- [Legal Precedent — source and interpretation](#legal-precedent--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="legal-precedent--use-and-reproduction"></a>

## Legal Precedent — use and reproduction

This case is a source-locked, deterministic representation of seven selected
U.S. Supreme Court public-school desegregation opinions from `Brown I` (1954)
through `Swann` (1971).

<a id="legal-precedent--use-and-reproduction--result"></a>

### Result

At the official decision date of `Green`, four selected earlier opinions were
available in the bounded cohort: `Brown I`, `Brown II`, `Cooper`, and
`Griffin`. CourtListener's native `opinion.cites` records contain direct
`Green -> earlier opinion` edges for all four. The later `Alexander` and
`Swann` opinions are retained in the complete bounded source record but are
excluded from the 1968 context projection.

The 16 native citation edges remain separate from four source-attributed
treatment claims read from the official `Green` opinion. Neither layer asserts
that a selected authority is binding. Citation counts are retained only as
provider metadata and are not used by any derivation.

<a id="legal-precedent--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

- CourtListener IDs, opinion SHA-1 values, native citation lists, and provider
  dates are pinned in a compact source projection.
- Seven official United States Reports PDFs are pinned by URL, byte count, and
  SHA-256; GovInfo decision dates drive the time slice.
- `Cooper` and `Swann` have differing GovInfo decision dates and CourtListener
  `dateFiled` values. Both fields remain visible; the conflict is not erased.
- The seven opinions are a deliberately incomplete research cohort, not a
  complete statement of school-desegregation doctrine or current law.
- The counterfactual removes `Brown II` only from a derived graph view. The
  seven source opinions and 16 recorded citation edges remain unchanged.
- Historical Load is not evaluated and remains `null`, not zero.
- The artifact and explorer are research visualizations, not legal advice.

<a id="legal-precedent--use-and-reproduction--reproduce"></a>

### Reproduce

```sh
npm run case:legal-precedent
npm run case:legal-precedent:verify
npm run model:legal-precedent
npm run model:legal-precedent:verify
```

<a id="legal-precedent--source-and-interpretation"></a>

## Legal Precedent — source and interpretation

<a id="legal-precedent--source-and-interpretation--implementation-status"></a>

### Implementation Status

```text
Maturity:
    ANALYSIS_READY

Case identity:
    sha256:158c1bb5be38b6f9e9f2cd4f32ad3a90f2d3ff20b55369067c86b590c3024691

Model Pack:
    legal-precedent-history@v1-05958887a4ffef41

Model root:
    sha256:c5541db8a9bc669f452a738ccf02d239ae2e2d286e61a5979129fe86275caf2a
```

The first release is complete as a full vertical slice: exact source locks,
offline deterministic extraction, a JSON Schema, negative tests, an exact
Model Pack, a light-theme Explorer, History Atlas integration, and an exact
Model Studio selection.

<a id="legal-precedent--source-and-interpretation--implemented-cohort"></a>

### Implemented Cohort

The bounded cohort contains seven selected United States Supreme Court
public-school desegregation opinions:

| ID | Citation | GovInfo decision date | CourtListener opinion ID |
|---|---|---|---:|
| `brown-i` | 347 U.S. 483 | 1954-05-17 | 105221 |
| `brown-ii` | 349 U.S. 294 | 1955-05-31 | 105312 |
| `cooper` | 358 U.S. 1 | 1958-09-12 | 105766 |
| `griffin` | 377 U.S. 218 | 1964-05-25 | 106825 |
| `green` | 391 U.S. 430 | 1968-05-27 | 107705 |
| `alexander` | 396 U.S. 19 | 1969-10-29 | 107993 |
| `swann` | 402 U.S. 1 | 1971-04-20 | 108316 |

This is a deliberately incomplete research selection, not a complete doctrinal
corpus or a statement of current law. CourtListener supplies provider
identifiers, opinion SHA-1 fields, retrieval-time citation totals, and native
`opinion.cites` relations. GovInfo supplies official United States Reports
metadata and seven PDF byte locks. The build requires no live network.

<a id="legal-precedent--source-and-interpretation--canonical-result"></a>

### Canonical Result

At `Green`'s official decision date, the four selected prior opinions are:

```text
Brown I
Brown II
Cooper
Griffin
```

`Green` has a CourtListener-native citation edge to each one. `Alexander` and
`Swann` remain in the seven-opinion source record but are excluded from the
1968 historical-input projection. The full cohort contains 16 native citation
edges; the Green context contains 10.

Four stronger treatment labels are stored separately and attributed to exact
locators in the official `Green` opinion:

```text
described-holding
applied-command
supporting-reference
quoted-timing-rule
```

None is derived from citation count, none creates a court-hierarchy edge, and
none is promoted to a binding-status claim. Binding status is `unknown` in the
native citation layer and `not-classified` in the attributed treatment layer.

<a id="legal-precedent--source-and-interpretation--preserved-source-disagreements"></a>

### Preserved Source Disagreements

GovInfo and CourtListener disagree on two date fields:

| Opinion | GovInfo decision date | CourtListener `dateFiled` |
|---|---|---|
| `Cooper` | 1958-09-12 | 1958-10-06 |
| `Swann` | 1971-04-20 | 1971-06-07 |

Both fields remain visible. The analysis profile explicitly chooses GovInfo's
official decision date for this time slice and makes no claim about why the
CourtListener value differs.

<a id="legal-precedent--source-and-interpretation--counterfactual-result"></a>

### Counterfactual Result

Withholding `Brown II` from the derived Green-context graph changes the view
from 5 to 4 nodes and from 10 to 6 citation edges. The source record remains
exactly 7 opinions and 16 citations. This is a reachability ablation only; it
cannot rewrite source history or support a legal conclusion.

<a id="legal-precedent--source-and-interpretation--historical-load-result"></a>

### Historical Load Result

Historical Load remains `null`, not zero. The case defines no finite legal
route space, route-cost function, or history-free normative baseline. Its
useful result is the typed evidence boundary and the exact available-at-time
projection, not a scalar.

<a id="legal-precedent--source-and-interpretation--reproduction"></a>

### Reproduction

```sh
npm run case:legal-precedent
npm run case:legal-precedent:verify
npm run model:legal-precedent
npm run model:legal-precedent:verify
```

<a id="legal-precedent--source-and-interpretation--purpose"></a>

### Purpose

Test normative path dependence: past decisions are part of the structured
historical context within which later legal reasoning occurs.

Primary distinction:

```text
citation history
    !=
causal dependency
    !=
binding precedent
```

This case must remain a model of legal records and citation/procedural history,
not an automated source of legal advice.

<a id="legal-precedent--source-and-interpretation--primary-external-source"></a>

### Primary External Source

CourtListener / Free Law Project:

```text
https://www.courtlistener.com/
https://wiki.free.law/c/courtlistener/help/api/rest/v4/rest-api-v47
https://wiki.free.law/c/courtlistener/help/api/rest/v4/citations
```

CourtListener exposes opinions and a citation graph between legal decisions.

Bulk citation data may be preferable for reproducible graph experiments.

<a id="legal-precedent--source-and-interpretation--non-goals"></a>

### Non-goals

Do not:

- provide legal advice;
- decide whether a precedent is binding;
- infer precedential weight from citation count alone;
- infer doctrinal dependence from one citation;
- classify an opinion as overruled without an explicit source;
- generate a "correct legal outcome".

The first release is a provenance/citation/normative-history representation.

<a id="legal-precedent--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot represent normative history without collapsing
citation, legal authority, and doctrinal interpretation into one edge type.

<a id="evidence-contract"></a>

## Evidence contract

The Legal Precedent case and `legal-precedent-history` Model Pack keep seven
layers independent:

1. exact CourtListener provider identifiers, opinion SHA-1 fields, and native
   `opinion.cites` lists;
2. exact GovInfo United States Reports metadata and PDF byte locks;
3. official decision dates used by one declared availability rule;
4. native `cites` edges with unknown binding status;
5. four source-attributed `Green` treatment claims with exact locators;
6. provider date disagreements retained as first-class evidence conflicts;
7. derived availability and counterfactual graph views.

No compiler rule derives binding status, court hierarchy, causal dependence,
or doctrinal treatment from a citation or citation count. Later opinions cannot
be historical inputs to an earlier decision. Counterfactual removal affects
only the derived analysis view and never the source graph.

GovInfo decision dates drive `AvailablePrecedentContext` in this release. The
CourtListener `dateFiled` values remain beside them, including the conflicting
`Cooper` and `Swann` records. The model does not infer why they differ.

Historical Load remains `null`: no legal route space, route cost, or
history-free normative baseline has been defined. The entire release is a
bounded research visualization and not legal advice.
