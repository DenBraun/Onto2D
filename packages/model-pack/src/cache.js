import {
  canonicalize,
  isContentHash
} from "@onto2d/kernel/canonical";
import {
  MODEL_PACK_FORMAT,
  MODEL_PACK_FORMAT_VERSION,
  ModelPackError
} from "./index.js";
import {
  MODEL_PACK_BROWSER_LIMITS,
  loadModelPackBundle
} from "./browser.js";
import { inspectTransportOptions } from "./transport-layout.js";

export const MODEL_PACK_CACHE_FORMAT = "onto2d-model-pack-cache";
export const MODEL_PACK_CACHE_FORMAT_VERSION = "1";
export const MODEL_PACK_CACHE_LIMITS = Object.freeze({
  maxEntries: 8,
  maxRecordBytes: MODEL_PACK_BROWSER_LIMITS.maxBundleBytes,
  maxTotalBytes: 256 * 1024 * 1024,
  maxDatabaseNameLength: 128
});

const CACHE_OPTION_FIELDS = new Set([
  "verifyBundle",
  "maxEntries",
  "maxRecordBytes",
  "maxTotalBytes",
  "ownsStorage"
]);
const IDENTITY_FIELDS = new Set(["rootHash", "manifestHash"]);
const STORAGE_COMMIT_FIELDS = new Set([
  "key",
  "value",
  "byteLength",
  "maxEntries",
  "maxRecordBytes",
  "maxTotalBytes"
]);
const STORAGE_READ_STATES = new Set(["miss", "entry", "invalid"]);
const INDEXED_DB_OPTION_FIELDS = new Set(["indexedDB", "databaseName"]);
const STORAGE_RECORD_FIELDS = new Set(["key", "value", "byteLength", "ordinal"]);
const STORAGE_METHODS = Object.freeze([
  "read",
  "commit",
  "remove",
  "clear",
  "inspect",
  "close"
]);
const CACHE_KEY_PATTERN = /^onto2d:model-pack-cache:v1:sha256:[0-9a-f]{64}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DATABASE_VERSION = 1;
const RECORD_STORE = "records";
const CACHE_KEY_PREFIX = "onto2d:model-pack-cache:v1:";
const MAX_STORAGE_SCAN_ENTRIES = 1024;
const encoder = new TextEncoder();

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
  const entries = inspectTransportOptions(value, "MODEL_PACK_CACHE_OPTIONS_INVALID", subject);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_CACHE_OPTIONS_INVALID", `${subject} contains unknown fields.`, { unknown });
  }
  return entries;
}

function optionValue(entries, field, fallback) {
  return entries.has(field) ? entries.get(field) : fallback;
}

function requireInteger(value, field, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail("MODEL_PACK_CACHE_LIMIT_INVALID", `${field} is outside the cache limit.`, {
      field,
      maximum
    });
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    fail("MODEL_PACK_CACHE_OPTIONS_INVALID", `${field} must be boolean.`, { field });
  }
  return value;
}

function requireCacheKey(value, field = "key") {
  if (typeof value !== "string" || !CACHE_KEY_PATTERN.test(value)) {
    fail("MODEL_PACK_CACHE_KEY_INVALID", `${field} is not a Model Pack cache key.`, { field });
  }
  return value;
}

function normalizeIdentity(value) {
  const entries = exactEntries(
    value,
    IDENTITY_FIELDS,
    "MODEL_PACK_CACHE_IDENTITY_INVALID",
    "Model Pack cache identity"
  );
  const identity = {
    rootHash: entries.get("rootHash"),
    manifestHash: entries.get("manifestHash")
  };
  if (!isContentHash(identity.rootHash) || !isContentHash(identity.manifestHash)) {
    fail(
      "MODEL_PACK_CACHE_IDENTITY_INVALID",
      "Model Pack cache identity requires rootHash and manifestHash content hashes."
    );
  }
  return Object.freeze(identity);
}

export function modelPackCacheKey(identity) {
  const normalized = normalizeIdentity(identity);
  return `${CACHE_KEY_PREFIX}${normalized.manifestHash}`;
}

