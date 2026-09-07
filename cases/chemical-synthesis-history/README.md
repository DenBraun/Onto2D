# Chemical Synthesis History

Case ID: `chemical-synthesis-history`. [History case registry](../history-case-registry.json).

- [Chemical Synthesis History — use and reproduction](#chemical-synthesis-history--use-and-reproduction)
- [Chemical Synthesis History — source and interpretation](#chemical-synthesis-history--source-and-interpretation)
- [Evidence contract](#evidence-contract)

<a id="chemical-synthesis-history--use-and-reproduction"></a>

## Chemical Synthesis History — use and reproduction

This case freezes two Open Reaction Database (ORD) v0.1.0 datasets and asks a
precise question:

```text
same exact product identifier
    !=
same reaction record or synthesis history
```

It is the first Onto2D case in chemistry. It neither predicts reactions nor
infers mechanisms.

<a id="chemical-synthesis-history--use-and-reproduction--reproduce"></a>

### Reproduce

```sh
npm run case:chemical-synthesis:verify
npm run model:chemical-reactions:verify
```

The normal build is offline. `upstream.json` pins the exact ORD tag, commit,
schema tag, Git LFS object hashes, uncompressed protobuf hashes, dataset IDs,
reaction counts, license, and publication DOIs.

An optional full source audit accepts the two local pinned Git LFS objects and
recomputes selection, source fields, native record hashes, missing values, and
cross-reference multiplicity:

```sh
python3 cases/chemical-synthesis-history/verify_upstream_snapshot.py \
  --ahneman /path/to/ord_dataset-46ff9a32d9e04016b9380b1b1ef949c3.pb.gz \
  --islatravir /path/to/ord_dataset-6a0bfcdf53a64c07987822162ae591e2.pb.gz
```

Use `ord-schema` from the upstream v0.3.10 tag. A compatible 0.3.x decoder is
accepted by the audit command; the source schema identity remains v0.3.10.

<a id="chemical-synthesis-history--use-and-reproduction--two-bounded-cohorts"></a>

### Two bounded cohorts

The Ahneman C–N coupling dataset contains 4,312 records and five exact native
product-SMILES groups. For each group, the committed projection selects the
minimum and maximum measured yield, with reaction ID as the deterministic tie
breaker. This gives ten real ORD records. Each pair shares one exact product
identifier while retaining different reaction IDs and condition profiles.

The islatravir dataset contains three reaction records. Later inputs carry
native `reaction_id` references to earlier records, so the case can represent
recorded material continuity without inferring it from matching compound
strings. The duplicated first cross-reference is preserved, not cleaned up.

<a id="chemical-synthesis-history--use-and-reproduction--identity-profiles"></a>

### Identity profiles

`exact-ord-product-smiles-v1` performs byte-exact source-string comparison and
no structural normalization. It preserves stereochemical syntax exactly but
may under-merge chemically equivalent representations. It is intentionally not
described as canonical molecular identity.

`ord-record-and-condition-profile-v1` retains the ORD record ID, product and
input identifiers, catalyst, base, additive, temperature, time, and workup
sequence. Therefore the same target identifier can coexist with distinct route
fragments without duplicating or corrupting the target node.

<a id="chemical-synthesis-history--use-and-reproduction--historical-load"></a>

### Historical Load

The four-route analysis around the linked islatravir cascade contains one
actual admissible route and three explicitly counterfactual alternatives. The
admissibility rule requires exact ORD reaction records and native cross-record
continuity:

```text
reaction records:        3 - 1 = +2
recorded intermediates:  2 - 0 = +2
```

In plain language, preserving the evidence-backed ORD chain costs two extra
reaction records and exposes two intermediate states compared with the
declared direct shortcut. The shortcut is a graph-analysis device, not a claim
that direct islatravir synthesis is chemically feasible. The result is not an
ORD metric, yield score, safety score, or universal synthesis complexity.

<a id="chemical-synthesis-history--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

- Direct record: native IDs, selected identifiers, conditions, workups,
  outcomes, yield values, DOI provenance, and cross-references.
- Derived: exact-string grouping, route identity, extrema comparison, and
  bounded Historical Load.
- Counterfactual: three declared shortcut or continuity-breaking routes.
- Unknown: equivalence beyond exact strings, unrecorded batch continuity,
  shortcut feasibility, mechanism, safety, and economic cost.

The committed JSON files are bounded native-field projections. Their source
record hashes bind each projection to the deterministic protobuf serialization,
but they are not presented as complete replacements for the ORD protobuf
datasets.

<a id="chemical-synthesis-history--source-and-interpretation"></a>

## Chemical Synthesis History — source and interpretation

<a id="chemical-synthesis-history--source-and-interpretation--purpose"></a>

### Purpose

Create the first non-IT external Onto2D case using real structured chemical reaction records.

Primary distinction:

```text
molecular identity
    !=
synthesis-route identity
```

A target molecule may be reached through different sequences of reactions, reagents, intermediates, conditions, workups, and yields.

<a id="chemical-synthesis-history--source-and-interpretation--implemented-result"></a>

### Implemented Result

The first release is complete and source-locked to ORD data v0.1.0 at commit
`8b83754b865c8a9f30667fbea4dfdc892d4dad60` with the release workflow's
ord-schema v0.3.10 pin.

Two bounded cohorts serve different questions:

- all five exact product-SMILES groups in the 4,312-record Ahneman dataset,
  represented by deterministic minimum/maximum measured-yield records;
- the complete three-record islatravir cascade, whose later inputs contain
  native cross-references to earlier reaction records.

The resulting 13-record projection, case artifact, Model Pack, and light-theme
Explorer reproduce offline. Exact source-string equality is deliberately
stricter than canonical chemical equivalence and never creates physical-batch
continuity. The bounded islatravir analysis resolves Historical Load as +2
reaction records or +2 recorded intermediates relative to a declared direct
shortcut; that shortcut is not a chemical-feasibility claim.

<a id="chemical-synthesis-history--source-and-interpretation--primary-external-source"></a>

### Primary External Source

Open Reaction Database (ORD).

Reference documentation:

```text
https://docs.open-reaction-database.org/en/stable/schema.html
https://docs.open-reaction-database.org/en/stable/overview.html
```

ORD reaction records expose structured fields for inputs, setup, conditions, observations, workups, outcomes, provenance, and reaction identity.

The implementation must pin a concrete ORD data snapshot before extraction.

<a id="chemical-synthesis-history--source-and-interpretation--non-goals"></a>

### Non-goals

Do not initially:

- build a general retrosynthesis engine;
- predict unknown reactions;
- infer reaction mechanisms;
- assign synthetic feasibility from a language model;
- equate recorded reaction order with chemical necessity;
- treat missing ORD data as a failed reaction;
- claim a universal chemical Historical Load.

<a id="chemical-synthesis-history--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot represent one molecular identity with multiple distinct recorded construction histories without duplicating or corrupting the target identity.

<a id="evidence-contract"></a>

## Evidence contract

1. Pin ORD data release v0.1.0 at commit
   `8b83754b865c8a9f30667fbea4dfdc892d4dad60` and the validation workflow's
   ord-schema tag v0.3.10.
2. Bind both selected Git LFS objects by compressed and uncompressed SHA-256,
   dataset ID, reaction count, and publication DOI.
3. Use byte-exact native product SMILES as the first target identity profile.
   Perform no silent canonicalization and state that this may under-merge
   equivalent structures.
4. Use reaction ID plus recorded input, condition, and workup fields for route
   fragment identity. Preserve missing measurements as `null`.
5. Create a physical-material continuity relation only from a native ORD
   `reaction_id` cross-reference. A compound-identifier match remains a
   derived identifier relation.
6. Keep the ten Ahneman extrema records and the three-record islatravir chain
   as actual source evidence. Keep all shortcut routes counterfactual.
7. Resolve Historical Load only in the four-route islatravir analysis space.
   The +2 values describe additional records or intermediate states required
   by the declared evidence rule, not chemical difficulty, yield, safety, or
   feasibility.
