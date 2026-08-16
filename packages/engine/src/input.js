import { engineFail } from "./errors.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function dataEntries(value, {
  code,
  subject,
  allowed,
  required = new Set()
}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    engineFail(code, `${subject} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    engineFail(code, `${subject} must be a plain object.`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    engineFail(code, `${subject} must not contain symbol fields.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const fields = Object.keys(descriptors).sort(compareText);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (
      !("value" in descriptor)
      || descriptor.enumerable !== true
      || FORBIDDEN_KEYS.has(field)
    ) {
      engineFail(code, `${subject} must contain enumerable safe data fields only.`, { field });
    }
  }
  const unknown = allowed === undefined
    ? []
    : fields.filter((field) => !allowed.has(field));
  const missing = [...required].filter((field) => !Object.hasOwn(descriptors, field));
  if (unknown.length > 0 || missing.length > 0) {
    engineFail(code, `${subject} has an invalid field set.`, { missing, unknown });
  }
  return new Map(fields.map((field) => [field, descriptors[field].value]));
}

export function dataArray(value, code, subject) {
  if (!Array.isArray(value)) {
    engineFail(code, `${subject} must be an array.`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    engineFail(code, `${subject} must not contain symbol fields.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of Object.keys(descriptors)) {
    if (field === "length") continue;
    if (!/^(?:0|[1-9][0-9]*)$/.test(field) || Number(field) >= value.length) {
      engineFail(code, `${subject} must not contain named fields.`, { field });
    }
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      engineFail(code, `${subject} must contain dense data elements only.`, { index });
    }
    result.push(descriptor.value);
  }
  return result;
}

export function safeIdentifier(value, code, subject) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 1024
    || value.trim() !== value
    || FORBIDDEN_KEYS.has(value)
  ) {
    engineFail(code, `${subject} must be a normalized safe bounded string.`, { subject });
  }
  return value;
}
