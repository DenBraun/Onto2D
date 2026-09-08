"""Independent stdlib rank reference over fabricated cases; never reads datasets.

Ranks use pairwise counting and exact Fractions. Spearman is computed as general
Pearson covariance of those Fractions, independently of the JS sorted-rank and
centered-integer implementation. Kendall uses unordered pair sign products.
"""

from fractions import Fraction
from itertools import combinations, product
import json
import math
import sys


MAX_VALUES = 1024


def finite_values(values):
    if not isinstance(values, list) or len(values) > MAX_VALUES:
        raise ValueError("bounded-array-required")
    if any(type(value) not in (int, float) or not math.isfinite(value) for value in values):
        raise ValueError("finite-observations-required")
    return values


def average_ranks(values):
    finite_values(values)
    return [Fraction(2 * sum(other < value for other in values)
                     + sum(other == value for other in values) + 1, 2)
            for value in values]


def rank_metrics(predicted, observed):
    finite_values(predicted)
    finite_values(observed)
    if len(predicted) != len(observed):
        raise ValueError("aligned-populations-required")
    n = len(predicted)
    x, y = average_ranks(predicted), average_ranks(observed)
    mean_x = sum(x, Fraction()) / n if n else Fraction()
    mean_y = sum(y, Fraction()) / n if n else Fraction()
    covariance = sum(((a - mean_x) * (b - mean_y) for a, b in zip(x, y)), Fraction())
    xx = sum(((a - mean_x) ** 2 for a in x), Fraction())
    yy = sum(((b - mean_y) ** 2 for b in y), Fraction())
    reason = ("too-few-observations" if n < 2 else
              "constant-prediction-and-observation" if xx == yy == 0 else
              "constant-prediction" if xx == 0 else
              "constant-observation" if yy == 0 else None)
    signs = [((predicted[i] > predicted[j]) - (predicted[i] < predicted[j]),
              (observed[i] > observed[j]) - (observed[i] < observed[j]))
             for i, j in combinations(range(n), 2)]
    concordant = sum(a * b > 0 for a, b in signs)
    discordant = sum(a * b < 0 for a, b in signs)
    tied_x = sum(a == 0 for a, _ in signs)
    tied_y = sum(b == 0 for _, b in signs)
    both = sum(a == b == 0 for a, b in signs)
    denominator = (len(signs) - tied_x) * (len(signs) - tied_y)
    skill_denominator = sum(b != 0 for _, b in signs)
    skill_reason = "too-few-observations" if n < 2 else "constant-observed" if skill_denominator == 0 else None
    return {"count": n, "rankSkill": {
        "value": (concordant - discordant) / skill_denominator if skill_reason is None else None,
        "reason": skill_reason, "numerator": str(concordant - discordant), "denominator": str(skill_denominator)},
        "spearman": {
        "value": float(covariance) / math.sqrt(float(xx * yy)) if reason is None else None,
        "reason": reason, "numerator": str(int(4 * covariance)),
        "predictedSumSquares": str(int(4 * xx)), "observedSumSquares": str(int(4 * yy)),
        "denominatorSquared": str(int(16 * xx * yy)),
        "exactComponents": "centered-doubled-average-ranks"},
        "kendallTauB": {
            "value": (concordant - discordant) / math.sqrt(denominator) if reason is None else None,
            "reason": reason, "concordant": concordant, "discordant": discordant,
            "tiedPredictedOnly": tied_x - both, "tiedObservedOnly": tied_y - both,
            "tiedBoth": both, "numerator": str(concordant - discordant),
            "denominatorSquared": str(denominator)}}


def generated_cases():
    vectors = [list(values) for length in range(5) for values in product(range(3), repeat=length)]
    pairs = []
    for left, predicted in enumerate(vectors):
        for right, observed in enumerate(vectors):
            if len(predicted) == len(observed):
                pairs.append({"predictedIndex": left, "observedIndex": right,
                              "expected": rank_metrics(predicted, observed)})
    invalid = []
    for predicted, observed in (([None, 1], [0, 1]), ([False, 1], [0, 1]),
                                (["0", 1], [0, 1]), ([0], [0, 1])):
        try:
            rank_metrics(predicted, observed)
        except ValueError as error:
            invalid.append({"predicted": predicted, "observed": observed, "error": str(error)})
        else:
            raise AssertionError("The independent reference accepted invalid observations")
    wildtype = [0, 10, -10, 5, -5, 20, -20, 2, -2, 30]
    contrasts = {}
    for contrast in ("knockouts", "knockdowns"):
        rows = [[0 if contrast == "knockouts" and i == j else baseline + (2 * i + j) % 5 - 2
                 for j, baseline in enumerate(wildtype)] for i in range(10)]
        contrasts[contrast] = {"values": rows, "targets": []}
        for i, row in enumerate(rows):
            differences = [abs(value - baseline) for j, (value, baseline) in enumerate(zip(row, wildtype)) if j != i]
            contrasts[contrast]["targets"].append({"magnitudes": differences,
                                                   "ranks": [float(rank) for rank in average_ranks(differences)]})
    return {"format": "onto2d-dream4-rank-reference-v1",
            "vectors": [{"values": vector, "ranks": [float(rank) for rank in average_ranks(vector)]} for vector in vectors],
            "pairs": pairs, "invalid": invalid,
            "targetFixture": {"wildtype": wildtype, "contrasts": contrasts}}


if __name__ == "__main__":
    if len(sys.argv) != 1:
        raise SystemExit("This reference has no dataset/scoring mode; invoke without arguments.")
    print(json.dumps(generated_cases(), separators=(",", ":"), allow_nan=False))
