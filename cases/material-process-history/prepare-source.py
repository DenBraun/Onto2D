#!/usr/bin/env python3
"""Build the bounded AMB2022-01 material-process source projection."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


FORMAT = "onto2d-ambench-material-process-projection"
PROFILE = "ambench-2022-01-material-process-projection-v1"
BUILD_IDS = ("AMB2022-718-AMMT-B6", "AMB2022-718-AMMT-B7", "AMB2022-718-AMMT-B8")
XML_HASHES = {
    "AMB2022-718-AMMT-B6.xml": "cbc2faa0babff3b2c1d9f71aea1656d12c290bcee782f192d81e563dae3f1a29",
    "AMB2022-718-AMMT-B7.xml": "0d9873810da15a9cc3e671a0cc0a998c633336243093b5ec39d062cb19b2e85e",
    "AMB2022-718-AMMT-B8.xml": "67b5bc5744ace15a7577a0eefb88a43a0ba58aab129fdcd59414a943290465f9",
    "AMB2022-718-AMMT-B6_PBF-LB.xml": "c70e2bd3cf4339ee6f16b9377832e4c9af9332e383e60e1689041ab8bb199acc",
    "AMB2022-718-AMMT-B7_PBF-LB.xml": "87e195be1a3329c32e8a562ee255c7baa75468be149765514bbab442d87e3c29",
    "AMB2022-718-AMMT-B8_PBF-LB.xml": "d895acd294cbd47a2c65b81fd00484941cad6059acf7d911a9cc6e4c7eb84a23",
    "AMB2022-718-AMMT-B6-P3.xml": "7cc9678d646711ce1660f066805fa761344faa1aa2c1cd1bb2fa6d3340a47dab",
    "AMB2022-718-AMMT-B7-P3.xml": "7cde610476466d9a3ed626cdc57a8e58d83809334e5c3609030b2e679eb17583",
    "AMB2022-718-AMMT-B8-P3.xml": "0cb1833ed3007c380b838d23fc68bf680803d2e73f229663080dbdb78c4af222",
    "AMB2022_Thermography_718-AMMT-B6-P1-StaringCamera_Signal.xml": "394de63734d8ac8b481955059582878a7888b81e7f52327b0c180c03907e3dca",
    "AMB2022_Thermography_718-AMMT-B7-P1-StaringCamera_Signal.xml": "7051b6105c8e4f56da6e51e80d82c477b01a4d0ff6c425303973382c21b09d93",
    "AMB2022_Thermography_718-AMMT-B8-P1-StaringCamera_Signal.xml": "84eec147e22a2e27110a9fe39888cec9ff873cd012f2db7bab9037344d55878d",
}
RESULT_HASH = "ce098ee2303a93ca2e66b769d81d60f9e31287689164bb9d6b4bcccd18e5e855"
PDF_HASH = "57f5ff84f22eecc30e8caceaa2a341e74375072305dd0ff010c68c4f506ad0d3"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked(path: Path, expected: str) -> Path:
    actual = sha256(path)
    if actual != expected:
        raise ValueError(f"{path.name} hash {actual} does not match the pinned source")
    return path


def required_text(parent: ET.Element, query: str) -> str:
    value = parent.findtext(query)
    if value is None or not value.strip():
        raise ValueError(f"missing XML value {query}")
    return value.strip()


def optional_text(parent: ET.Element, query: str) -> str | None:
    value = parent.findtext(query)
    return value.strip() if value and value.strip() else None


def quantity(parent: ET.Element, query: str) -> dict[str, float | str]:
    node = parent.find(query)
    if node is None:
        raise ValueError(f"missing XML quantity {query}")
    return {
        "value": float(required_text(node, "value")),
        "unit": required_text(node, "unit"),
    }


def field_map(parent: ET.Element) -> dict[str, ET.Element]:
    result: dict[str, ET.Element] = {}
    for field in parent.findall(".//field"):
        name = field.findtext("name")
        if name:
            if name in result:
                raise ValueError(f"duplicate thermography field {name}")
            result[name] = field
    return result


def field_value(fields: dict[str, ET.Element], name: str) -> float | str:
    field = fields.get(name)
    if field is None:
        raise ValueError(f"missing thermography field {name}")
    raw = field.findtext("quantity/value") or field.findtext("value")
    if raw is None:
        raise ValueError(f"missing value for thermography field {name}")
    raw = raw.strip()
    try:
        return float(raw)
    except ValueError:
        return raw


def field_quantity(fields: dict[str, ET.Element], name: str) -> dict[str, float | str]:
    field = fields.get(name)
    if field is None:
        raise ValueError(f"missing thermography field {name}")
    return {
        "value": float(required_text(field, "quantity/value")),
        "unit": required_text(field, "quantity/unit"),
    }


def parse_build(path: Path, build_id: str) -> dict[str, object]:
    root = ET.parse(path).getroot()
    node = root.find("AMBuild")
    if node is None or required_text(node, "name") != build_id:
        raise ValueError(f"{path.name} does not contain {build_id}")
    component_ids = [required_text(item, "name").removesuffix("_Component") for item in node.findall("component")]
    if component_ids != [f"{build_id}-P{index}" for index in range(1, 5)] + [f"{build_id}-G1", f"{build_id}-G2"]:
        raise ValueError(f"{build_id} component inventory differs")
    return {
        "id": build_id,
        "pid": required_text(root, "pid"),
        "recordedCreationDate": required_text(node, "creationDate"),
        "materialClass": required_text(node, "materialInfo/materialClass"),
        "benchmarkId": required_text(node, "AMBenchmarkID"),
        "status": required_text(node, "status"),
        "purpose": required_text(node, "purpose"),
        "componentIds": component_ids,
    }


def parse_process(path: Path, build_id: str) -> dict[str, object]:
    root = ET.parse(path).getroot()
    node = root.find("PBFLBAMBuildProcess")
    process_id = f"{build_id}_PBF-LB"
    if node is None or required_text(node, "name") != process_id:
        raise ValueError(f"{path.name} does not contain {process_id}")
    p3_process = None
    for component in node.findall("componentProcess"):
        if component.findtext("componentProcessOutput/productID") == f"{build_id}-P3_Component":
            p3_process = component
            break
    if p3_process is None:
        raise ValueError(f"{process_id} has no P3 process")
    laser = p3_process.find("buildParameters/laser")
    solid = p3_process.find("buildParameters/solidLayers")
    scan = p3_process.find("buildParameters/scanGeometry")
    if laser is None or solid is None or scan is None:
        raise ValueError(f"{process_id} P3 recipe is incomplete")
    recipe = {
        "processType": required_text(node, "buildProcessInfo/buildProcessType"),
        "facility": required_text(node, "facility"),
        "machine": required_text(node, "buildMachineConfiguration/buildMachine/name"),
        "feedstockId": required_text(node, "feedstock/feedstockID"),
        "feedstockCondition": required_text(node, "feedstock/condition"),
        "materialClass": required_text(node, "feedstock/materialInfo/materialClass"),
        "substrateTemperature": quantity(node, "buildProcessSubstrate/substrateTemperature"),
        "atmosphere": required_text(node, "buildEnvironment/buildAtmosphere/atmosphereComposition"),
        "oxygenContentLimit": quantity(node, "buildEnvironment/buildAtmosphere/oxygenContentLimit"),
        "buildChamberPressure": quantity(node, "buildEnvironment/buildAtmosphere/buildChamberPressure"),
        "gasFlowDirection": required_text(node, "buildEnvironment/gasFlowConfiguration/gasFlowDirection"),
        "gasFlowSpeed": quantity(node, "buildEnvironment/gasFlowConfiguration/gasFlowSpeed"),
        "recoatingDirection": required_text(node, "buildEnvironment/recoatingSystem/recoatingDirection"),
        "recoatingSpeed": quantity(node, "buildEnvironment/recoatingSystem/recoatingSpeed"),
        "nominalLaserPower": quantity(laser, "nominalBuildLaserPower"),
        "nominalScanSpeed": quantity(laser, "nominalScanSpeed"),
        "beamSpotSize": quantity(laser, "beamSpotSize"),
        "nominalLayerThickness": quantity(solid, "nominalSolidLayerThickness"),
        "totalLayers": int(required_text(solid, "totalNumberLayers")),
        "hatchSpacing": quantity(scan, "hatchSpacing"),
        "scanDataUrl": required_text(scan, "scanDataFile/accessURL"),
    }
    return {
        "id": process_id,
        "pid": required_text(root, "pid"),
        "recordedStartDate": required_text(node, "startDate"),
        "recordedCompleteDate": required_text(node, "completeDate"),
        "challengeIds": [item.text.strip() for item in node.findall("challengeID") if item.text],
        "outputBuildId": required_text(node, "buildProcessOutput/productID"),
        "p3ComponentProcessId": required_text(p3_process, "name"),
        "recipe": recipe,
    }


def parse_part(path: Path, build_id: str) -> dict[str, object]:
    root = ET.parse(path).getroot()
    node = root.find("AMBuildPart")
    part_id = f"{build_id}-P3"
    if node is None or required_text(node, "name") != part_id:
        raise ValueError(f"{path.name} does not contain {part_id}")
    return {
        "id": part_id,
        "pid": required_text(root, "pid"),
        "componentId": required_text(node, "componentID"),
        "parentPid": required_text(node, "parent/parentPID"),
        "recordedCreationDate": required_text(node, "creationDate"),
        "materialClass": required_text(node, "materialInfo/materialClass"),
        "purpose": required_text(node, "purpose"),
        "condition": optional_text(node, "condition"),
    }


def parse_thermography(path: Path, build_id: str) -> dict[str, object]:
    root = ET.parse(path).getroot()
    node = root.find("AMThermography")
    expected_id = f"AMB2022_Thermography_718-AMMT-{build_id[-2:]}-P1-StaringCamera_Signal"
    if node is None or required_text(node, "name") != expected_id:
        raise ValueError(f"{path.name} does not contain {expected_id}")
    fields = field_map(node)
    return {
        "id": expected_id,
        "pid": required_text(root, "pid"),
        "buildProcessId": required_text(node, "buildProcessID"),
        "componentProcessId": required_text(node, "componentProcessID"),
        "recordedStartDate": required_text(node, "startDate"),
        "recordedCompleteDate": required_text(node, "completeDate"),
        "technique": "staring-camera thermography",
        "instrumentModel": required_text(node, "measurementMethod/instrumentConfiguration/instrument/model"),
        "frameRate": field_quantity(fields, "Frame_rate"),
        "bitDepth": int(field_value(fields, "Bit_depth")),
        "shutterSpeed": field_quantity(fields, "Shutter_speed"),
        "imageWidthPixels": int(field_value(fields, "Image_width")),
        "imageHeightPixels": int(field_value(fields, "Image_height")),
        "pixelScaleX": field_quantity(fields, "Pixel_scaleX"),
        "pixelScaleY": field_quantity(fields, "Pixel_scaleY"),
        "tam": {
            "filename": str(field_value(fields, "TAM_filename")),
            "dataDoi": required_text(fields["TAM_data"], "digitalArtifact/DOI"),
            "emissivity": float(field_value(fields, "TAM_emissivity")),
            "thresholdTemperature": field_quantity(fields, "TAM_threshold_temperature"),
        },
        "solidCoolingRate": {
            "filename": str(field_value(fields, "SCR_filename")),
            "dataDoi": required_text(fields["SCR_data"], "digitalArtifact/DOI"),
            "unit": str(field_value(fields, "SCR_data_units")),
            "emissivity": float(field_value(fields, "SCR_emissivity")),
            "solidusTemperature": field_quantity(fields, "SCR_Tsolidus"),
            "temperatureInterval": field_quantity(fields, "SCR_DeltaT"),
        },
    }


def round_number(value: float) -> float:
    return round(value, 9)


def strain_summary(points: list[dict[str, float]]) -> dict[str, object]:
    by_height: dict[float, list[dict[str, float]]] = defaultdict(list)
    for point in points:
        by_height[point["zMm"]].append(point)

    def component(name: str) -> dict[str, object]:
        minimum = min(points, key=lambda point: point[name])
        maximum = max(points, key=lambda point: point[name])
        values = [point[name] for point in points]
        return {
            "minimum": {"value": minimum[name], "xMm": minimum["xMm"], "yMm": minimum["yMm"], "zMm": minimum["zMm"]},
            "maximum": {"value": maximum[name], "xMm": maximum["xMm"], "yMm": maximum["yMm"], "zMm": maximum["zMm"]},
            "mean": round_number(sum(values) / len(values)),
            "meanAbsolute": round_number(sum(abs(value) for value in values) / len(values)),
        }

    slices = []
    for height, selected in sorted(by_height.items()):
        slices.append({
            "zMm": height,
            "pointCount": len(selected),
            "meanXX": round_number(sum(point["xxStrain"] for point in selected) / len(selected)),
            "meanZZ": round_number(sum(point["zzStrain"] for point in selected) / len(selected)),
        })
    return {
        "pointCount": len(points),
        "uniqueXCount": len({point["xMm"] for point in points}),
        "uniqueYCount": len({point["yMm"] for point in points}),
        "uniqueZCount": len(by_height),
        "xx": component("xxStrain"),
        "zz": component("zzStrain"),
        "heightSlices": slices,
    }


def parse_strain(path: Path) -> list[dict[str, float]]:
    points = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter="\t")
        if reader.fieldnames != ["X pos (mm)", "Y pos (mm)", "Z pos (mm)", "XX Strain", "ZZ Strain"]:
            raise ValueError("residual-strain columns differ")
        for row_number, row in enumerate(reader, start=2):
            values = [float(row[name]) for name in reader.fieldnames]
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f"non-finite residual-strain value at line {row_number}")
            points.append({
                "sourceRow": row_number,
                "xMm": values[0],
                "yMm": values[1],
                "zMm": values[2],
                "xxStrain": values[3],
                "zzStrain": values[4],
            })
    if len(points) != 2248 or any(point["yMm"] != 2.5 for point in points):
        raise ValueError("residual-strain point inventory or mid-plane differs")
    if len({(point["xMm"], point["yMm"], point["zMm"]) for point in points}) != len(points):
        raise ValueError("residual-strain coordinates repeat")
    return points


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("metadata_xml_root", type=Path)
    parser.add_argument("residual_strain_txt", type=Path)
    parser.add_argument("measurement_description_pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    input_files = []
    for name, digest in XML_HASHES.items():
        path = checked(args.metadata_xml_root / name, digest)
        input_files.append({"path": f"xml/{name}", "sha256": digest, "bytes": path.stat().st_size})
    checked(args.residual_strain_txt, RESULT_HASH)
    checked(args.measurement_description_pdf, PDF_HASH)
    input_files.extend([
        {"path": "mds2-2711/AMB2022_EDD_results_V2.txt", "sha256": RESULT_HASH, "bytes": args.residual_strain_txt.stat().st_size},
        {"path": "mds2-2711/AMB2022-01-RS-PD measurement results_v1.1.pdf", "sha256": PDF_HASH, "bytes": args.measurement_description_pdf.stat().st_size},
    ])

    builds = []
    recipes = []
    for build_id in BUILD_IDS:
        short = build_id[-2:]
        build = parse_build(args.metadata_xml_root / f"{build_id}.xml", build_id)
        process = parse_process(args.metadata_xml_root / f"{build_id}_PBF-LB.xml", build_id)
        if process["outputBuildId"] != build_id:
            raise ValueError(f"{build_id} process output differs")
        part = parse_part(args.metadata_xml_root / f"{build_id}-P3.xml", build_id)
        if part["parentPid"] != build["pid"]:
            raise ValueError(f"{build_id}-P3 parent link differs")
        thermography = parse_thermography(
            args.metadata_xml_root / f"AMB2022_Thermography_718-AMMT-{short}-P1-StaringCamera_Signal.xml",
            build_id,
        )
        if thermography["buildProcessId"] != process["id"]:
            raise ValueError(f"{build_id} thermography process link differs")
        recipes.append(process["recipe"])
        builds.append({**build, "process": process, "comparisonPart": part, "thermography": thermography})
    if any(recipe != recipes[0] for recipe in recipes[1:]):
        raise ValueError("the three selected P3 nominal recipes are not byte-equivalent projections")

    points = parse_strain(args.residual_strain_txt)
    projection = {
        "format": FORMAT,
        "formatVersion": "1",
        "profileVersion": PROFILE,
        "source": {
            "name": "NIST Additive Manufacturing Benchmark 2022",
            "publisher": "National Institute of Standards and Technology",
            "benchmarkId": "AMB2022-01",
            "challengeIds": ["CHAL-AMB2022-01-TAM", "CHAL-AMB2022-01-SCR", "CHAL-AMB2022-01-RS"],
            "challengeDescriptionDoi": "10.18434/mds2-2607",
            "measurementResultsDoi": "10.18434/mds2-2711",
            "measurementResultsVersion": "1.1.1",
            "metadataRelease": "3.0.0",
            "metadataReleaseDate": "2026-05-05",
            "metadataRepositoryCommit": "77adb06c6de95b9b97e1dd26d46561f29db927af",
            "metadataArchiveSha256": "0e2f673d6be7b700a9e14e461fab78a6372b9472ba230ff22c638dadee822d8c",
            "license": "NIST Public Data License",
            "licenseUrl": "https://www.nist.gov/open/license",
        },
        "selection": {
            "buildIds": list(BUILD_IDS),
            "comparisonPartSuffix": "P3",
            "thermographyPartSuffix": "P1",
            "residualStrainTarget": "AMB2022-718-AMMT-B7-P3",
            "rule": "Retain B6, B7, and B8 as distinct AMB2022-01 build records; compare their P3 part identities under the exact shared nominal recipe; retain each P1 thermography record; attach the published CHESS residual-strain field only to its declared B7-P3 target.",
            "completeProcessSpaceClaim": False,
            "causalEffectClaim": False,
        },
        "inputFiles": input_files,
        "sharedNominalRecipe": recipes[0],
        "builds": builds,
        "residualStrain": {
            "measurementId": "CHAL-AMB2022-01-RS-CHESS-EDD",
            "targetPartId": "AMB2022-718-AMMT-B7-P3",
            "technique": "synchrotron X-ray energy dispersive diffraction",
            "facility": "Cornell High Energy Synchrotron Source",
            "measurementPlane": {"axis": "Y", "position": 2.5, "unit": "mm", "descriptionLocator": "measurement description PDF, pages 1-2"},
            "components": ["XX", "ZZ"],
            "strainUnit": "unitless",
            "estimatedMeasurementUncertainty": {"value": 0.0001, "unit": "unitless", "coverageFactor": None, "descriptionLocator": "measurement description PDF, page 2"},
            "points": points,
            "summary": strain_summary(points),
        },
        "sourceAnomalies": [
            {
                "id": "repeated-scr-filename",
                "severity": "source-literal-warning",
                "description": "The B7 and B8 thermography XML records publish B6 in SCR_filename while their SCR DOI values differ. The projection preserves the literals and does not invent corrected filenames.",
                "affectedBuildIds": ["AMB2022-718-AMMT-B7", "AMB2022-718-AMMT-B8"],
            },
            {
                "id": "recorded-date-semantics",
                "severity": "interpretation-boundary",
                "description": "AMBuild creationDate and PBFLBAMBuildProcess startDate/completeDate are retained as separately named recorded fields and are not promoted to an exact physical chronology.",
                "affectedBuildIds": list(BUILD_IDS),
            },
        ],
        "evidenceBoundary": {
            "sameNominalRecipeMergesBuildIdentity": False,
            "sameMaterialClassMergesPartIdentity": False,
            "thermographyPromotedToResidualStrain": False,
            "residualStrainPromotedToCausalEffect": False,
            "missingMeasurementCopiedAcrossSiblingParts": False,
            "sourceFilenameCorrectedWithoutAuthority": False,
            "measurementCoordinatesRetained": True,
            "measurementUncertaintyRetained": True,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(projection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
