import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { MOTIFS } from "./src/catalog.mjs";
import { censusGraph, degreeSequence, loadEColiNetwork } from "./src/census.mjs";
import { createTrialRng, randomizeByMfinderSwitches } from "./src/randomize.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));

function parseArguments(argv) {
  const options = {
    dataDirectory: path.join(caseRoot, "sources"),
    output: path.join(caseRoot, "artifacts", "analysis.json"),
    trials: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--data-dir" && value) options.dataDirectory = path.resolve(value);
    else if (flag === "--output" && value) options.output = path.resolve(value);
    else if (flag === "--trials" && value) options.trials = Number(value);
    else throw new Error(`Unknown or incomplete argument: ${flag}`);
    index += 1;
  }
  if (options.trials !== null && (!Number.isInteger(options.trials) || options.trials < 1)) {
    throw new Error("--trials must be a positive integer.");
  }
  return options;
}

function sampleStandardDeviation(sum, sumSquares, count) {
  if (count < 2) return 0;
  const centered = sumSquares - (sum * sum / count);
  return Math.sqrt(Math.max(0, centered / (count - 1)));
}

async function sha256File(filename) {
  const bytes = await readFile(filename);
  return {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function verifySelectedSources(dataDirectory) {
  const lock = JSON.parse(await readFile(new URL("./source-lock.json", import.meta.url), "utf8"));
  const selectedNames = ["coliInterNoAutoRegVec.txt", "coliInterFullNames.txt"];
  const verified = {};
  for (const localName of selectedNames) {
    const expected = lock.sources.find((source) => source.localName === localName);
    if (!expected) throw new Error(`Source lock is missing ${localName}.`);
    const actual = await sha256File(path.join(dataDirectory, localName));
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`${localName} does not match its frozen byte length and SHA-256.`);
    }
    verified[localName] = actual;
  }
  return verified;
}

