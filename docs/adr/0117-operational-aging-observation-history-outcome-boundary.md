# ADR 0117: Separate operational observation, history, latent state, and outcome

Date: 2026-08-18

Status: Accepted

## Context

NASA C-MAPSS FD001 supplies simulated setting and sensor trajectories, complete
training runs, truncated test prefixes, and a separate RUL vector for test
endpoints. It does not give participants the simulator health index. A compact
case can therefore compare observable current frames and recorded histories,
but it cannot treat latent degradation as directly measured. The supplied RUL
can explain a result after selection, yet feeding it into the current-frame
metric would leak the outcome.

## Decision

The Operational Aging case and `operational-aging` Model Pack keep five layers
independent:

1. the current frame contains settings and sensor values only;
2. the recorded history contains ordered observed-prefix rows only;
3. history-window means are derived descriptors, not latent health;
4. NASA-provided RUL is a held-out outcome and never a distance input;
5. prediction remains explicitly not evaluated.

The flagship pair is selected by maximizing the provided-RUL difference inside
the nearest five percent of all current-frame pairs. Every surface therefore
labels the result outcome-aware and selection-biased. Declared nearness creates
no exact state identity. Historical Load remains `null`, because FD001 supplies
no finite alternative-history space, admissibility rule, route cost, or
baseline route.

## Consequences

The focused Lab can show that units 25 and 72 rank 78th of 4,950 by their final
frame, have 145 versus 50 supplied RUL cycles, and become less exceptional
under last-20 and full-prefix history descriptors. This supports the bounded
claim that current-frame nearness does not erase recorded operational history.
It does not measure latent damage, evaluate a predictor, establish physical
causation, or generalize beyond FD001's one condition and one fault mode.
