# ADR 0116: Preserve manuscript contamination outside tree parentage

Date: 2026-08-18

Status: Accepted

## Context

A collation records readings, while a stemmatic analysis interprets their
historical transmission. Shared readings do not by themselves identify a copy
direction. The selected Miller's Tale analysis also describes Cx2 as produced
from a copy of Cx1 corrected against a second, better exemplar whose exact
physical identity is unresolved. A single-parent tree cannot preserve this
claim without dropping or misclassifying one input.

## Decision

The Manuscript Stemmatics case and `manuscript-transmission` Model Pack keep
four independent layers:

1. selected NEXUS readings remain source-projected collation records;
2. exact selected-site agreement remains a selection-biased derived result
   that creates neither copying nor ancestry;
3. copying and base-text relations remain attributed published-analysis
   relations, never direct observations;
4. the better-copy correction source remains an attributed-contamination
   relation with `treeCompatible = false`.

The better copy is represented as an unresolved exemplar reference with no
invented shelfmark, extant witness identity, or exact identifier. Evidence
ablation partitions relations into supported, attributed-only, and withheld
sets without mutating the source claims. Historical Load remains `null` because
no finite reconstruction space, admissibility rule, route cost, or baseline is
declared.

## Consequences

Model Studio and the focused Explorer can query and draw Cx2's two inputs
without turning contamination into an ordinary tree edge. Removing supporting
evidence can weaken or withhold the bounded reconstruction, but it cannot
rewrite the published source. The release demonstrates a partial, attributed
history and does not claim to recover the actual past or resolve the central
rooting of the complete tradition.
