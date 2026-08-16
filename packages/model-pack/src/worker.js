import {
  canonicalClone,
  isContentHash
} from "@onto2d/kernel/canonical";
import {
  MODEL_PACK_BROWSER_LIMITS,
  loadModelPackBundle,
  loadModelPackHttpDirectory
} from "./browser.js";
import {
  MODEL_PACK_FORMAT,
  MODEL_PACK_FORMAT_VERSION,
  ModelPackError,
  modelPackFilePaths
} from "./index.js";
import { inspectTransportOptions } from "./transport-layout.js";

export const MODEL_PACK_WORKER_PROTOCOL = Object.freeze({
  name: "onto2d-model-pack-worker",
  version: "1"
});

export const MODEL_PACK_WORKER_LIMITS = Object.freeze({
  maxActiveRequests: 4,
  maxPendingRequests: 8,
  maxRequestIdLength: 128,
  maxRequestTimeoutMs: 5 * 60 * 1000,
  maxFileBytes: MODEL_PACK_BROWSER_LIMITS.maxFileBytes,
  maxTotalBytes: MODEL_PACK_BROWSER_LIMITS.maxTotalBytes,
  maxBundleBytes: MODEL_PACK_BROWSER_LIMITS.maxBundleBytes,
  maxUrlLength: MODEL_PACK_BROWSER_LIMITS.maxUrlLength,
  maxResultEntries: 1_000_000,
  maxResultDepth: 128
});

const CLIENT_OPTION_FIELDS = new Set([
  "clientId",
  "maxPendingRequests",
  "requestTimeoutMs",
  "ownsWorker"
]);
const ENDPOINT_OPTION_FIELDS = new Set(["fetch", "maxActiveRequests"]);
const HTTP_REQUEST_OPTION_FIELDS = new Set([
  "signal",
  "timeoutMs",
  "bundle",
  "maxFileBytes",
  "maxTotalBytes",
  "maxUrlLength"
]);
const HTTP_WIRE_OPTION_FIELDS = new Set([
  "bundle",
  "maxFileBytes",
  "maxTotalBytes",
  "maxUrlLength"
]);
const BUNDLE_REQUEST_OPTION_FIELDS = new Set([
  "signal",
  "timeoutMs",
  "transfer",
  "maxBundleBytes"
]);
const BUNDLE_WIRE_OPTION_FIELDS = new Set(["maxBundleBytes"]);
const REQUEST_FIELDS = new Set(["protocol", "version", "kind", "id", "operation", "input"]);
const CANCEL_FIELDS = new Set(["protocol", "version", "kind", "id"]);
const RESULT_FIELDS = new Set(["protocol", "version", "kind", "id", "pack"]);
const ERROR_FIELDS = new Set(["protocol", "version", "kind", "id", "error"]);
const SERIALIZED_ERROR_FIELDS = new Set(["name", "code", "message", "details"]);
const PACK_FIELDS = new Set(["manifest", "files"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const BUNDLE_POLICIES = new Set(["omit", "required"]);
const TRANSFER_POLICIES = new Set(["copy", "move"]);
let clientSequence = 0;

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
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_WORKER_OPTIONS_INVALID",
    subject
  );
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", `${subject} contains unknown fields.`, {
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
    fail("MODEL_PACK_WORKER_LIMIT_INVALID", `${field} is outside the worker protocol limit.`, {
      field,
      maximum
    });
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", `${field} must be boolean.`, { field });
  }
  return value;
}

function requireRequestId(value, field = "id") {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MODEL_PACK_WORKER_LIMITS.maxRequestIdLength
    || !REQUEST_ID_PATTERN.test(value)
  ) {
    fail("MODEL_PACK_WORKER_REQUEST_ID_INVALID", `${field} is not a bounded protocol identifier.`, {
      field
    });
  }
  return value;
}

