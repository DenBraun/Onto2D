import { ModelPackError, verifyModelPack } from "./index.js";
import {
  MODEL_PACK_REQUIRED_PATHS,
  inspectTransportOptions,
  modelPackTransportFail,
  verifyTransportFiles
} from "./transport-layout.js";

export const MODEL_PACK_BROWSER_LIMITS = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxBundleBytes: 64 * 1024 * 1024,
  maxUrlLength: 16_384
});

const HTTP_OPTION_FIELDS = new Set([
  "fetch",
  "signal",
  "bundle",
  "maxFileBytes",
  "maxTotalBytes",
  "maxUrlLength"
]);
const BUNDLE_OPTION_FIELDS = new Set(["maxBundleBytes"]);
const BUNDLE_POLICIES = new Set(["omit", "required"]);
const JSON_MEDIA_TYPE = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/;

function fail(code, message, details = {}) {
  modelPackTransportFail(code, message, details);
}

function requireInteger(value, field, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail("MODEL_PACK_BROWSER_LIMIT_INVALID", `${field} is outside the supported range.`, {
      field
    });
  }
  return value;
}

function optionValue(entries, field, fallback) {
  return entries.has(field) ? entries.get(field) : fallback;
}

function normalizeHttpOptions(value) {
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_BROWSER_OPTIONS_INVALID",
    "Browser HTTP loader options"
  );
  const unknown = [...entries.keys()].filter((field) => !HTTP_OPTION_FIELDS.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_BROWSER_OPTIONS_INVALID", "Browser HTTP loader options contain unknown fields.", {
      unknown
    });
  }
  const maxFileBytes = requireInteger(
    optionValue(entries, "maxFileBytes", MODEL_PACK_BROWSER_LIMITS.maxFileBytes),
    "maxFileBytes",
    1024 * 1024 * 1024
  );
  const maxTotalBytes = requireInteger(
    optionValue(entries, "maxTotalBytes", MODEL_PACK_BROWSER_LIMITS.maxTotalBytes),
    "maxTotalBytes",
    4 * 1024 * 1024 * 1024
  );
  const maxUrlLength = requireInteger(
    optionValue(entries, "maxUrlLength", MODEL_PACK_BROWSER_LIMITS.maxUrlLength),
    "maxUrlLength",
    1024 * 1024
  );
  if (maxFileBytes > maxTotalBytes) {
    fail("MODEL_PACK_BROWSER_LIMIT_INVALID", "maxFileBytes cannot exceed maxTotalBytes.");
  }
  const bundle = optionValue(entries, "bundle", "omit");
  if (!BUNDLE_POLICIES.has(bundle)) {
    fail("MODEL_PACK_BROWSER_OPTIONS_INVALID", "bundle must be omit or required.", {
      field: "bundle"
    });
  }
  const fetchImplementation = entries.has("fetch")
    ? entries.get("fetch")
    : typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
  if (typeof fetchImplementation !== "function") {
    fail("MODEL_PACK_BROWSER_FETCH_UNAVAILABLE", "A fetch implementation is required.");
  }
  const signal = optionValue(entries, "signal", null);
  if (
    signal !== null
    && (typeof AbortSignal !== "function" || !(signal instanceof AbortSignal))
  ) {
    fail("MODEL_PACK_BROWSER_OPTIONS_INVALID", "signal must be an AbortSignal or null.", {
      field: "signal"
    });
  }
  return Object.freeze({
    fetch: fetchImplementation,
    signal,
    bundle,
    maxFileBytes,
    maxTotalBytes,
    maxUrlLength
  });
}

