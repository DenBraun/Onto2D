import { readFile } from "node:fs/promises";
import path from "node:path";
import { MFINDER_ID_BY_LABELLED_MASK, MOTIFS, MOTIF_BY_MFINDER_ID } from "./catalog.mjs";

function nonemptyLines(text) {
  return text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

export function parseNodeDictionary(text) {
  const nodes = nonemptyLines(text).map((line, index) => {
    const match = line.match(/^(\d+)\s+(.+)$/u);
    if (!match) throw new Error(`Invalid node dictionary line ${index + 1}.`);
    return { sourceId: Number(match[1]), name: match[2].trim() };
  });
  const uniqueIds = new Set(nodes.map((node) => node.sourceId));
  if (uniqueIds.size !== nodes.length) throw new Error("Node dictionary contains duplicate IDs.");
  return nodes;
}

export function parseInteractions(text, nodes) {
  const indexBySourceId = new Map(nodes.map((node, index) => [node.sourceId, index]));
  const seen = new Set();
  const edges = [];
  for (const [lineIndex, line] of nonemptyLines(text).entries()) {
    const columns = line.split(/\s+/u).map(Number);
    if (columns.length !== 3 || columns.some((value) => !Number.isInteger(value))) {
      throw new Error(`Invalid interaction line ${lineIndex + 1}.`);
    }
    const [targetSourceId, sourceSourceId, binaryValue] = columns;
    if (binaryValue !== 1) throw new Error(`Interaction line ${lineIndex + 1} is not unsigned binary data.`);
    const from = indexBySourceId.get(sourceSourceId);
    const to = indexBySourceId.get(targetSourceId);
    if (from === undefined || to === undefined) throw new Error(`Interaction line ${lineIndex + 1} references an unknown node.`);
    if (from === to) throw new Error(`Interaction line ${lineIndex + 1} contains a self-loop.`);
    const key = `${from}:${to}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push([from, to]);
    }
  }
  return edges;
}

export async function loadEColiNetwork(dataDirectory) {
  const [dictionaryText, interactionText] = await Promise.all([
    readFile(path.join(dataDirectory, "coliInterFullNames.txt"), "utf8"),
    readFile(path.join(dataDirectory, "coliInterNoAutoRegVec.txt"), "utf8")
  ]);
  const nodes = parseNodeDictionary(dictionaryText);
  const edges = parseInteractions(interactionText, nodes);
  return { nodes, edges };
}

export function adjacencyFor(nodeCount, edges) {
  const adjacency = new Uint8Array(nodeCount * nodeCount);
  for (const [from, to] of edges) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= nodeCount || to >= nodeCount) {
      throw new Error(`Edge ${from} -> ${to} falls outside the node universe.`);
    }
    if (from === to) throw new Error("Self-loops are outside the frozen graph convention.");
    const offset = from * nodeCount + to;
    if (adjacency[offset]) throw new Error(`Duplicate edge ${from} -> ${to}.`);
    adjacency[offset] = 1;
  }
  return adjacency;
}

function sortedTriple(first, second, third) {
  let a = first;
  let b = second;
  let c = third;
  if (a > b) [a, b] = [b, a];
  if (b > c) [b, c] = [c, b];
  if (a > b) [a, b] = [b, a];
  return [a, b, c];
}

function labelledMask(adjacency, nodeCount, a, b, c) {
  const nodes = [a, b, c];
  let mask = 0;
  for (let from = 0; from < 3; from += 1) {
    for (let to = 0; to < 3; to += 1) {
      if (from !== to && adjacency[nodes[from] * nodeCount + nodes[to]]) {
        mask += 2 ** (from * 3 + to);
      }
    }
  }
  return mask;
}

export function censusGraph({ nodeCount, edges, adjacency = null }) {
  const matrix = adjacency ?? adjacencyFor(nodeCount, edges);
  const neighbors = Array.from({ length: nodeCount }, () => new Set());
  for (const [from, to] of edges) {
    neighbors[from].add(to);
    neighbors[to].add(from);
  }

  // Every weakly connected three-node graph contains a two-edge undirected
  // wedge. Enumerating wedges and deduplicating node triples avoids scanning
  // all C(n, 3) triples in sparse networks.
  const connectedTriples = new Set();
  for (let center = 0; center < nodeCount; center += 1) {
    const adjacent = [...neighbors[center]];
    for (let left = 0; left < adjacent.length; left += 1) {
      for (let right = left + 1; right < adjacent.length; right += 1) {
        const [a, b, c] = sortedTriple(center, adjacent[left], adjacent[right]);
        connectedTriples.add((a * nodeCount + b) * nodeCount + c);
      }
    }
  }

  const counts = Object.fromEntries(MOTIFS.map((motif) => [motif.triadCode, 0]));
  for (const encoded of connectedTriples) {
    const c = encoded % nodeCount;
    const quotient = (encoded - c) / nodeCount;
    const b = quotient % nodeCount;
    const a = (quotient - b) / nodeCount;
    const mfinderId = MFINDER_ID_BY_LABELLED_MASK[labelledMask(matrix, nodeCount, a, b, c)];
    const motif = MOTIF_BY_MFINDER_ID.get(mfinderId);
    if (!motif) throw new Error(`Connected triad classified to unknown mfinder ID ${mfinderId}.`);
    counts[motif.triadCode] += 1;
  }

  return {
    counts,
    totalConnected: connectedTriples.size
  };
}

export function degreeSequence(nodeCount, edges) {
  const inDegree = Array(nodeCount).fill(0);
  const outDegree = Array(nodeCount).fill(0);
  const adjacency = adjacencyFor(nodeCount, edges);
  const mutualDegree = Array(nodeCount).fill(0);
  for (const [from, to] of edges) {
    outDegree[from] += 1;
    inDegree[to] += 1;
    if (adjacency[to * nodeCount + from]) mutualDegree[from] += 1;
  }
  return { inDegree, outDegree, mutualDegree };
}
