// Shared original experiment operations. Keep legacy normalization, errors and hash domains stable.
import { canonicalClone, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { UNIT_METRIC_POLICY } from "./policies.js";
import { TYPED_SELECTION_POLICY, INVERSE_TARGET_SHARE_METRIC_POLICY, STRUCTURAL_INTERVAL_POLICY } from "./experiment-policies.js";
import { fraction, decimalFraction, add, divide, encodedFraction } from "./rational.js";

function fail(code, message, details = {}) {
  throw new EngineError(`STRUCTURAL_EXPERIMENT_${code}`, message, details);
}
const hash = (name, value) => hashCanonical(`onto2d:${name}:v1`, value);
const seal = (name, body) => deepFreeze({ ...body, artifactHash: hash(name, body) });

function object(value, fields, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("INPUT_INVALID", `${label} must be a plain object.`);
  }
  const result = canonicalClone(value);
  if (Object.keys(result).some((field) => !fields.includes(field))) {
    fail("INPUT_INVALID", `${label} contains unsupported fields.`);
  }
  return result;
}

export function normalize(input) {
  const value = object(input, ["selection", "metricPolicyId"], "request");
  const metricPolicyId = value.metricPolicyId ?? "unit-v1";
  if (value.metricPolicyId === null || !["unit-v1", "inverse-target-share-v1"].includes(metricPolicyId)) {
    fail("METRIC_UNSUPPORTED", "The requested experimental metric is unsupported.");
  }
  const raw = value.selection === undefined ? { kind: "all" } : value.selection;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail("INPUT_INVALID", "selection must be a plain object.");
  const allowed = {
    all: ["kind"], necessity: ["kind", "through"], roles: ["kind", "roles"], channel: ["kind", "field", "value"]
  };
  if (typeof raw.kind !== "string" || !Object.hasOwn(allowed, raw.kind)) {
    fail("SELECTION_UNSUPPORTED", "The selection kind must be a supported string.");
  }
  const selection = object(raw, allowed[raw.kind], "selection");
  if (selection.kind === "necessity" && !TYPED_SELECTION_POLICY.necessityOrder.includes(selection.through)) {
    fail("SELECTION_UNSUPPORTED", "Necessity selections require a supported endpoint.");
  }
  if (selection.kind === "roles") {
    if (!Array.isArray(selection.roles) || selection.roles.length === 0 || selection.roles.length > 3 ||
      selection.roles.some((role) => !TYPED_SELECTION_POLICY.roleUniverse.includes(role)) ||
      new Set(selection.roles).size !== selection.roles.length) {
      fail("SELECTION_UNSUPPORTED", "Role selections require a nonempty unique subset of supported roles.");
    }
    selection.roles.sort();
  }
  if (selection.kind === "channel" && (!TYPED_SELECTION_POLICY.channels.includes(selection.field) ||
      !Number.isSafeInteger(selection.value) || selection.value < 0)) {
    fail("SELECTION_UNSUPPORTED", "Channel selections require a supported field and nonnegative integer code.");
  }
  return { selection, metricPolicyId };
}

export function select(projection, selection) {
  const selected = [];
  const excludedEdgeIds = [];
  const missingChannelEdgeIds = [];
  for (const edge of projection.edges) {
    let included = true;
    if (selection.kind === "necessity") {
      const index = TYPED_SELECTION_POLICY.necessityOrder.indexOf(edge.attributes.necessity);
      if (index < 0) fail("CATEGORY_INVALID", "Every source edge requires a known necessity for this selection.", { edgeId: edge.id });
      included = index <= TYPED_SELECTION_POLICY.necessityOrder.indexOf(selection.through);
    } else if (selection.kind === "roles") {
      const role = edge.attributes.ontologicalRole;
      if (!TYPED_SELECTION_POLICY.roleUniverse.includes(role)) fail("CATEGORY_INVALID", "Every source edge requires a known ontological role for this selection.", { edgeId: edge.id });
      included = selection.roles.includes(role);
    } else if (selection.kind === "channel") {
      if (!Object.hasOwn(edge.attributes, selection.field)) {
        missingChannelEdgeIds.push(edge.id);
        included = false;
      } else {
        const attribute = edge.attributes[selection.field];
        const values = selection.field === "dependencyTypeId" ? [attribute] : attribute;
        if (!Array.isArray(values) || values.some((v) => !Number.isSafeInteger(v) || v < 0) || new Set(values).size !== values.length) {
          fail("CHANNEL_INVALID", "Present channel values must be nonnegative integer codes without duplicates.", { edgeId: edge.id });
        }
        included = values.includes(selection.value);
      }
    }
    if (included) selected.push(edge);
    else excludedEdgeIds.push(edge.id);
  }
  const body = {
    sourceProjectionHash: projection.projectionHash,
    policyHash: hash("structural-selection-policy", TYPED_SELECTION_POLICY),
    selection, nodeIds: projection.nodes.map((node) => node.id),
    edges: selected.map(({ id, source, target }) => ({ id, source, target }))
  };
  return {
    edges: selected, projectionHash: hash("structural-selected-projection", body),
    accounting: {
      sourceNodeCount: projection.nodes.length, sourceEdgeCount: projection.edges.length,
      selectedEdgeIds: selected.map((edge) => edge.id), excludedEdgeIds, missingChannelEdgeIds
    }
  };
}