function identityFromVerifiedPack(pack) {
  const packEntries = inspectTransportOptions(
    pack,
    "MODEL_PACK_CACHE_VERIFIER_RESULT_INVALID",
    "Verified Model Pack"
  );
  const manifestEntries = inspectTransportOptions(
    packEntries.get("manifest"),
    "MODEL_PACK_CACHE_VERIFIER_RESULT_INVALID",
    "Verified Model Pack manifest"
  );
  if (
    manifestEntries.get("format") !== MODEL_PACK_FORMAT
    || manifestEntries.get("formatVersion") !== MODEL_PACK_FORMAT_VERSION
  ) {
    fail("MODEL_PACK_CACHE_VERIFIER_RESULT_INVALID", "Verifier returned an unsupported Model Pack.");
  }
  return normalizeIdentity({
    rootHash: manifestEntries.get("rootHash"),
    manifestHash: manifestEntries.get("manifestHash")
  });
}

function assertExpectedIdentity(actual, expected) {
  if (
    actual.rootHash !== expected.rootHash
    || actual.manifestHash !== expected.manifestHash
  ) {
    fail("MODEL_PACK_CACHE_IDENTITY_MISMATCH", "Verified Model Pack identity differs from the expected cache identity.", {
      expectedRootHash: expected.rootHash,
      expectedManifestHash: expected.manifestHash,
      actualRootHash: actual.rootHash,
      actualManifestHash: actual.manifestHash
    });
  }
}

function normalizeCacheOptions(value) {
  const entries = optionEntries(value, CACHE_OPTION_FIELDS, "Model Pack cache options");
  const verifyBundle = optionValue(entries, "verifyBundle", loadModelPackBundle);
  if (typeof verifyBundle !== "function") {
    fail("MODEL_PACK_CACHE_OPTIONS_INVALID", "verifyBundle must be a function.", {
      field: "verifyBundle"
    });
  }
  const maxRecordBytes = requireInteger(
    optionValue(entries, "maxRecordBytes", MODEL_PACK_CACHE_LIMITS.maxRecordBytes),
    "maxRecordBytes",
    MODEL_PACK_CACHE_LIMITS.maxRecordBytes
  );
  const maxTotalBytes = requireInteger(
    optionValue(entries, "maxTotalBytes", MODEL_PACK_CACHE_LIMITS.maxTotalBytes),
    "maxTotalBytes",
    MODEL_PACK_CACHE_LIMITS.maxTotalBytes
  );
  if (maxRecordBytes > maxTotalBytes) {
    fail("MODEL_PACK_CACHE_LIMIT_INVALID", "maxRecordBytes cannot exceed maxTotalBytes.");
  }
  return Object.freeze({
    verifyBundle,
    maxEntries: requireInteger(
      optionValue(entries, "maxEntries", MODEL_PACK_CACHE_LIMITS.maxEntries),
      "maxEntries",
      MODEL_PACK_CACHE_LIMITS.maxEntries
    ),
    maxRecordBytes,
    maxTotalBytes,
    ownsStorage: requireBoolean(optionValue(entries, "ownsStorage", false), "ownsStorage")
  });
}

function validateStorage(storage) {
  try {
    if (storage === null || (typeof storage !== "object" && typeof storage !== "function")) {
      throw new TypeError();
    }
    for (const method of STORAGE_METHODS) {
      if (typeof storage[method] !== "function") throw new TypeError();
    }
  } catch {
    fail(
      "MODEL_PACK_CACHE_STORAGE_INVALID",
      "storage must implement the Model Pack cache storage surface."
    );
  }
  return storage;
}

function normalizeStorageCommit(value) {
  const entries = exactEntries(
    value,
    STORAGE_COMMIT_FIELDS,
    "MODEL_PACK_CACHE_STORAGE_INPUT_INVALID",
    "Cache storage commit"
  );
  const key = requireCacheKey(entries.get("key"));
  const serialized = entries.get("value");
  if (typeof serialized !== "string" || serialized.length === 0) {
    fail("MODEL_PACK_CACHE_STORAGE_INPUT_INVALID", "Cache storage value must be a non-empty string.");
  }
  const maxRecordBytes = requireInteger(
    entries.get("maxRecordBytes"),
    "maxRecordBytes",
    MODEL_PACK_CACHE_LIMITS.maxRecordBytes
  );
  const maxTotalBytes = requireInteger(
    entries.get("maxTotalBytes"),
    "maxTotalBytes",
    MODEL_PACK_CACHE_LIMITS.maxTotalBytes
  );
  const byteLength = requireInteger(entries.get("byteLength"), "byteLength", maxRecordBytes);
  if (serialized.length > byteLength || encoder.encode(serialized).byteLength !== byteLength) {
    fail("MODEL_PACK_CACHE_STORAGE_INPUT_INVALID", "Cache storage byteLength differs from its value.");
  }
  if (maxRecordBytes > maxTotalBytes) {
    fail("MODEL_PACK_CACHE_LIMIT_INVALID", "maxRecordBytes cannot exceed maxTotalBytes.");
  }
  return Object.freeze({
    key,
    value: serialized,
    byteLength,
    maxEntries: requireInteger(
      entries.get("maxEntries"),
      "maxEntries",
      MODEL_PACK_CACHE_LIMITS.maxEntries
    ),
    maxRecordBytes,
    maxTotalBytes
  });
}