function requireClientId(value) {
  const maximum = MODEL_PACK_WORKER_LIMITS.maxRequestIdLength - 32;
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maximum
    || !REQUEST_ID_PATTERN.test(value)
  ) {
    fail("MODEL_PACK_WORKER_REQUEST_ID_INVALID", "clientId is not a bounded protocol identifier.", {
      field: "clientId",
      maximum
    });
  }
  return value;
}

function normalizeSignal(value) {
  if (
    value !== null
    && (typeof AbortSignal !== "function" || !(value instanceof AbortSignal))
  ) {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "signal must be an AbortSignal or null.", {
      field: "signal"
    });
  }
  return value;
}

function defaultClientId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return `client-${globalThis.crypto.randomUUID()}`;
    }
  } catch {
    // A deterministic process-local fallback is sufficient for a dedicated worker.
  }
  clientSequence += 1;
  return `client-${Date.now().toString(36)}-${clientSequence.toString(36)}`;
}

function normalizeClientOptions(value) {
  const entries = optionEntries(value, CLIENT_OPTION_FIELDS, "Worker client options");
  const clientId = requireClientId(entries.has("clientId") ? entries.get("clientId") : defaultClientId());
  return Object.freeze({
    clientId,
    maxPendingRequests: requireInteger(
      optionValue(entries, "maxPendingRequests", MODEL_PACK_WORKER_LIMITS.maxPendingRequests),
      "maxPendingRequests",
      MODEL_PACK_WORKER_LIMITS.maxPendingRequests
    ),
    requestTimeoutMs: requireInteger(
      optionValue(entries, "requestTimeoutMs", MODEL_PACK_WORKER_LIMITS.maxRequestTimeoutMs),
      "requestTimeoutMs",
      MODEL_PACK_WORKER_LIMITS.maxRequestTimeoutMs
    ),
    ownsWorker: requireBoolean(optionValue(entries, "ownsWorker", false), "ownsWorker")
  });
}

function normalizeEndpointOptions(value) {
  const entries = optionEntries(value, ENDPOINT_OPTION_FIELDS, "Worker endpoint options");
  const fetchImplementation = entries.has("fetch") ? entries.get("fetch") : undefined;
  if (fetchImplementation !== undefined && typeof fetchImplementation !== "function") {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "fetch must be a function when supplied.", {
      field: "fetch"
    });
  }
  return Object.freeze({
    fetch: fetchImplementation,
    maxActiveRequests: requireInteger(
      optionValue(entries, "maxActiveRequests", MODEL_PACK_WORKER_LIMITS.maxActiveRequests),
      "maxActiveRequests",
      MODEL_PACK_WORKER_LIMITS.maxActiveRequests
    )
  });
}

function normalizeHttpWireOptions(value) {
  const entries = optionEntries(value, HTTP_WIRE_OPTION_FIELDS, "Worker HTTP request options");
  const bundle = optionValue(entries, "bundle", "omit");
  if (!BUNDLE_POLICIES.has(bundle)) {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "bundle must be omit or required.", {
      field: "bundle"
    });
  }
  const maxFileBytes = requireInteger(
    optionValue(entries, "maxFileBytes", MODEL_PACK_WORKER_LIMITS.maxFileBytes),
    "maxFileBytes",
    MODEL_PACK_WORKER_LIMITS.maxFileBytes
  );
  const maxTotalBytes = requireInteger(
    optionValue(entries, "maxTotalBytes", MODEL_PACK_WORKER_LIMITS.maxTotalBytes),
    "maxTotalBytes",
    MODEL_PACK_WORKER_LIMITS.maxTotalBytes
  );
  if (maxFileBytes > maxTotalBytes) {
    fail("MODEL_PACK_WORKER_LIMIT_INVALID", "maxFileBytes cannot exceed maxTotalBytes.");
  }
  return Object.freeze({
    bundle,
    maxFileBytes,
    maxTotalBytes,
    maxUrlLength: requireInteger(
      optionValue(entries, "maxUrlLength", MODEL_PACK_WORKER_LIMITS.maxUrlLength),
      "maxUrlLength",
      MODEL_PACK_WORKER_LIMITS.maxUrlLength
    )
  });
}

