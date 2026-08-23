import { deepFreeze } from "@onto2d/kernel/canonical";

export const ArtifactKind = deepFreeze({
  EvidenceArtifact: "EvidenceArtifact",
  CodingClaim: "CodingClaim",
  DerivedArtifact: "DerivedArtifact"
});

export const DerivationOperation = deepFreeze({
  DirectCoding: "DirectCoding",
  Inference: "Inference",
  Imputation: "Imputation",
  DeterministicDerivation: "DeterministicDerivation",
  Aggregation: "Aggregation",
  StatisticalEstimation: "StatisticalEstimation",
  ManualResolution: "ManualResolution",
  ImportedPublishedResult: "ImportedPublishedResult"
});

export const ResolutionState = deepFreeze({
  Resolved: "Resolved",
  Unknown: "Unknown",
  SuspectedUnknown: "SuspectedUnknown",
  Disputed: "Disputed",
  Transitional: "Transitional",
  Range: "Range",
  NotApplicable: "NotApplicable",
  Uncoded: "Uncoded"
});

export const EvidenceBasis = deepFreeze({
  Measurement: "Measurement",
  DirectHistoricalAttestation: "DirectHistoricalAttestation",
  ArchaeologicalObservation: "ArchaeologicalObservation",
  SecondaryScholarship: "SecondaryScholarship",
  ExpertCommunication: "ExpertCommunication",
  ExpertJudgment: "ExpertJudgment",
  UnknownBasis: "UnknownBasis"
});

export const ReviewStatus = deepFreeze({
  Unknown: "unknown",
  RaCoded: "RA-coded",
  ExpertReviewed: "expert-reviewed",
  DrbReviewed: "DRB-reviewed",
  Other: "other"
});

export const AgreementStatus = deepFreeze({
  Agreed: "agreed",
  Disputed: "disputed",
  MultipleAlternatives: "multiple-alternatives",
  Unknown: "unknown"
});

export const Precision = deepFreeze({
  Exact: "exact",
  Range: "range",
  Interval: "interval",
  Approximate: "approximate",
  Unknown: "unknown"
});

export const SupportGroupType = deepFreeze({
  SourceRecord: "SourceRecord",
  SourceWork: "SourceWork",
  SourceFamily: "SourceFamily",
  ResearchAssistant: "ResearchAssistant",
  Expert: "Expert",
  Reviewer: "Reviewer",
  ReviewEpisode: "ReviewEpisode",
  Narrative: "Narrative",
  DataPropagationEpisode: "DataPropagationEpisode"
});

const enumSets = deepFreeze({
  artifactKind: new Set(Object.values(ArtifactKind)),
  derivationOperation: new Set(Object.values(DerivationOperation)),
  resolutionState: new Set(Object.values(ResolutionState)),
  evidenceBasis: new Set(Object.values(EvidenceBasis)),
  reviewStatus: new Set(Object.values(ReviewStatus)),
  agreementStatus: new Set(Object.values(AgreementStatus)),
  precision: new Set(Object.values(Precision)),
  supportGroupType: new Set(Object.values(SupportGroupType))
});

const NATIVE_CODE_TABLE = deepFreeze({
  A: { semanticValue: "absent", resolutionState: ResolutionState.Resolved, derivationOperation: DerivationOperation.DirectCoding },
  P: { semanticValue: "present", resolutionState: ResolutionState.Resolved, derivationOperation: DerivationOperation.DirectCoding },
  "A*": { semanticValue: "absent", resolutionState: ResolutionState.Resolved, derivationOperation: DerivationOperation.Inference },
  "P*": { semanticValue: "present", resolutionState: ResolutionState.Resolved, derivationOperation: DerivationOperation.Inference },
  U: { semanticValue: null, resolutionState: ResolutionState.Unknown, derivationOperation: DerivationOperation.DirectCoding },
  "U*": { semanticValue: null, resolutionState: ResolutionState.SuspectedUnknown, derivationOperation: DerivationOperation.DirectCoding },
  "A~P": { semanticValue: ["absent", "present"], resolutionState: ResolutionState.Transitional, derivationOperation: DerivationOperation.DirectCoding },
  "P~A": { semanticValue: ["present", "absent"], resolutionState: ResolutionState.Transitional, derivationOperation: DerivationOperation.DirectCoding },
  "A;P": { semanticValue: ["absent", "present"], resolutionState: ResolutionState.Disputed, derivationOperation: DerivationOperation.DirectCoding },
  NA: { semanticValue: null, resolutionState: ResolutionState.NotApplicable, derivationOperation: DerivationOperation.DirectCoding },
  "": { semanticValue: null, resolutionState: ResolutionState.Uncoded, derivationOperation: DerivationOperation.DirectCoding }
});

function fail(message) {
  throw new TypeError(`Seshat epistemic model rejected: ${message}`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) fail(`${label} must be a normalized non-empty string`);
  return value;
}

function requireEnum(axis, value) {
  if (!enumSets[axis]?.has(value)) fail(`${axis} contains an unsupported value`);
  return value;
}

export function parseNativeSeshatCode(nativeCode) {
  if (typeof nativeCode !== "string" || !Object.hasOwn(NATIVE_CODE_TABLE, nativeCode)) fail(`unsupported native code ${String(nativeCode)}`);
  return deepFreeze({ nativeCode, ...structuredClone(NATIVE_CODE_TABLE[nativeCode]) });
}

export function roundTripNativeSeshatCode(parsed) {
  if (!parsed || typeof parsed !== "object" || typeof parsed.nativeCode !== "string") fail("parsed native code is invalid");
  const expected = parseNativeSeshatCode(parsed.nativeCode);
  if (JSON.stringify(expected) !== JSON.stringify(parsed)) fail("parsed native code has been semantically mutated");
  return parsed.nativeCode;
}

