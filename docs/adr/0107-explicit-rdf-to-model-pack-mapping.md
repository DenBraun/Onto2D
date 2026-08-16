# ADR 0107: Explicit RDF-to-Model-Pack mapping

- Status: accepted
- Date: 2026-08-16

## Context

RDF import preserves syntax and graph identity. SHACL validation establishes
structural conformance to one declared shapes graph. Neither operation can
decide that an RDF class is an Onto2D type role, that a predicate is a model
relation, that a record belongs at a particular level, or that omitted source
facts are harmless. Putting those decisions into the importer or validator
would make reusable infrastructure an undeclared semantic authority.

The first mapping also needs a public, replayable case. The non-normative W3C
SHACL Person and Company example supplies familiar classes and a directed
`worksFor` predicate, but its published data is intentionally invalid and its
full shapes use constraints outside the current closed Onto2D SHACL profile.

## Decision

Add a browser-safe `@onto2d/rdf-mapping` package with profile
`rdf-to-model-pack-explicit-v1`. It accepts two verified RDF imports, an exact
replayable SHACL report with `conforms: true`, and a canonical mapping policy
bound to the data and shapes source IDs, their import hashes, and the report
hash. Keeping source IDs in the policy is required because they participate in
exact import identity; replay from raw files must not depend on hidden caller
configuration.

The policy must contain source title, stable URI, version, license URI, and an
adaptation notice. It selects nodes only through one directly asserted mapped
`rdf:type`. Nodes keep their source IRIs. One constant non-negative level and
its meaning are declared globally. Class rules assign `typeRole` and
`scientificStatus`. Predicate rules may supply one xsd:string label, a directed
edge with explicit source and target classes, layer, and role, or an ignored
disposition with a reason.

Every mapped class and every label or edge predicate must have active coverage
in the exact compiled SHACL plan. Every data statement must then receive
exactly one `node-type`, `node-label`, `edge`, or `ignored` disposition. Unknown
statements, ambiguous classes or labels, blank-node entities, unmapped edge
endpoints, non-conforming reports, input drift, and unsupported policy fields
fail without a partial artifact.

The mapping artifact preserves complete statement accounting and exact source
term and statement identities. Its Model Pack projection uses the RDF source
hashes, places `mappingHash` in `source.auditHash`, and embeds the complete
policy and mapping audit in dictionaries. Verification replays the mapping and
normal Model Pack construction.

Add `cases/rdf-mapping-reference` as a derived, conforming teaching fixture
from the W3C example. Record the stable Recommendation URL, license, changes,
and non-endorsement notice. SSN statements are explicitly omitted from the
structural pack and remain in the audit. Level 0 means only a flat source layer;
it is not kernel Level 0, Historical Load zero, or a formation claim.

## Consequences

- RDF parsing, structural validation, semantic mapping, and Model Pack
  verification remain separate replayable boundaries.
- Mapping policy and source provenance affect identity; documentation cannot
  silently change their meaning without new hashes.
- Complete accounting makes loss visible, including reviewed omissions.
- The first profile deliberately does not support subclass-selected entities,
  blank-node entities, language negotiation, multiple labels, inferred edges,
  attribute projection, OWL, or automatic ontology alignment.
- The public case proves the deterministic engineering path. A real domain
  mapping still requires independent source and policy review.