function normalizeHttpRequestOptions(value, defaultTimeoutMs) {
  const entries = optionEntries(value, HTTP_REQUEST_OPTION_FIELDS, "Worker HTTP client options");
  const wireEntries = new Map(
    [...entries].filter(([field]) => HTTP_WIRE_OPTION_FIELDS.has(field))
  );
  return Object.freeze({
    signal: normalizeSignal(optionValue(entries, "signal", null)),
    timeoutMs: requireInteger(
      optionValue(entries, "timeoutMs", defaultTimeoutMs),
      "timeoutMs",
      MODEL_PACK_WORKER_LIMITS.maxRequestTimeoutMs
    ),
    wire: normalizeHttpWireOptions(Object.fromEntries(wireEntries))
  });
}

function normalizeBundleWireOptions(value) {
  const entries = optionEntries(value, BUNDLE_WIRE_OPTION_FIELDS, "Worker bundle request options");
  return Object.freeze({
    maxBundleBytes: requireInteger(
      optionValue(entries, "maxBundleBytes", MODEL_PACK_WORKER_LIMITS.maxBundleBytes),
      "maxBundleBytes",
      MODEL_PACK_WORKER_LIMITS.maxBundleBytes
    )
  });
}

function normalizeBundleRequestOptions(value, defaultTimeoutMs) {
  const entries = optionEntries(value, BUNDLE_REQUEST_OPTION_FIELDS, "Worker bundle client options");
  const transfer = optionValue(entries, "transfer", "copy");
  if (!TRANSFER_POLICIES.has(transfer)) {
    fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "transfer must be copy or move.", {
      field: "transfer"
    });
  }
  const wireEntries = new Map(
    [...entries].filter(([field]) => BUNDLE_WIRE_OPTION_FIELDS.has(field))
  );
  return Object.freeze({
    signal: normalizeSignal(optionValue(entries, "signal", null)),
    timeoutMs: requireInteger(
      optionValue(entries, "timeoutMs", defaultTimeoutMs),
      "timeoutMs",
      MODEL_PACK_WORKER_LIMITS.maxRequestTimeoutMs
    ),
    transfer,
    wire: normalizeBundleWireOptions(Object.fromEntries(wireEntries))
  });
}

function validateWorkerPort(worker, ownsWorker) {
  try {
    if (
      worker === null
      || typeof worker !== "object"
      || typeof worker.postMessage !== "function"
      || typeof worker.addEventListener !== "function"
      || typeof worker.removeEventListener !== "function"
      || (ownsWorker && typeof worker.terminate !== "function")
    ) {
      throw new TypeError();
    }
  } catch {
    fail("MODEL_PACK_WORKER_PORT_INVALID", "worker must implement the Worker event and message surface.");
  }
  return worker;
}

function validateEndpointScope(scope) {
  try {
    if (
      scope === null
      || (typeof scope !== "object" && typeof scope !== "function")
      || typeof scope.postMessage !== "function"
      || typeof scope.addEventListener !== "function"
      || typeof scope.removeEventListener !== "function"
    ) {
      throw new TypeError();
    }
  } catch {
    fail("MODEL_PACK_WORKER_PORT_INVALID", "scope must implement the worker-global message surface.");
  }
  return scope;
}

function workerError(code, message, details = {}) {
  return new ModelPackError(code, message, details);
}

function safeErrorDetails(error) {
  if (!(error instanceof ModelPackError)) {
    return { cause: error instanceof Error ? error.name : typeof error };
  }
  try {
    return canonicalClone(error.details, {
      limits: { maxDepth: 16, maxEntries: 256, maxStringBytes: 4096 }
    });
  } catch {
    return {};
  }
}

function serializeError(error) {
  const modelPackError = error instanceof ModelPackError;
  const code = modelPackError
    && typeof error.code === "string"
    && error.code.length <= 128
    && ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : "MODEL_PACK_WORKER_INTERNAL";
  const message = modelPackError && typeof error.message === "string"
    ? error.message.slice(0, 2048)
    : "The Model Pack worker failed internally.";
  return Object.freeze({
    name: "ModelPackError",
    code,
    message,
    details: safeErrorDetails(error)
  });
}

