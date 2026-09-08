"""Independent weighted ridge controls using Decimal and augmented Gauss-Jordan.

This program fits only the synthetic controls declared below. It does not load
the biological corpus, import project code, tune a model or score any dataset.
The intercept is solved jointly with all standardized coefficients, independently
of the JavaScript implementation's centered Cholesky equations.
"""

from decimal import Decimal, localcontext
import json
import sys


LAMBDAS = [0.01, 0.1, 1, 10, 100]
CONTROLS = [
    {"id": "closed-form-with-constant-column",
     "rows": [{"x": [-1, 7], "y": 0, "weight": 1},
              {"x": [1, 7], "y": 1, "weight": 1}],
     "predictionInputs": [[-1, 1000], [1, -1000], [0, 7], [5, 7]]},
    {"id": "asymmetric-weighted-offset-features",
     "rows": [{"x": [-3, 4, 11], "y": 0, "weight": 1},
              {"x": [1, 1, 11], "y": 0.25, "weight": 3},
              {"x": [2, -1, 11], "y": 0.75, "weight": 2},
              {"x": [7, 3, 11], "y": 1, "weight": 4}],
     "predictionInputs": [[-3, 4, 500], [0, 2, -100], [10, 5, 11], [30, -5, 11]]},
    {"id": "collinear-features-unequal-weights",
     "rows": [{"x": [-2, -3, 0], "y": 1, "weight": 1},
              {"x": [-1, -1, 0], "y": 0.75, "weight": 2},
              {"x": [0, 1, 0], "y": 0, "weight": 4},
              {"x": [1, 3, 0], "y": 0.5, "weight": 3},
              {"x": [2, 5, 0], "y": 1, "weight": 1}],
     "predictionInputs": [[-3, -5, 0], [1, 3, 1234], [0, 7, -1]]},
    {"id": "large-common-weight-scale",
     "rows": [{"x": [-2, 5], "y": 0, "weight": 1e120},
              {"x": [0, 5], "y": 0.25, "weight": 3e120},
              {"x": [4, 5], "y": 1, "weight": 2e120}],
     "predictionInputs": [[-2, -999], [0, 5], [4, 5]]},
    {"id": "small-common-weight-scale",
     "rows": [{"x": [-2, 5], "y": 0, "weight": 1e-120},
              {"x": [0, 5], "y": 0.25, "weight": 3e-120},
              {"x": [4, 5], "y": 1, "weight": 2e-120}],
     "predictionInputs": [[-2, -999], [0, 5], [4, 5]]},
    {"id": "single-row-all-constant",
     "rows": [{"x": [2, 9], "y": 0.75, "weight": 7}],
     "predictionInputs": [[2, 9], [-200, 1000]]},
    {"id": "constant-unit-target-nonbinary-normalized-weights",
     "rows": [{"x": [1], "y": 1, "weight": 1} for _ in range(9)],
     "predictionInputs": [[1], [22]]},
]


def number(value):
    return Decimal(str(value))


def solve(matrix, rhs):
    """Full augmented elimination with partial pivoting, not Cholesky."""
    size = len(rhs)
    augmented = [list(row) + [value] for row, value in zip(matrix, rhs)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if augmented[pivot][column] == 0:
            raise ValueError("Synthetic reference unexpectedly singular")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            multiplier = augmented[row][column]
            augmented[row] = [value - multiplier * pivot_value
                              for value, pivot_value in zip(augmented[row], augmented[column])]
    return [row[-1] for row in augmented]


def reference(control, penalty):
    with localcontext() as context:
        context.prec = 80
        rows = control["rows"]
        x = [[number(value) for value in row["x"]] for row in rows]
        y = [number(row["y"]) for row in rows]
        raw_weights = [number(row["weight"]) for row in rows]
        mass = sum(raw_weights)
        weights = [weight / mass for weight in raw_weights]
        width = len(x[0])
        means = [sum(weight * row[column] for weight, row in zip(weights, x))
                 for column in range(width)]
        scales = [sum(weight * (row[column] - means[column]) ** 2
                      for weight, row in zip(weights, x)).sqrt()
                  if any(row[column] != x[0][column] for row in x) else Decimal(0)
                  for column in range(width)]

        def design(values):
            return [Decimal(1)] + [(value - mean) / scale if scale else Decimal(0)
                                   for value, mean, scale in zip(values, means, scales)]

        a = [design(row) for row in x]
        regularization = number(penalty)
        gram = [[sum(weight * row[j] * row[k] for weight, row in zip(weights, a))
                 + (regularization if j == k and j > 0 else Decimal(0))
                 for k in range(width + 1)] for j in range(width + 1)]
        rhs = [sum(weight * row[j] * target for weight, row, target in zip(weights, a, y))
               for j in range(width + 1)]
        parameters = solve(gram, rhs)

        def predict(values):
            return sum(coefficient * value for coefficient, value in zip(parameters, design(values)))

        predictions = [predict([number(value) for value in values]) for values in control["predictionInputs"]]
        objective = sum(weight * (target - predict(row)) ** 2
                        for weight, target, row in zip(weights, y, x))
        objective += regularization * sum(value * value for value in parameters[1:])
        residual = max(abs(sum(value * coefficient for value, coefficient in zip(row, parameters)) - target)
                       for row, target in zip(gram, rhs))
        if residual > Decimal("1e-70"):
            raise ValueError("Independent synthetic normal equation residual is too large")
        return {"lambda": penalty, "means": list(map(float, means)),
                "scales": list(map(float, scales)), "intercept": float(parameters[0]),
                "coefficients": list(map(float, parameters[1:])),
                "predictions": list(map(float, predictions)), "objective": float(objective),
                "normalEquationResidualMaximum": float(residual)}


def main():
    if len(sys.argv) != 1:
        raise ValueError("This reference accepts no dataset paths or input rows")
    cases = [{**control, "results": [reference(control, penalty) for penalty in LAMBDAS]}
             for control in CONTROLS]
    closed = next(result for result in cases[0]["results"] if result["lambda"] == 1)
    if closed["coefficients"] != [0.25, 0.0] or closed["intercept"] != 0.5:
        raise ValueError("Independent reference disagrees with the hand-derived control")
    print(json.dumps({"format": "onto2d-independent-weighted-ridge-controls-v1",
                      "method": "decimal-80-joint-intercept-pivoted-gauss-jordan",
                      "cases": cases}, allow_nan=False, sort_keys=True))


if __name__ == "__main__":
    main()