function normalizeStoredRecord(value) {
  try {
    const entries = exactEntries(
      value,
      STORAGE_RECORD_FIELDS,
      "MODEL_PACK_CACHE_STORAGE_RECORD_INVALID",
      "Cache storage record"
    );
    const key = requireCacheKey(entries.get("key"));
    const serialized = entries.get("value");
    const byteLength = entries.get("byteLength");
    const ordinal = entries.get("ordinal");
    if (
      typeof serialized !== "string"
      || serialized.length === 0
      || serialized.length > MODEL_PACK_CACHE_LIMITS.maxTotalBytes
      || !Number.isSafeInteger(byteLength)
      || byteLength < 1
      || byteLength > MODEL_PACK_CACHE_LIMITS.maxTotalBytes
      || serialized.length > byteLength
      || encoder.encode(serialized).byteLength !== byteLength
      || !Number.isSafeInteger(ordinal)
      || ordinal < 1
    ) {
      return null;
    }
    return { key, value: serialized, byteLength, ordinal };
  } catch {
    return null;
  }
}

function compareStorageRecords(left, right) {
  if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal;
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

function storageSnapshot(records) {
  const entries = [...records]
    .sort(compareStorageRecords)
    .map(({ key, byteLength, ordinal }) => Object.freeze({ key, byteLength, ordinal }));
  return Object.freeze({
    entries: Object.freeze(entries),
    entryCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.byteLength, 0)
  });
}

function commitRecords(currentRecords, commit) {
  const byKey = new Map(currentRecords.map((record) => [record.key, { ...record }]));
  const existing = byKey.get(commit.key);
  let nextOrdinal = currentRecords.reduce(
    (maximum, record) => Math.max(maximum, record.ordinal),
    0
  ) + 1;
  if (!Number.isSafeInteger(nextOrdinal)) {
    const compacted = [...byKey.values()].sort(compareStorageRecords);
    compacted.forEach((record, index) => {
      record.ordinal = index + 1;
    });
    byKey.clear();
    for (const record of compacted) byKey.set(record.key, record);
    nextOrdinal = compacted.length + 1;
  }
  byKey.set(commit.key, {
    key: commit.key,
    value: commit.value,
    byteLength: commit.byteLength,
    ordinal: existing?.ordinal ?? nextOrdinal
  });

  const evictedKeys = [];
  let ordered = [...byKey.values()].sort(compareStorageRecords);
  let totalBytes = ordered.reduce((total, record) => total + record.byteLength, 0);
  while (ordered.length > commit.maxEntries || totalBytes > commit.maxTotalBytes) {
    const victim = ordered.find((record) => record.key !== commit.key);
    if (!victim) {
      fail("MODEL_PACK_CACHE_LIMIT_EXCEEDED", "The cache record cannot fit within storage limits.");
    }
    byKey.delete(victim.key);
    evictedKeys.push(victim.key);
    totalBytes -= victim.byteLength;
    ordered = ordered.filter((record) => record.key !== victim.key);
  }
  return Object.freeze({
    records: Object.freeze(ordered),
    evictedKeys: Object.freeze(evictedKeys),
    snapshot: storageSnapshot(ordered)
  });
}

function storageCommitResult(committed) {
  return Object.freeze({
    evictedKeys: committed.evictedKeys,
    entryCount: committed.snapshot.entryCount,
    totalBytes: committed.snapshot.totalBytes
  });
}

