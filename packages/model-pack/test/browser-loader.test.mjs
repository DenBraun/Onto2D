import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel";
import {
  buildModelPack,
  modelPackFilePaths,
  ModelPackError
} from "../src/index.js";
import {
  MODEL_PACK_BROWSER_LIMITS,
  loadModelPackBundle,
  loadModelPackHttpDirectory
} from "../src/browser.js";

const BASE_URL = "https://models.example.test/releases/v1/";
const sourceHash = `sha256:${"e".repeat(64)}`;
const encoder = new TextEncoder();

function fixture(version = "1") {
  return buildModelPack({
    model: { id: "browser-fixture", name: "Browser Fixture", version },
    source: { id: "browser-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

function transportValues(pack, bundle = pack) {
  return new Map([
    ["manifest.json", pack.manifest],
    ...Object.entries(pack.files),
    ["bundle.json", bundle]
  ]);
}

function responseBytes(value) {
  if (value instanceof Uint8Array) return value;
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function makeResponse(value, options = {}) {
  const bytes = responseBytes(value);
  const chunks = options.chunks ?? [bytes];
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json; charset=utf-8");
  }
  if (options.contentLength !== null) {
    headers.set("content-length", options.contentLength ?? String(bytes.byteLength));
  }
  const body = options.body === null ? null : options.body ?? new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  const status = options.status ?? 200;
  return {
    ok: options.ok ?? (status >= 200 && status < 300),
    status,
    redirected: options.redirected ?? false,
    type: options.type ?? "basic",
    url: options.url ?? "",
    headers,
    body
  };
}

function makeFetch(values, override) {
  const calls = [];
  const implementation = async (input, init) => {
    const url = new URL(input);
    const relative = decodeURIComponent(url.pathname.slice(new URL(BASE_URL).pathname.length));
    calls.push({ url: url.href, relative, init });
    if (override) {
      const result = await override({ url, relative, init, value: values.get(relative) });
      if (result !== undefined) return result;
    }
    if (!values.has(relative)) return makeResponse({}, { status: 404, url: url.href });
    return makeResponse(values.get(relative), { url: url.href });
  };
  return { calls, implementation };
}

async function rejected(action, code) {
  await assert.rejects(
    action,
    (error) => error instanceof ModelPackError && error.code === code
  );
}

test("the browser HTTP loader streams and verifies the complete split Model Pack", async () => {
  const pack = fixture();
  const mock = makeFetch(transportValues(pack));
  const loaded = await loadModelPackHttpDirectory(BASE_URL.slice(0, -1), {
    fetch: mock.implementation
  });
  assert.equal(canonicalize(loaded), canonicalize(pack));
  assert.ok(Object.isFrozen(loaded));
  assert.deepEqual(mock.calls.map((call) => call.relative), [
    "manifest.json",
    ...Object.values(modelPackFilePaths())
  ]);
  for (const call of mock.calls) {
    assert.equal(call.init.method, "GET");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.credentials, "same-origin");
    assert.equal(call.init.redirect, "error");
    assert.deepEqual(call.init.headers, { Accept: "application/json" });
  }
});

test("a required HTTP bundle must reproduce the authoritative split files", async () => {
  const pack = fixture();
  let mock = makeFetch(transportValues(pack));
  const loaded = await loadModelPackHttpDirectory(BASE_URL, {
    fetch: mock.implementation,
    bundle: "required"
  });
  assert.equal(canonicalize(loaded), canonicalize(pack));
  assert.equal(mock.calls.at(-1).relative, "bundle.json");

  mock = makeFetch(transportValues(pack, fixture("2")));
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      bundle: "required"
    }),
    "MODEL_PACK_BROWSER_BUNDLE_MISMATCH"
  );
});

test("bundle bytes, offset views, ArrayBuffers, and Blobs use the same verifier", async () => {
  const pack = fixture();
  const bytes = encoder.encode(`${JSON.stringify(pack)}\n`);
  const padded = new Uint8Array(bytes.byteLength + 4);
  padded.set(bytes, 2);
  const sources = [
    bytes,
    padded.subarray(2, 2 + bytes.byteLength),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    new Blob([bytes], { type: "application/json" })
  ];
  for (const source of sources) {
    assert.equal(canonicalize(await loadModelPackBundle(source)), canonicalize(pack));
  }
});

