import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildModelPack,
  ModelPackError
} from "../src/index.js";
import {
  MODEL_PACK_REGISTRY_FORMAT,
  MODEL_PACK_REGISTRY_FORMAT_VERSION,
  MODEL_PACK_REGISTRY_LIMITS,
  MODEL_PACK_RESOLUTION_FORMAT,
  matchModelPackRegistryResolution,
  resolveModelPackRegistry,
  resolveModelPackRegistryHttp
} from "../src/registry.js";

const REGISTRY_URL = "https://models.example.test/catalogue/registry.json";
const sourceHash = `sha256:${"d".repeat(64)}`;
const encoder = new TextEncoder();

function fixture(version = "1") {
  return buildModelPack({
    model: { id: "registry-fixture", name: "Registry Fixture", version },
    source: { id: "registry-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

function entry(pack, packPath = `releases/${pack.manifest.model.version}/`) {
  return {
    modelId: pack.manifest.model.id,
    version: pack.manifest.model.version,
    rootHash: pack.manifest.rootHash,
    manifestHash: pack.manifest.manifestHash,
    packPath
  };
}

function registry(entries) {
  return {
    format: MODEL_PACK_REGISTRY_FORMAT,
    formatVersion: MODEL_PACK_REGISTRY_FORMAT_VERSION,
    entries
  };
}

function selection(pack) {
  return {
    modelId: pack.manifest.model.id,
    version: pack.manifest.model.version
  };
}

function responseBytes(value) {
  return value instanceof Uint8Array ? value : encoder.encode(`${JSON.stringify(value)}\n`);
}

function makeResponse(value, options = {}) {
  const bytes = responseBytes(value);
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json; charset=utf-8");
  }
  if (options.contentLength !== null) {
    headers.set("content-length", options.contentLength ?? String(bytes.byteLength));
  }
  return {
    ok: options.ok ?? (options.status ?? 200) === 200,
    status: options.status ?? 200,
    redirected: options.redirected ?? false,
    type: options.type ?? "basic",
    url: options.url ?? REGISTRY_URL,
    headers,
    body: options.body === null ? null : options.body ?? new ReadableStream({
      start(controller) {
        for (const chunk of options.chunks ?? [bytes]) controller.enqueue(chunk);
        controller.close();
      }
    })
  };
}

async function rejected(action, code) {
  await assert.rejects(
    action,
    (error) => error instanceof ModelPackError && error.code === code
  );
}

test("an explicit model and version resolve to one exact immutable release", () => {
  const first = fixture("1");
  const second = fixture("2");
  const document = registry([entry(second), entry(first)]);
  const unpinned = resolveModelPackRegistry(document, REGISTRY_URL, selection(first));
  const reordered = resolveModelPackRegistry(
    registry([...document.entries].reverse()),
    REGISTRY_URL,
    selection(first)
  );

  assert.equal(unpinned.format, MODEL_PACK_RESOLUTION_FORMAT);
  assert.equal(unpinned.registryTrust, "transport-only");
  assert.equal(unpinned.registryHash, reordered.registryHash);
  assert.equal(unpinned.rootHash, first.manifest.rootHash);
  assert.equal(unpinned.manifestHash, first.manifest.manifestHash);
  assert.equal(unpinned.baseUrl, "https://models.example.test/catalogue/releases/1/");
  assert.ok(Object.isFrozen(unpinned));

  const pinned = resolveModelPackRegistry(document, REGISTRY_URL, selection(first), {
    expectedRegistryHash: unpinned.registryHash
  });
  assert.equal(pinned.registryTrust, "hash-pinned");
  assert.equal(matchModelPackRegistryResolution(first, pinned), first);
});

test("the HTTP resolver fetches one bounded public registry without credentials", async () => {
  const pack = fixture();
  const document = registry([entry(pack)]);
  const expected = resolveModelPackRegistry(document, REGISTRY_URL, selection(pack));
  const calls = [];
  const resolved = await resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
    expectedRegistryHash: expected.registryHash,
    async fetch(input, init) {
      calls.push({ input, init });
      return makeResponse(document);
    }
  });

  assert.equal(resolved.registryTrust, "hash-pinned");
  assert.equal(resolved.registryHash, expected.registryHash);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, REGISTRY_URL);
  assert.deepEqual(calls[0].init, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" }
  });
});