export function createMemoryModelPackCacheStorage() {
  const records = new Map();
  let closed = false;

  function requireOpen() {
    if (closed) fail("MODEL_PACK_CACHE_STORAGE_CLOSED", "The cache storage is closed.");
  }

  async function read(keyInput) {
    requireOpen();
    const key = requireCacheKey(keyInput);
    const record = records.get(key);
    return record === undefined
      ? Object.freeze({ state: "miss" })
      : Object.freeze({ state: "entry", value: record.value });
  }

  async function commit(value) {
    requireOpen();
    const normalized = normalizeStorageCommit(value);
    const committed = commitRecords([...records.values()], normalized);
    records.clear();
    for (const record of committed.records) records.set(record.key, { ...record });
    return storageCommitResult(committed);
  }

  async function remove(keyInput) {
    requireOpen();
    return records.delete(requireCacheKey(keyInput));
  }

  async function clear() {
    requireOpen();
    const removed = records.size;
    records.clear();
    return removed;
  }

  async function inspect() {
    requireOpen();
    return storageSnapshot(records.values());
  }

  function close() {
    closed = true;
  }

  return Object.freeze({ read, commit, remove, clear, inspect, close });
}

function normalizeIndexedDbOptions(value) {
  const entries = optionEntries(value, INDEXED_DB_OPTION_FIELDS, "IndexedDB cache options");
  const factory = entries.has("indexedDB") ? entries.get("indexedDB") : globalThis.indexedDB;
  if (factory === null || typeof factory !== "object" || typeof factory.open !== "function") {
    fail("MODEL_PACK_CACHE_INDEXEDDB_UNAVAILABLE", "IndexedDB is unavailable.");
  }
  const databaseName = optionValue(entries, "databaseName", "onto2d-model-pack-cache-v1");
  if (
    typeof databaseName !== "string"
    || databaseName.length < 1
    || databaseName.length > MODEL_PACK_CACHE_LIMITS.maxDatabaseNameLength
    || !DATABASE_NAME_PATTERN.test(databaseName)
  ) {
    fail("MODEL_PACK_CACHE_OPTIONS_INVALID", "databaseName is not a bounded cache identifier.", {
      field: "databaseName"
    });
  }
  return Object.freeze({ factory, databaseName });
}

function requestResult(request, subject) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ModelPackError(
      "MODEL_PACK_CACHE_STORAGE_FAILED",
      `${subject} failed.`,
      { cause: request.error?.name ?? "Error" }
    ));
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new ModelPackError(
      "MODEL_PACK_CACHE_STORAGE_FAILED",
      "The IndexedDB cache transaction was aborted.",
      { cause: transaction.error?.name ?? "AbortError" }
    ));
    transaction.onerror = () => {
      // The abort event owns the stable transaction rejection.
    };
  });
}

async function indexedDbInventory(store) {
  const recordsRequest = store.getAll();
  const keysRequest = store.getAllKeys();
  const [records, keys] = await Promise.all([
    requestResult(recordsRequest, "IndexedDB cache inventory"),
    requestResult(keysRequest, "IndexedDB cache key inventory")
  ]);
  if (
    !Array.isArray(records)
    || !Array.isArray(keys)
    || records.length !== keys.length
    || records.length > MAX_STORAGE_SCAN_ENTRIES
  ) {
    fail("MODEL_PACK_CACHE_STORAGE_CORRUPT", "IndexedDB cache inventory exceeds its scan bound.");
  }
  return records.map((value, index) => Object.freeze({
    storageKey: keys[index],
    value
  }));
}