function rankRows(rows) {
  return [...rows].sort((left, right) => {
    const leftFinite = Number.isFinite(left.zScore);
    const rightFinite = Number.isFinite(right.zScore);
    if (leftFinite !== rightFinite) return leftFinite ? -1 : 1;
    if (leftFinite && left.zScore !== right.zScore) return right.zScore - left.zScore;
    return left.canonicalId.localeCompare(right.canonicalId);
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function runAnalysis({ dataDirectory, trials, onProgress = null }) {
  const nullModel = JSON.parse(await readFile(new URL("./null-model.json", import.meta.url), "utf8"));
  const trialCount = trials ?? nullModel.execution.trials;
  const verifiedSources = await verifySelectedSources(dataDirectory);
  const network = await loadEColiNetwork(dataDirectory);
  const nodeCount = network.nodes.length;
  if (nodeCount !== 424 || network.edges.length !== 519) {
    throw new Error(`Frozen dataset must contain 424 nodes and 519 edges; received ${nodeCount} and ${network.edges.length}.`);
  }
  const observedCensus = censusGraph({ nodeCount, edges: network.edges });
  const observedDegrees = degreeSequence(nodeCount, network.edges);
  const accumulators = Object.fromEntries(MOTIFS.map((motif) => [motif.triadCode, {
    sum: 0,
    sumSquares: 0,
    upperTail: 0
  }]));
  let attemptedSwitches = 0;
  let acceptedSwitches = 0;

  for (let trialIndex = 0; trialIndex < trialCount; trialIndex += 1) {
    const rng = createTrialRng(nullModel.execution.seed, trialIndex);
    const randomized = randomizeByMfinderSwitches({ nodeCount, edges: network.edges }, rng);
    const census = censusGraph(randomized);
    attemptedSwitches += randomized.attempts;
    acceptedSwitches += randomized.accepted;
    for (const motif of MOTIFS) {
      const value = census.counts[motif.triadCode];
      const accumulator = accumulators[motif.triadCode];
      accumulator.sum += value;
      accumulator.sumSquares += value * value;
      if (value >= observedCensus.counts[motif.triadCode]) accumulator.upperTail += 1;
    }
    if (onProgress && ((trialIndex + 1) % 50 === 0 || trialIndex + 1 === trialCount)) {
      onProgress(trialIndex + 1, trialCount);
    }
  }

  const unranked = MOTIFS.map((motif) => {
    const observed = observedCensus.counts[motif.triadCode];
    const accumulator = accumulators[motif.triadCode];
    const nullMean = accumulator.sum / trialCount;
    const nullStandardDeviation = sampleStandardDeviation(accumulator.sum, accumulator.sumSquares, trialCount);
    const zScore = nullStandardDeviation > 0 ? (observed - nullMean) / nullStandardDeviation : null;
    return {
      triadCode: motif.triadCode,
      name: motif.name,
      mfinderId: motif.mfinderId,
      canonicalId: motif.canonicalId,
      observed,
      nullMean,
      nullStandardDeviation,
      zScore,
      foldEnrichment: nullMean > 0 ? observed / nullMean : null,
      relativeEnrichment: nullMean > 0 ? (observed - nullMean) / nullMean : null,
      empiricalUpperP: accumulator.upperTail / trialCount,
      significant: accumulator.upperTail / trialCount < 0.01
    };
  });
  const ranked = rankRows(unranked);
  const zNorm = Math.sqrt(ranked.reduce((sum, row) => sum + (Number.isFinite(row.zScore) ? row.zScore ** 2 : 0), 0));
  const motifs = ranked.map((row) => ({
    ...row,
    significanceProfile: Number.isFinite(row.zScore) && zNorm > 0 ? row.zScore / zNorm : null
  }));
  const ffl = motifs.find((row) => row.triadCode === "030T");
  const significant = motifs.filter((row) => row.significant).map((row) => row.triadCode);

  return {
    schemaVersion: "1",
    caseId: "three-node-motifs",
    generatedBy: "cases/three-node-motifs/run.mjs",
    dataset: {
      name: "ColiNet 1.0 E. coli transcription network without autoregulation",
      nodeCount,
      edgeCount: network.edges.length,
      nonisolatedNodeCount: observedDegrees.inDegree.filter((value, index) => value + observedDegrees.outDegree[index] > 0).length,
      mutualDirectedEdgeCount: observedDegrees.mutualDegree.reduce((sum, value) => sum + value, 0),
      interactionSha256: verifiedSources["coliInterNoAutoRegVec.txt"].sha256,
      dictionarySha256: verifiedSources["coliInterFullNames.txt"].sha256
    },
    observed: {
      totalConnectedTriads: observedCensus.totalConnected,
      counts: observedCensus.counts
    },
    nullExecution: {
      trials: trialCount,
      seed: nullModel.execution.seed,
      prng: nullModel.execution.prng,
      attemptedSwitches,
      acceptedSwitches,
      acceptanceRate: attemptedSwitches > 0 ? acceptedSwitches / attemptedSwitches : 0
    },
    motifs,
    comparison: {
      publishedTopMotif: "030T",
      observedFflMatchesPublished40: ffl.observed === 40,
      onto2dTopMotif: motifs[0].triadCode,
      topRankingAgrees: motifs[0].triadCode === "030T",
      significantTriadsAtPublishedThreshold: significant,
      onlyFflSignificant: significant.length === 1 && significant[0] === "030T",
      roundedNullResultCompatible: Math.abs(ffl.nullMean - 7) <= 1 &&
        Math.abs(ffl.nullStandardDeviation - 3) <= 0.5 &&
        Math.abs(ffl.zScore - 10) <= 1,
      publishedRoundedFfl: { observed: 40, nullMean: 7, nullStandardDeviation: 3, zScore: 10 }
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const result = await runAnalysis({
    dataDirectory: options.dataDirectory,
    trials: options.trials,
    onProgress: (completed, total) => process.stderr.write(`Null trials: ${completed}/${total}\n`)
  });
  await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${options.output}\n`);
}