test("browser URLs and options are strict and accessors are never invoked", async () => {
  const pack = fixture();
  const mock = makeFetch(transportValues(pack));
  for (const url of [
    "relative/model",
    "ftp://models.example.test/model/",
    "https://user:secret@models.example.test/model/",
    "https://models.example.test/model/?release=1",
    "https://models.example.test/model/#release"
  ]) {
    await rejected(
      () => loadModelPackHttpDirectory(url, { fetch: mock.implementation }),
      "MODEL_PACK_BROWSER_URL_INVALID"
    );
  }
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, { fetch: null }),
    "MODEL_PACK_BROWSER_FETCH_UNAVAILABLE"
  );
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      maxFileBytes: 2,
      maxTotalBytes: 1
    }),
    "MODEL_PACK_BROWSER_LIMIT_INVALID"
  );
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      unknown: true
    }),
    "MODEL_PACK_BROWSER_OPTIONS_INVALID"
  );
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      maxFileBytes: undefined
    }),
    "MODEL_PACK_BROWSER_LIMIT_INVALID"
  );
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      bundle: undefined
    }),
    "MODEL_PACK_BROWSER_OPTIONS_INVALID"
  );
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      signal: { aborted: false }
    }),
    "MODEL_PACK_BROWSER_OPTIONS_INVALID"
  );
  await rejected(
    () => loadModelPackBundle(new Uint8Array(), { maxBundleBytes: undefined }),
    "MODEL_PACK_BROWSER_LIMIT_INVALID"
  );

  let invoked = 0;
  const accessor = {};
  Object.defineProperty(accessor, "fetch", {
    enumerable: true,
    get() {
      invoked += 1;
      return mock.implementation;
    }
  });
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, accessor),
    "MODEL_PACK_BROWSER_OPTIONS_INVALID"
  );
  assert.equal(invoked, 0);
});

test("HTTP status, redirects, response identity, media type, and fetch failures fail closed", async () => {
  const pack = fixture();
  const values = transportValues(pack);
  const cases = [
    [() => makeResponse({}, { status: 404 }), "MODEL_PACK_BROWSER_HTTP_FAILED"],
    [({ url }) => makeResponse({}, { redirected: true, url: url.href }), "MODEL_PACK_BROWSER_REDIRECT_REJECTED"],
    [() => makeResponse({}, { url: "https://other.example.test/manifest.json" }), "MODEL_PACK_BROWSER_RESPONSE_URL_MISMATCH"],
    [() => makeResponse({}), "MODEL_PACK_BROWSER_RESPONSE_INVALID"],
    [({ url }) => makeResponse({}, { contentType: "text/html", url: url.href }), "MODEL_PACK_BROWSER_CONTENT_TYPE_INVALID"],
    [({ url }) => makeResponse({}, { body: null, url: url.href }), "MODEL_PACK_BROWSER_STREAM_INVALID"],
    [() => null, "MODEL_PACK_BROWSER_RESPONSE_INVALID"]
  ];
  for (const [override, code] of cases) {
    const mock = makeFetch(values, override);
    await rejected(
      () => loadModelPackHttpDirectory(BASE_URL, { fetch: mock.implementation }),
      code
    );
  }

  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      async fetch() {
        throw new DOMException("cancelled", "AbortError");
      }
    }),
    "MODEL_PACK_BROWSER_FETCH_FAILED"
  );
});

