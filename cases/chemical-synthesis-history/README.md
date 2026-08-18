# Chemical Synthesis History case

This case freezes two Open Reaction Database (ORD) v0.1.0 datasets and asks a
precise question:

```text
same exact product identifier
    !=
same reaction record or synthesis history
```

It is the first Onto2D case in chemistry. It neither predicts reactions nor
infers mechanisms.

## Reproduce

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

## Two bounded cohorts

The Ahneman C–N coupling dataset contains 4,312 records and five exact native
product-SMILES groups. For each group, the committed projection selects the
minimum and maximum measured yield, with reaction ID as the deterministic tie
breaker. This gives ten real ORD records. Each pair shares one exact product
identifier while retaining different reaction IDs and condition profiles.

The islatravir dataset contains three reaction records. Later inputs carry
native `reaction_id` references to earlier records, so the case can represent
recorded material continuity without inferring it from matching compound
strings. The duplicated first cross-reference is preserved, not cleaned up.

## Identity profiles

`exact-ord-product-smiles-v1` performs byte-exact source-string comparison and
no structural normalization. It preserves stereochemical syntax exactly but
may under-merge chemically equivalent representations. It is intentionally not
described as canonical molecular identity.

`ord-record-and-condition-profile-v1` retains the ORD record ID, product and
input identifiers, catalyst, base, additive, temperature, time, and workup
sequence. Therefore the same target identifier can coexist with distinct route
fragments without duplicating or corrupting the target node.

## Historical Load

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

## Evidence boundary

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