function nativeDecimalLexeme(value, label) {
  if (typeof value !== "string" || value !== value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    fail(`${label} must be an exact finite decimal lexeme`);
  }
  return value;
}

function nativeYear(value, label) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value)) fail(`${label} must be a safe integer year or null`);
  return value;
}

export function createNativeSeshatTimeBounds(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("native time bounds must be an object");
  const bounds = {
    yearFrom: nativeYear(input.yearFrom, "timeBounds.yearFrom"),
    yearTo: nativeYear(input.yearTo, "timeBounds.yearTo")
  };
  if (bounds.yearFrom !== null && bounds.yearTo !== null && bounds.yearFrom > bounds.yearTo) fail("timeBounds.yearFrom cannot exceed yearTo");
  return deepFreeze(bounds);
}

export function roundTripNativeSeshatTimeBounds(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("parsed native time bounds are invalid");
  const expected = createNativeSeshatTimeBounds(parsed);
  if (JSON.stringify(expected) !== JSON.stringify(parsed)) fail("parsed native time bounds have been mutated or extended");
  return parsed;
}

export function createNativeSeshatRange(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("native range must be an object");
  const range = {
    valueFrom: nativeDecimalLexeme(input.valueFrom, "range.valueFrom"),
    valueTo: nativeDecimalLexeme(input.valueTo, "range.valueTo"),
    timeBounds: createNativeSeshatTimeBounds(input.timeBounds ?? { yearFrom: null, yearTo: null })
  };
  if (Number(range.valueFrom) > Number(range.valueTo)) fail("range.valueFrom cannot exceed valueTo");
  return deepFreeze(range);
}

export function roundTripNativeSeshatRange(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("parsed native range is invalid");
  const expected = createNativeSeshatRange(parsed);
  if (JSON.stringify(expected) !== JSON.stringify(parsed)) fail("parsed native range has been mutated or extended");
  return parsed;
}

export function satisfiesResolvedCategoricalValue(parsed, semanticValue) {
  if (semanticValue !== "absent" && semanticValue !== "present") fail("resolved categorical comparison requires absent or present");
  roundTripNativeSeshatCode(parsed);
  return parsed.resolutionState === ResolutionState.Resolved && parsed.semanticValue === semanticValue;
}

export function directlyAttestsResolvedCategoricalValue(parsed, semanticValue) {
  return satisfiesResolvedCategoricalValue(parsed, semanticValue) && parsed.derivationOperation === DerivationOperation.DirectCoding;
}

export function createEpistemicArtifact(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = {
    id: requiredString(input.id, "artifact.id"),
    artifactKind: requireEnum("artifactKind", input.artifactKind),
    artifactSubtype: requiredString(input.artifactSubtype, "artifact.artifactSubtype"),
    nativeIdentity: requiredString(input.nativeIdentity, "artifact.nativeIdentity"),
    claimIdentity: input.claimIdentity === null ? null : requiredString(input.claimIdentity, "artifact.claimIdentity"),
    derivationOperation: input.derivationOperation === null ? null : requireEnum("derivationOperation", input.derivationOperation),
    resolutionState: input.resolutionState === null ? null : requireEnum("resolutionState", input.resolutionState),
    evidenceBasis: requireEnum("evidenceBasis", input.evidenceBasis),
    reviewStatus: requireEnum("reviewStatus", input.reviewStatus),
    agreementStatus: requireEnum("agreementStatus", input.agreementStatus),
    precision: requireEnum("precision", input.precision),
    mappingIdentity: input.mappingIdentity === null ? null : requiredString(input.mappingIdentity, "artifact.mappingIdentity"),
    labels: structuredClone(input.labels ?? {})
  };

  if (artifact.artifactKind === ArtifactKind.EvidenceArtifact && artifact.derivationOperation !== null) {
    fail("EvidenceArtifact cannot carry a derivation operation");
  }
  if (artifact.artifactKind !== ArtifactKind.EvidenceArtifact && artifact.derivationOperation === null) {
    fail(`${artifact.artifactKind} requires a derivation operation`);
  }
  if (artifact.artifactKind === ArtifactKind.CodingClaim && artifact.claimIdentity === null) {
    fail("CodingClaim requires claim identity");
  }
  if (artifact.artifactKind === ArtifactKind.EvidenceArtifact && artifact.resolutionState !== null) {
    fail("EvidenceArtifact cannot carry a claim resolution state");
  }
  if (artifact.artifactKind !== ArtifactKind.EvidenceArtifact && artifact.resolutionState === null) {
    fail(`${artifact.artifactKind} requires a resolution state`);
  }
  return deepFreeze(artifact);
}

export function createSupportGroup(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("support group must be an object");
  if (!Array.isArray(input.memberNodeIds) || input.memberNodeIds.length === 0) fail("support group requires member nodes");
  const members = input.memberNodeIds.map((id) => requiredString(id, "supportGroup.memberNodeIds entry"));
  if (new Set(members).size !== members.length) fail("support group member nodes must be unique");
  return deepFreeze({
    id: requiredString(input.id, "supportGroup.id"),
    type: requireEnum("supportGroupType", input.type),
    label: requiredString(input.label, "supportGroup.label"),
    memberNodeIds: [...members].sort()
  });
}

export function assertAxisValue(axis, value) {
  return requireEnum(axis, value);
}

export const NativeSeshatCodes = Object.freeze(Object.keys(NATIVE_CODE_TABLE));
