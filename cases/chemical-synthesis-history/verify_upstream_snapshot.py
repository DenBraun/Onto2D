#!/usr/bin/env python3
"""Verify the committed bounded projections against local ORD v0.1.0 protobufs.

This optional source-audit command is deliberately outside the normal offline
Node.js build. Install ord-schema from the pinned v0.3.10 tag, download the two
exact Git LFS objects named in upstream.json, and pass their local paths.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from typing import Any

from ord_schema.proto import dataset_pb2, reaction_pb2

CASE_ROOT = Path(__file__).resolve().parent
SMILES = reaction_pb2.CompoundIdentifier.SMILES
NAME = reaction_pb2.CompoundIdentifier.NAME


def fail(message: str) -> None:
    raise RuntimeError(f"Chemical Synthesis History upstream verification failed: {message}")


def read_json(relative: str) -> dict[str, Any]:
    return json.loads((CASE_ROOT / relative).read_text(encoding="utf-8"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def enum_name(message: Any, field: str, value: int) -> str:
    return message.DESCRIPTOR.fields_by_name[field].enum_type.values_by_number[value].name


def identifier(compound: Any, kind: int) -> str | None:
    return next((item.value for item in compound.identifiers if item.type == kind), None)


def product_smiles(reaction: Any) -> str | None:
    return next((identifier(product, SMILES) for outcome in reaction.outcomes for product in outcome.products if identifier(product, SMILES)), None)


def measured_yield(reaction: Any) -> float | None:
    return next((measurement.percentage.value for outcome in reaction.outcomes for product in outcome.products for measurement in product.measurements if measurement.type == reaction_pb2.ProductMeasurement.YIELD and measurement.HasField("percentage")), None)


def selected_input(reaction: Any, key: str) -> dict[str, Any]:
    components = reaction.inputs[key].components if key in reaction.inputs else []
    compound = next((entry for entry in components if enum_name(entry, "reaction_role", entry.reaction_role) != "SOLVENT"), components[0] if components else None)
    if compound is None:
        fail(f"{reaction.reaction_id} has no {key} component")
    return {
        "name": identifier(compound, NAME),
        "smiles": identifier(compound, SMILES),
        "nativeRole": enum_name(compound, "reaction_role", compound.reaction_role),
    }


def load_dataset(path: Path, expected: dict[str, Any]) -> Any:
    compressed = path.read_bytes()
    if digest(compressed) != expected["sha256"]:
        fail(f"{path} compressed SHA-256 differs from upstream.json")
    protobuf = gzip.decompress(compressed)
    if digest(protobuf) != expected["protobufSha256"] or len(protobuf) != expected["protobufBytes"]:
        fail(f"{path} uncompressed protobuf identity differs from upstream.json")
    dataset = dataset_pb2.Dataset()
    dataset.ParseFromString(protobuf)
    if dataset.dataset_id != expected["datasetId"] or len(dataset.reactions) != expected["reactionCount"]:
        fail(f"{path} dataset ID or reaction count differs from upstream.json")
    return dataset


def verify_ahneman(dataset: Any, fixture: dict[str, Any]) -> None:
    groups: dict[str, list[Any]] = {}
    for reaction in dataset.reactions:
        product = product_smiles(reaction)
        if product is not None and measured_yield(reaction) is not None:
            groups.setdefault(product, []).append(reaction)
    if sorted(groups) != [target["productIdentifier"]["value"] for target in fixture["targets"]]:
        fail("Ahneman product cohort differs from the committed exact-string selection")
    input_keys = {"arylHalide": "aryl halide", "amine": "toluidine", "catalyst": "catalyst", "base": "base", "additive": "additive"}
    for target in fixture["targets"]:
        reactions = groups[target["productIdentifier"]["value"]]
        if len(reactions) != target["sourceCohortSize"]:
            fail(f"{target['id']} source cohort size differs")
        selected = [min(reactions, key=lambda item: (measured_yield(item), item.reaction_id)), max(reactions, key=lambda item: (measured_yield(item), item.reaction_id))]
        for native, projected in zip(selected, target["routes"]):
            if native.reaction_id != projected["reactionId"]:
                fail(f"{target['id']} extrema selection differs")
            native_hash = f"sha256:{digest(native.SerializeToString(deterministic=True))}"
            if native_hash != projected["nativeRecordSha256"]:
                fail(f"{native.reaction_id} deterministic protobuf hash differs")
            if measured_yield(native) != projected["outcome"]["yield"]["value"] or product_smiles(native) != projected["outcome"]["productSmiles"]:
                fail(f"{native.reaction_id} product or yield projection differs")
            for projected_key, native_key in input_keys.items():
                if selected_input(native, native_key) != projected["inputs"][projected_key]:
                    fail(f"{native.reaction_id} {native_key} projection differs")
            temperature = native.conditions.temperature.setpoint
            actual_temperature = {"value": temperature.value, "unit": enum_name(temperature, "units", temperature.units)}
            outcome_time = native.outcomes[0].reaction_time
            actual_time = {"value": outcome_time.value, "unit": enum_name(outcome_time, "units", outcome_time.units)}
            if actual_temperature != projected["conditions"]["temperature"] or actual_time != projected["conditions"]["reactionTime"]:
                fail(f"{native.reaction_id} condition projection differs")
            workups = [enum_name(workup, "type", workup.type) for workup in native.workups]
            if workups != projected["workups"] or native.provenance.doi != projected["provenance"]["doi"]:
                fail(f"{native.reaction_id} workup or provenance projection differs")


def native_cross_references(reaction: Any) -> list[str]:
    return [component.reaction_id for reaction_input in reaction.inputs.values() for component in reaction_input.crude_components]


def desired_product(reaction: Any) -> Any:
    return next((product for outcome in reaction.outcomes for product in outcome.products if product.is_desired_product), None)


def outcome_projection(outcome: Any) -> dict[str, Any]:
    yield_value = next((measurement.percentage.value for product in outcome.products for measurement in product.measurements if measurement.type == reaction_pb2.ProductMeasurement.YIELD and measurement.HasField("percentage")), None)
    selectivity = next((measurement.percentage.value for product in outcome.products for measurement in product.measurements if measurement.type == reaction_pb2.ProductMeasurement.SELECTIVITY and measurement.HasField("percentage")), None)
    return {
        "time": {"value": outcome.reaction_time.value, "unit": enum_name(outcome.reaction_time, "units", outcome.reaction_time.units)},
        "conversionPercentage": outcome.conversion.value if outcome.HasField("conversion") else None,
        "yieldPercentage": yield_value,
        "selectivityPercentage": selectivity,
    }


def verify_islatravir(dataset: Any, fixture: dict[str, Any]) -> None:
    if [reaction.reaction_id for reaction in dataset.reactions] != [record["reactionId"] for record in fixture["records"]]:
        fail("islatravir reaction order differs")
    for native, projected in zip(dataset.reactions, fixture["records"]):
        native_hash = f"sha256:{digest(native.SerializeToString(deterministic=True))}"
        if native_hash != projected["nativeRecordSha256"]:
            fail(f"{native.reaction_id} deterministic protobuf hash differs")
        if native_cross_references(native) != projected["crossReferencedReactionIds"]:
            fail(f"{native.reaction_id} cross-reference multiplicity differs")
        product = desired_product(native)
        if product is None or identifier(product, SMILES) != projected["desiredProduct"]["smiles"]:
            fail(f"{native.reaction_id} desired product differs")
        if [outcome_projection(outcome) for outcome in native.outcomes] != projected["outcomes"]:
            fail(f"{native.reaction_id} outcome projection differs")
        workups = [enum_name(workup, "type", workup.type) for workup in native.workups]
        if workups != projected["workups"] or native.provenance.doi != projected["provenance"]["doi"]:
            fail(f"{native.reaction_id} workup or provenance projection differs")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ahneman", required=True, type=Path, help="local pinned Ahneman .pb.gz")
    parser.add_argument("--islatravir", required=True, type=Path, help="local pinned islatravir .pb.gz")
    args = parser.parse_args()
    installed = version("ord-schema")
    if not installed.startswith("0.3."):
        fail(f"ord-schema 0.3.x decoder required; found {installed}")
    upstream = read_json("upstream.json")
    source_by_role = {entry["role"]: entry for entry in upstream["datasets"]}
    ahneman = load_dataset(args.ahneman, source_by_role["same-target-condition-sweep"])
    islatravir = load_dataset(args.islatravir, source_by_role["cross-referenced-cascade"])
    verify_ahneman(ahneman, read_json("fixtures/ahneman-condition-sweep.json"))
    verify_islatravir(islatravir, read_json("fixtures/islatravir-cascade.json"))
    print(f"Verified ORD {upstream['source']['release']} projections with ord-schema {installed}: 10 Ahneman extrema records and 3 islatravir cascade records.")


if __name__ == "__main__":
    main()
