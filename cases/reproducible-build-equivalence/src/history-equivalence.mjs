import { hashCanonical } from "@onto2d/kernel/canonical";

const PROJECTION_DOMAIN = "onto2d:build-history-equivalence-projection:v1";
const REGIME_IDS = Object.freeze(["byte-output", "declared-input", "toolchain", "environment", "provenance"]);

function fail(message) {
  throw new Error(`Build History Equivalence failed: ${message}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readPath(value, field) {
  let current = value;
  for (const part of field.split(".")) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, part)) fail(`missing compared field ${field}`);
    current = current[part];
  }
  return structuredClone(current);
}

export function validateEquivalenceProfile(input) {
  const profile = structuredClone(input);
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) fail("profile must be an object");
  if (!same(Object.keys(profile).sort(), ["format", "formatVersion", "nonClaims", "pairOrder", "profileVersion", "regimes"].sort())) fail("profile fields are not closed");
  if (profile?.format !== "onto2d-build-history-equivalence-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "build-history-equivalence-v1") fail("unsupported equivalence profile");
  if (!Array.isArray(profile.regimes) || !same(profile.regimes.map((regime) => regime.id), REGIME_IDS)) fail("regime inventory is incomplete or reordered");
  for (const regime of profile.regimes) {
    const expectedKeys = regime.id === "environment"
      ? ["id", "label", "question", "fields", "excludedFields", "normalization"]
      : ["id", "label", "question", "fields", "normalization"];
    if (!same(Object.keys(regime).sort(), expectedKeys.sort())) fail(`${regime.id} fields are not closed`);
    if (!Array.isArray(regime.fields) || !regime.fields.length || new Set(regime.fields).size !== regime.fields.length) fail(`${regime.id} compared fields are invalid`);
    if (![regime.label, regime.question, regime.normalization].every((value) => typeof value === "string" && value.length > 0)) fail(`${regime.id} explanatory fields are invalid`);
    if (!regime.fields.every((field) => typeof field === "string" && /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(field))) fail(`${regime.id} compared field paths are invalid`);
    if (regime.id === "environment" && !same(regime.excludedFields, ["environment.observedIrrelevant.ONTO2D_SESSION_LABEL"])) fail("environment exclusions differ");
  }
  if (!Array.isArray(profile.pairOrder) || profile.pairOrder.length !== 3 || new Set(profile.pairOrder).size !== 3) fail("pair order is invalid");
  if (!Array.isArray(profile.nonClaims) || profile.nonClaims.length < 5 || new Set(profile.nonClaims).size !== profile.nonClaims.length || !profile.nonClaims.every((value) => typeof value === "string" && value.length > 0)) fail("non-claim boundary is incomplete or invalid");
  return Object.freeze(profile);
}

function projection(record, regime) {
  const values = Object.fromEntries(regime.fields.map((field) => [field, readPath(record, field)]));
  return Object.freeze({
    values,
    identity: hashCanonical(PROJECTION_DOMAIN, { regime: regime.id, values })
  });
}

export function compareBuildHistories(comparison, left, right, profileInput) {
  const profile = validateEquivalenceProfile(profileInput);
  if (comparison.left !== left.executionId || comparison.right !== right.executionId) fail(`${comparison.id} history order differs`);
  if (left.executionId === right.executionId || left.historyIdentity === right.historyIdentity) fail(`${comparison.id} must compare distinct historical records`);
  const regimes = profile.regimes.map((regime) => {
    const leftProjection = projection(left, regime);
    const rightProjection = projection(right, regime);
    const differingFields = regime.fields.filter((field) => !same(readPath(left, field), readPath(right, field)));
    const equal = leftProjection.identity === rightProjection.identity;
    if (equal !== (differingFields.length === 0)) fail(`${comparison.id}/${regime.id} projection and field comparison disagree`);
    return Object.freeze({
      regimeId: regime.id,
      label: regime.label,
      question: regime.question,
      comparedFields: [...regime.fields],
      excludedFields: [...(regime.excludedFields ?? [])],
      normalization: regime.normalization,
      leftProjectionIdentity: leftProjection.identity,
      rightProjectionIdentity: rightProjection.identity,
      differingFields,
      equal
    });
  });
  return Object.freeze({
    id: comparison.id,
    label: comparison.label,
    leftHistory: left.executionId,
    rightHistory: right.executionId,
    historiesDistinct: true,
    regimes
  });
}

export const BUILD_EQUIVALENCE_REGIME_IDS = REGIME_IDS;
