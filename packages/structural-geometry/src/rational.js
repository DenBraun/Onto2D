// Internal exact arithmetic for the explicitly bounded experimental profile.
export const SCALE = 10n ** 12n;
const abs = (n) => n < 0n ? -n : n;
function gcd(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return abs(a);
}
export function fraction(n, d = 1n) {
  if (d === 0n) throw new RangeError("Zero rational denominator.");
  if (d < 0n) [n, d] = [-n, -d];
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}
export function decimalFraction(value) {
  const text = JSON.stringify(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(text);
  if (!match) throw new TypeError("A finite canonical JSON number is required.");
  const places = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
  const n = BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`);
  return places >= 0 ? fraction(n, 10n ** BigInt(places)) : fraction(n * 10n ** BigInt(-places));
}
export const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const divide = (a, b) => fraction(a.n * b.d, a.d * b.n);
export const encodedFraction = (value) => ({ numerator: String(value.n), denominator: String(value.d) });
export const encodedInterval = (lower, upper = lower) => ({ lowerTicks: String(lower), upperTicks: String(upper) });

function isqrt(n) {
  if (n < 0n) throw new RangeError("A nonnegative square-root operand is required.");
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const next = (x + n / x) / 2n;
    if (next >= x) return x;
    x = next;
  }
}

export function sqrtBounds(ratio) {
  const scaledNumerator = ratio.n * SCALE * SCALE;
  const lower = isqrt(scaledNumerator / ratio.d);
  const upper = lower * lower * ratio.d === scaledNumerator ? lower : lower + 1n;
  return [lower, upper];
}
