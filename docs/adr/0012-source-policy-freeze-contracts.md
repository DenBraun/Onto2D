# ADR-0012: Source policy freeze contracts

Status: accepted and implemented for policy artifacts only

## Context

Stage D3 requires relation-classification and node-resolution policies to be
complete, reviewable, and content-addressed before catalogue migration. The
current authors have already seen SCC-aware audit material, so code must not
turn a template into a supposedly prospective-blind scientific decision.
Conversely, leaving the freeze format entirely informal would allow policy
fields, forbidden inputs, or warning thresholds to change without changing a
machine-verifiable identity.

ADR-0001 and ADR-0002 still await domain-expert authorship. This ADR defines
how an authored policy is validated and frozen; it does not supply its
scientific category or cluster decisions.

## Decision

The kernel exposes two closed, deterministic artifact constructors:

- `freezeSourceClassificationPolicy`, versioned as
  `source-classification-policy-v1` and hashed in
  `onto2d:source-classification-policy:v1`;
- `freezeSourceNodeResolutionPolicy`, versioned as
  `source-node-resolution-policy-v1` and hashed in
  `onto2d:source-node-resolution-policy:v1`.

The classification contract requires all six relation kinds. Each kind has a
decision question, necessary and sufficient observations, inclusions,
exclusions, and counterexamples. The artifact also contains the conflict rule,
classification-visible fields, a complete forbidden-input vocabulary, and the
three migration-risk thresholds from the architecture.

The authorship and exposure declarations are cross-checked:

- `human-independent` requires at least two classifiers;
- `prospective-blind` requires independent human authorship and a negative
  declaration of pre-freeze SCC-aware exposure;
- `deterministic-precommitted` requires a frozen classifier ID and version and
  a negative declaration of pre-freeze SCC-aware exposure;
- `historically-exposed` requires an explicit positive exposure declaration
  and cannot be represented as prospective blind.

The exact forbidden classification inputs are SCC membership, cycle
visualization, desired topology, and the effect on quotient acyclicity. None
may occur in the visible-field set. Visible fields use a closed, versioned
local-field vocabulary and must include `source` and `target`; undeclared
aliases such as `sccMembership` are rejected. Human policy minima are bounded
from two through the executable annotation ceiling of 100 classifiers, so a
successfully frozen policy is not impossible to instantiate.

The node-resolution contract binds the classification policy hash and requires
classified relations, source endpoints, and SCC membership as post-
classification inputs. It covers all four dispositions with general criteria
and positive/negative examples. Cycle-removal outcome, desired acyclicity,
component size alone, and resemblance to the foundational paper alone are
frozen as forbidden criteria.

Every resolution policy fixes three additional invariants:

- each raw relation is preserved and reconciled exactly once as inter-cluster,
  internal, or typed explanation;
- cluster internal order is `undefined`, and members inherit cluster depth;
- the condensation quotient is required to be a DAG.

Set-valued arrays are deduplicated and sorted before hashing. Authored text is
preserved but must already be normalized and non-empty. The policy hash covers
the schema version, freezer version, and every normalized semantic field; it
does not cover itself.

## Consequences

The executable boundary can now reject incomplete policies, topology-driven
resolution criteria, false blindness claims, weakened edge reconciliation,
and policy drift before any catalogue annotation is accepted. Frozen policy
artifacts have JSON Schema and TypeScript contracts and are available through
the public kernel capability manifest.

This implementation does not classify a source relation, adjudicate an
annotation, resolve an SCC, create a cluster, or load `sourceMigration`.
ADR-0001 and ADR-0002 remain pending until reviewed scientific policy content
is authored. The loader remains closed to migration artifacts until complete
node/edge reconciliation and condensation validation are implemented.

The downstream freezing of caller-supplied annotation and adjudication records
is specified separately by
[ADR-0013](0013-source-classification-annotation-artifacts.md).

## Verification

Tests cover canonical set ordering, domain-separated hash reproduction,
immutability, complete relation/disposition vocabularies, exposure coherence,
risk bounds, required post-classification inputs, forbidden topology criteria,
and fixed reconciliation/cluster semantics.
