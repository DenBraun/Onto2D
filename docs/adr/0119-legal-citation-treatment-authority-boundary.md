# ADR 0119: Separate legal citation, attributed treatment, and authority

Date: 2026-08-19

Status: Accepted

## Context

CourtListener exposes stable opinion identifiers and a native citation graph.
An edge in that graph records that one opinion cites another. It does not by
itself say that the cited opinion caused the result, was doctrinally relied on,
or was binding. Retrieval-time citation totals are still weaker: popularity or
network degree cannot manufacture normative authority.

The selected `Green` opinion directly discusses four earlier opinions, so the
case can preserve a second, stronger layer when each treatment label remains
attributed to the source opinion and an exact United States Reports locator.
The sources also disagree on two dates, which makes a silent shared date field
unsafe for a temporal projection.

## Decision

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

## Consequences

The Lab can show exactly four selected earlier opinions and ten context edges
at the `Green` cutoff, while keeping `Alexander` and `Swann` visibly later. It
can overlay attributed treatment on four native citations without calling any
of them binding. Withholding `Brown II` reduces the derived graph from ten to
six edges while preserving all seven source opinions and sixteen source
citations.

The release cannot determine current law, precedential weight, or a correct
legal outcome. Extending the corpus or adding authority classifications
requires a new source lock, an explicit jurisdiction/hierarchy policy, and
independently attributable evidence.
