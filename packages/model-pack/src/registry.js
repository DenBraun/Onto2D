import {
  hashCanonical,
  isContentHash
} from "@onto2d/kernel/canonical";
import {
  MODEL_PACK_FORMAT,
  MODEL_PACK_FORMAT_VERSION,
  ModelPackError
} from "./index.js";
import { inspectTransportOptions } from "./transport-layout.js";

export const MODEL_PACK_REGISTRY_FORMAT = "onto2d-model-pack-registry";
export const MODEL_PACK_REGISTRY_FORMAT_VERSION = "1";
export const MODEL_PACK_RESOLUTION_FORMAT = "onto2d-model-pack-resolution";
export const MODEL_PACK_RESOLUTION_FORMAT_VERSION = "1";
export const MODEL_PACK_REGISTRY_LIMITS = Object.freeze({
  maxRegistryBytes: 1024 * 1024,
  maxEntries: 1024,
  maxUrlLength: 16_384,
  maxIdentifierLength: 128,
  maxPathLength: 2048
});

const REGISTRY_HASH_DOMAIN = "onto2d:model-pack-registry:v1";
const REGISTRY_FIELDS = new Set(["format", "formatVersion", "entries"]);
const ENTRY_FIELDS = new Set([
  "modelId",
  "version",
  "rootHash",
  "manifestHash",
  "packPath"
]);
const SELECTION_FIELDS = new Set(["modelId", "version"]);
const PURE_OPTION_FIELDS = new Set([
  "expectedRegistryHash",
  "maxEntries",
  "maxUrlLength"
]);
const HTTP_OPTION_FIELDS = new Set([
  ...PURE_OPTION_FIELDS,
  "fetch",
  "signal",
  "maxRegistryBytes"
]);
const RESOLUTION_FIELDS = new Set([
  "format",
  "formatVersion",
  "registryHash",
  "registryUrl",
  "registryTrust",
  "modelId",
  "version",
  "rootHash",
  "manifestHash",
  "baseUrl"
]);
const REGISTRY_TRUST_VALUES = new Set(["hash-pinned", "transport-only"]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const JSON_MEDIA_TYPE = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/;
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);

function fail(code, message, details = {}) {
  throw new ModelPackError(code, message, details);
}

function exactEntries(value, fields, code, subject) {
  const entries = inspectTransportOptions(value, code, subject);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort();
  const missing = [...fields].filter((field) => !entries.has(field)).sort();
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${subject} has an invalid field set.`, { missing, unknown });
  }
  return entries;
}

function optionEntries(value, fields, subject) {
  const entries = inspectTransportOptions(value, "MODEL_PACK_REGISTRY_OPTIONS_INVALID", subject);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_REGISTRY_OPTIONS_INVALID", `${subject} contains unknown fields.`, {
      unknown
    });
  }
  return entries;
}

function optionValue(entries, field, fallback) {
  return entries.has(field) ? entries.get(field) : fallback;
}

function requireInteger(value, field, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail("MODEL_PACK_REGISTRY_LIMIT_INVALID", `${field} is outside the registry limit.`, {
      field,
      maximum
    });
  }
  return value;
}

function requireIdentifier(value, field) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MODEL_PACK_REGISTRY_LIMITS.maxIdentifierLength
    || !IDENTIFIER_PATTERN.test(value)
    || FORBIDDEN_IDENTIFIERS.has(value)
  ) {
    fail("MODEL_PACK_REGISTRY_IDENTIFIER_INVALID", `${field} is not a bounded registry identifier.`, {
      field
    });
  }
  return value;
}

function requireContentHash(value, field, code = "MODEL_PACK_REGISTRY_ENTRY_INVALID") {
  if (!isContentHash(value)) {
    fail(code, `${field} must be a content hash.`, { field });
  }
  return value;
}

function requireDataArray(value, maximum, subject) {
  if (!Array.isArray(value)) {
    fail("MODEL_PACK_REGISTRY_INVALID", `${subject} must be an array.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail("MODEL_PACK_REGISTRY_INVALID", `${subject} must contain only indexed data properties.`);
  }
  if (!Number.isSafeInteger(value.length) || value.length < 1 || value.length > maximum) {
    fail("MODEL_PACK_REGISTRY_ENTRY_LIMIT_EXCEEDED", `${subject} exceeds maxEntries.`, {
      maxEntries: maximum
    });
  }
  const items = [];
  for (const key of Object.keys(descriptors)) {
    if (key === "length") continue;
    if (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
      fail("MODEL_PACK_REGISTRY_INVALID", `${subject} contains a named property.`);
    }
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail("MODEL_PACK_REGISTRY_INVALID", `${subject} must be dense plain data.`);
    }
    items.push(descriptor.value);
  }
  return items;
}

