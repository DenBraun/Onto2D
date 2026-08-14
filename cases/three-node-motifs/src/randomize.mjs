import { createHash } from "node:crypto";
import { adjacencyFor } from "./census.mjs";

function uint32Words(bytes) {
  return Array.from({ length: 4 }, (_, index) => bytes.readUInt32LE(index * 4));
}

export function createTrialRng(seed, trialIndex) {
  const digest = createHash("sha256").update(`${seed}:${trialIndex}`, "utf8").digest();
  let [a, b, c, d] = uint32Words(digest);
  if ((a | b | c | d) === 0) d = 1;

  function uint32() {
    // sfc32: frozen 32-bit stream with explicit unsigned coercions.
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const result = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + result) >>> 0;
    return result;
  }

  function integer(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x1_0000_0000) {
      throw new Error("Random integer bound must be in [1, 2^32].");
    }
    const usableRange = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    let draw;
    do draw = uint32(); while (draw >= usableRange);
    return draw % maxExclusive;
  }

  return Object.freeze({ uint32, integer });
}

export function randomizeByMfinderSwitches({ nodeCount, edges }, rng, switchFactor = 100) {
  if (!Number.isInteger(switchFactor) || switchFactor < 1) throw new Error("Switch factor must be a positive integer.");
  const edgeCount = edges.length;
  const sources = Int32Array.from(edges, ([from]) => from);
  const targets = Int32Array.from(edges, ([, to]) => to);
  const adjacency = adjacencyFor(nodeCount, edges);

  for (const [from, to] of edges) {
    if (adjacency[to * nodeCount + from]) {
      throw new Error("This case implementation expects the selected zero-mutual-edge E. coli graph.");
    }
  }

  const baseAttempts = switchFactor * edgeCount;
  const attempts = edgeCount <= 1 ? 0 : baseAttempts + rng.integer(baseAttempts) + 1;
  let accepted = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const first = rng.integer(edgeCount);
    const second = rng.integer(edgeCount);
    if (first === second) continue;

    const s1 = sources[first];
    const t1 = targets[first];
    const s2 = sources[second];
    const t2 = targets[second];
    if (
      adjacency[s1 * nodeCount + t2] ||
      adjacency[s2 * nodeCount + t1] ||
      adjacency[t2 * nodeCount + s1] ||
      adjacency[t1 * nodeCount + s2] ||
      s1 === s2 || s1 === t2 || t1 === s2 || t1 === t2
    ) continue;

    adjacency[s1 * nodeCount + t1] = 0;
    adjacency[s2 * nodeCount + t2] = 0;
    adjacency[s1 * nodeCount + t2] = 1;
    adjacency[s2 * nodeCount + t1] = 1;
    targets[first] = t2;
    targets[second] = t1;
    accepted += 1;
  }

  return {
    nodeCount,
    edges: Array.from({ length: edgeCount }, (_, index) => [sources[index], targets[index]]),
    adjacency,
    attempts,
    accepted
  };
}
