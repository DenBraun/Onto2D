import { readFile } from "node:fs/promises";

const catalogUrl = new URL("../motif-catalog.json", import.meta.url);
export const CATALOG = Object.freeze(JSON.parse(await readFile(catalogUrl, "utf8")));
export const MOTIFS = Object.freeze(CATALOG.motifs.map((motif) => Object.freeze(motif)));

const NODE_PERMUTATIONS = Object.freeze([
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0]
]);

export function adjacencyId(edges) {
  return edges.reduce((id, [from, to]) => id + 2 ** (from * 3 + to), 0);
}

export function canonicalMfinderId(edges) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const canonicalToInput of NODE_PERMUTATIONS) {
    const inputToCanonical = Array(3);
    canonicalToInput.forEach((inputIndex, canonicalIndex) => {
      inputToCanonical[inputIndex] = canonicalIndex;
    });
    const permuted = edges.map(([from, to]) => [
      inputToCanonical[from],
      inputToCanonical[to]
    ]);
    minimum = Math.min(minimum, adjacencyId(permuted));
  }
  return minimum;
}

function edgesFromMask(mask) {
  const edges = [];
  for (let from = 0; from < 3; from += 1) {
    for (let to = 0; to < 3; to += 1) {
      if (from !== to && (mask & 2 ** (from * 3 + to)) !== 0) edges.push([from, to]);
    }
  }
  return edges;
}

export function isWeaklyConnected(edges) {
  const seen = new Set([0]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [from, to] of edges) {
      if (seen.has(from) && !seen.has(to)) {
        seen.add(to);
        changed = true;
      }
      if (seen.has(to) && !seen.has(from)) {
        seen.add(from);
        changed = true;
      }
    }
  }
  return seen.size === 3;
}

export const MFINDER_ID_BY_LABELLED_MASK = Object.freeze(Array.from({ length: 512 }, (_, mask) => {
  const edges = edgesFromMask(mask);
  return isWeaklyConnected(edges) ? canonicalMfinderId(edges) : null;
}));

export const MOTIF_BY_MFINDER_ID = new Map(MOTIFS.map((motif) => [motif.mfinderId, motif]));
export const MOTIF_BY_TRIAD_CODE = new Map(MOTIFS.map((motif) => [motif.triadCode, motif]));

export function motifCandidate(motif) {
  return {
    domain: CATALOG.identityBasis.candidateDomain,
    nodes: Array.from({ length: 3 }, () => ({ ref: CATALOG.identityBasis.nodeRef })),
    edges: motif.edges.map(([from, to]) => ({
      from,
      to,
      role: CATALOG.identityBasis.edgeRole
    }))
  };
}
