import { canonicalize } from "@onto2d/kernel/canonical";
import { HASH_OPTIONS } from "./constants.js";
import { fail } from "./errors.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_INSPECTED_ENTRIES = 2_000_000;
const MAX_INSPECTED_DEPTH = 48;

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isArrayIndex(key, length) {
  return /^(?:0|[1-9][0-9]*)$/.test(key) && Number(key) < length && String(Number(key)) === key;
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

export function exactObject(value, allowed, path, code, required = allowed) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(code, `${path} must be a plain object.`, { path });
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    fail(code, `${path} must be a plain object.`, { path });
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(code, `${path} must not contain symbol fields.`, { path });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const fields = Object.keys(descriptors).sort(compareText);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!("value" in descriptor) || !descriptor.enumerable || FORBIDDEN_KEYS.has(field)) {
      fail(code, `${path} must contain enumerable safe data fields only.`, { path, field });
    }
  }
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = [...required].filter((field) => !Object.prototype.hasOwnProperty.call(descriptors, field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${path} has an invalid field set.`, { path, unknown, missing });
  }
  return new Map(fields.map((field) => [field, descriptors[field].value]));
}
