#!/usr/bin/env python3
"""Freeze a small, auditable Gaia DR3 chemical-cartography projection.

The script deliberately queries the orbital, astrophysical-parameter, and
Gaia-source tables separately.  Joining the full DR3 tables is both expensive
and liable to blur the evidence boundary that this case is intended to show.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


FORMAT = "onto2d-gaia-dr3-galactic-archaeology-projection"
FORMAT_VERSION = "1"
PROFILE_VERSION = "gaia-dr3-chemical-cartography-balanced-v1"
DEFAULT_TAP = "https://gaia.aip.de/tap/sync"
CANDIDATES_PER_SKY_BAND = 400
PER_QUALITY_AND_PROFILE = 8
BATCH_SIZE = 400
# source_id encodes a level-12 HEALPix location.  Four fixed ID bands avoid
# selecting every candidate from one small part of the sky while keeping the
# query deterministic and index-friendly.
SOURCE_ID_BANDS = (
    (0, 1_729_382_256_910_270_464),
    (1_729_382_256_910_270_464, 3_458_764_513_820_540_928),
    (3_458_764_513_820_540_928, 5_188_146_770_730_811_392),
    (5_188_146_770_730_811_392, 6_917_529_027_641_081_856),
)
TAP_CACHE: Path | None = None

ORBIT_COLUMNS = (
    "source_id", "rplane_med", "rplane_lo", "rplane_hi",
    "vrplane_med", "vrplane_lo", "vrplane_hi", "vz_med", "vz_lo", "vz_hi",
    "vphi_med", "vphi_lo", "vphi_hi", "zmax_med", "zmax_lo", "zmax_hi",
    "ecc_med", "ecc_lo", "ecc_hi", "jr_med", "jr_lo", "jr_hi",
    "jz_med", "jz_lo", "jz_hi", "jphi_med", "jphi_lo", "jphi_hi", "energy_med",
)
PARAMETER_COLUMNS = (
    "source_id", "teff_gspspec", "teff_gspspec_lower", "teff_gspspec_upper",
    "logg_gspspec", "logg_gspspec_lower", "logg_gspspec_upper",
    "mh_gspspec", "mh_gspspec_lower", "mh_gspspec_upper",
    "alphafe_gspspec", "alphafe_gspspec_lower", "alphafe_gspspec_upper",
    "flags_gspspec",
)
OBSERVATION_COLUMNS = (
    "source_id", "designation", "random_index", "ra", "ra_error", "dec", "dec_error",
    "parallax", "parallax_error", "pmra", "pmra_error", "pmdec", "pmdec_error",
    "radial_velocity", "radial_velocity_error", "phot_g_mean_mag", "bp_rp", "ruwe",
)

PROFILES = (
    {
        "id": "cold-rotating-metal-rich",
        "label": "Cold rotating / metal-rich rule profile",
        "candidatePredicate": "vphi_med >= 180 AND ecc_med <= 0.2 AND zmax_med <= 0.5",
        "rule": "vphi >= 180 km/s; eccentricity <= 0.2; zmax <= 0.5 kpc; [M/H] >= -0.5 dex",
        "interpretations": ["kinematically cold disc-like present-day pattern"],
    },
    {
        "id": "alpha-raised-intermediate",
        "label": "Alpha-raised intermediate-orbit rule profile",
        "candidatePredicate": "vphi_med >= 100 AND vphi_med < 200 AND ecc_med > 0.2 AND ecc_med < 0.6 AND zmax_med > 0.5 AND zmax_med < 3",
        "rule": "100 <= vphi < 200 km/s; 0.2 < eccentricity < 0.6; 0.5 < zmax < 3 kpc; -1 <= [M/H] < -0.3 dex; [alpha/Fe] >= 0.15 dex",
        "interpretations": ["alpha-raised dynamically warm disc-like present-day pattern"],
    },
    {
        "id": "radial-metal-poor",
        "label": "Radial metal-poor rule profile",
        "candidatePredicate": "vphi_med >= 0 AND ecc_med >= 0.7 AND zmax_med >= 3",
        "rule": "vphi >= 0 km/s; eccentricity >= 0.7; zmax >= 3 kpc; [M/H] <= -0.8 dex",
        "interpretations": ["radially biased metal-poor halo-like pattern", "compatible with more than one formation channel"],
    },
    {
        "id": "counter-rotating-metal-poor",
        "label": "Counter-rotating metal-poor rule profile",
        "candidatePredicate": "vphi_med < 0 AND zmax_med >= 1",
        "rule": "vphi < 0 km/s; zmax >= 1 kpc; [M/H] <= -0.8 dex",
        "interpretations": ["counter-rotating metal-poor halo-like pattern", "compatible with accretion-related interpretations, but not proof of origin"],
    },
)


def adql(columns: tuple[str, ...], table: str, where: str, limit: int | None = None) -> str:
    top = f"TOP {limit} " if limit is not None else ""
    return f"SELECT {top}{', '.join(columns)} FROM {table} WHERE {where} ORDER BY source_id"


def tap_query(endpoint: str, query: str, attempts: int = 3) -> list[dict[str, Any]]:
    cache_path = None
    if TAP_CACHE is not None:
        cache_key = hashlib.sha256((endpoint + "\n" + query).encode()).hexdigest()
        cache_path = TAP_CACHE / f"{cache_key}.xml"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "QUERY": query}).encode()
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            if cache_path is not None and cache_path.exists():
                response_bytes = cache_path.read_bytes()
            else:
                request = urllib.request.Request(endpoint, data=payload, headers={"User-Agent": "Onto2D source freezer/1"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    response_bytes = response.read()
            root = ElementTree.fromstring(response_bytes)
            statuses = [element for element in root.iter() if element.tag.endswith("INFO") and element.attrib.get("name") == "QUERY_STATUS"]
            failed = next((item for item in statuses if item.attrib.get("value") != "OK"), None)
            if failed is not None:
                raise RuntimeError((failed.text or failed.attrib.get("value") or "TAP query failed").strip())
            if cache_path is not None and not cache_path.exists():
                cache_path.write_bytes(response_bytes)
            fields = [element.attrib for element in root.iter() if element.tag.endswith("FIELD")]
            names = [field["name"] for field in fields]
            types = [field.get("datatype", "char") for field in fields]
            output = []
            for table_row in (element for element in root.iter() if element.tag.endswith("TR")):
                cells = [element.text for element in table_row if element.tag.endswith("TD")]
                row: dict[str, Any] = {}
                for name, datatype, value in zip(names, types, cells):
                    if value in (None, ""):
                        row[name] = None
                    elif name == "source_id" or datatype in {"char", "unicodeChar"}:
                        row[name] = value
                    elif datatype in {"short", "int", "long", "unsignedByte"}:
                        row[name] = int(value)
                    else:
                        row[name] = float(value)
                output.append(row)
            return output
        except Exception as error:  # retry transient TAP failures, then preserve the final cause
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(1 + attempt)
    raise RuntimeError(f"TAP query failed after {attempts} attempts: {last_error}") from last_error


def chunks(values: list[str]) -> list[list[str]]:
    return [values[index:index + BATCH_SIZE] for index in range(0, len(values), BATCH_SIZE)]


def fetch_by_ids(endpoint: str, table: str, columns: tuple[str, ...], ids: list[str], query_log: list[dict[str, str]]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    for batch_index, batch in enumerate(chunks(ids), start=1):
        query = adql(columns, table, f"source_id IN ({', '.join(batch)})")
        query_log.append({"role": f"{table}-enrichment-{batch_index}", "adql": query})
        for row in tap_query(endpoint, query):
            output[str(row["source_id"])] = row
    return output


def flags(value: Any) -> list[int]:
    text = str(value or "")
    if len(text) < 13 or not text[:13].isdigit():
        return []
    return [int(character) for character in text[:13]]


def medium_quality(row: dict[str, Any]) -> bool:
    f = flags(row.get("flags_gspspec"))
    values = [row.get(name) for name in PARAMETER_COLUMNS[1:13]]
    if len(f) != 13 or any(value is None for value in values):
        return False
    teff = row["teff_gspspec"]
    logg = row["logg_gspspec"]
    return bool(
        teff > 3500 and 0 < logg < 5
        and (teff >= 3800 or logg <= 3.5)
        and (teff >= 4150 or logg >= 3.6 or logg <= 2.4)
        and row["teff_gspspec_upper"] - row["teff_gspspec_lower"] < 750
        and row["logg_gspspec_upper"] - row["logg_gspspec_lower"] < 1
        and row["mh_gspspec_upper"] - row["mh_gspspec_lower"] < 0.5
        and all(value <= 1 for value in f[:6])
        and f[6] <= 3 and f[7] <= 2 and f[12] <= 1
    )


def high_quality(row: dict[str, Any]) -> bool:
    f = flags(row.get("flags_gspspec"))
    return bool(
        len(f) == 13 and row.get("teff_gspspec") is not None and row.get("logg_gspspec") is not None
        and row["teff_gspspec"] > 3500 and 0 < row["logg_gspspec"] < 5
        and all(value == 0 for value in f[:7]) and f[7] <= 2
        and all(value == 0 for value in f[8:12]) and f[12] <= 1
    )


def profile_match(profile_id: str, parameter: dict[str, Any], orbit: dict[str, Any]) -> bool:
    mh = parameter.get("mh_gspspec")
    alpha = parameter.get("alphafe_gspspec")
    orbit_values = [orbit.get(name) for name in ORBIT_COLUMNS[1:]]
    if mh is None or alpha is None or any(value is None or not math.isfinite(value) for value in [mh, alpha, *orbit_values]):
        return False
    if profile_id == "cold-rotating-metal-rich":
        return orbit["vphi_med"] >= 180 and orbit["ecc_med"] <= 0.2 and orbit["zmax_med"] <= 0.5 and mh >= -0.5
    if profile_id == "alpha-raised-intermediate":
        return 100 <= orbit["vphi_med"] < 200 and 0.2 < orbit["ecc_med"] < 0.6 and 0.5 < orbit["zmax_med"] < 3 and -1 <= mh < -0.3 and alpha >= 0.15
    if profile_id == "radial-metal-poor":
        return orbit["vphi_med"] >= 0 and orbit["ecc_med"] >= 0.7 and orbit["zmax_med"] >= 3 and mh <= -0.8
    return orbit["vphi_med"] < 0 and orbit["zmax_med"] >= 1 and mh <= -0.8


def rounded(row: dict[str, Any]) -> dict[str, Any]:
    output = {}
    for key, value in row.items():
        normalized = round(value, 7) if isinstance(value, float) else value
        output[key] = 0.0 if isinstance(normalized, float) and normalized == 0 else normalized
    return output


def build_projection(endpoint: str, retrieved_at: str) -> dict[str, Any]:
    query_log: list[dict[str, str]] = []
    candidates: dict[str, list[dict[str, Any]]] = {}
    orbital_rows: dict[str, dict[str, Any]] = {}
    for profile in PROFILES:
        rows = []
        for band_index, (lower, upper) in enumerate(SOURCE_ID_BANDS, start=1):
            predicate = f"({profile['candidatePredicate']}) AND source_id >= {lower} AND source_id < {upper}"
            query = adql(ORBIT_COLUMNS, "gaiadr3.chemical_cartography", predicate, CANDIDATES_PER_SKY_BAND)
            query_log.append({"role": f"{profile['id']}-orbital-candidates-band-{band_index}", "adql": query})
            band_rows = tap_query(endpoint, query)
            if len(band_rows) != CANDIDATES_PER_SKY_BAND:
                raise ValueError(f"{profile['id']} band {band_index} returned {len(band_rows)} candidates, expected {CANDIDATES_PER_SKY_BAND}")
            rows.extend(band_rows)
        candidates[profile["id"]] = rows
        orbital_rows.update((str(row["source_id"]), row) for row in rows)

    candidate_ids = sorted(orbital_rows, key=int)
    parameters = fetch_by_ids(endpoint, "gaiadr3.astrophysical_parameters", PARAMETER_COLUMNS, candidate_ids, query_log)

    selected: list[dict[str, Any]] = []
    selection_audit = []
    for profile in PROFILES:
        eligible = []
        for orbit in candidates[profile["id"]]:
            source_id = str(orbit["source_id"])
            parameter = parameters.get(source_id)
            if parameter is not None and medium_quality(parameter) and profile_match(profile["id"], parameter, orbit):
                eligible.append((source_id, orbit, parameter))
        high = [item for item in eligible if high_quality(item[2])]
        medium_only = [item for item in eligible if not high_quality(item[2])]
        if len(high) < PER_QUALITY_AND_PROFILE or len(medium_only) < PER_QUALITY_AND_PROFILE:
            raise ValueError(f"{profile['id']} has only {len(high)} high and {len(medium_only)} medium-only candidates")
        chosen = high[:PER_QUALITY_AND_PROFILE] + medium_only[:PER_QUALITY_AND_PROFILE]
        for source_id, orbit, parameter in chosen:
            selected.append({
                "sourceId": source_id,
                "ruleProfileId": profile["id"],
                "qualityProfile": "high" if high_quality(parameter) else "medium-only",
                "gaiaParameters": rounded({key: parameter[key] for key in PARAMETER_COLUMNS[1:]}),
                "publishedOrbit": rounded({key: orbit[key] for key in ORBIT_COLUMNS[1:]}),
            })
        selection_audit.append({
            "ruleProfileId": profile["id"],
            "candidateCount": len(candidates[profile["id"]]),
            "mediumEligibleCount": len(eligible),
            "highEligibleCount": len(high),
            "mediumOnlyEligibleCount": len(medium_only),
            "selectedHighCount": PER_QUALITY_AND_PROFILE,
            "selectedMediumOnlyCount": PER_QUALITY_AND_PROFILE,
        })

    selected_ids = sorted((row["sourceId"] for row in selected), key=int)
    observations = fetch_by_ids(endpoint, "gaiadr3.gaia_source", OBSERVATION_COLUMNS, selected_ids, query_log)
    for row in selected:
        observation = observations.get(row["sourceId"])
        if observation is None:
            raise ValueError(f"Gaia source {row['sourceId']} is absent from gaia_source")
        row["observation"] = rounded({key: observation[key] for key in OBSERVATION_COLUMNS[1:]})
    selected.sort(key=lambda row: (next(index for index, profile in enumerate(PROFILES) if profile["id"] == row["ruleProfileId"]), row["qualityProfile"], int(row["sourceId"])))

    return {
        "format": FORMAT,
        "formatVersion": FORMAT_VERSION,
        "profileVersion": PROFILE_VERSION,
        "source": {
            "release": "Gaia DR3",
            "tapEndpoint": endpoint,
            "retrievedAt": retrieved_at,
            "tables": [
                {"name": "gaiadr3.gaia_source", "doi": "10.17876/gaia/dr.3/1", "evidenceClass": "catalogue observation and quality"},
                {"name": "gaiadr3.astrophysical_parameters", "doi": "10.17876/gaia/dr.3/43", "evidenceClass": "Gaia Apsis parameter estimate"},
                {"name": "gaiadr3.chemical_cartography", "doi": "10.17876/gaia/dr.3/99", "evidenceClass": "published companion orbital derivation"},
            ],
            "paper": {"title": "Gaia Data Release 3: Chemical cartography of the Milky Way", "doi": "10.1051/0004-6361/202243511", "sha256": "c7c10f8d9b22a7c15c293b657451e912aed54e660c3e446098d7ccf4b8772036"},
        },
        "selection": {
            "rule": f"Across four fixed source_id sky bands, collect {CANDIDATES_PER_SKY_BAND} ascending orbital candidates per band and rule profile; then take the first {PER_QUALITY_AND_PROFILE} ascending source_id values in the paper's High sample and the first {PER_QUALITY_AND_PROFILE} in Medium-but-not-High.",
            "candidateCountPerProfile": CANDIDATES_PER_SKY_BAND * len(SOURCE_ID_BANDS),
            "sourceIdBands": [[lower, upper] for lower, upper in SOURCE_ID_BANDS],
            "selectedPerQualityAndProfile": PER_QUALITY_AND_PROFILE,
            "sourceCount": len(selected),
            "profiles": list(PROFILES),
            "qualityDefinitions": {
                "medium": "Appendix B General exclusions plus Teff/logg/uncertainty limits and GSP-Spec flag positions 1-6 <=1, 7 <=3, 8 <=2, 13 <=1.",
                "high": "Appendix B Teff/logg limits and GSP-Spec flag positions 1-7 =0, 8 <=2, 9-12 =0, 13 <=1.",
            },
            "audit": selection_audit,
        },
        "queries": query_log,
        "records": selected,
        "evidenceBoundary": {
            "observationIsOrbit": False,
            "parameterEstimateIsObservation": False,
            "ruleProfileIsPublishedPopulationLabel": False,
            "ruleProfileIsBirthOrigin": False,
            "chemicalSimilarityIsCommonAncestry": False,
            "sampleIsCompleteMilkyWayPopulation": False,
            "uncertaintyIntervalsRetained": True,
        },
    }


def main() -> None:
    global TAP_CACHE
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--tap-endpoint", default=DEFAULT_TAP)
    parser.add_argument("--retrieved-at", required=True, help="Pinned UTC timestamp written to the projection")
    parser.add_argument("--cache-directory", type=Path, help="Optional validated VOTable cache for resumable source preparation")
    args = parser.parse_args()
    TAP_CACHE = args.cache_directory
    projection = build_projection(args.tap_endpoint, args.retrieved_at)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(projection, indent=2, ensure_ascii=True, allow_nan=False) + "\n").encode()
    args.output.write_bytes(encoded)
    print(json.dumps({"path": str(args.output), "bytes": len(encoded), "sha256": hashlib.sha256(encoded).hexdigest(), "records": len(projection["records"])}, indent=2))


if __name__ == "__main__":
    main()
