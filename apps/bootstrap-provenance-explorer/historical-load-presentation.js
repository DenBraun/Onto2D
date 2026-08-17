const COST_UNITS = Object.freeze({
  "event-count": ["counted event", "counted events"],
  "build-event-count": ["build event", "build events"],
  "distinct-tool-count": ["distinct tool", "distinct tools"],
  "trust-root-count": ["declared trust root", "declared trust roots"]
});

function requireRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a record.`);
  }
  return value;
}

function requireFiniteNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

export function formatHistoricalLoadCost(value, costFunctionId) {
  const amount = requireFiniteNumber(value, "Historical Load cost");
  const units = COST_UNITS[costFunctionId] ?? ["cost unit", "cost units"];
  return `${amount} ${Math.abs(amount) === 1 ? units[0] : units[1]}`;
}

export function presentHistoricalLoad({ result, regime, freePath, admissiblePath }) {
  const resolved = requireRecord(result, "result");
  const selectedRegime = requireRecord(regime, "regime");
  const free = requireRecord(freePath, "freePath");
  const admissible = requireRecord(admissiblePath, "admissiblePath");
  const costFunction = requireRecord(resolved.costFunction, "result.costFunction");
  const pathSpace = requireRecord(resolved.pathSpace, "result.pathSpace");
  const a0 = requireFiniteNumber(resolved.a0, "result.a0");
  const aF = requireFiniteNumber(resolved.aF, "result.aF");
  const dH = requireFiniteNumber(resolved.dH, "result.dH");
  const freeCost = formatHistoricalLoadCost(a0, costFunction.id);
  const admissibleCost = formatHistoricalLoadCost(aF, costFunction.id);
  const deltaCost = formatHistoricalLoadCost(Math.abs(dH), costFunction.id);
  const pathChanged = free.id !== admissible.id;
  let meaning;
  if (dH > 0) {
    meaning = `Within the ${pathSpace.size} declared paths, "${selectedRegime.label}" moves the minimum from "${free.label}" (${freeCost}) to "${admissible.label}" (${admissibleCost}). The selected constraint therefore adds ${deltaCost}.`;
  } else if (pathChanged) {
    meaning = `"${selectedRegime.label}" changes the selected route from "${free.label}" to "${admissible.label}", but both cost ${freeCost}; the measured load is zero.`;
  } else {
    meaning = `"${selectedRegime.label}" leaves "${free.label}" as the minimum at ${freeCost}; the selected constraint adds no cost under this measure.`;
  }
  return Object.freeze({
    displayedDelta: dH > 0 ? `+${dH}` : String(dH),
    formula: `${aF} - ${a0} = ${dH > 0 ? "+" : ""}${dH} ${String(costFunction.label).toLowerCase()}`,
    freeCost,
    admissibleCost,
    meaning,
    scope: `${costFunction.description} Delta H applies only to this bounded ${pathSpace.size}-path Onto2D comparison. It is not elapsed build time, difficulty, security, completeness, or a live-bootstrap score.`
  });
}