function normalizePackPath(value, field) {
  if (
    typeof value !== "string"
    || value.length < 2
    || value.length > MODEL_PACK_REGISTRY_LIMITS.maxPathLength
    || !value.endsWith("/")
    || value.startsWith("/")
    || value.includes("\\")
    || value.includes("?")
    || value.includes("#")
    || value.includes("%")
  ) {
    fail("MODEL_PACK_REGISTRY_PATH_INVALID", `${field} must be a bounded relative directory path.`, {
      field
    });
  }
  const segments = value.slice(0, -1).split("/");
  if (
    segments.some((segment) => (
      segment === "."
      || segment === ".."
      || !PATH_SEGMENT_PATTERN.test(segment)
    ))
  ) {
    fail("MODEL_PACK_REGISTRY_PATH_INVALID", `${field} contains an invalid path segment.`, {
      field
    });
  }
  return value;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEntries(left, right) {
  return compareText(left.modelId, right.modelId) || compareText(left.version, right.version);
}

function normalizeRegistry(value, maxEntries) {
  const entries = exactEntries(
    value,
    REGISTRY_FIELDS,
    "MODEL_PACK_REGISTRY_INVALID",
    "Model Pack registry"
  );
  if (
    entries.get("format") !== MODEL_PACK_REGISTRY_FORMAT
    || entries.get("formatVersion") !== MODEL_PACK_REGISTRY_FORMAT_VERSION
  ) {
    fail("MODEL_PACK_REGISTRY_FORMAT_UNSUPPORTED", "The Model Pack registry format is unsupported.");
  }
  const seen = new Set();
  const normalizedEntries = requireDataArray(entries.get("entries"), maxEntries, "registry.entries")
    .map((valueEntry, index) => {
      const fields = exactEntries(
        valueEntry,
        ENTRY_FIELDS,
        "MODEL_PACK_REGISTRY_ENTRY_INVALID",
        `registry.entries[${index}]`
      );
      const entry = {
        modelId: requireIdentifier(fields.get("modelId"), `registry.entries[${index}].modelId`),
        version: requireIdentifier(fields.get("version"), `registry.entries[${index}].version`),
        rootHash: requireContentHash(fields.get("rootHash"), `registry.entries[${index}].rootHash`),
        manifestHash: requireContentHash(
          fields.get("manifestHash"),
          `registry.entries[${index}].manifestHash`
        ),
        packPath: normalizePackPath(fields.get("packPath"), `registry.entries[${index}].packPath`)
      };
      const key = `${entry.modelId}\u0000${entry.version}`;
      if (seen.has(key)) {
        fail("MODEL_PACK_REGISTRY_ENTRY_DUPLICATE", "Registry model and version pairs must be unique.", {
          modelId: entry.modelId,
          version: entry.version
        });
      }
      seen.add(key);
      return Object.freeze(entry);
    })
    .sort(compareEntries);
  const registry = Object.freeze({
    format: MODEL_PACK_REGISTRY_FORMAT,
    formatVersion: MODEL_PACK_REGISTRY_FORMAT_VERSION,
    entries: Object.freeze(normalizedEntries)
  });
  return Object.freeze({
    registry,
    registryHash: hashCanonical(REGISTRY_HASH_DOMAIN, registry)
  });
}

function normalizeSelection(value) {
  const entries = exactEntries(
    value,
    SELECTION_FIELDS,
    "MODEL_PACK_REGISTRY_SELECTION_INVALID",
    "Model Pack registry selection"
  );
  return Object.freeze({
    modelId: requireIdentifier(entries.get("modelId"), "selection.modelId"),
    version: requireIdentifier(entries.get("version"), "selection.version")
  });
}

function normalizeRegistryUrl(
  value,
  maxUrlLength,
  field = "registryUrl",
  code = "MODEL_PACK_REGISTRY_URL_INVALID"
) {
  if (typeof value === "string" && value.length > maxUrlLength) {
    fail(code, `${field} exceeds maxUrlLength.`, { field });
  }
  if (typeof value !== "string" && !(value instanceof URL)) {
    fail(code, `${field} must be an absolute URL.`, { field });
  }
  let url;
  try {
    url = new URL(value instanceof URL ? value.href : value);
  } catch {
    fail(code, `${field} must be an absolute URL.`, { field });
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:")
    || url.username !== ""
    || url.password !== ""
    || url.search !== ""
    || url.hash !== ""
    || url.href.length > maxUrlLength
  ) {
    fail(
      code,
      `${field} must be a bounded HTTP(S) URL without credentials, query, or fragment.`,
      { field }
    );
  }
  return url;
}

function normalizeBaseUrl(value, maxUrlLength) {
  const url = normalizeRegistryUrl(
    value,
    maxUrlLength,
    "baseUrl",
    "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
  );
  if (!url.pathname.endsWith("/")) {
    fail("MODEL_PACK_REGISTRY_RESOLUTION_INVALID", "baseUrl must identify a directory.");
  }
  return url;
}

function normalizeCommonOptions(entries) {
  const expectedRegistryHash = optionValue(entries, "expectedRegistryHash", null);
  if (expectedRegistryHash !== null) {
    requireContentHash(
      expectedRegistryHash,
      "expectedRegistryHash",
      "MODEL_PACK_REGISTRY_OPTIONS_INVALID"
    );
  }
  return {
    expectedRegistryHash,
    maxEntries: requireInteger(
      optionValue(entries, "maxEntries", MODEL_PACK_REGISTRY_LIMITS.maxEntries),
      "maxEntries",
      MODEL_PACK_REGISTRY_LIMITS.maxEntries
    ),
    maxUrlLength: requireInteger(
      optionValue(entries, "maxUrlLength", MODEL_PACK_REGISTRY_LIMITS.maxUrlLength),
      "maxUrlLength",
      MODEL_PACK_REGISTRY_LIMITS.maxUrlLength
    )
  };
}

function normalizePureOptions(value) {
  return Object.freeze(normalizeCommonOptions(optionEntries(
    value,
    PURE_OPTION_FIELDS,
    "Model Pack registry resolver options"
  )));
}

function normalizeHttpOptions(value) {
  const entries = optionEntries(value, HTTP_OPTION_FIELDS, "Model Pack registry HTTP options");
  const common = normalizeCommonOptions(entries);
  const fetchImplementation = entries.has("fetch")
    ? entries.get("fetch")
    : typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
  if (typeof fetchImplementation !== "function") {
    fail("MODEL_PACK_REGISTRY_FETCH_UNAVAILABLE", "A fetch implementation is required.");
  }
  const signal = optionValue(entries, "signal", null);
  if (
    signal !== null
    && (typeof AbortSignal !== "function" || !(signal instanceof AbortSignal))
  ) {
    fail("MODEL_PACK_REGISTRY_OPTIONS_INVALID", "signal must be an AbortSignal or null.", {
      field: "signal"
    });
  }
  return Object.freeze({
    ...common,
    fetch: fetchImplementation,
    signal,
    maxRegistryBytes: requireInteger(
      optionValue(
        entries,
        "maxRegistryBytes",
        MODEL_PACK_REGISTRY_LIMITS.maxRegistryBytes
      ),
      "maxRegistryBytes",
      MODEL_PACK_REGISTRY_LIMITS.maxRegistryBytes
    )
  });
}

function resolveNormalized(registryValue, registryUrl, selectionValue, options) {
  const selection = normalizeSelection(selectionValue);
  const normalized = normalizeRegistry(registryValue, options.maxEntries);
  if (
    options.expectedRegistryHash !== null
    && normalized.registryHash !== options.expectedRegistryHash
  ) {
    fail("MODEL_PACK_REGISTRY_HASH_MISMATCH", "The registry hash differs from the expected hash.", {
      expectedRegistryHash: options.expectedRegistryHash,
      actualRegistryHash: normalized.registryHash
    });
  }
  const entry = normalized.registry.entries.find((candidate) => (
    candidate.modelId === selection.modelId && candidate.version === selection.version
  ));
  if (entry === undefined) {
    fail("MODEL_PACK_REGISTRY_RELEASE_NOT_FOUND", "The explicit model and version are not in the registry.", {
      modelId: selection.modelId,
      version: selection.version
    });
  }
  const registryDirectory = new URL(".", registryUrl);
  const baseUrl = new URL(entry.packPath, registryDirectory);
  if (
    baseUrl.origin !== registryUrl.origin
    || !baseUrl.href.startsWith(registryDirectory.href)
    || !baseUrl.pathname.endsWith("/")
    || baseUrl.href.length > options.maxUrlLength
  ) {
    fail("MODEL_PACK_REGISTRY_PATH_INVALID", "The resolved Model Pack URL escapes its registry directory.");
  }
  return Object.freeze({
    format: MODEL_PACK_RESOLUTION_FORMAT,
    formatVersion: MODEL_PACK_RESOLUTION_FORMAT_VERSION,
    registryHash: normalized.registryHash,
    registryUrl: registryUrl.href,
    registryTrust: options.expectedRegistryHash === null ? "transport-only" : "hash-pinned",
    modelId: entry.modelId,
    version: entry.version,
    rootHash: entry.rootHash,
    manifestHash: entry.manifestHash,
    baseUrl: baseUrl.href
  });
}

export function resolveModelPackRegistry(registry, registryUrl, selection, options = {}) {
  const normalizedOptions = normalizePureOptions(options);
  const normalizedUrl = normalizeRegistryUrl(
    registryUrl,
    normalizedOptions.maxUrlLength
  );
  return resolveNormalized(registry, normalizedUrl, selection, normalizedOptions);
}

function responseFields(response) {
  try {
    if (response === null || typeof response !== "object") throw new TypeError();
    if (typeof response.headers?.get !== "function") throw new TypeError();
    return {
      ok: response.ok,
      status: response.status,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      headers: response.headers,
      body: response.body
    };
  } catch {
    fail("MODEL_PACK_REGISTRY_RESPONSE_INVALID", "fetch returned an invalid registry response.");
  }
}

function inspectResponse(response, requestedUrl, maximum) {
  const fields = responseFields(response);
  if (fields.type === "opaque") {
    fail("MODEL_PACK_REGISTRY_RESPONSE_INVALID", "Opaque registry responses are not accepted.");
  }
  if (fields.redirected === true) {
    fail("MODEL_PACK_REGISTRY_REDIRECT_REJECTED", "Redirected registry responses are not accepted.");
  }
  if (fields.ok !== true || fields.status !== 200) {
    fail("MODEL_PACK_REGISTRY_HTTP_FAILED", "The registry request did not return status 200.", {
      status: Number.isInteger(fields.status) ? fields.status : null
    });
  }
  let responseUrl;
  try {
    if (typeof fields.url !== "string" || fields.url === "") throw new TypeError();
    responseUrl = new URL(fields.url).href;
  } catch {
    fail("MODEL_PACK_REGISTRY_RESPONSE_INVALID", "The registry response URL is missing or invalid.");
  }
  if (responseUrl !== requestedUrl.href) {
    fail("MODEL_PACK_REGISTRY_RESPONSE_URL_MISMATCH", "The registry response came from a different URL.");
  }
  let contentType;
  let contentLength;
  try {
    contentType = fields.headers.get("content-type");
    contentLength = fields.headers.get("content-length");
  } catch {
    fail("MODEL_PACK_REGISTRY_RESPONSE_INVALID", "Registry response headers cannot be read.");
  }
  const mediaType = typeof contentType === "string"
    ? contentType.split(";", 1)[0].trim().toLowerCase()
    : "";
  if (!JSON_MEDIA_TYPE.test(mediaType)) {
    fail("MODEL_PACK_REGISTRY_CONTENT_TYPE_INVALID", "The registry response is not JSON content.");
  }
  let declaredLength = null;
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(contentLength)) {
      fail("MODEL_PACK_REGISTRY_CONTENT_LENGTH_INVALID", "Content-Length is not a valid byte count.");
    }
    declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength)) {
      fail("MODEL_PACK_REGISTRY_CONTENT_LENGTH_INVALID", "Content-Length exceeds the supported range.");
    }
    if (declaredLength > maximum) {
      fail("MODEL_PACK_REGISTRY_BYTE_LIMIT_EXCEEDED", "The registry response exceeds maxRegistryBytes.", {
        maxRegistryBytes: maximum
      });
    }
  }
  if (fields.body === null || typeof fields.body?.getReader !== "function") {
    fail("MODEL_PACK_REGISTRY_STREAM_INVALID", "The registry response requires a readable byte stream.");
  }
  return Object.freeze({
    stream: fields.body,
    declaredLength
  });
}