test("registry shape, identity, uniqueness, path, and selection fail closed", async () => {
  const pack = fixture();
  const validEntry = entry(pack);
  const cases = [
    [registry([{ ...validEntry, extra: true }]), "MODEL_PACK_REGISTRY_ENTRY_INVALID"],
    [registry([validEntry, { ...validEntry }]), "MODEL_PACK_REGISTRY_ENTRY_DUPLICATE"],
    [registry([{ ...validEntry, packPath: "../release/" }]), "MODEL_PACK_REGISTRY_PATH_INVALID"],
    [registry([{ ...validEntry, packPath: "https://other.test/release/" }]), "MODEL_PACK_REGISTRY_PATH_INVALID"],
    [registry([{ ...validEntry, rootHash: "sha256:bad" }]), "MODEL_PACK_REGISTRY_ENTRY_INVALID"],
    [{ ...registry([validEntry]), formatVersion: "2" }, "MODEL_PACK_REGISTRY_FORMAT_UNSUPPORTED"]
  ];
  for (const [document, code] of cases) {
    await rejected(
      async () => resolveModelPackRegistry(document, REGISTRY_URL, selection(pack)),
      code
    );
  }
  await rejected(
    async () => resolveModelPackRegistry(registry([validEntry]), REGISTRY_URL, {
      modelId: pack.manifest.model.id,
      version: "missing"
    }),
    "MODEL_PACK_REGISTRY_RELEASE_NOT_FOUND"
  );
  await rejected(
    async () => resolveModelPackRegistry(registry([validEntry]), REGISTRY_URL, {
      ...selection(pack),
      alias: "latest"
    }),
    "MODEL_PACK_REGISTRY_SELECTION_INVALID"
  );
  await rejected(
    async () => resolveModelPackRegistry(registry([validEntry]), REGISTRY_URL, selection(pack), {
      expectedRegistryHash: `sha256:${"0".repeat(64)}`
    }),
    "MODEL_PACK_REGISTRY_HASH_MISMATCH"
  );
  await rejected(
    async () => resolveModelPackRegistry(registry([validEntry]), "https://user@models.test/registry.json", selection(pack)),
    "MODEL_PACK_REGISTRY_URL_INVALID"
  );
});

test("limits and accessors are rejected before user data can run", async () => {
  const pack = fixture();
  let invoked = 0;
  const options = {};
  Object.defineProperty(options, "maxEntries", {
    enumerable: true,
    get() {
      invoked += 1;
      return 1;
    }
  });
  await rejected(
    async () => resolveModelPackRegistry(registry([entry(pack)]), REGISTRY_URL, selection(pack), options),
    "MODEL_PACK_REGISTRY_OPTIONS_INVALID"
  );
  assert.equal(invoked, 0);

  const maliciousEntry = {};
  Object.defineProperty(maliciousEntry, "modelId", {
    enumerable: true,
    get() {
      invoked += 1;
      return pack.manifest.model.id;
    }
  });
  await rejected(
    async () => resolveModelPackRegistry(registry([maliciousEntry]), REGISTRY_URL, selection(pack)),
    "MODEL_PACK_REGISTRY_ENTRY_INVALID"
  );
  assert.equal(invoked, 0);

  await rejected(
    async () => resolveModelPackRegistry(registry([entry(pack)]), REGISTRY_URL, selection(pack), {
      maxEntries: 0
    }),
    "MODEL_PACK_REGISTRY_LIMIT_INVALID"
  );
  await rejected(
    () => resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
      fetch: null
    }),
    "MODEL_PACK_REGISTRY_FETCH_UNAVAILABLE"
  );
  assert.equal(MODEL_PACK_REGISTRY_LIMITS.maxEntries, 1024);
});

