import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import {
  buildModelPack,
  ModelPackError
} from "../src/index.js";
import {
  MODEL_PACK_CACHE_LIMITS,
  createIndexedDbModelPackCacheStorage,
  createMemoryModelPackCacheStorage,
  createVerifiedModelPackCache,
  modelPackCacheKey
} from "../src/cache.js";

const sourceHash = `sha256:${"b".repeat(64)}`;
const encoder = new TextEncoder();

function fixture(version = "1") {
  return buildModelPack({
    model: { id: "cache-fixture", name: "Cache Fixture", version },
    source: { id: "cache-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

function identity(pack) {
  return {
    rootHash: pack.manifest.rootHash,
    manifestHash: pack.manifest.manifestHash
  };
}

async function rejected(action, code) {
  await assert.rejects(
    action,
    (error) => error instanceof ModelPackError && error.code === code
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

test("a miss is verified before storage and the exact identity becomes a verified hit", async () => {
  const pack = fixture();
  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage);
  let loads = 0;

  const first = await cache.load(identity(pack), async () => {
    loads += 1;
    return pack;
  });
  assert.equal(first.source, "loader");
  assert.equal(first.cacheState, "miss");
  assert.equal(canonicalize(first.pack), canonicalize(pack));
  assert.ok(Object.isFrozen(first.pack));

  const second = await cache.load(identity(pack), async () => {
    loads += 1;
    throw new Error("cache hit must not call loader");
  });
  assert.equal(second.source, "cache");
  assert.equal(second.cacheState, "hit");
  assert.equal(loads, 1);
  assert.deepEqual(await cache.inspect(), {
    entries: [{
      key: modelPackCacheKey(identity(pack)),
      byteLength: encoder.encode(canonicalize(pack)).byteLength,
      ordinal: 1
    }],
    entryCount: 1,
    totalBytes: encoder.encode(canonicalize(pack)).byteLength
  });
});

test("a conflicting expected root never invalidates a valid manifest-keyed entry", async () => {
  const pack = fixture();
  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage);
  await cache.put(identity(pack), pack);

  await rejected(
    () => cache.match({
      rootHash: `sha256:${"c".repeat(64)}`,
      manifestHash: pack.manifest.manifestHash
    }),
    "MODEL_PACK_CACHE_IDENTITY_MISMATCH"
  );
  assert.equal((await cache.match(identity(pack))).state, "hit");
});

test("corrupt and non-canonical records are removed before a loader can recover", async () => {
  const pack = fixture();
  const expected = identity(pack);
  const key = modelPackCacheKey(expected);
  const storage = createMemoryModelPackCacheStorage();
  await storage.commit({
    key,
    value: "{",
    byteLength: 1,
    maxEntries: MODEL_PACK_CACHE_LIMITS.maxEntries,
    maxRecordBytes: MODEL_PACK_CACHE_LIMITS.maxRecordBytes,
    maxTotalBytes: MODEL_PACK_CACHE_LIMITS.maxTotalBytes
  });
  const cache = createVerifiedModelPackCache(storage);
  const recovered = await cache.load(expected, async () => pack);
  assert.equal(recovered.source, "loader");
  assert.equal(recovered.cacheState, "invalid");
  assert.equal(recovered.invalidCode, "MODEL_PACK_BROWSER_BUNDLE_JSON_INVALID");
  assert.equal((await cache.match(expected)).state, "hit");

  const nonCanonicalValue = `${canonicalize(pack)}\n`;
  await storage.commit({
    key,
    value: nonCanonicalValue,
    byteLength: encoder.encode(nonCanonicalValue).byteLength,
    maxEntries: MODEL_PACK_CACHE_LIMITS.maxEntries,
    maxRecordBytes: MODEL_PACK_CACHE_LIMITS.maxRecordBytes,
    maxTotalBytes: MODEL_PACK_CACHE_LIMITS.maxTotalBytes
  });
  const nonCanonical = await cache.match(expected);
  assert.equal(nonCanonical.state, "invalid");
  assert.equal(nonCanonical.invalidCode, "MODEL_PACK_CACHE_ENTRY_NONCANONICAL");
  assert.equal((await storage.inspect()).entryCount, 0);
});

test("identity mismatch and verifier rejection cannot write a cache record", async () => {
  const first = fixture("1");
  const second = fixture("2");
  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage);

  await rejected(
    () => cache.put(identity(second), first),
    "MODEL_PACK_CACHE_IDENTITY_MISMATCH"
  );
  await rejected(
    () => cache.put(identity(first), { ...first, files: {} }),
    "MODEL_PACK_FILE_MISSING"
  );
  assert.equal((await cache.inspect()).entryCount, 0);
});

test("bounded storage evicts the oldest exact identity without consulting a clock", async () => {
  const packs = [fixture("1"), fixture("2"), fixture("3")];
  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage, { maxEntries: 2 });
  await cache.put(identity(packs[0]), packs[0]);
  await cache.put(identity(packs[1]), packs[1]);
  const third = await cache.put(identity(packs[2]), packs[2]);

  assert.deepEqual(third.evictedKeys, [modelPackCacheKey(identity(packs[0]))]);
  assert.equal((await cache.match(identity(packs[0]))).state, "miss");
  assert.equal((await cache.match(identity(packs[1]))).state, "hit");
  assert.equal((await cache.match(identity(packs[2]))).state, "hit");
  const snapshot = await cache.inspect();
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.ordinal),
    [2, 3]
  );
});

