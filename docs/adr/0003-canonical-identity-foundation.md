# ADR-0003: Canonical identity foundation

Status: proposed implementation baseline; local conformance passed,
cross-platform CI passed; independent review pending

## Context

Every later kernel artifact depends on stable bytes and domain-separated
identity. The implementation needs a safe baseline before graph
canonicalization, scientific quantities, and release serializers are complete.
Environment-dependent defaults, locale sorting, executable object accessors,
and unframed hashes would make this boundary non-reproducible or unsafe.

## Decision

Schema-v1 package inputs use a restricted JSON value domain. Canonical object
keys use deterministic UTF-16 code-unit order; arrays preserve declared order;
negative zero becomes zero; non-finite numbers, invalid Unicode, sparse arrays,
accessors, symbol keys, cycles, non-plain objects, and prototype-sensitive keys
are rejected. Parsing is bounded by versioned depth, entry-count, and string-byte
limits.

The provisional number policy is `rfc8785-compatible-binary64-v1`: finite
binary64 values use the ECMAScript/RFC-8785-compatible shortest JSON form.
Scientific decimal rounding and unit normalization do not delegate to this
policy; they require the later named decimal/unit implementation.

SHA-256 input is framed as a fixed Onto2D prefix, byte length, versioned domain,
separator, and canonical payload. Equal payloads in element, profile, package,
rules, depth-basis, and other domains therefore have different hashes.

The default identity policy is materialized and hashed. Ordinary source IDs,
claims, evidence, timestamps, and derivation records are non-structural.
Ontology coordinates, type tags, normalized invariants, profile hashes, and the
cluster-resolution policy are structural. Cluster identity binds content hashes
of node resolution and condensation instead of annotator/review metadata.
Quantity identity uses normalized value, unit, tolerance, and semantic meaning;
quantity evidence/provenance remains in the normalized package and package hash
but does not change primitive element IDs or profile hashes.

## Consequences

- changing a domain or canonical policy requires a new explicit version;
- locale-dependent comparison is forbidden in identity paths;
- packages with two primitives that normalize to one structural ID fail rather
  than silently deduplicate;
- explicit primitive profiles are required until profile derivation exists;
- package, rules, depth-basis, and identity-policy hashes are distinct;
- full graph isomorphism and unit algebra remain separate conformance gates.

## Acceptance artifacts

- canonical positive, negative, and domain-separation tests;
- input-order package identity tests;
- hash goldens from an independently reviewed implementation;
- cross-platform Node.js execution;
- schema/type parity checks;
- review of binary64 edge cases and Unicode ordering.

This ADR must not be marked accepted until those checks execute successfully.

The independent restricted canonical-JSON/domain-frame generator and its
committed positive goldens are now present. Their deterministic regeneration
and JavaScript comparison pass in the supported Node.js 22 and 24 CI matrix.
Every finite RFC
8785 Appendix B vector, non-finite rejection, UTF-16 key ordering, Unicode
preservation, and invalid-surrogate rejection now have direct fixtures.
Independent review remains pending; the ADR status therefore does not change.
