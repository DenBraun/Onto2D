import { canonicalize, isContentHash } from "@onto2d/kernel/canonical";
import { HASH_OPTIONS, RDF_MAPPING_LIMITS } from "./constants.js";
import { fail } from "./errors.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ABSOLUTE_IRI_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const MAX_INSPECTED_ENTRIES = 2_000_000;
const MAX_INSPECTED_DEPTH = 48;

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isArrayIndex(key, length) {
  return /^(?:0|[1-9][0-9]*)$/.test(key)
    && Number(key) < length
    && String(Number(key)) === key;
}

export function assertPlainData(value, code, root = "value") {
  const ancestors = new WeakSet();
  let entries = 0;

  function visit(current, path, depth) {
    entries += 1;
    if (entries > MAX_INSPECTED_ENTRIES || depth > MAX_INSPECTED_DEPTH) {
      fail(code, `${root} exceeds the supported data shape.`, { path });
    }
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) fail(code, `${path} must be finite.`, { path });
      return;
    }
    if (typeof current !== "object") fail(code, `${path} is not JSON data.`, { path });
    if (ancestors.has(current)) fail(code, `${root} must not contain cycles.`, { path });
    ancestors.add(current);
    try {
      if (Object.getOwnPropertySymbols(current).length > 0) {
        fail(code, `${path} must not contain symbol fields.`, { path });
      }
      const descriptors = Object.getOwnPropertyDescriptors(current);
      if (Array.isArray(current)) {
        for (const [key, descriptor] of Object.entries(descriptors)) {
          if (key === "length") continue;
          if (!isArrayIndex(key, current.length) || !("value" in descriptor) || !descriptor.enumerable) {
            fail(code, `${path} must be a dense data-only array.`, { path, field: key });
          }
        }
        for (let index = 0; index < current.length; index += 1) {
          if (!descriptors[index]) fail(code, `${path} must not contain holes.`, { path, index });
          visit(descriptors[index].value, `${path}[${index}]`, depth + 1);
        }
        return;
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        fail(code, `${path} must be a plain object.`, { path });
      }
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (FORBIDDEN_KEYS.has(key) || !("value" in descriptor) || !descriptor.enumerable) {
          fail(code, `${path} must contain enumerable safe data fields only.`, { path, field: key });
        }
        visit(descriptor.value, `${path}.${key}`, depth + 1);
      }
    } finally {
      ancestors.delete(current);
    }
  }

  visit(value, root, 0);
  try {
    return canonicalize(value, HASH_OPTIONS);
  } catch (error) {
    fail(code, `${root} is not canonical JSON data.`, { causeCode: error?.code });
  }
}

export function exactObject(value, fields, path, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code, `${path} must be a plain object.`, { path });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(code, `${path} must be a plain object.`, { path });
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(code, `${path} must not contain symbol fields.`, { path });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort(compareText);
  for (const field of actual) {
    const descriptor = descriptors[field];
    if (FORBIDDEN_KEYS.has(field) || !("value" in descriptor) || !descriptor.enumerable) {
      fail(code, `${path} must contain enumerable safe data fields only.`, { path, field });
    }
  }
  const unknown = actual.filter((field) => !fields.has(field));
  const missing = [...fields].filter((field) => !Object.hasOwn(descriptors, field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${path} has an invalid field set.`, { path, unknown, missing });
  }
  return new Map(actual.map((field) => [field, descriptors[field].value]));
}

export function boundedArray(value, path, maximum, code, allowEmpty = false) {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    fail(code, `${path} must be a bounded dense array.`, { path, maximum });
  }
  assertPlainData(value, code, path);
  return value;
}

export function boundedString(value, path, code, maximum = RDF_MAPPING_LIMITS.maxTextLength) {
  if (typeof value !== "string" || value.length === 0 || [...value].length > maximum) {
    fail(code, `${path} must be a non-empty bounded string.`, { path, maximum });
  }
  try {
    canonicalize(value, HASH_OPTIONS);
  } catch (error) {
    fail(code, `${path} must contain valid Unicode.`, { path, causeCode: error?.code });
  }
  return value;
}

export function identifier(value, path, code) {
  const result = boundedString(value, path, code, RDF_MAPPING_LIMITS.maxIdentifierLength);
  if (!IDENTIFIER_PATTERN.test(result) || FORBIDDEN_KEYS.has(result)) {
    fail(code, `${path} must be a safe ASCII identifier.`, { path });
  }
  return result;
}

export function absoluteIri(value, path, code) {
  const result = boundedString(value, path, code, 16_384);
  if (!ABSOLUTE_IRI_PATTERN.test(result) || /%(?![0-9A-Fa-f]{2})/.test(result)) {
    fail(code, `${path} must be an absolute IRI.`, { path });
  }
  for (const character of result) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x20 || '<>"{}|^`\\'.includes(character)) {
      fail(code, `${path} must be an absolute IRI.`, { path });
    }
  }
  return result;
}

export function contentHash(value, path, code) {
  if (!isContentHash(value)) fail(code, `${path} must be a content hash.`, { path });
  return value;
}

export function nonNegativeInteger(value, path, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
    fail(code, `${path} must be a supported non-negative integer.`, { path });
  }
  return value;
}
