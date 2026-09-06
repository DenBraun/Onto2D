import { EngineError } from "@onto2d/engine";
import { fraction, add, divide, encodedFraction } from "./rational.js";
import { STRUCTURAL_FLOW_POLICY } from "./flow-policy.js";

export const fail = (code, message) => { throw new EngineError(`STRUCTURAL_FLOW_${code}`, message); };
export const limits = STRUCTURAL_FLOW_POLICY.limits;
export const ZERO = Object.freeze(fraction(0n));
export const ONE = Object.freeze(fraction(1n));
export const F = (value) => fraction(BigInt(value));
export const plus = add;
export const div = divide;
export const sub = (a, b) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => fraction(a.n * b.n, a.d * b.d);
export const compare = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export const absolute = (a) => fraction(a.n < 0n ? -a.n : a.n, a.d);
export const sum = (values) => values.reduce(plus, ZERO);
export const maximum = (values) => values.reduce((a, b) => compare(a, b) > 0 ? a : b);
export const minimum = (values) => values.reduce((a, b) => compare(a, b) < 0 ? a : b);

export function fields(value, allowed, required = allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    fail("INPUT_INVALID", "Object fields differ from the closed structural flow contract.");
  }
}

export function encode(value) {
  const output = encodedFraction(value);
  if (Object.values(output).some((text) => text.replace("-", "").length > limits.maxRationalDigits)) {
    fail("NUMERIC_LIMIT", "Exact rational arithmetic exceeds the declared digit bound.");
  }
  return output;
}

export function rational(value, positive = false) {
  fields(value, ["numerator", "denominator"]);
  if (typeof value.numerator !== "string" || typeof value.denominator !== "string" ||
      value.numerator.length > limits.maxRationalDigits + 1 || value.denominator.length > limits.maxRationalDigits ||
      !/^(0|-?[1-9][0-9]*)$/.test(value.numerator) || !/^[1-9][0-9]*$/.test(value.denominator)) {
    fail("INPUT_INVALID", "Expected bounded reduced rational integer strings.");
  }
  const result = fraction(BigInt(value.numerator), BigInt(value.denominator));
  const encoded = encode(result);
  if (encoded.numerator !== value.numerator || encoded.denominator !== value.denominator || (positive && result.n <= 0n)) {
    fail("INPUT_INVALID", "Rational values must be reduced and satisfy the requested sign.");
  }
  return result;
}

export function integer(value, low, high) {
  if (!Number.isSafeInteger(value) || value < low || value > high) fail("INPUT_INVALID", "Integer is outside the flow profile bounds.");
  return value;
}

export function ids(value, low, high) {
  if (!Array.isArray(value) || value.length < low || value.length > high ||
      value.some((id) => typeof id !== "string" || !id || id.length > 1024) || new Set(value).size !== value.length) {
    fail("INPUT_INVALID", "IDs must be bounded unique nonempty strings.");
  }
  return [...value].sort();
}

// Floyd-Warshall over exact positive lengths; null denotes an unreachable pair.
export function allDistances(graph, lengths) {
  const index = new Map(graph.nodes.map((node, i) => [node.id, i]));
  const size = index.size;
  const rows = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i === j ? ZERO : null));
  graph.edges.forEach((edge, i) => { rows[index.get(edge.source)][index.get(edge.target)] = lengths[i]; });
  for (let k = 0; k < size; k += 1) for (let i = 0; i < size; i += 1) {
    if (rows[i][k] === null) continue;
    for (let j = 0; j < size; j += 1) {
      if (rows[k][j] === null) continue;
      const candidate = plus(rows[i][k], rows[k][j]);
      if (rows[i][j] === null || compare(candidate, rows[i][j]) < 0) rows[i][j] = candidate;
    }
  }
  return (source, target) => rows[index.get(source)][index.get(target)];
}

export function normalizeMetric(graph, raw) {
  const distances = allDistances(graph, raw);
  const closed = graph.edges.map((edge) => distances(edge.source, edge.target));
  const rawSum = sum(raw); const closedSum = sum(closed);
  const factor = div(F(graph.edges.length), closedSum);
  const lengths = closed.map((length) => mul(length, factor));
  return { lengths, normalization: { rawSum: encode(rawSum), closureSum: encode(closedSum), factor: encode(factor),
    shortenedEdgeIds: graph.edges.filter((_, i) => compare(closed[i], raw[i]) < 0).map((edge) => edge.id) } };
}