function normalizeBundleOptions(value) {
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_BROWSER_OPTIONS_INVALID",
    "Browser bundle loader options"
  );
  const unknown = [...entries.keys()].filter((field) => !BUNDLE_OPTION_FIELDS.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_BROWSER_OPTIONS_INVALID", "Browser bundle loader options contain unknown fields.", {
      unknown
    });
  }
  return Object.freeze({
    maxBundleBytes: requireInteger(
      optionValue(entries, "maxBundleBytes", MODEL_PACK_BROWSER_LIMITS.maxBundleBytes),
      "maxBundleBytes",
      1024 * 1024 * 1024
    )
  });
}

function normalizeBaseUrl(value, maxUrlLength) {
  if (typeof value === "string" && value.length > maxUrlLength) {
    fail("MODEL_PACK_BROWSER_URL_INVALID", "The Model Pack base URL exceeds maxUrlLength.");
  }
  if (typeof value !== "string" && !(value instanceof URL)) {
    fail("MODEL_PACK_BROWSER_URL_INVALID", "baseUrl must be an absolute URL or URL string.");
  }
  let url;
  try {
    url = new URL(value instanceof URL ? value.href : value);
  } catch {
    fail("MODEL_PACK_BROWSER_URL_INVALID", "baseUrl must be an absolute URL.");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    fail(
      "MODEL_PACK_BROWSER_URL_INVALID",
      "baseUrl must be an HTTP(S) URL without credentials, query, or fragment."
    );
  }
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  if (url.href.length > maxUrlLength) {
    fail("MODEL_PACK_BROWSER_URL_INVALID", "The normalized Model Pack base URL exceeds maxUrlLength.");
  }
  return url;
}

function responseFields(response, relative) {
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
    fail("MODEL_PACK_BROWSER_RESPONSE_INVALID", "fetch returned an invalid response object.", {
      path: relative
    });
  }
}

function inspectResponse(response, requestedUrl, relative, limits, budget) {
  const fields = responseFields(response, relative);
  if (fields.type === "opaque") {
    fail("MODEL_PACK_BROWSER_RESPONSE_INVALID", "Opaque fetch responses are not accepted.", {
      path: relative
    });
  }
  if (fields.redirected === true) {
    fail("MODEL_PACK_BROWSER_REDIRECT_REJECTED", "Redirected Model Pack responses are not accepted.", {
      path: relative
    });
  }
  if (fields.ok !== true || fields.status !== 200) {
    fail("MODEL_PACK_BROWSER_HTTP_FAILED", "A Model Pack HTTP request did not return status 200.", {
      path: relative,
      status: Number.isInteger(fields.status) ? fields.status : null
    });
  }
  let normalizedResponseUrl;
  try {
    if (typeof fields.url !== "string" || fields.url === "") throw new TypeError();
    normalizedResponseUrl = new URL(fields.url).href;
  } catch {
    fail("MODEL_PACK_BROWSER_RESPONSE_INVALID", "A Model Pack response URL is missing or invalid.", {
      path: relative
    });
  }
  if (normalizedResponseUrl !== requestedUrl.href) {
    fail("MODEL_PACK_BROWSER_RESPONSE_URL_MISMATCH", "A Model Pack response came from a different URL.", {
      path: relative
    });
  }
  let contentType;
  let contentLength;
  try {
    contentType = fields.headers.get("content-type");
    contentLength = fields.headers.get("content-length");
  } catch {
    fail("MODEL_PACK_BROWSER_RESPONSE_INVALID", "Model Pack response headers cannot be read.", {
      path: relative
    });
  }
  const mediaType = typeof contentType === "string"
    ? contentType.split(";", 1)[0].trim().toLowerCase()
    : "";
  if (!JSON_MEDIA_TYPE.test(mediaType)) {
    fail("MODEL_PACK_BROWSER_CONTENT_TYPE_INVALID", "A Model Pack response is not JSON content.", {
      path: relative
    });
  }
  let declaredLength = null;
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(contentLength)) {
      fail("MODEL_PACK_BROWSER_CONTENT_LENGTH_INVALID", "Content-Length is not a valid byte count.", {
        path: relative
      });
    }
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared)) {
      fail("MODEL_PACK_BROWSER_CONTENT_LENGTH_INVALID", "Content-Length exceeds the supported range.", {
        path: relative
      });
    }
    if (declared > limits.maxFileBytes) {
      fail("MODEL_PACK_BROWSER_FILE_LIMIT_EXCEEDED", "A Model Pack response exceeds maxFileBytes.", {
        path: relative,
        maxFileBytes: limits.maxFileBytes
      });
    }
    if (budget.bytes > limits.maxTotalBytes - declared) {
      fail("MODEL_PACK_BROWSER_TOTAL_LIMIT_EXCEEDED", "Model Pack responses exceed maxTotalBytes.", {
        maxTotalBytes: limits.maxTotalBytes
      });
    }
    declaredLength = declared;
  }
  if (fields.body === null || typeof fields.body?.getReader !== "function") {
    fail("MODEL_PACK_BROWSER_STREAM_INVALID", "A Model Pack response requires a readable byte stream.", {
      path: relative
    });
  }
  return Object.freeze({ stream: fields.body, declaredLength });
}