function freezeStructuredJson(value, subject) {
  const pending = [{ value, depth: 0, path: "$" }];
  const seen = new WeakSet();
  let entries = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    entries += 1;
    if (entries > MODEL_PACK_WORKER_LIMITS.maxResultEntries) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} exceeds the result entry limit.`);
    }
    if (current.depth > MODEL_PACK_WORKER_LIMITS.maxResultDepth) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} exceeds the result depth limit.`);
    }
    const item = current.value;
    if (item === null || typeof item === "boolean") continue;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) {
        fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains a non-finite number.`, {
          path: current.path
        });
      }
      continue;
    }
    if (typeof item === "string") {
      if (item.length > 1_048_576) {
        fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains an oversized string.`, {
          path: current.path
        });
      }
      continue;
    }
    if (typeof item !== "object" || seen.has(item)) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} is not structured JSON.`, {
        path: current.path
      });
    }
    seen.add(item);
    const isArray = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (
      (isArray && prototype !== Array.prototype)
      || (!isArray && prototype !== Object.prototype && prototype !== null)
    ) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains a non-plain object.`, {
        path: current.path
      });
    }
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (isArray && item.length > MODEL_PACK_WORKER_LIMITS.maxResultEntries) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains an oversized array.`, {
        path: current.path
      });
    }
    let arrayEntryCount = 0;
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if (typeof key !== "string" || !("value" in descriptor)) {
        fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains an accessor or symbol.`, {
          path: current.path
        });
      }
      if (!descriptor.enumerable) {
        if (isArray && key === "length") continue;
        fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains a non-enumerable field.`, {
          path: current.path
        });
      }
      if (isArray) {
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || index >= item.length || String(index) !== key) {
          fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains a named array field.`, {
            path: current.path
          });
        }
        arrayEntryCount += 1;
      }
      pending.push({
        value: descriptor.value,
        depth: current.depth + 1,
        path: isArray ? `${current.path}[${key}]` : `${current.path}.${key}`
      });
    }
    if (isArray && arrayEntryCount !== item.length) {
      fail("MODEL_PACK_WORKER_RESPONSE_INVALID", `${subject} contains a sparse array.`, {
        path: current.path
      });
    }
    Object.freeze(item);
  }
  return value;
}

function validateResultPack(pack) {
  const entries = exactEntries(
    pack,
    PACK_FIELDS,
    "MODEL_PACK_WORKER_RESPONSE_INVALID",
    "Worker result pack"
  );
  const manifest = entries.get("manifest");
  const files = entries.get("files");
  const manifestEntries = inspectTransportOptions(
    manifest,
    "MODEL_PACK_WORKER_RESPONSE_INVALID",
    "Worker result manifest"
  );
  if (
    manifestEntries.get("format") !== MODEL_PACK_FORMAT
    || manifestEntries.get("formatVersion") !== MODEL_PACK_FORMAT_VERSION
    || !isContentHash(manifestEntries.get("rootHash"))
    || !isContentHash(manifestEntries.get("manifestHash"))
  ) {
    fail("MODEL_PACK_WORKER_RESPONSE_INVALID", "Worker result manifest identity is invalid.");
  }
  const fileEntries = inspectTransportOptions(
    files,
    "MODEL_PACK_WORKER_RESPONSE_INVALID",
    "Worker result files"
  );
  const required = Object.values(modelPackFilePaths()).sort();
  const actual = [...fileEntries.keys()].sort();
  if (
    actual.length !== required.length
    || actual.some((path, index) => path !== required[index])
  ) {
    fail("MODEL_PACK_WORKER_RESPONSE_INVALID", "Worker result file layout is invalid.");
  }
  return freezeStructuredJson(pack, "Worker result pack");
}

