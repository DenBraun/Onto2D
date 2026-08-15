const PRECURSOR_CODES = Object.freeze(["021D", "021U", "021C"]);
const REGIMES = Object.freeze({
  observed: Object.freeze({
    id: "observed",
    label: "Observed support",
    accepts: (motif) => motif.observed > 0
  }),
  significant: Object.freeze({
    id: "significant",
    label: "Significant only",
    accepts: (motif) => motif.significant
  })
});

function motifMap(data) {
  return new Map(data.motifs.map((motif) => [motif.triadCode, motif]));
}

function requiredMotif(byCode, code) {
  const motif = byCode.get(code);
  if (!motif) throw new Error(`Missing motif ${code}.`);
  return motif;
}

function isNullFixedAbsence(motif) {
  return motif.observed === 0 && motif.nullMean === 0 && motif.nullStandardDeviation === 0;
}

export function deriveEcoliReading(data) {
  const byCode = motifMap(data);
  const target = requiredMotif(byCode, "030T");
  const precursors = PRECURSOR_CODES.map((code) => requiredMotif(byCode, code));
  const observedClasses = data.motifs.filter((motif) => motif.observed > 0);
  const nullFixedClasses = data.motifs.filter(isNullFixedAbsence);
  const allowedButAbsentClasses = data.motifs.filter((motif) =>
    motif.observed === 0 && !isNullFixedAbsence(motif)
  );

  return Object.freeze({
    target,
    precursors: Object.freeze(precursors.map((motif) => Object.freeze({
      ...motif,
      deltaFromNull: motif.observed - motif.nullMean
    }))),
    targetDeltaFromNull: target.observed - target.nullMean,
    targetOccurrenceShare: target.observed / data.dataset.totalConnectedTriads,
    targetExcessFraction: (target.observed - target.nullMean) / target.observed,
    observedClassCount: observedClasses.length,
    allowedButAbsentCodes: Object.freeze(allowedButAbsentClasses.map((motif) => motif.triadCode)),
    nullFixedClassCount: nullFixedClasses.length
  });
}

export function analyzeFflConstruction(data, regimeId) {
  const regime = REGIMES[regimeId];
  if (!regime) throw new Error(`Unknown construction regime: ${regimeId}`);
  const reading = deriveEcoliReading(data);
  const acceptedPrecursors = reading.precursors.filter(regime.accepts);
  const targetAccepted = regime.accepts(reading.target);
  const freePathLength = reading.target.edges.length;
  const admissiblePathLength = targetAccepted && acceptedPrecursors.length > 0
    ? freePathLength
    : Number.POSITIVE_INFINITY;

  return Object.freeze({
    regime: Object.freeze({ id: regime.id, label: regime.label }),
    freePathLength,
    admissiblePathLength,
    historicalLoad: Number.isFinite(admissiblePathLength)
      ? admissiblePathLength - freePathLength
      : Number.POSITIVE_INFINITY,
    acceptedPrecursorCodes: Object.freeze(acceptedPrecursors.map((motif) => motif.triadCode)),
    survivingEdgeOrders: targetAccepted ? acceptedPrecursors.length * 2 : 0,
    totalEdgeOrders: 6
  });
}

export const ECOLI_CONSTRUCTION_REGIMES = Object.freeze(
  Object.values(REGIMES).map(({ id, label }) => Object.freeze({ id, label }))
);