async function readBoundedStream(stream, maximum, budget, totalMaximum, relative, prefix) {
  let reader;
  try {
    reader = stream.getReader();
  } catch {
    fail(`${prefix}_STREAM_INVALID`, "The source byte stream cannot be read.", {
      path: relative
    });
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result === null || typeof result !== "object" || typeof result.done !== "boolean") {
        fail(`${prefix}_STREAM_INVALID`, "The source byte stream returned an invalid chunk.", {
          path: relative
        });
      }
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        fail(`${prefix}_STREAM_INVALID`, "The source byte stream must yield Uint8Array chunks.", {
          path: relative
        });
      }
      const chunk = result.value;
      if (total > maximum - chunk.byteLength) {
        fail(`${prefix}_LIMIT_EXCEEDED`, "The source byte stream exceeds its byte limit.", {
          path: relative,
          maximum
        });
      }
      if (budget.bytes + total > totalMaximum - chunk.byteLength) {
        fail("MODEL_PACK_BROWSER_TOTAL_LIMIT_EXCEEDED", "Model Pack responses exceed maxTotalBytes.", {
          maxTotalBytes: totalMaximum
        });
      }
      total += chunk.byteLength;
      chunks.push(chunk.slice());
    }
  } catch (error) {
    try {
      Promise.resolve(reader.cancel()).catch(() => {});
    } catch {
      // The original bounded-stream error remains authoritative.
    }
    if (error instanceof ModelPackError) throw error;
    fail(`${prefix}_STREAM_FAILED`, "The source byte stream failed while being read.", {
      path: relative,
      cause: error instanceof Error ? error.name : typeof error
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed stream can already be detached from its reader.
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  budget.bytes += total;
  return bytes;
}

function parseJson(bytes, relative, prefix = "MODEL_PACK_BROWSER") {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${prefix}_UTF8_INVALID`, "Model Pack bytes are not valid UTF-8.", {
      path: relative
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${prefix}_JSON_INVALID`, "Model Pack bytes are not valid JSON.", {
      path: relative
    });
  }
}

async function fetchJson(fetchImplementation, requestedUrl, relative, options, budget) {
  let response;
  const request = {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    headers: { Accept: "application/json" }
  };
  if (options.signal !== null) request.signal = options.signal;
  try {
    response = await fetchImplementation(requestedUrl.href, request);
  } catch (error) {
    fail("MODEL_PACK_BROWSER_FETCH_FAILED", "A Model Pack HTTP request failed.", {
      path: relative,
      cause: error instanceof Error ? error.name : typeof error
    });
  }
  const inspected = inspectResponse(response, requestedUrl, relative, options, budget);
  const bytes = await readBoundedStream(
    inspected.stream,
    options.maxFileBytes,
    budget,
    options.maxTotalBytes,
    relative,
    "MODEL_PACK_BROWSER_FILE"
  );
  if (inspected.declaredLength !== null && inspected.declaredLength !== bytes.byteLength) {
    fail(
      "MODEL_PACK_BROWSER_CONTENT_LENGTH_MISMATCH",
      "Content-Length does not match the received Model Pack bytes.",
      { path: relative }
    );
  }
  return parseJson(bytes, relative);
}