function deserializeError(value) {
  const entries = exactEntries(
    value,
    SERIALIZED_ERROR_FIELDS,
    "MODEL_PACK_WORKER_PROTOCOL_INVALID",
    "Serialized worker error"
  );
  const code = entries.get("code");
  const message = entries.get("message");
  if (
    entries.get("name") !== "ModelPackError"
    || typeof code !== "string"
    || code.length > 128
    || !ERROR_CODE_PATTERN.test(code)
    || typeof message !== "string"
    || message.length > 2048
  ) {
    fail("MODEL_PACK_WORKER_PROTOCOL_INVALID", "Serialized worker error identity is invalid.");
  }
  const details = freezeStructuredJson(entries.get("details"), "Serialized worker error details");
  return workerError(code, message, details);
}

function protocolEnvelope(kind, id, extra = {}) {
  return {
    protocol: MODEL_PACK_WORKER_PROTOCOL.name,
    version: MODEL_PACK_WORKER_PROTOCOL.version,
    kind,
    id,
    ...extra
  };
}

function safeMessageIdentity(value) {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const protocol = descriptors.protocol;
    const id = descriptors.id;
    if (!(protocol && "value" in protocol && id && "value" in id)) return null;
    if (protocol.value !== MODEL_PACK_WORKER_PROTOCOL.name) return null;
    return requireRequestId(id.value);
  } catch {
    return null;
  }
}

function prepareBundleSource(source, options) {
  let byteLength;
  let payload;
  let transfers = [];
  try {
    if (typeof Blob === "function" && source instanceof Blob) {
      if (options.transfer === "move") {
        fail("MODEL_PACK_WORKER_BUNDLE_TRANSFER_INVALID", "Blob sources cannot use move transfer.");
      }
      byteLength = source.size;
      payload = source;
    } else if (source instanceof ArrayBuffer) {
      byteLength = source.byteLength;
      payload = options.transfer === "move" ? source : source.slice(0);
      transfers = [payload];
    } else if (ArrayBuffer.isView(source) && source.buffer instanceof ArrayBuffer) {
      byteLength = source.byteLength;
      if (options.transfer === "move") {
        if (source.byteOffset !== 0 || source.byteLength !== source.buffer.byteLength) {
          fail(
            "MODEL_PACK_WORKER_BUNDLE_TRANSFER_INVALID",
            "A moved view must cover its complete ArrayBuffer."
          );
        }
        payload = source.buffer;
      } else {
        payload = new Uint8Array(
          source.buffer,
          source.byteOffset,
          source.byteLength
        ).slice().buffer;
      }
      transfers = [payload];
    } else {
      fail(
        "MODEL_PACK_WORKER_BUNDLE_SOURCE_INVALID",
        "source must be a Blob, ArrayBuffer, or view over an ArrayBuffer."
      );
    }
  } catch (error) {
    if (error instanceof ModelPackError) throw error;
    fail("MODEL_PACK_WORKER_BUNDLE_SOURCE_INVALID", "The bundle source is detached or invalid.");
  }
  if (!Number.isSafeInteger(byteLength) || byteLength > options.wire.maxBundleBytes) {
    fail("MODEL_PACK_WORKER_BUNDLE_LIMIT_EXCEEDED", "The bundle exceeds maxBundleBytes.", {
      maxBundleBytes: options.wire.maxBundleBytes
    });
  }
  return { payload, transfers };
}