test("HTTP status, redirects, identity, media type, and malformed bodies fail closed", async () => {
  const pack = fixture();
  const document = registry([entry(pack)]);
  const cases = [
    [makeResponse(document, { status: 404 }), "MODEL_PACK_REGISTRY_HTTP_FAILED"],
    [makeResponse(document, { redirected: true }), "MODEL_PACK_REGISTRY_REDIRECT_REJECTED"],
    [makeResponse(document, { url: "https://other.test/registry.json" }), "MODEL_PACK_REGISTRY_RESPONSE_URL_MISMATCH"],
    [makeResponse(document, { contentType: "text/plain" }), "MODEL_PACK_REGISTRY_CONTENT_TYPE_INVALID"],
    [makeResponse(document, { body: null }), "MODEL_PACK_REGISTRY_STREAM_INVALID"],
    [makeResponse(document, { contentLength: "1e3" }), "MODEL_PACK_REGISTRY_CONTENT_LENGTH_INVALID"],
    [makeResponse(new Uint8Array([0xff])), "MODEL_PACK_REGISTRY_UTF8_INVALID"],
    [makeResponse(encoder.encode("{")), "MODEL_PACK_REGISTRY_JSON_INVALID"]
  ];
  for (const [response, code] of cases) {
    await rejected(
      () => resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
        async fetch() {
          return response;
        }
      }),
      code
    );
  }
  await rejected(
    () => resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
      async fetch() {
        throw new DOMException("cancelled", "AbortError");
      }
    }),
    "MODEL_PACK_REGISTRY_FETCH_FAILED"
  );
});

test("HTTP registry loading accepts decoded bytes larger than compressed Content-Length", async () => {
  const pack = fixture();
  const document = registry([entry(pack)]);
  const resolved = await resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
    async fetch() {
      return makeResponse(document, { contentLength: "1" });
    }
  });
  assert.equal(resolved.rootHash, pack.manifest.rootHash);
});

test("declared and streamed registry bytes are bounded and failed streams are cancelled", async () => {
  const pack = fixture();
  const document = registry([entry(pack)]);
  await rejected(
    () => resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
      maxRegistryBytes: 8,
      async fetch() {
        return makeResponse(document, { contentLength: "9" });
      }
    }),
    "MODEL_PACK_REGISTRY_BYTE_LIMIT_EXCEEDED"
  );

  let cancelled = 0;
  await rejected(
    () => resolveModelPackRegistryHttp(REGISTRY_URL, selection(pack), {
      maxRegistryBytes: 8,
      async fetch() {
        return makeResponse(document, {
          contentLength: null,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(9));
            },
            cancel() {
              cancelled += 1;
            }
          })
        });
      }
    }),
    "MODEL_PACK_REGISTRY_BYTE_LIMIT_EXCEEDED"
  );
  assert.equal(cancelled, 1);
});

test("a resolution binds model, version, and both hashes to an already verified pack", async () => {
  const first = fixture("1");
  const second = fixture("2");
  const resolution = resolveModelPackRegistry(
    registry([entry(first)]),
    REGISTRY_URL,
    selection(first)
  );
  await rejected(
    async () => matchModelPackRegistryResolution(second, resolution),
    "MODEL_PACK_REGISTRY_RESOLUTION_MISMATCH"
  );
  await rejected(
    async () => matchModelPackRegistryResolution({ manifest: {}, files: {} }, resolution),
    "MODEL_PACK_REGISTRY_PACK_INVALID"
  );
  await rejected(
    async () => matchModelPackRegistryResolution(first, {
      ...resolution,
      baseUrl: "https://other.test/release/"
    }),
    "MODEL_PACK_REGISTRY_RESOLUTION_INVALID"
  );
});

test("registry documents and derived resolutions conform to their public schemas", async () => {
  const pack = fixture();
  const document = registry([entry(pack)]);
  const resolution = resolveModelPackRegistry(document, REGISTRY_URL, selection(pack));
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const registrySchema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/model-pack-registry.schema.json", import.meta.url),
    "utf8"
  ));
  const resolutionSchema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/model-pack-resolution.schema.json", import.meta.url),
    "utf8"
  ));
  assert.equal(ajv.compile(registrySchema)(document), true);
  assert.equal(ajv.compile(resolutionSchema)(resolution), true);
});

test("the complete registry module graph contains no Node dependency", async () => {
  const entryUrl = new URL("../src/registry.js", import.meta.url);
  const portableKernel = new URL("../../kernel/src/canonical-entry.js", import.meta.url);
  const pending = [entryUrl];
  const visited = new Set();
  while (pending.length > 0) {
    const moduleUrl = pending.pop();
    if (visited.has(moduleUrl.href)) continue;
    visited.add(moduleUrl.href);
    const source = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(source, /(?:^|["'])node:/, moduleUrl.pathname);
    for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier === "@onto2d/kernel/canonical") {
        pending.push(portableKernel);
      } else if (specifier.startsWith(".")) {
        pending.push(new URL(specifier, moduleUrl));
      } else {
        assert.fail(`unexpected registry dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
});
