# ADR-0001: Source relation classification policy

Status: template awaiting blind-policy authorship

## Context

Source `ParentCode` edges mix possible generative, constitutive,
intra-closure-support, evidential, descriptive, and regulatory-feedback
semantics. The published architecture already exposes the current SCCs, so its
authors cannot retroactively claim prospective blindness.

## Decision to freeze

Before annotation begins, define for every relation kind:

- positive decision question;
- necessary and sufficient observable fields;
- inclusions, exclusions, and counterexamples;
- conflict/adjudication rule;
- annotator/tool exposure declaration;
- policy version and hash;
- warning thresholds for disagreement and post-unblinding changes.

The policy must not receive SCC membership, cycle visualizations, desired
acyclicity, or the effect of a label on the quotient graph.

## Acceptance artifacts

- frozen policy and hash;
- access-controlled annotation view;
- independent immutable annotations;
- exposure declarations and conflict log;
- linked, non-overwriting post-unblinding amendments;
- complete reconciliation of all source edges.

No actual category decisions are recorded in this template.