export function createModelPackWorkerClient(worker, options = {}) {
  const normalized = normalizeClientOptions(options);
  const port = validateWorkerPort(worker, normalized.ownsWorker);
  const pending = new Map();
  let requestSequence = 0;
  let closed = false;

  function removeListeners() {
    port.removeEventListener("message", onMessage);
    port.removeEventListener("messageerror", onTransportError);
    port.removeEventListener("error", onTransportError);
  }

  function cleanup(request) {
    clearTimeout(request.timer);
    if (request.signal !== null) {
      request.signal.removeEventListener("abort", request.onAbort);
    }
  }

  function rejectAll(error, notifyEndpoint = false) {
    for (const [id, request] of pending) {
      cleanup(request);
      if (notifyEndpoint) {
        try {
          port.postMessage(protocolEnvelope("cancel", id));
        } catch {
          // Local closure is authoritative even if cancellation cannot be posted.
        }
      }
      request.reject(error);
    }
    pending.clear();
  }

  function closeTransport(error, terminate, notifyEndpoint = false) {
    if (closed) return;
    closed = true;
    removeListeners();
    rejectAll(error, notifyEndpoint);
    if (terminate && typeof port.terminate === "function") {
      try {
        port.terminate();
      } catch {
        // Pending requests already received the stable local error.
      }
    }
  }

  function cancelRequest(id, error) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    cleanup(request);
    try {
      port.postMessage(protocolEnvelope("cancel", id));
    } catch {
      // Cancellation is already authoritative on the client side.
    }
    request.reject(error);
  }

  function onTransportError() {
    closeTransport(
      workerError(
        "MODEL_PACK_WORKER_TRANSPORT_FAILED",
        "The Model Pack worker transport failed."
      ),
      normalized.ownsWorker
    );
  }

  function onMessage(event) {
    const identity = safeMessageIdentity(event?.data);
    if (identity === null) return;
    let entries;
    try {
      const data = event.data;
      const header = inspectTransportOptions(
        data,
        "MODEL_PACK_WORKER_PROTOCOL_INVALID",
        "Worker response message"
      );
      if (header.get("version") !== MODEL_PACK_WORKER_PROTOCOL.version) {
        fail("MODEL_PACK_WORKER_VERSION_UNSUPPORTED", "The worker protocol version is unsupported.");
      }
      const kind = header.get("kind");
      if (kind === "result") {
        entries = exactEntries(
          data,
          RESULT_FIELDS,
          "MODEL_PACK_WORKER_PROTOCOL_INVALID",
          "Worker result message"
        );
      } else if (kind === "error") {
        entries = exactEntries(
          data,
          ERROR_FIELDS,
          "MODEL_PACK_WORKER_PROTOCOL_INVALID",
          "Worker error message"
        );
      } else {
        fail("MODEL_PACK_WORKER_PROTOCOL_INVALID", "The worker response kind is invalid.");
      }
      requireRequestId(entries.get("id"));
      const request = pending.get(identity);
      if (!request) return;
      const outcome = kind === "result"
        ? { pack: validateResultPack(entries.get("pack")) }
        : { error: deserializeError(entries.get("error")) };
      pending.delete(identity);
      cleanup(request);
      if (kind === "result") {
        request.resolve(outcome.pack);
      } else {
        request.reject(outcome.error);
      }
    } catch (error) {
      closeTransport(
        error instanceof ModelPackError
          ? error
          : workerError(
            "MODEL_PACK_WORKER_PROTOCOL_INVALID",
            "The Model Pack worker returned an invalid response."
          ),
        normalized.ownsWorker
      );
    }
  }

  function request(operation, input, requestOptions, transfers = []) {
    if (closed) {
      return Promise.reject(workerError(
        "MODEL_PACK_WORKER_CLIENT_CLOSED",
        "The Model Pack worker client is closed."
      ));
    }
    if (requestOptions.signal?.aborted === true) {
      return Promise.reject(workerError(
        "MODEL_PACK_WORKER_ABORTED",
        "The Model Pack worker request was aborted."
      ));
    }
    if (pending.size >= normalized.maxPendingRequests) {
      return Promise.reject(workerError(
        "MODEL_PACK_WORKER_CAPACITY_EXCEEDED",
        "The Model Pack worker client has too many pending requests."
      ));
    }
    requestSequence += 1;
    const id = requireRequestId(`${normalized.clientId}:request-${requestSequence}`);
    return new Promise((resolve, reject) => {
      const onAbort = () => cancelRequest(
        id,
        workerError("MODEL_PACK_WORKER_ABORTED", "The Model Pack worker request was aborted.")
      );
      const timer = setTimeout(() => cancelRequest(
        id,
        workerError("MODEL_PACK_WORKER_TIMEOUT", "The Model Pack worker request timed out.")
      ), requestOptions.timeoutMs);
      const record = {
        resolve,
        reject,
        signal: requestOptions.signal,
        onAbort,
        timer
      };
      pending.set(id, record);
      if (record.signal !== null) {
        record.signal.addEventListener("abort", onAbort, { once: true });
      }
      try {
        port.postMessage(protocolEnvelope("request", id, { operation, input }), transfers);
      } catch (error) {
        pending.delete(id);
        cleanup(record);
        const transportError = workerError(
          "MODEL_PACK_WORKER_TRANSPORT_FAILED",
          "The Model Pack worker request could not be posted.",
          { cause: error instanceof Error ? error.name : typeof error }
        );
        reject(transportError);
        closeTransport(transportError, normalized.ownsWorker);
      }
    });
  }

  async function loadHttpDirectory(baseUrl, requestOptions = {}) {
    const normalizedRequest = normalizeHttpRequestOptions(
      requestOptions,
      normalized.requestTimeoutMs
    );
    let href;
    try {
      href = baseUrl instanceof URL ? baseUrl.href : baseUrl;
    } catch {
      fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "baseUrl cannot be converted to a URL string.");
    }
    if (typeof href !== "string") {
      fail("MODEL_PACK_WORKER_OPTIONS_INVALID", "baseUrl must be a URL or URL string.");
    }
    if (href.length > normalizedRequest.wire.maxUrlLength) {
      fail("MODEL_PACK_WORKER_URL_LIMIT_EXCEEDED", "baseUrl exceeds maxUrlLength.", {
        maxUrlLength: normalizedRequest.wire.maxUrlLength
      });
    }
    return request(
      "load-http-directory",
      { baseUrl: href, options: normalizedRequest.wire },
      normalizedRequest
    );
  }

  async function loadBundle(source, requestOptions = {}) {
    const normalizedRequest = normalizeBundleRequestOptions(
      requestOptions,
      normalized.requestTimeoutMs
    );
    const prepared = prepareBundleSource(source, normalizedRequest);
    return request(
      "load-bundle",
      { source: prepared.payload, options: normalizedRequest.wire },
      normalizedRequest,
      prepared.transfers
    );
  }

  function close() {
    closeTransport(
      workerError("MODEL_PACK_WORKER_CLIENT_CLOSED", "The Model Pack worker client was closed."),
      normalized.ownsWorker,
      true
    );
  }

  port.addEventListener("message", onMessage);
  port.addEventListener("messageerror", onTransportError);
  port.addEventListener("error", onTransportError);

  return Object.freeze({ loadHttpDirectory, loadBundle, close });
}

