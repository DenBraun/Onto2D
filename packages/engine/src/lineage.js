import {
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel";
import { engineFail } from "./errors.js";

export const MODEL_LINEAGE_VERSION = "1";
export const MODEL_LINEAGE_BUILDER = "onto2d-model-lineage-v1";
export const MODEL_LINEAGE_EVENT_KINDS = Object.freeze([
  "rename",
  "move",
  "split",
  "merge",
  "deprecate",
  "replace",
  "relation-change",
  "classification-change",
  "metadata-only-change"
]);

const EVENT_KINDS = new Set(MODEL_LINEAGE_EVENT_KINDS);
const EVENT_ENTITIES = new Set(["node", "edge", "model"]);
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requirePlainObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    engineFail("ENGINE_LINEAGE_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    engineFail("ENGINE_LINEAGE_INPUT_INVALID", `${name} must be a plain object.`, { name });
  }
  return value;
}

function rejectUnknownFields(value, allowed, name) {
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    engineFail("ENGINE_LINEAGE_INPUT_INVALID", `${name} contains unknown fields.`, { name, unknown });
  }
}

function requireIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    value.trim() !== value ||
    FORBIDDEN_IDENTIFIERS.has(value)
  ) {
    engineFail("ENGINE_LINEAGE_IDENTIFIER_INVALID", `${name} must be a normalized bounded identifier.`, {
      name
    });
  }
  return value;
}

function normalizeIdentity(value, name) {
  const identity = requirePlainObject(value, name);
  rejectUnknownFields(identity, new Set(["modelId", "modelVersion", "modelRootHash"]), name);
  const result = {
    modelId: requireIdentifier(identity.modelId, `${name}.modelId`),
    modelVersion: requireIdentifier(identity.modelVersion, `${name}.modelVersion`),
    modelRootHash: identity.modelRootHash
  };
  if (!isContentHash(result.modelRootHash)) {
    engineFail("ENGINE_LINEAGE_MODEL_HASH_INVALID", `${name}.modelRootHash must be a content hash.`, {
      name
    });
  }
  return result;
}

function normalizeIdentifiers(value, name) {
  if (!Array.isArray(value)) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${name} must be an array.`, { name });
  }
  const normalized = value.map((identifier, index) => requireIdentifier(identifier, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${name} must not contain duplicate identifiers.`, { name });
  }
  return normalized.sort(compareText);
}

function requireCardinality(event, from, to, fromRule, toRule) {
  const passes = (values, rule) => (
    rule === "zero" ? values.length === 0
      : rule === "one" ? values.length === 1
        : rule === "many" ? values.length >= 2
          : values.length >= 1
  );
  if (!passes(from, fromRule) || !passes(to, toRule)) {
    engineFail(
      "ENGINE_LINEAGE_EVENT_CARDINALITY_INVALID",
      `Lineage event ${event.id} has invalid from/to cardinality for ${event.kind}.`,
      { eventId: event.id, kind: event.kind, fromCount: from.length, toCount: to.length }
    );
  }
}