test("byte limits reject oversized records and evict by deterministic insertion order", async () => {
  const first = fixture("bytes-1");
  const second = fixture("bytes-2");
  const firstBytes = encoder.encode(canonicalize(first)).byteLength;
  const secondBytes = encoder.encode(canonicalize(second)).byteLength;
  const oneRecordLimit = Math.max(firstBytes, secondBytes);

  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage, {
    maxEntries: 2,
    maxRecordBytes: oneRecordLimit,
    maxTotalBytes: oneRecordLimit
  });
  await cache.put(identity(first), first);
  const inserted = await cache.put(identity(second), second);
  assert.deepEqual(inserted.evictedKeys, [modelPackCacheKey(identity(first))]);
  assert.equal((await cache.match(identity(first))).state, "miss");
  assert.equal((await cache.match(identity(second))).state, "hit");

  const tooSmall = createVerifiedModelPackCache(createMemoryModelPackCacheStorage(), {
    maxRecordBytes: firstBytes - 1,
    maxTotalBytes: firstBytes - 1
  });
  await rejected(
    () => tooSmall.put(identity(first), first),
    "MODEL_PACK_CACHE_RECORD_LIMIT_EXCEEDED"
  );
  assert.equal((await tooSmall.inspect()).entryCount, 0);
});

test("concurrent loads for one exact identity share one loader and close waits for it", async () => {
  const pack = fixture();
  const gate = deferred();
  const storage = createMemoryModelPackCacheStorage();
  const cache = createVerifiedModelPackCache(storage, { ownsStorage: true });
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await gate.promise;
    return pack;
  };
  const first = cache.load(identity(pack), loader);
  const second = cache.load(identity(pack), loader);
  assert.equal(first, second);
  const closing = cache.close();
  let closed = false;
  void closing.then(() => {
    closed = true;
  });
  await Promise.resolve();
  assert.equal(closed, false);
  gate.resolve();
  await first;
  await closing;
  assert.equal(loads, 1);
  await rejected(() => cache.match(identity(pack)), "MODEL_PACK_CACHE_CLOSED");
  await rejected(() => storage.inspect(), "MODEL_PACK_CACHE_STORAGE_CLOSED");
});

test("storage boundaries, cache options, identities, and loader errors fail closed", async () => {
  const pack = fixture();
  const storage = createMemoryModelPackCacheStorage();
  let invoked = 0;
  const options = {};
  Object.defineProperty(options, "maxEntries", {
    enumerable: true,
    get() {
      invoked += 1;
      return 1;
    }
  });
  assert.throws(
    () => createVerifiedModelPackCache(storage, options),
    (error) => error.code === "MODEL_PACK_CACHE_OPTIONS_INVALID"
  );
  assert.equal(invoked, 0);

  const cache = createVerifiedModelPackCache(storage);
  await rejected(
    () => cache.load(identity(pack), null),
    "MODEL_PACK_CACHE_LOADER_INVALID"
  );
  await rejected(
    () => cache.load(identity(pack), async () => {
      throw new TypeError("private loader detail");
    }),
    "MODEL_PACK_CACHE_LOADER_FAILED"
  );
  await rejected(
    () => cache.match({ ...identity(pack), extra: true }),
    "MODEL_PACK_CACHE_IDENTITY_INVALID"
  );
  await rejected(
    () => storage.commit({
      key: modelPackCacheKey(identity(pack)),
      value: "{}",
      byteLength: 1,
      maxEntries: 1,
      maxRecordBytes: 10,
      maxTotalBytes: 10
    }),
    "MODEL_PACK_CACHE_STORAGE_INPUT_INVALID"
  );
  assert.throws(
    () => createIndexedDbModelPackCacheStorage({ indexedDB: null }),
    (error) => error.code === "MODEL_PACK_CACHE_INDEXEDDB_UNAVAILABLE"
  );
});

test("malformed custom storage results never become cache hits", async () => {
  const pack = fixture();
  const badStorage = {
    async read() {
      return { state: "entry", value: canonicalize(pack), extra: true };
    },
    async commit() {
      return { evictedKeys: [], entryCount: 1, totalBytes: 1 };
    },
    async remove() {
      return true;
    },
    async clear() {
      return 0;
    },
    async inspect() {
      return { entries: [], entryCount: 0, totalBytes: 0 };
    },
    close() {}
  };
  const cache = createVerifiedModelPackCache(badStorage);
  await rejected(
    () => cache.match(identity(pack)),
    "MODEL_PACK_CACHE_STORAGE_RESULT_INVALID"
  );
});

test("late IndexedDB open success is closed after blocking or cache closure", async () => {
  const key = modelPackCacheKey(identity(fixture()));

  for (const scenario of ["blocked", "closed"]) {
    let request;
    let closeCalls = 0;
    const indexedDB = {
      open() {
        request = {};
        queueMicrotask(() => {
          if (scenario === "blocked") request.onblocked();
          request.result = {
            close() {
              closeCalls += 1;
            }
          };
          request.onsuccess();
        });
        return request;
      }
    };
    const storage = createIndexedDbModelPackCacheStorage({
      indexedDB,
      databaseName: `onto2d-cache-${scenario}`
    });
    const pending = storage.read(key);
    if (scenario === "closed") storage.close();
    await rejected(
      () => pending,
      scenario === "blocked"
        ? "MODEL_PACK_CACHE_STORAGE_BLOCKED"
        : "MODEL_PACK_CACHE_STORAGE_CLOSED"
    );
    assert.equal(closeCalls, 1);
    storage.close();
  }
});

test("the complete cache module graph contains no Node dependency", async () => {
  const entry = new URL("../src/cache.js", import.meta.url);
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
        assert.fail(`unexpected cache dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
  assert.ok([...visited].some((url) => url.endsWith("/packages/kernel/src/sha256.js")));
});