function readEndpointMessage(value) {
  const header = inspectTransportOptions(
    value,
    "MODEL_PACK_WORKER_PROTOCOL_INVALID",
    "Worker request message"
  );
  if (header.get("kind") === "cancel") {
    const entries = exactEntries(
      value,
      CANCEL_FIELDS,
      "MODEL_PACK_WORKER_PROTOCOL_INVALID",
      "Worker cancellation message"
    );
    return Object.freeze({ kind: "cancel", id: requireRequestId(entries.get("id")) });
  }
  const entries = exactEntries(
    value,
    REQUEST_FIELDS,
    "MODEL_PACK_WORKER_PROTOCOL_INVALID",
    "Worker request message"
  );
  if (entries.get("kind") !== "request") {
    fail("MODEL_PACK_WORKER_PROTOCOL_INVALID", "The worker message kind is invalid.");
  }
  const operation = entries.get("operation");
  if (operation !== "load-http-directory" && operation !== "load-bundle") {
    fail("MODEL_PACK_WORKER_OPERATION_UNSUPPORTED", "The worker operation is unsupported.");
  }
  return Object.freeze({
    kind: "request",
    id: requireRequestId(entries.get("id")),
    operation,
    input: entries.get("input")
  });
}

function requireProtocolIdentity(value) {
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_WORKER_PROTOCOL_INVALID",
    "Worker protocol message"
  );
  if (
    entries.get("protocol") !== MODEL_PACK_WORKER_PROTOCOL.name
    || entries.get("version") !== MODEL_PACK_WORKER_PROTOCOL.version
  ) {
    fail("MODEL_PACK_WORKER_VERSION_UNSUPPORTED", "The worker protocol identity is unsupported.");
  }
}