export function createIndexedDbModelPackCacheStorage(options = {}) {
  const normalized = normalizeIndexedDbOptions(options);
  let closed = false;
  let databasePromise = null;

  function requireOpen() {
    if (closed) fail("MODEL_PACK_CACHE_STORAGE_CLOSED", "The cache storage is closed.");
  }

  function openDatabase() {
    requireOpen();
    if (databasePromise !== null) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      let request;
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      try {
        request = normalized.factory.open(normalized.databaseName, DATABASE_VERSION);
      } catch (error) {
        rejectOnce(new ModelPackError(
          "MODEL_PACK_CACHE_STORAGE_FAILED",
          "IndexedDB cache could not be opened.",
          { cause: error instanceof Error ? error.name : typeof error }
        ));
        return;
      }
      request.onupgradeneeded = () => {
        try {
          const database = request.result;
          if (!database.objectStoreNames.contains(RECORD_STORE)) {
            database.createObjectStore(RECORD_STORE, { keyPath: "key" });
          }
        } catch (error) {
          try {
            request.transaction?.abort();
          } catch {
            // The stable open failure below is sufficient.
          }
          rejectOnce(new ModelPackError(
            "MODEL_PACK_CACHE_STORAGE_FAILED",
            "IndexedDB cache schema creation failed.",
            { cause: error instanceof Error ? error.name : typeof error }
          ));
        }
      };
      request.onblocked = () => rejectOnce(new ModelPackError(
        "MODEL_PACK_CACHE_STORAGE_BLOCKED",
        "IndexedDB cache opening is blocked by another connection."
      ));
      request.onerror = () => rejectOnce(new ModelPackError(
        "MODEL_PACK_CACHE_STORAGE_FAILED",
        "IndexedDB cache could not be opened.",
        { cause: request.error?.name ?? "Error" }
      ));
      request.onsuccess = () => {
        const database = request.result;
        if (settled || closed) {
          database.close();
          if (closed) {
            rejectOnce(new ModelPackError(
              "MODEL_PACK_CACHE_STORAGE_CLOSED",
              "The cache storage is closed."
            ));
          }
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (!closed) databasePromise = null;
        };
        settled = true;
        resolve(database);
      };
    });
    databasePromise.catch(() => {
      if (!closed) databasePromise = null;
    });
    return databasePromise;
  }

  async function withStore(mode, action) {
    requireOpen();
    const database = await openDatabase();
    let transaction;
    try {
      transaction = database.transaction(RECORD_STORE, mode);
    } catch (error) {
      fail("MODEL_PACK_CACHE_STORAGE_FAILED", "IndexedDB cache transaction could not start.", {
        cause: error instanceof Error ? error.name : typeof error
      });
    }
    const completed = transactionCompletion(transaction);
    try {
      const result = await action(transaction.objectStore(RECORD_STORE));
      await completed;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be complete or aborted.
      }
      await completed.catch(() => {});
      throw error;
    }
  }

  async function read(keyInput) {
    const key = requireCacheKey(keyInput);
    return withStore("readwrite", async (store) => {
      const raw = await requestResult(store.get(key), "IndexedDB cache read");
      if (raw === undefined) return Object.freeze({ state: "miss" });
      const record = normalizeStoredRecord(raw);
      if (record === null || record.key !== key) {
        await requestResult(store.delete(key), "IndexedDB invalid cache removal");
        return Object.freeze({ state: "invalid" });
      }
      return Object.freeze({ state: "entry", value: record.value });
    });
  }

  async function commit(value) {
    const commitInput = normalizeStorageCommit(value);
    return withStore("readwrite", async (store) => {
      const inventory = await indexedDbInventory(store);
      const validRecords = [];
      for (const item of inventory) {
        const record = normalizeStoredRecord(item.value);
        if (record === null || record.key !== item.storageKey) {
          await requestResult(store.delete(item.storageKey), "IndexedDB invalid cache cleanup");
        } else {
          validRecords.push(record);
        }
      }
      const committed = commitRecords(validRecords, commitInput);
      const retainedKeys = new Set(committed.records.map((record) => record.key));
      for (const record of validRecords) {
        if (!retainedKeys.has(record.key)) {
          await requestResult(store.delete(record.key), "IndexedDB cache eviction");
        }
      }
      const inserted = committed.records.find((record) => record.key === commitInput.key);
      await requestResult(store.put(inserted), "IndexedDB cache write");
      return storageCommitResult(committed);
    });
  }

  async function remove(keyInput) {
    const key = requireCacheKey(keyInput);
    return withStore("readwrite", async (store) => {
      const existing = await requestResult(store.getKey(key), "IndexedDB cache key read");
      if (existing === undefined) return false;
      await requestResult(store.delete(key), "IndexedDB cache removal");
      return true;
    });
  }

  async function clear() {
    return withStore("readwrite", async (store) => {
      const count = await requestResult(store.count(), "IndexedDB cache count");
      await requestResult(store.clear(), "IndexedDB cache clear");
      return count;
    });
  }

  async function inspect() {
    return withStore("readwrite", async (store) => {
      const inventory = await indexedDbInventory(store);
      const validRecords = [];
      for (const item of inventory) {
        const record = normalizeStoredRecord(item.value);
        if (record === null || record.key !== item.storageKey) {
          await requestResult(store.delete(item.storageKey), "IndexedDB invalid cache cleanup");
        } else {
          validRecords.push(record);
        }
      }
      return storageSnapshot(validRecords);
    });
  }

  function close() {
    if (closed) return;
    closed = true;
    databasePromise?.then((database) => database.close()).catch(() => {});
  }

  return Object.freeze({ read, commit, remove, clear, inspect, close });
}

