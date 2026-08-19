# ADR 0118: Separate ecological measurement, event context, and causality

Date: 2026-08-19

Status: Accepted

## Context

The official NEON wildfire LiDAR tutorial supplies exact 2019 and 2021
Soaproot Saddle tile files and identifies the tile as a small area observed
before and after the 2020 Creek Fire. A separate official tutorial renders four
site-management event records for that fire. These sources support a bounded
before/after description. They do not supply an exact fire-perimeter join, a
control tile, a constant sensor protocol, or a causal adjustment design.

The LiDAR observations also do not directly expose “ecosystem state.” Any
comparison first requires a declared projection over selected returns and
summary statistics.

## Decision

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

## Consequences

The Lab can report 7,275 matched 10 m cells, negative paired median change in
all four declared height metrics, and a flagship cell with the same rounded
four-number signature across years. Those observations support a clear
demonstration that projection-relative appearance does not erase recorded
history. They do not establish a Creek Fire effect, complete ecosystem state,
a recovery curve, or a transferable ecological-memory score.
