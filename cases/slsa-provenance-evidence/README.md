# SLSA Provenance Evidence

Case ID: `slsa-provenance-evidence`. [History case registry](../history-case-registry.json).

- [SLSA Provenance Evidence — source and interpretation](#slsa-provenance-evidence--source-and-interpretation)

<a id="slsa-provenance-evidence--source-and-interpretation"></a>

## SLSA Provenance Evidence — source and interpretation

<a id="slsa-provenance-evidence--source-and-interpretation--purpose"></a>

### Purpose

Stress-test the epistemic boundary between:

```text
history
claim about history
evidence for the claim
verification of the evidence
```

This case is primarily about epistemology, not Historical Load.

<a id="slsa-provenance-evidence--source-and-interpretation--outputs"></a>

### Outputs

```text
cases/slsa-provenance/
apps/provenance-evidence-lab/
models/slsa-provenance/
cases/slsa-provenance-evidence/README.md
```

<a id="slsa-provenance-evidence--source-and-interpretation--phase-0--frozen-provenance-fixtures"></a>

### Phase 0 — Frozen Provenance Fixtures

Create or pin a bounded set of provenance statements covering:

- valid provenance;
- changed artifact;
- wrong source/material;
- unverifiable signer/issuer where applicable;
- incomplete provenance.

Keep fixtures small and local.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-1--native-record-model"></a>

### Phase 1 — Native Record Model

Represent separately:

```text
subject
subject digest
builder
build type
invocation
materials
provenance statement
attestation envelope
verification result
```

Do not collapse subject identity and provenance statement identity.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-2--epistemic-states"></a>

### Phase 2 — Epistemic States

Initial Onto2D evidence states:

```text
declared
attested
verified
contradicted
inferred
unknown
```

These states apply to evidence/claims, not directly to ontology truth.

For example:

```text
claim: artifact A was built from source S
status: attested
```

is not equivalent to:

```text
relation A <- S is ontologically proven
```

<a id="slsa-provenance-evidence--source-and-interpretation--phase-3--canonical-experiments"></a>

### Phase 3 — Canonical Experiments

<a id="slsa-provenance-evidence--source-and-interpretation--experiment-a--valid-provenance"></a>

#### Experiment A — Valid provenance

Statement and artifact/material identities are mutually consistent.

<a id="slsa-provenance-evidence--source-and-interpretation--experiment-b--artifact-changed-after-provenance"></a>

#### Experiment B — Artifact changed after provenance

Subject digest mismatch.

<a id="slsa-provenance-evidence--source-and-interpretation--experiment-c--different-materialsource"></a>

#### Experiment C — Different material/source

Provenance claims a source different from the selected source artifact.

<a id="slsa-provenance-evidence--source-and-interpretation--experiment-d--unverifiable-attestation"></a>

#### Experiment D — Unverifiable attestation

The claim exists but verification cannot establish the required trust chain.

<a id="slsa-provenance-evidence--source-and-interpretation--experiment-e--partial-evidence"></a>

#### Experiment E — Partial evidence

Some provenance fields are present while others remain unknown.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-4--claimevidence-graph"></a>

### Phase 4 — Claim/Evidence Graph

Represent:

```text
Artifact
   ^
   |
Claim
   ^
   |
Attestation
   ^
   |
Verification Evidence
```

with explicit relation types.

Do not create direct artifact ancestry solely because an attestation says so
unless the active analysis profile explicitly chooses that interpretation.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-5--model-pack"></a>

### Phase 5 — Model Pack

Create:

```text
modelId: slsa-provenance
```

Entities:

- subject artifact;
- source/material artifact;
- builder;
- provenance claim;
- attestation;
- verification result;
- evidence reference.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-6--explorer"></a>

### Phase 6 — Explorer

Views:

1. Artifact
2. Provenance Claim
3. Evidence/Attestation
4. Verification
5. Contradictions
6. Unknowns

A central UI principle:

```text
RELATION
CLAIM
EVIDENCE
STATUS
```

must appear as separate fields.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-7--cross-case-integration"></a>

### Phase 7 — Cross-case Integration

Later compare evidence semantics with:

- live-bootstrap source evidence;
- in-toto signed links;
- Software Heritage archival records.

Do not force a shared evidence schema until common semantics are demonstrated.

<a id="slsa-provenance-evidence--source-and-interpretation--phase-8--negative-tests"></a>

### Phase 8 — Negative Tests

Required:

- attested does not automatically equal verified;
- verified statement does not silently mutate ontology source records;
- digest contradiction is explicit;
- missing evidence returns unknown/unresolved;
- claim identity remains distinct from subject artifact identity;
- analysis profiles cannot rewrite the original provenance statement.

<a id="slsa-provenance-evidence--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot distinguish a relation from a claim about that
relation and from the evidence supporting the claim.

<a id="slsa-provenance-evidence--source-and-interpretation--definition-of-done"></a>

### Definition of Done

The Explorer can show the same provenance claim in multiple epistemic states
without changing the underlying source artifacts or conflating verification
status with ontological truth.
