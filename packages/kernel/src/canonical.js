import { KernelError } from "./errors.js";

const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 64,
  maxEntries: 100_000,
  maxStringBytes: 1_048_576
});
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const encoder = new TextEncoder();

function fail(code, message, details) {
  throw new KernelError({
    code,
    stage: "CANONICALIZE",
    message,
    details
  });
}

function assertValidUnicode(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("CANONICALIZATION_INVALID_UNICODE", "Unpaired high surrogate in string.", { path, index });
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("CANONICALIZATION_INVALID_UNICODE", "Unpaired low surrogate in string.", { path, index });
    }
  }
}

function encodeString(value, path, limits) {
  assertValidUnicode(value, path);
  const bytes = encoder.encode(value).byteLength;
  if (bytes > limits.maxStringBytes) {
    fail("CANONICALIZATION_LIMIT_EXCEEDED", "String exceeds canonicalization byte limit.", {
      path,
      bytes,
      maximum: limits.maxStringBytes
    });
  }
  return JSON.stringify(value);
}

function requirePlainOptions(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("CANONICALIZATION_OPTIONS_INVALID", "Canonicalization options must be a plain object.", { path });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("CANONICALIZATION_OPTIONS_INVALID", "Canonicalization options must be a plain object.", { path });
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail("CANONICALIZATION_SYMBOL_KEY", "Canonicalization options cannot contain symbol keys.", { path });
  }
  return Object.getOwnPropertyDescriptors(value);
}

function readOption(descriptors, key, path) {
  const descriptor = descriptors[key];
  if (!descriptor) return undefined;
  if (descriptor.get || descriptor.set) {
    fail("CANONICALIZATION_ACCESSOR", "Canonicalization options cannot contain accessors.", { path, key });
  }
  if (!descriptor.enumerable) {
    fail("CANONICALIZATION_OPTIONS_INVALID", "Canonicalization options must use enumerable data properties.", {
      path,
      key
    });
  }
  return descriptor.value;
}

function normalizeLimits(options) {
  if (options === undefined) return { ...DEFAULT_LIMITS };
  const optionDescriptors = requirePlainOptions(options, "$options");
  for (const key of Object.keys(optionDescriptors)) {
    if (key !== "limits") {
      fail("CANONICALIZATION_OPTIONS_INVALID", "Unknown canonicalization option.", { path: "$options", key });
    }
  }
  const suppliedLimits = readOption(optionDescriptors, "limits", "$options");
  if (suppliedLimits === undefined) return { ...DEFAULT_LIMITS };
  const limitDescriptors = requirePlainOptions(suppliedLimits, "$options.limits");
  const limits = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(limitDescriptors)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_LIMITS, key)) {
      fail("CANONICALIZATION_OPTIONS_INVALID", "Unknown canonicalization limit.", {
        path: "$options.limits",
        key
      });
    }
    limits[key] = readOption(limitDescriptors, key, "$options.limits");
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      fail(
        "CANONICALIZATION_LIMIT_INVALID",
        "Canonicalization limits must be positive safe integers.",
        { path: `$options.limits.${name}`, name, value }
      );
    }
  }
  return limits;
}

function isArrayElementKey(key, length) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

export function canonicalize(value, options = {}) {
  const limits = normalizeLimits(options);
  const ancestors = new WeakSet();
  let entries = 0;

  function count(path) {
    entries += 1;
    if (entries > limits.maxEntries) {
      fail("CANONICALIZATION_LIMIT_EXCEEDED", "Value exceeds canonicalization entry limit.", {
        path,
        entries,
        maximum: limits.maxEntries
      });
    }
  }

  function visit(current, path, depth) {
    count(path);
    if (depth > limits.maxDepth) {
      fail("CANONICALIZATION_LIMIT_EXCEEDED", "Value exceeds canonicalization depth limit.", {
        path,
        depth,
        maximum: limits.maxDepth
      });
    }

    if (current === null) return "null";
    if (typeof current === "string") return encodeString(current, path, limits);
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        fail("NUMERIC_NONFINITE", "Canonical numbers must be finite.", { path, value: String(current) });
      }
      return Object.is(current, -0) ? "0" : JSON.stringify(current);
    }

    if (typeof current !== "object") {
      fail("CANONICALIZATION_UNSUPPORTED_VALUE", "Unsupported canonical value type.", {
        path,
        type: typeof current
      });
    }
    if (ancestors.has(current)) {
      fail("CANONICALIZATION_CYCLE", "Canonical values cannot contain object cycles.", { path });
    }

    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getOwnPropertySymbols(current).length > 0) {
          fail("CANONICALIZATION_SYMBOL_KEY", "Symbol-keyed array properties are not canonical JSON.", { path });
        }
        const descriptors = Object.getOwnPropertyDescriptors(current);
        for (const [key, descriptor] of Object.entries(descriptors)) {
          if (key === "length" || isArrayElementKey(key, current.length)) continue;
          if (descriptor.enumerable) {
            fail("CANONICALIZATION_ARRAY_PROPERTY", "Arrays cannot carry enumerable named properties.", {
              path,
              key
            });
          }
        }
        const values = [];
        for (let index = 0; index < current.length; index += 1) {
          const descriptor = descriptors[index];
          if (!descriptor) {
            fail("CANONICALIZATION_SPARSE_ARRAY", "Sparse arrays are not canonical JSON values.", {
              path,
              index
            });
          }
          if (descriptor.get || descriptor.set) {
            fail("CANONICALIZATION_ACCESSOR", "Accessor array elements are forbidden in canonical input.", {
              path,
              index
            });
          }
          values.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
        }
        return `[${values.join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        fail("CANONICALIZATION_UNSUPPORTED_OBJECT", "Only plain objects are canonicalizable.", {
          path,
          prototype: "non-plain"
        });
      }
      if (Object.getOwnPropertySymbols(current).length > 0) {
        fail("CANONICALIZATION_SYMBOL_KEY", "Symbol-keyed properties are not canonical JSON.", { path });
      }

      const descriptors = Object.getOwnPropertyDescriptors(current);
      const keys = Object.keys(descriptors)
        .filter((key) => descriptors[key].enumerable)
        .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
      const properties = [];
      for (const key of keys) {
        const descriptor = descriptors[key];
        if (descriptor.get || descriptor.set) {
          fail("CANONICALIZATION_ACCESSOR", "Accessor properties are forbidden in canonical input.", {
            path,
            key
          });
        }
        if (FORBIDDEN_KEYS.has(key)) {
          fail("PACKAGE_PROTOTYPE_KEY", "Prototype-sensitive object key is forbidden.", { path, key });
        }
        const keyPath = path === "$" ? `$.${key}` : `${path}.${key}`;
        properties.push(`${encodeString(key, keyPath, limits)}:${visit(descriptor.value, keyPath, depth + 1)}`);
      }
      return `{${properties.join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  }

  return visit(value, "$", 0);
}

export function canonicalBytes(value, options) {
  return encoder.encode(canonicalize(value, options));
}

export function canonicalClone(value, options) {
  return JSON.parse(canonicalize(value, options));
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

export const CANONICAL_JSON_POLICY = "rfc8785-compatible-binary64-v1";
export const CANONICAL_LIMITS = DEFAULT_LIMITS;