function normalizeStorageRead(value) {
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_CACHE_STORAGE_RESULT_INVALID",
    "Cache storage read result"
  );
  const state = entries.get("state");
  if (!STORAGE_READ_STATES.has(state)) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage returned an invalid read state.");
  }
  const expectedFields = state === "entry" ? new Set(["state", "value"]) : new Set(["state"]);
  const unknown = [...entries.keys()].filter((field) => !expectedFields.has(field)).sort();
  const missing = [...expectedFields].filter((field) => !entries.has(field)).sort();
  if (unknown.length > 0 || missing.length > 0) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage read result has invalid fields.", {
      missing,
      unknown
    });
  }
  if (state === "entry" && typeof entries.get("value") !== "string") {
    return Object.freeze({ state: "invalid" });
  }
  return Object.freeze({
    state,
    ...(state === "entry" ? { value: entries.get("value") } : {})
  });
}

function normalizeStorageCommitResult(value) {
  const entries = exactEntries(
    value,
    new Set(["evictedKeys", "entryCount", "totalBytes"]),
    "MODEL_PACK_CACHE_STORAGE_RESULT_INVALID",
    "Cache storage commit result"
  );
  const evictedKeys = entries.get("evictedKeys");
  if (!Array.isArray(evictedKeys)) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "evictedKeys must be an array.");
  }
  const normalizedKeys = evictedKeys.map((key) => requireCacheKey(key, "evictedKeys"));
  if (new Set(normalizedKeys).size !== normalizedKeys.length) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "evictedKeys must be unique.");
  }
  return Object.freeze({
    evictedKeys: Object.freeze(normalizedKeys),
    entryCount: requireInteger(
      entries.get("entryCount"),
      "entryCount",
      MODEL_PACK_CACHE_LIMITS.maxEntries
    ),
    totalBytes: requireInteger(
      entries.get("totalBytes"),
      "totalBytes",
      MODEL_PACK_CACHE_LIMITS.maxTotalBytes
    )
  });
}

function normalizeStorageSnapshot(value) {
  const entries = exactEntries(
    value,
    new Set(["entries", "entryCount", "totalBytes"]),
    "MODEL_PACK_CACHE_STORAGE_RESULT_INVALID",
    "Cache storage snapshot"
  );
  const records = entries.get("entries");
  if (!Array.isArray(records) || records.length > MODEL_PACK_CACHE_LIMITS.maxEntries) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage snapshot entries are invalid.");
  }
  const normalizedRecords = records.map((record) => {
    const recordEntries = exactEntries(
      record,
      new Set(["key", "byteLength", "ordinal"]),
      "MODEL_PACK_CACHE_STORAGE_RESULT_INVALID",
      "Cache storage snapshot entry"
    );
    return Object.freeze({
      key: requireCacheKey(recordEntries.get("key")),
      byteLength: requireInteger(
        recordEntries.get("byteLength"),
        "byteLength",
        MODEL_PACK_CACHE_LIMITS.maxTotalBytes
      ),
      ordinal: requireInteger(recordEntries.get("ordinal"), "ordinal", Number.MAX_SAFE_INTEGER)
    });
  });
  const entryCount = entries.get("entryCount");
  const totalBytes = entries.get("totalBytes");
  if (
    entryCount !== normalizedRecords.length
    || totalBytes !== normalizedRecords.reduce((total, record) => total + record.byteLength, 0)
    || new Set(normalizedRecords.map((record) => record.key)).size !== normalizedRecords.length
  ) {
    fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage snapshot totals are invalid.");
  }
  return Object.freeze({
    entries: Object.freeze(normalizedRecords),
    entryCount,
    totalBytes
  });
}

function safeInvalidCode(error) {
  return error instanceof Error
    && typeof error.code === "string"
    && error.code.length <= 128
    && ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : "MODEL_PACK_CACHE_ENTRY_INVALID";
}