async function readBoundedRegistry(stream, maximum) {
  let reader;
  try {
    reader = stream.getReader();
  } catch {
    fail("MODEL_PACK_REGISTRY_STREAM_INVALID", "The registry byte stream cannot be read.");
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result === null || typeof result !== "object" || typeof result.done !== "boolean") {
        fail("MODEL_PACK_REGISTRY_STREAM_INVALID", "The registry byte stream returned an invalid chunk.");
      }
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        fail("MODEL_PACK_REGISTRY_STREAM_INVALID", "The registry byte stream must yield Uint8Array chunks.");
      }
      if (total > maximum - result.value.byteLength) {
        fail("MODEL_PACK_REGISTRY_BYTE_LIMIT_EXCEEDED", "The registry response exceeds maxRegistryBytes.", {
          maxRegistryBytes: maximum
        });
      }
      total += result.value.byteLength;
      chunks.push(result.value.slice());
    }
  } catch (error) {
    try {
      Promise.resolve(reader.cancel()).catch(() => {});
    } catch {
      // The stable registry stream failure remains authoritative.
    }
    if (error instanceof ModelPackError) throw error;
    fail("MODEL_PACK_REGISTRY_STREAM_FAILED", "The registry byte stream failed.", {
      cause: error instanceof Error ? error.name : typeof error
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed stream may already have released its reader.
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseRegistryJson(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("MODEL_PACK_REGISTRY_UTF8_INVALID", "Registry bytes are not valid UTF-8.");
  }
  try {
    return JSON.parse(text);
  } catch {
    fail("MODEL_PACK_REGISTRY_JSON_INVALID", "Registry bytes are not valid JSON.");
  }
}

export async function resolveModelPackRegistryHttp(registryUrl, selection, options = {}) {
  const normalized = normalizeHttpOptions(options);
  const requestedUrl = normalizeRegistryUrl(registryUrl, normalized.maxUrlLength);
  const request = {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" }
  };
  if (normalized.signal !== null) request.signal = normalized.signal;
  let response;
  try {
    response = await normalized.fetch(requestedUrl.href, request);
  } catch (error) {
    fail("MODEL_PACK_REGISTRY_FETCH_FAILED", "The registry HTTP request failed.", {
      cause: error instanceof Error ? error.name : typeof error
    });
  }
  const inspected = inspectResponse(response, requestedUrl, normalized.maxRegistryBytes);
  const bytes = await readBoundedRegistry(inspected.stream, normalized.maxRegistryBytes);
  if (inspected.declaredLength !== null && inspected.declaredLength !== bytes.byteLength) {
    fail("MODEL_PACK_REGISTRY_CONTENT_LENGTH_MISMATCH", "Content-Length differs from registry bytes.");
  }
  return resolveNormalized(parseRegistryJson(bytes), requestedUrl, selection, normalized);
}

function normalizeResolution(value) {
  const entries = exactEntries(
    value,
    RESOLUTION_FIELDS,
    "MODEL_PACK_REGISTRY_RESOLUTION_INVALID",
    "Model Pack registry resolution"
  );
  if (
    entries.get("format") !== MODEL_PACK_RESOLUTION_FORMAT
    || entries.get("formatVersion") !== MODEL_PACK_RESOLUTION_FORMAT_VERSION
  ) {
    fail("MODEL_PACK_REGISTRY_RESOLUTION_INVALID", "The Model Pack resolution format is unsupported.");
  }
  const registryTrust = entries.get("registryTrust");
  if (!REGISTRY_TRUST_VALUES.has(registryTrust)) {
    fail("MODEL_PACK_REGISTRY_RESOLUTION_INVALID", "registryTrust is invalid.");
  }
  const registryUrl = normalizeRegistryUrl(
    entries.get("registryUrl"),
    MODEL_PACK_REGISTRY_LIMITS.maxUrlLength,
    "resolution.registryUrl",
    "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
  );
  const baseUrl = normalizeBaseUrl(
    entries.get("baseUrl"),
    MODEL_PACK_REGISTRY_LIMITS.maxUrlLength
  );
  const registryDirectory = new URL(".", registryUrl);
  if (
    baseUrl.origin !== registryUrl.origin
    || !baseUrl.href.startsWith(registryDirectory.href)
  ) {
    fail(
      "MODEL_PACK_REGISTRY_RESOLUTION_INVALID",
      "baseUrl must remain within the registry directory."
    );
  }
  return Object.freeze({
    format: MODEL_PACK_RESOLUTION_FORMAT,
    formatVersion: MODEL_PACK_RESOLUTION_FORMAT_VERSION,
    registryHash: requireContentHash(
      entries.get("registryHash"),
      "resolution.registryHash",
      "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
    ),
    registryUrl: registryUrl.href,
    registryTrust,
    modelId: requireIdentifier(entries.get("modelId"), "resolution.modelId"),
    version: requireIdentifier(entries.get("version"), "resolution.version"),
    rootHash: requireContentHash(
      entries.get("rootHash"),
      "resolution.rootHash",
      "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
    ),
    manifestHash: requireContentHash(
      entries.get("manifestHash"),
      "resolution.manifestHash",
      "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
    ),
    baseUrl: baseUrl.href
  });
}

export function matchModelPackRegistryResolution(pack, resolutionInput) {
  const resolution = normalizeResolution(resolutionInput);
  const packEntries = inspectTransportOptions(
    pack,
    "MODEL_PACK_REGISTRY_PACK_INVALID",
    "Verified Model Pack"
  );
  const manifestEntries = inspectTransportOptions(
    packEntries.get("manifest"),
    "MODEL_PACK_REGISTRY_PACK_INVALID",
    "Verified Model Pack manifest"
  );
  const modelEntries = inspectTransportOptions(
    manifestEntries.get("model"),
    "MODEL_PACK_REGISTRY_PACK_INVALID",
    "Verified Model Pack model"
  );
  if (
    manifestEntries.get("format") !== MODEL_PACK_FORMAT
    || manifestEntries.get("formatVersion") !== MODEL_PACK_FORMAT_VERSION
  ) {
    fail("MODEL_PACK_REGISTRY_PACK_INVALID", "The supplied value is not a supported verified Model Pack.");
  }
  const actual = {
    modelId: modelEntries.get("id"),
    version: modelEntries.get("version"),
    rootHash: manifestEntries.get("rootHash"),
    manifestHash: manifestEntries.get("manifestHash")
  };
  if (
    actual.modelId !== resolution.modelId
    || actual.version !== resolution.version
    || actual.rootHash !== resolution.rootHash
    || actual.manifestHash !== resolution.manifestHash
  ) {
    fail("MODEL_PACK_REGISTRY_RESOLUTION_MISMATCH", "The verified Model Pack differs from its registry resolution.", {
      expectedModelId: resolution.modelId,
      expectedVersion: resolution.version,
      expectedRootHash: resolution.rootHash,
      expectedManifestHash: resolution.manifestHash,
      actualModelId: typeof actual.modelId === "string" ? actual.modelId : null,
      actualVersion: typeof actual.version === "string" ? actual.version : null,
      actualRootHash: isContentHash(actual.rootHash) ? actual.rootHash : null,
      actualManifestHash: isContentHash(actual.manifestHash) ? actual.manifestHash : null
    });
  }
  return pack;
}