export function weightAudit(projection) {
  const incoming = new Map(projection.nodes.map((node) => [node.id, []]));
  const invalidWeights = [];
  for (const edge of projection.edges) {
    const value = edge.attributes.weight;
    let reason = null;
    if (!Object.hasOwn(edge.attributes, "weight")) reason = "missing";
    else if (typeof value !== "number") reason = "not-a-number";
    else if (value === 0) reason = "zero";
    else if (value < 0 || value > 1) reason = "out-of-range";
    else if (value < INVERSE_TARGET_SHARE_METRIC_POLICY.minimumSourceWeight) reason = "below-minimum";
    if (reason !== null) invalidWeights.push({ edgeId: edge.id, reason });
    incoming.get(edge.target).push({ edge, invalid: reason !== null });
  }
  const targets = projection.nodes.map((node) => {
    const entries = incoming.get(node.id);
    const numeric = entries.every(({ edge }) => typeof edge.attributes.weight === "number");
    const sum = numeric ? entries.reduce((total, { edge }) => add(total, decimalFraction(edge.attributes.weight)), fraction(0n)) : null;
    const disposition = entries.length === 0 ? "no-parents" : entries.some((entry) => entry.invalid) ? "invalid" :
      sum.n === sum.d ? "normalized" : "non-unit-sum";
    return {
      nodeId: node.id, incomingEdgeIds: entries.map(({ edge }) => edge.id),
      sourceWeightSum: sum === null ? null : encodedFraction(sum), disposition
    };
  });
  return seal("structural-weight-audit", {
    schemaVersion: "1", model: projection.model, sourceProjectionHash: projection.projectionHash,
    algorithm: { id: "incoming-source-weight-audit", version: "1" },
    policy: INVERSE_TARGET_SHARE_METRIC_POLICY,
    policyHash: hash("structural-metric-policy", INVERSE_TARGET_SHARE_METRIC_POLICY),
    sourceNumberInterpretation: STRUCTURAL_INTERVAL_POLICY.sourceNumberInterpretation,
    eligibleForInverseShare: invalidWeights.length === 0, invalidWeights, targets,
    nonUnitTargetIds: targets.filter((target) => target.disposition === "non-unit-sum").map((target) => target.nodeId)
  });
}


export function metric(projection, metricPolicyId) {
  const policy = metricPolicyId === "unit-v1" ? UNIT_METRIC_POLICY : INVERSE_TARGET_SHARE_METRIC_POLICY;
  const lengths = new Map();
  let auditHash = null;
  if (metricPolicyId === "unit-v1") {
    for (const edge of projection.edges) lengths.set(edge.id, fraction(1n));
  } else {
    const audit = weightAudit(projection);
    if (!audit.eligibleForInverseShare) fail("WEIGHTS_INVALID", "The full source contains weights outside the inverse-share metric profile.", { invalidWeights: audit.invalidWeights });
    auditHash = audit.artifactHash;
    const sums = new Map(audit.targets.map((target) => [target.nodeId, target.sourceWeightSum]));
    for (const edge of projection.edges) {
      const sum = sums.get(edge.target);
      lengths.set(edge.id, divide(fraction(BigInt(sum.numerator), BigInt(sum.denominator)), decimalFraction(edge.attributes.weight)));
    }
  }
  const policyHash = hash("structural-metric-policy", policy);
  const contextHash = hash("structural-metric-context", {
    sourceProjectionHash: projection.projectionHash, policyHash,
    edges: projection.edges.map((edge) => ({ id: edge.id, length: encodedFraction(lengths.get(edge.id)) }))
  });
  return { policy, policyHash, auditHash, contextHash, lengths };
}

