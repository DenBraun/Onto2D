#!/usr/bin/env python3
"""Build the bounded LTEE Ara-3 replay projection from one exact NCBI article."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from fractions import Fraction
from html.parser import HTMLParser
from pathlib import Path


FORMAT = "onto2d-ltee-replay-projection"
PROFILE = "ltee-ara3-citrate-replay-projection-v1"
ARTICLE_SHA256 = "7e271d52f2fba0e4c40c3c7491b654a56482763639b255fb77930583a4cc10f9"
ARTICLE_BYTES = 225210
ARTICLE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC2430337/?report=printable"
EXPERIMENT_IDS = ("replay-1", "replay-2", "replay-3")
GENERATION_LABELS = (
    "Ancestor", "5,000", "10,000", "15,000", "20,000", "25,000",
    "27,000", "27,500", "28,000", "29,000", "30,000", "30,500",
    "31,000", "31,500", "32,000", "32,500",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


class ArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.metadata: dict[str, list[str]] = {}
        self.tables: dict[str, list[list[str]]] = {"T1": [], "T2": []}
        self.active_table: str | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("name", "").startswith("citation_"):
            self.metadata.setdefault(attributes["name"], []).append(attributes.get("content", ""))
        if tag == "section" and attributes.get("id") in self.tables:
            self.active_table = attributes["id"]
        elif self.active_table and tag == "tr":
            self.row = []
        elif self.active_table and tag in {"th", "td"}:
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if self.active_table and tag in {"th", "td"} and self.cell is not None and self.row is not None:
            self.row.append(normalize("".join(self.cell)))
            self.cell = None
        elif self.active_table and tag == "tr" and self.row is not None:
            if any(self.row):
                self.tables[self.active_table].append(self.row)
            self.row = None
        elif self.active_table and tag == "section":
            self.active_table = None

    def handle_data(self, data: str) -> None:
        self.text.append(data)
        if self.cell is not None:
            self.cell.append(data)


def integer(value: str) -> int | None:
    if value in {"—", "-", ""}:
        return None
    return int(value.replace(",", ""))


def generation(value: str) -> int:
    return 0 if value == "Ancestor" else int(value.replace(",", ""))


def round_half_up(value: Fraction) -> int:
    if value < 0:
        raise ValueError("generation means must be non-negative")
    return (2 * value.numerator + value.denominator) // (2 * value.denominator)


def parse_table_one(rows: list[list[str]]) -> tuple[list[dict[str, object]], dict[str, dict[str, int]]]:
    expected_headers = [
        ["Generation", "First experiment", "Second experiment", "Third experiment"],
        ["Replicates", "Independent Cit+ mutants", "Replicates", "Independent Cit+ mutants", "Replicates", "Independent Cit+ mutants"],
    ]
    if rows[:2] != expected_headers:
        raise ValueError(f"Table 1 headers differ: {rows[:2]!r}")
    body = rows[2:]
    if [row[0] for row in body] != [*GENERATION_LABELS, "Totals"]:
        raise ValueError("Table 1 generation order differs")
    if any(len(row) != 7 for row in body):
        raise ValueError("Table 1 row width differs")

    observations: list[dict[str, object]] = []
    for row in body[:-1]:
        label = row[0]
        point = generation(label)
        for index, experiment_id in enumerate(EXPERIMENT_IDS):
            replicates = integer(row[1 + index * 2])
            mutants = integer(row[2 + index * 2])
            if (replicates is None) != (mutants is None):
                raise ValueError(f"Table 1 has a partial observation for {label} / {experiment_id}")
            if replicates is None:
                continue
            if replicates < 1 or mutants < 0 or mutants > replicates:
                raise ValueError(f"Table 1 counts are invalid for {label} / {experiment_id}")
            observations.append({
                "id": f"observation:{experiment_id}:g-{point:05d}",
                "experimentId": experiment_id,
                "backgroundId": f"background:ara-3:g-{point:05d}",
                "sourceGeneration": point,
                "nativeGenerationLabel": label,
                "replicates": replicates,
                "independentCitPlusMutants": mutants,
                "outcomeStatus": "observed" if mutants > 0 else "not-observed",
                "absenceMeansImpossible": False,
            })

    total_row = body[-1]
    totals = {}
    for index, experiment_id in enumerate(EXPERIMENT_IDS):
        totals[experiment_id] = {
            "replicates": integer(total_row[1 + index * 2]),
            "independentCitPlusMutants": integer(total_row[2 + index * 2]),
        }
        selected = [item for item in observations if item["experimentId"] == experiment_id]
        if sum(item["replicates"] for item in selected) != totals[experiment_id]["replicates"]:
            raise ValueError(f"Table 1 replicate total differs for {experiment_id}")
        if sum(item["independentCitPlusMutants"] for item in selected) != totals[experiment_id]["independentCitPlusMutants"]:
            raise ValueError(f"Table 1 mutant total differs for {experiment_id}")
    return observations, totals


def parse_table_two(rows: list[list[str]], observations: list[dict[str, object]]) -> list[dict[str, object]]:
    if rows[:2] != [["", "Mean generation of clones yielding Cit+"], ["First experiment", "Second experiment", "Third experiment"]]:
        raise ValueError(f"Table 2 headers differ: {rows[:2]!r}")
    if [row[0] for row in rows[2:]] != ["Expected", "Observed", "Monte Carlo P value"]:
        raise ValueError("Table 2 statistic rows differ")
    expected = [integer(value) for value in rows[2][1:]]
    observed = [integer(value) for value in rows[3][1:]]
    p_values = [float(value) for value in rows[4][1:]]
    if expected != [24917, 28382, 22571] or observed != [31750, 32100, 27563] or p_values != [0.0085, 0.0007, 0.0823]:
        raise ValueError("Table 2 values differ")

    statistics = []
    for index, experiment_id in enumerate(EXPERIMENT_IDS):
        selected = [item for item in observations if item["experimentId"] == experiment_id]
        table_one_replicate_weighted_mean = Fraction(
            sum(item["sourceGeneration"] * item["replicates"] for item in selected),
            sum(item["replicates"] for item in selected),
        )
        positive = [item for item in selected if item["independentCitPlusMutants"] > 0]
        observed_fraction = Fraction(
            sum(item["sourceGeneration"] * item["independentCitPlusMutants"] for item in positive),
            sum(item["independentCitPlusMutants"] for item in positive),
        )
        if round_half_up(observed_fraction) != observed[index]:
            raise ValueError(f"Table 2 observed mean generation does not reproduce for {experiment_id}")
        table_one_expected = round_half_up(table_one_replicate_weighted_mean)
        statistics.append({
            "experimentId": experiment_id,
            "nullHypothesis": "all sampled source generations have equal likelihood of yielding Cit+ under this experiment",
            "expectedMeanGeneration": expected[index],
            "observedMeanGeneration": observed[index],
            "meanShiftGenerations": observed[index] - expected[index],
            "tableOneReplicateWeightedMean": {
                "numerator": table_one_replicate_weighted_mean.numerator,
                "denominator": table_one_replicate_weighted_mean.denominator,
                "rounded": table_one_expected,
            },
            "tableOneMeanMatchesPublishedExpected": table_one_expected == expected[index],
            "recomputedObservedMean": {"numerator": observed_fraction.numerator, "denominator": observed_fraction.denominator},
            "publishedMonteCarloPValue": p_values[index],
            "monteCarloIterations": 1000000,
            "pValueRecomputed": False,
            "publishedExpectedMeanRecomputed": False,
        })
    return statistics


def required_metadata(parser: ArticleParser, key: str, expected: list[str]) -> list[str]:
    actual = parser.metadata.get(key, [])
    if actual != expected:
        raise ValueError(f"article metadata {key} differs: {actual!r}")
    return actual


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("article_html", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    if args.article_html.stat().st_size != ARTICLE_BYTES or sha256(args.article_html) != ARTICLE_SHA256:
        raise ValueError("article HTML bytes do not match the pinned NCBI response")
    article = ArticleParser()
    article.feed(args.article_html.read_text(encoding="utf-8"))
    required_metadata(article, "citation_title", ["Historical contingency and the evolution of a key innovation in an experimental population of Escherichia coli"])
    required_metadata(article, "citation_author", ["Zachary D Blount", "Christina Z Borland", "Richard E Lenski"])
    required_metadata(article, "citation_publication_date", ["2008 Jun 4"])
    required_metadata(article, "citation_doi", ["10.1073/pnas.0803151105"])
    required_metadata(article, "citation_pmid", ["18524956"])

    document_text = normalize("".join(article.text))
    required_passages = [
        "In total, there were 72 replay populations, six from each generation, each founded by a single clone.",
        "same 68 clones used in the first replay experiment were spread on each of five MC plates, and these 340 plates were then incubated for 59 days.",
        "We isolated 20 clones from each of 13 time points in the history of population Ara-3, again through 32,500 generations.",
        "We generated and tested 10 replicate cultures of each evolved clone and 200 replicates of the ancestor.",
        "We found no Cit+ mutants among any of the 200 ancestral cultures, nor among any of the other 600 cultures that used clones isolated before generation 20,000.",
        "We also cannot separate potentiated and nonpotentiated clones by generation because some generational samples may be polymorphic.",
    ]
    for passage in required_passages:
        if passage not in document_text:
            raise ValueError(f"required article passage differs: {passage}")

    observations, totals = parse_table_one(article.tables["T1"])
    statistics = parse_table_two(article.tables["T2"], observations)
    backgrounds = [{
        "id": f"background:ara-3:g-{generation(label):05d}",
        "populationId": "Ara-3",
        "sourceGeneration": generation(label),
        "nativeGenerationLabel": label,
        "recordKind": "published-generation-sample",
        "cloneIdentityAvailableInTable": False,
        "completeGenotypeAvailableInTable": False,
        "potentiationStatusFromGenerationAlone": "unresolved",
    } for label in GENERATION_LABELS]
    protocols = [
        {
            "id": "replay-1", "nativeLabel": "First experiment", "mode": "serial-transfer replay", "replicateUnit": "replay population",
            "sourceCloneCountPerGeneration": 3, "markerVariantsPerClone": 2, "maximumReplayGenerationsApproximate": 3700,
            "screeningIntervalGenerations": 250, "incubationDays": None, **totals["replay-1"],
        },
        {
            "id": "replay-2", "nativeLabel": "Second experiment", "mode": "MC plate assay", "replicateUnit": "MC plate",
            "sourceCloneCount": 68, "platesPerClone": 5, "cellsPerPlateApproximate": 390000000, "incubationDays": 59,
            **totals["replay-2"],
        },
        {
            "id": "replay-3", "nativeLabel": "Third experiment", "mode": "MC plate assay", "replicateUnit": "culture plated on MC agar",
            "sourceCloneCountPerEvolvedGeneration": 20, "replicatesPerClone": 10, "ancestorReplicates": 200,
            "cellsPerCultureApproximateRange": [10000000000, 20000000000], "totalCellsApproximate": 40000000000000,
            "incubationDays": 45, **totals["replay-3"],
        },
    ]
    background_assessments = []
    for background in backgrounds:
        selected = [item for item in observations if item["backgroundId"] == background["id"]]
        positive = [item["experimentId"] for item in selected if item["outcomeStatus"] == "observed"]
        background_assessments.append({
            "backgroundId": background["id"],
            "sourceGeneration": background["sourceGeneration"],
            "observedExperimentIds": [item["experimentId"] for item in selected],
            "citPlusObservedExperimentIds": positive,
            "boundedOutcomeStatus": "observed" if positive else "not-observed",
            "accessibilityStatus": "supported-in-at-least-one-bounded-replay" if positive else "unresolved",
            "protocolsPooled": False,
            "impossibilityClaim": False,
        })

    projection = {
        "format": FORMAT,
        "formatVersion": "1",
        "profileVersion": PROFILE,
        "source": {
            "publisher": "National Center for Biotechnology Information",
            "repository": "PubMed Central",
            "articleUrl": ARTICLE_URL,
            "pmcid": "PMC2430337",
            "pmid": "18524956",
            "doi": "10.1073/pnas.0803151105",
            "title": article.metadata["citation_title"][0],
            "authors": article.metadata["citation_author"],
            "publicationDate": "2008-06-04",
            "retrievalFormat": "PMC printable HTML",
        },
        "selection": {
            "populationId": "Ara-3",
            "targetOutcomeId": "phenotype:aerobic-citrate-use",
            "targetOutcomeLabel": "Cit+",
            "tableIds": ["T1", "T2"],
            "generationLabels": list(GENERATION_LABELS),
            "experimentIds": list(EXPERIMENT_IDS),
            "rule": "Retain every source-generation row and non-missing replay count in Tables 1 and 2; preserve the three protocols separately; treat zero observed mutants as bounded non-observation, never impossibility.",
        },
        "inputFiles": [{"path": "pmc/PMC2430337-printable.html", "sha256": ARTICLE_SHA256, "bytes": ARTICLE_BYTES}],
        "backgrounds": backgrounds,
        "protocols": protocols,
        "observations": observations,
        "publishedStatistics": statistics,
        "historyConditionedReachability": {
            "status": "descriptive-published-evidence",
            "targetOutcomeId": "phenotype:aerobic-citrate-use",
            "conditionedOn": ["Ara-3 source generation", "exact replay experiment"],
            "backgroundAssessments": background_assessments,
            "combinedPublishedPValueUpperBound": 0.0001,
            "combinedPValueRecomputed": False,
            "protocolPoolingAllowed": False,
            "completeMutationPathSpaceClaim": False,
        },
        "publishedInterpretationBoundary": {
            "laterBackgroundsShowGreaterPropensity": True,
            "potentiatingBackgroundSupported": True,
            "potentiatingMutationIdentifiedBySelectedTables": False,
            "generationUniquelyDeterminesPotentiation": False,
            "reason": "The paper reports that generational samples may be polymorphic and that potentiated and nonpotentiated clones cannot be separated by generation alone.",
        },
        "evidenceBoundary": {
            "replayHistoryEqualsOriginalLteeHistory": False,
            "notObservedMeansImpossible": False,
            "generationLabelEqualsCompleteGenotype": False,
            "generationLabelUniquelyIdentifiesClone": False,
            "protocolCountsMayBePooledIntoOneRate": False,
            "publishedMonteCarloPValuesRecomputed": False,
            "publishedInterpretationBecomesUniversalLaw": False,
            "sourceRowsRetained": True,
        },
    }
    if len(observations) != 38 or sum(item["independentCitPlusMutants"] for item in observations) != 17:
        raise ValueError("bounded replay observation inventory differs")
    if not all(math.isfinite(item["publishedMonteCarloPValue"]) for item in statistics):
        raise ValueError("published P values are not finite")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(projection, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