test("declared, streamed, total, and malformed HTTP bytes are bounded", async () => {
  const pack = fixture();
  const values = transportValues(pack);
  let mock = makeFetch(values, ({ url }) => makeResponse({}, {
    contentLength: "1000",
    url: url.href
  }));
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      maxFileBytes: 999,
      maxTotalBytes: 999
    }),
    "MODEL_PACK_BROWSER_FILE_LIMIT_EXCEEDED"
  );

  mock = makeFetch(values, ({ url }) => makeResponse({}, {
    contentLength: "1e3",
    url: url.href
  }));
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, { fetch: mock.implementation }),
    "MODEL_PACK_BROWSER_CONTENT_LENGTH_INVALID"
  );

  let cancelled = 0;
  mock = makeFetch(values, ({ url }) => makeResponse({}, {
    contentLength: null,
    url: url.href,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(16));
      },
      cancel() {
        cancelled += 1;
      }
    })
  }));
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      maxFileBytes: 8,
      maxTotalBytes: 8
    }),
    "MODEL_PACK_BROWSER_FILE_LIMIT_EXCEEDED"
  );
  assert.equal(cancelled, 1);

  const sizes = [...values.entries()]
    .filter(([relative]) => relative !== "bundle.json")
    .map(([, value]) => responseBytes(value).byteLength);
  const largest = Math.max(...sizes);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  mock = makeFetch(values);
  await rejected(
    () => loadModelPackHttpDirectory(BASE_URL, {
      fetch: mock.implementation,
      maxFileBytes: largest,
      maxTotalBytes: total - 1
    }),
    "MODEL_PACK_BROWSER_TOTAL_LIMIT_EXCEEDED"
  );

  for (const [bytes, code] of [
    [new Uint8Array([0xff]), "MODEL_PACK_BROWSER_UTF8_INVALID"],
    [encoder.encode("{"), "MODEL_PACK_BROWSER_JSON_INVALID"]
  ]) {
    mock = makeFetch(values, ({ url, relative }) => relative === "manifest.json"
      ? makeResponse(bytes, { url: url.href })
      : undefined);
    await rejected(
      () => loadModelPackHttpDirectory(BASE_URL, { fetch: mock.implementation }),
      code
    );
  }
});

test("HTTP directory loading accepts decoded bytes larger than compressed Content-Length", async () => {
  const pack = fixture();
  const mock = makeFetch(transportValues(pack), ({ url, value }) => makeResponse(value, {
    contentLength: "1",
    url: url.href
  }));
  const loaded = await loadModelPackHttpDirectory(BASE_URL, { fetch: mock.implementation });
  assert.equal(canonicalize(loaded), canonicalize(pack));
});

test("bundle sources enforce byte, encoding, JSON, and verification boundaries", async () => {
  const pack = fixture();
  const bytes = encoder.encode(JSON.stringify(pack));
  await rejected(
    () => loadModelPackBundle(bytes, { maxBundleBytes: bytes.byteLength - 1 }),
    "MODEL_PACK_BROWSER_BUNDLE_LIMIT_EXCEEDED"
  );
  await rejected(
    () => loadModelPackBundle("not bytes"),
    "MODEL_PACK_BROWSER_BUNDLE_SOURCE_INVALID"
  );
  await rejected(
    () => loadModelPackBundle(new Uint8Array([0xff])),
    "MODEL_PACK_BROWSER_BUNDLE_UTF8_INVALID"
  );
  await rejected(
    () => loadModelPackBundle(encoder.encode("{")),
    "MODEL_PACK_BROWSER_BUNDLE_JSON_INVALID"
  );
  await rejected(
    () => loadModelPackBundle(encoder.encode(JSON.stringify({ ...pack, files: {} }))),
    "MODEL_PACK_FILE_MISSING"
  );
});

test("the browser entrypoint contains no Node transport dependency", async () => {
  const entry = new URL("../src/browser.js", import.meta.url);
  const portableKernel = new URL("../../kernel/src/canonical-entry.js", import.meta.url);
  const pending = [entry];
  const visited = new Set();
  while (pending.length > 0) {
    const moduleUrl = pending.pop();
    if (visited.has(moduleUrl.href)) continue;
    visited.add(moduleUrl.href);
    const source = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(source, /(?:^|["'])node:/, moduleUrl.pathname);
    assert.doesNotMatch(source, /node-archive|\.\/node\.js/, moduleUrl.pathname);
    for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier === "@onto2d/kernel/canonical") {
        pending.push(portableKernel);
      } else if (specifier.startsWith(".")) {
        pending.push(new URL(specifier, moduleUrl));
      } else {
        assert.fail(`unexpected browser dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
  assert.ok([...visited].some((url) => url.endsWith("/packages/kernel/src/sha256.js")));
  assert.equal(MODEL_PACK_BROWSER_LIMITS.maxFileBytes, 16 * 1024 * 1024);
  assert.equal(MODEL_PACK_BROWSER_LIMITS.maxTotalBytes, 64 * 1024 * 1024);
});