async function executeEndpointRequest(request, options, signal) {
  if (request.operation === "load-http-directory") {
    const entries = exactEntries(
      request.input,
      new Set(["baseUrl", "options"]),
      "MODEL_PACK_WORKER_PROTOCOL_INVALID",
      "Worker HTTP input"
    );
    if (typeof entries.get("baseUrl") !== "string") {
      fail("MODEL_PACK_WORKER_PROTOCOL_INVALID", "Worker HTTP baseUrl must be a string.");
    }
    const wire = normalizeHttpWireOptions(entries.get("options"));
    return loadModelPackHttpDirectory(entries.get("baseUrl"), {
      ...wire,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      signal
    });
  }
  const entries = exactEntries(
    request.input,
    new Set(["source", "options"]),
    "MODEL_PACK_WORKER_PROTOCOL_INVALID",
    "Worker bundle input"
  );
  const wire = normalizeBundleWireOptions(entries.get("options"));
  if (signal.aborted) {
    fail("MODEL_PACK_WORKER_ABORTED", "The Model Pack worker request was aborted.");
  }
  const pack = await loadModelPackBundle(entries.get("source"), wire);
  if (signal.aborted) {
    fail("MODEL_PACK_WORKER_ABORTED", "The Model Pack worker request was aborted.");
  }
  return pack;
}

export function installModelPackWorkerEndpoint(scope = globalThis, options = {}) {
  const normalized = normalizeEndpointOptions(options);
  const port = validateEndpointScope(scope);
  const active = new Map();
  let closed = false;

  function postError(id, error) {
    try {
      port.postMessage(protocolEnvelope("error", id, { error: serializeError(error) }));
    } catch {
      // A broken destination cannot receive a secondary protocol error.
    }
  }

  function cancel(id) {
    const record = active.get(id);
    if (!record) return;
    active.delete(id);
    record.controller.abort();
  }

  async function handleMessage(event) {
    const id = safeMessageIdentity(event?.data);
    if (id === null || closed) return;
    let request;
    try {
      requireProtocolIdentity(event.data);
      request = readEndpointMessage(event.data);
    } catch (error) {
      postError(id, error);
      return;
    }
    if (request.kind === "cancel") {
      cancel(request.id);
      return;
    }
    if (active.has(request.id)) {
      cancel(request.id);
      postError(request.id, workerError(
        "MODEL_PACK_WORKER_DUPLICATE_REQUEST",
        "The worker request identifier is already active."
      ));
      return;
    }
    if (active.size >= normalized.maxActiveRequests) {
      postError(request.id, workerError(
        "MODEL_PACK_WORKER_CAPACITY_EXCEEDED",
        "The Model Pack worker has too many active requests."
      ));
      return;
    }
    const record = { controller: new AbortController() };
    active.set(request.id, record);
    try {
      const pack = await executeEndpointRequest(
        request,
        normalized,
        record.controller.signal
      );
      if (active.get(request.id) !== record || record.controller.signal.aborted) return;
      port.postMessage(protocolEnvelope("result", request.id, { pack }));
    } catch (error) {
      if (active.get(request.id) === record && !record.controller.signal.aborted) {
        postError(request.id, error);
      }
    } finally {
      if (active.get(request.id) === record) active.delete(request.id);
    }
  }

  function onMessage(event) {
    void handleMessage(event);
  }

  function close() {
    if (closed) return;
    closed = true;
    port.removeEventListener("message", onMessage);
    for (const id of [...active.keys()]) cancel(id);
  }

  port.addEventListener("message", onMessage);
  return Object.freeze({ close });
}