export function createVerifiedModelPackCache(storageInput, options = {}) {
  const storage = validateStorage(storageInput);
  const normalized = normalizeCacheOptions(options);
  const inflight = new Map();
  let closed = false;
  let closePromise = null;

  function requireOpen() {
    if (closed) fail("MODEL_PACK_CACHE_CLOSED", "The Model Pack cache is closed.");
  }

  async function storageCall(method, ...args) {
    try {
      return await storage[method](...args);
    } catch (error) {
      if (error instanceof ModelPackError && error.code.startsWith("MODEL_PACK_CACHE_")) {
        throw error;
      }
      fail("MODEL_PACK_CACHE_STORAGE_FAILED", `Cache storage ${method} failed.`, {
        operation: method,
        cause: error instanceof Error ? error.name : typeof error
      });
    }
  }

  function serializeBounded(value, code, subject) {
    let serialized;
    try {
      serialized = canonicalize(value);
    } catch (error) {
      fail(code, `${subject} is not canonicalizable Model Pack data.`, {
        cause: error instanceof Error ? error.name : typeof error
      });
    }
    if (serialized.length > normalized.maxRecordBytes) {
      fail("MODEL_PACK_CACHE_RECORD_LIMIT_EXCEEDED", `${subject} exceeds maxRecordBytes.`, {
        maxRecordBytes: normalized.maxRecordBytes
      });
    }
    const byteLength = encoder.encode(serialized).byteLength;
    if (byteLength > normalized.maxRecordBytes) {
      fail("MODEL_PACK_CACHE_RECORD_LIMIT_EXCEEDED", `${subject} exceeds maxRecordBytes.`, {
        maxRecordBytes: normalized.maxRecordBytes
      });
    }
    return Object.freeze({ serialized, byteLength });
  }

  async function verifySerialized(serialized) {
    if (typeof serialized !== "string" || serialized.length === 0) {
      fail("MODEL_PACK_CACHE_ENTRY_INVALID", "Cached Model Pack bytes are invalid.");
    }
    if (serialized.length > normalized.maxRecordBytes) {
      fail("MODEL_PACK_CACHE_RECORD_LIMIT_EXCEEDED", "Cached Model Pack exceeds maxRecordBytes.", {
        maxRecordBytes: normalized.maxRecordBytes
      });
    }
    const bytes = encoder.encode(serialized);
    if (bytes.byteLength > normalized.maxRecordBytes) {
      fail("MODEL_PACK_CACHE_RECORD_LIMIT_EXCEEDED", "Cached Model Pack exceeds maxRecordBytes.", {
        maxRecordBytes: normalized.maxRecordBytes
      });
    }
    let pack;
    try {
      pack = await normalized.verifyBundle(bytes);
    } catch (error) {
      if (error instanceof ModelPackError) throw error;
      fail("MODEL_PACK_CACHE_VERIFIER_FAILED", "Model Pack cache verifier failed.", {
        cause: error instanceof Error ? error.name : typeof error
      });
    }
    const identity = identityFromVerifiedPack(pack);
    const canonical = serializeBounded(
      pack,
      "MODEL_PACK_CACHE_VERIFIER_RESULT_INVALID",
      "Verified Model Pack"
    );
    return Object.freeze({ pack, identity, ...canonical });
  }

  async function verifyValue(value) {
    const candidate = serializeBounded(
      value,
      "MODEL_PACK_CACHE_VALUE_INVALID",
      "Model Pack cache candidate"
    );
    return verifySerialized(candidate.serialized);
  }

  async function removeKey(key) {
    const removed = await storageCall("remove", key);
    if (typeof removed !== "boolean") {
      fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage remove result must be boolean.");
    }
    return removed;
  }

  async function matchNormalized(identity, key) {
    const read = normalizeStorageRead(await storageCall("read", key));
    if (read.state === "miss") return Object.freeze({ state: "miss", key });
    if (read.state === "invalid") {
      await removeKey(key);
      return Object.freeze({
        state: "invalid",
        key,
        invalidCode: "MODEL_PACK_CACHE_STORAGE_RECORD_INVALID"
      });
    }
    let verified;
    try {
      verified = await verifySerialized(read.value);
      if (verified.serialized !== read.value) {
        fail("MODEL_PACK_CACHE_ENTRY_NONCANONICAL", "Cached Model Pack bytes are not canonical.");
      }
    } catch (error) {
      await removeKey(key);
      return Object.freeze({
        state: "invalid",
        key,
        invalidCode: safeInvalidCode(error)
      });
    }
    assertExpectedIdentity(verified.identity, identity);
    return Object.freeze({
      state: "hit",
      key,
      byteLength: verified.byteLength,
      pack: verified.pack
    });
  }

  async function commitVerified(key, verified) {
    const result = normalizeStorageCommitResult(await storageCall("commit", {
      key,
      value: verified.serialized,
      byteLength: verified.byteLength,
      maxEntries: normalized.maxEntries,
      maxRecordBytes: normalized.maxRecordBytes,
      maxTotalBytes: normalized.maxTotalBytes
    }));
    if (result.evictedKeys.includes(key)) {
      fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage evicted the record being committed.");
    }
    return result;
  }

  async function match(identityInput) {
    requireOpen();
    const identity = normalizeIdentity(identityInput);
    return matchNormalized(identity, modelPackCacheKey(identity));
  }

  async function put(identityInput, pack) {
    requireOpen();
    const identity = normalizeIdentity(identityInput);
    const key = modelPackCacheKey(identity);
    const verified = await verifyValue(pack);
    assertExpectedIdentity(verified.identity, identity);
    const committed = await commitVerified(key, verified);
    return Object.freeze({
      key,
      byteLength: verified.byteLength,
      evictedKeys: committed.evictedKeys,
      entryCount: committed.entryCount,
      totalBytes: committed.totalBytes,
      pack: verified.pack
    });
  }

  function load(identityInput, loader) {
    requireOpen();
    const identity = normalizeIdentity(identityInput);
    if (typeof loader !== "function") {
      return Promise.reject(new ModelPackError(
        "MODEL_PACK_CACHE_LOADER_INVALID",
        "loader must be a function."
      ));
    }
    const key = modelPackCacheKey(identity);
    if (inflight.has(key)) return inflight.get(key);
    const loading = (async () => {
      const cached = await matchNormalized(identity, key);
      if (cached.state === "hit") {
        return Object.freeze({
          source: "cache",
          cacheState: "hit",
          key,
          byteLength: cached.byteLength,
          evictedKeys: Object.freeze([]),
          pack: cached.pack
        });
      }
      let candidate;
      try {
        candidate = await loader(Object.freeze({ identity, key }));
      } catch (error) {
        if (error instanceof ModelPackError) throw error;
        fail("MODEL_PACK_CACHE_LOADER_FAILED", "Model Pack cache loader failed.", {
          cause: error instanceof Error ? error.name : typeof error
        });
      }
      const verified = await verifyValue(candidate);
      assertExpectedIdentity(verified.identity, identity);
      const committed = await commitVerified(key, verified);
      return Object.freeze({
        source: "loader",
        cacheState: cached.state,
        ...(cached.state === "invalid" ? { invalidCode: cached.invalidCode } : {}),
        key,
        byteLength: verified.byteLength,
        evictedKeys: committed.evictedKeys,
        pack: verified.pack
      });
    })();
    inflight.set(key, loading);
    void loading.finally(() => {
      if (inflight.get(key) === loading) inflight.delete(key);
    }).catch(() => {});
    return loading;
  }

  async function remove(identityInput) {
    requireOpen();
    const identity = normalizeIdentity(identityInput);
    const key = modelPackCacheKey(identity);
    await inflight.get(key)?.catch(() => {});
    return removeKey(key);
  }

  async function clear() {
    requireOpen();
    await Promise.allSettled([...inflight.values()]);
    const removed = await storageCall("clear");
    if (!Number.isSafeInteger(removed) || removed < 0) {
      fail("MODEL_PACK_CACHE_STORAGE_RESULT_INVALID", "Cache storage clear result is invalid.");
    }
    return removed;
  }

  async function inspect() {
    requireOpen();
    return normalizeStorageSnapshot(await storageCall("inspect"));
  }

  function close() {
    if (closePromise !== null) return closePromise;
    closed = true;
    closePromise = Promise.allSettled([...inflight.values()]).then(async () => {
      if (!normalized.ownsStorage) return;
      try {
        await storage.close();
      } catch (error) {
        fail("MODEL_PACK_CACHE_STORAGE_FAILED", "Cache storage close failed.", {
          cause: error instanceof Error ? error.name : typeof error
        });
      }
    });
    return closePromise;
  }

  return Object.freeze({ match, put, load, remove, clear, inspect, close });
}