function validateEventShape(event) {
  const { kind, entity, from, to, fields = [] } = event;
  if (kind === "split") {
    if (entity !== "node") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "split requires node scope.", { eventId: event.id });
    }
    requireCardinality(event, from, to, "one", "many");
  } else if (kind === "merge") {
    if (entity !== "node") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "merge requires node scope.", { eventId: event.id });
    }
    requireCardinality(event, from, to, "many", "one");
  } else if (kind === "deprecate") {
    if (entity === "model") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "deprecate requires node or edge scope.", {
        eventId: event.id
      });
    }
    requireCardinality(event, from, to, "at-least-one", "zero");
  } else if (kind === "metadata-only-change") {
    if (entity !== "model" || from.length !== 0 || to.length !== 0 || fields.length === 0) {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "metadata-only-change requires model scope, no entity IDs, and fields.", {
        eventId: event.id
      });
    }
  } else {
    requireCardinality(event, from, to, "one", "one");
    if (kind === "relation-change" && entity !== "edge") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "relation-change requires edge scope.", { eventId: event.id });
    }
    if (["rename", "move", "classification-change"].includes(kind) && entity !== "node") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${kind} requires node scope.`, { eventId: event.id });
    }
    if (kind === "replace" && entity === "model") {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "replace requires node or edge scope.", { eventId: event.id });
    }
  }
  if (["move", "classification-change", "metadata-only-change"].includes(kind) && fields.length === 0) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${kind} requires at least one changed field.`, {
      eventId: event.id
    });
  }
  if (["move", "classification-change"].includes(kind) && from[0] !== to[0]) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${kind} must retain the node identifier.`, {
      eventId: event.id
    });
  }
  if (["rename", "replace"].includes(kind) && from[0] === to[0]) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", `${kind} must change the entity identifier.`, {
      eventId: event.id
    });
  }
}

function normalizeEvent(value, index) {
  const event = canonicalClone(requirePlainObject(value, `events[${index}]`));
  rejectUnknownFields(
    event,
    new Set(["id", "kind", "entity", "from", "to", "fields", "note"]),
    `events[${index}]`
  );
  const normalized = {
    id: requireIdentifier(event.id, `events[${index}].id`),
    kind: requireIdentifier(event.kind, `events[${index}].kind`),
    entity: requireIdentifier(event.entity, `events[${index}].entity`),
    from: normalizeIdentifiers(event.from, `events[${index}].from`),
    to: normalizeIdentifiers(event.to, `events[${index}].to`)
  };
  if (!EVENT_KINDS.has(normalized.kind) || !EVENT_ENTITIES.has(normalized.entity)) {
    engineFail("ENGINE_LINEAGE_EVENT_INVALID", "Lineage event kind or entity is unsupported.", {
      eventId: normalized.id,
      kind: normalized.kind,
      entity: normalized.entity
    });
  }
  if (event.fields !== undefined) {
    normalized.fields = normalizeIdentifiers(event.fields, `events[${index}].fields`);
    if (normalized.fields.length === 0) {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "Lineage event fields must not be empty when supplied.", {
        eventId: normalized.id
      });
    }
  }
  if (event.note !== undefined) {
    if (typeof event.note !== "string" || event.note.length === 0 || event.note.length > 4096) {
      engineFail("ENGINE_LINEAGE_EVENT_INVALID", "Lineage event note must be a non-empty bounded string.", {
        eventId: normalized.id
      });
    }
    normalized.note = event.note;
  }
  validateEventShape(normalized);
  return normalized;
}

export function modelIdentity(model) {
  if (!model || typeof model !== "object") {
    engineFail("ENGINE_LINEAGE_MODEL_INVALID", "modelIdentity requires an engine Model.");
  }
  return deepFreeze(normalizeIdentity({
    modelId: model.id,
    modelVersion: model.version,
    modelRootHash: model.rootHash
  }, "model"));
}

export function buildModelLineage(input) {
  const value = canonicalClone(requirePlainObject(input, "input"));
  rejectUnknownFields(value, new Set(["from", "to", "events"]), "input");
  if (!Array.isArray(value.events)) {
    engineFail("ENGINE_LINEAGE_INPUT_INVALID", "events must be an array.");
  }
  const events = value.events.map(normalizeEvent).sort((left, right) => compareText(left.id, right.id));
  if (new Set(events.map((event) => event.id)).size !== events.length) {
    engineFail("ENGINE_LINEAGE_EVENT_DUPLICATE", "Lineage event identifiers must be unique.");
  }
  const body = {
    schemaVersion: MODEL_LINEAGE_VERSION,
    builder: MODEL_LINEAGE_BUILDER,
    from: normalizeIdentity(value.from, "from"),
    to: normalizeIdentity(value.to, "to"),
    events
  };
  if (canonicalize(body.from) === canonicalize(body.to)) {
    engineFail("ENGINE_LINEAGE_IDENTITY_UNCHANGED", "Model lineage must connect two distinct releases.");
  }
  return deepFreeze({
    ...body,
    lineageHash: hashCanonical("onto2d:model-lineage:v1", body)
  });
}

export function verifyModelLineage(lineage, expected = {}) {
  const value = canonicalClone(requirePlainObject(lineage, "lineage"));
  if (value.schemaVersion !== MODEL_LINEAGE_VERSION || value.builder !== MODEL_LINEAGE_BUILDER) {
    engineFail("ENGINE_LINEAGE_VERSION_UNSUPPORTED", "The model lineage version is unsupported.");
  }
  const rebuilt = buildModelLineage({ from: value.from, to: value.to, events: value.events });
  if (canonicalize(value) !== canonicalize(rebuilt)) {
    engineFail("ENGINE_LINEAGE_VERIFICATION_FAILED", "Model lineage content or identity differs from reconstruction.");
  }
  if (expected.from !== undefined && canonicalize(rebuilt.from) !== canonicalize(modelIdentity(expected.from))) {
    engineFail("ENGINE_LINEAGE_SOURCE_MISMATCH", "Model lineage does not bind the left model.");
  }
  if (expected.to !== undefined && canonicalize(rebuilt.to) !== canonicalize(modelIdentity(expected.to))) {
    engineFail("ENGINE_LINEAGE_TARGET_MISMATCH", "Model lineage does not bind the right model.");
  }
  return rebuilt;
}