export async function loadModelPackHttpDirectory(baseUrl, options = {}) {
  const normalized = normalizeHttpOptions(options);
  const base = normalizeBaseUrl(baseUrl, normalized.maxUrlLength);
  const paths = normalized.bundle === "required"
    ? [...MODEL_PACK_REQUIRED_PATHS, "bundle.json"]
    : MODEL_PACK_REQUIRED_PATHS;
  const values = new Map();
  const budget = { bytes: 0 };
  for (const relative of paths) {
    const requestedUrl = new URL(relative, base);
    if (
      requestedUrl.origin !== base.origin ||
      !requestedUrl.href.startsWith(base.href) ||
      requestedUrl.href.length > normalized.maxUrlLength
    ) {
      fail("MODEL_PACK_BROWSER_URL_INVALID", "A Model Pack entry URL escapes the bounded base URL.", {
        path: relative
      });
    }
    values.set(relative, await fetchJson(
      normalized.fetch,
      requestedUrl,
      relative,
      normalized,
      budget
    ));
  }
  try {
    return verifyTransportFiles(values);
  } catch (error) {
    if (error instanceof ModelPackError && error.code === "MODEL_PACK_TRANSPORT_BUNDLE_MISMATCH") {
      fail("MODEL_PACK_BROWSER_BUNDLE_MISMATCH", error.message);
    }
    throw error;
  }
}

function byteView(source, maximum) {
  try {
    let view = null;
    if (source instanceof ArrayBuffer) view = new Uint8Array(source);
    if (ArrayBuffer.isView(source)) {
      view = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    }
    if (view === null) return null;
    if (view.byteLength > maximum) {
      fail("MODEL_PACK_BROWSER_BUNDLE_LIMIT_EXCEEDED", "The bundle exceeds maxBundleBytes.", {
        maxBundleBytes: maximum
      });
    }
    return view.slice();
  } catch (error) {
    if (error instanceof ModelPackError) throw error;
    fail("MODEL_PACK_BROWSER_BUNDLE_SOURCE_INVALID", "The bundle byte source is detached or invalid.");
  }
}

export async function loadModelPackBundle(source, options = {}) {
  const normalized = normalizeBundleOptions(options);
  let bytes = byteView(source, normalized.maxBundleBytes);
  if (bytes === null) {
    if (typeof Blob === "undefined" || !(source instanceof Blob)) {
      fail(
        "MODEL_PACK_BROWSER_BUNDLE_SOURCE_INVALID",
        "source must be a Blob, ArrayBuffer, or ArrayBuffer view."
      );
    }
    if (!Number.isSafeInteger(source.size) || source.size > normalized.maxBundleBytes) {
      fail("MODEL_PACK_BROWSER_BUNDLE_LIMIT_EXCEEDED", "The bundle exceeds maxBundleBytes.", {
        maxBundleBytes: normalized.maxBundleBytes
      });
    }
    const budget = { bytes: 0 };
    let stream;
    try {
      stream = source.stream();
    } catch {
      fail("MODEL_PACK_BROWSER_BUNDLE_SOURCE_INVALID", "The Blob source cannot provide a byte stream.");
    }
    bytes = await readBoundedStream(
      stream,
      normalized.maxBundleBytes,
      budget,
      normalized.maxBundleBytes,
      "bundle.json",
      "MODEL_PACK_BROWSER_BUNDLE"
    );
  }
  return verifyModelPack(parseJson(bytes, "bundle.json", "MODEL_PACK_BROWSER_BUNDLE"));
}
