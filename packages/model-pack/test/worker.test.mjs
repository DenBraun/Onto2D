import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import {
  buildModelPack,
  modelPackFilePaths,
  ModelPackError
} from "../src/index.js";
import {
  MODEL_PACK_WORKER_LIMITS,
  MODEL_PACK_WORKER_PROTOCOL,
  createModelPackWorkerClient,
  installModelPackWorkerEndpoint
} from "../src/worker.js";

const BASE_URL = "https://models.example.test/releases/worker-v1/";
const encoder = new TextEncoder();
const sourceHash = `sha256:${"d".repeat(64)}`;

function fixture() {
  return buildModelPack({
    model: { id: "worker-fixture", name: "Worker Fixture", version: "1" },
    source: { id: "worker-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

function transportValues(pack) {
  return new Map([
    ["manifest.json", pack.manifest],
    ...Object.entries(pack.files)
  ]);
}

function responseBytes(value) {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function makeResponse(value, url) {
  const bytes = responseBytes(value);
  return {
    ok: true,
    status: 200,
    redirected: false,
    type: "basic",
    url,
    headers: new Headers({
      "content-type": "application/json; charset=utf-8",
      "content-length": String(bytes.byteLength)
    }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    })
  };
}

function makeFetch(values, calls = []) {
  return async (input, init) => {
    const url = new URL(input);
    const relative = decodeURIComponent(url.pathname.slice(new URL(BASE_URL).pathname.length));
    calls.push({ url: url.href, relative, init });
    if (!values.has(relative)) throw new Error(`missing ${relative}`);
    return makeResponse(values.get(relative), url.href);
  };
}

function cloned(value, transfers = []) {
  return transfers.length > 0
    ? structuredClone(value, { transfer: transfers })
    : structuredClone(value);
}

function createDuplex() {
  const clientListeners = new Map();
  const endpointListeners = new Map();
  const clientSent = [];
  const endpointSent = [];
  let terminated = false;

  function add(listeners, type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  }

  function remove(listeners, type, listener) {
    listeners.get(type)?.delete(listener);
  }

  function emit(listeners, type, event) {
    for (const listener of listeners.get(type) ?? []) listener(event);
  }

  function deliver(listeners, type, event) {
    queueMicrotask(() => emit(listeners, type, event));
  }

  const worker = {
    postMessage(message, transfers = []) {
      if (terminated) throw new Error("terminated");
      const copy = cloned(message, transfers);
      clientSent.push(copy);
      deliver(endpointListeners, "message", { data: copy });
    },
    addEventListener(type, listener) {
      add(clientListeners, type, listener);
    },
    removeEventListener(type, listener) {
      remove(clientListeners, type, listener);
    },
    terminate() {
      terminated = true;
    }
  };

  const scope = {
    postMessage(message) {
      const copy = cloned(message);
      endpointSent.push(copy);
      deliver(clientListeners, "message", { data: copy });
    },
    addEventListener(type, listener) {
      add(endpointListeners, type, listener);
    },
    removeEventListener(type, listener) {
      remove(endpointListeners, type, listener);
    }
  };

  return {
    worker,
    scope,
    clientSent,
    endpointSent,
    emitClient(type, event) {
      emit(clientListeners, type, event);
    },
    emitEndpoint(type, event) {
      emit(endpointListeners, type, event);
    },
    get terminated() {
      return terminated;
    }
  };
}

async function rejected(action, code) {
  await assert.rejects(
    action,
    (error) => error instanceof ModelPackError && error.code === code
  );
}

function delay(milliseconds = 0) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("bundle requests round-trip through structured clone and freeze the verified result", async () => {
  const pack = fixture();
  const bytes = encoder.encode(JSON.stringify(pack));
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope);
  const client = createModelPackWorkerClient(duplex.worker, {
    clientId: "bundle-client",
    ownsWorker: true
  });

  const loaded = await client.loadBundle(bytes);
  assert.equal(canonicalize(loaded), canonicalize(pack));
  assert.equal(bytes.byteLength > 0, true);
  assert.ok(Object.isFrozen(loaded));
  assert.ok(Object.isFrozen(loaded.manifest));
  assert.ok(Object.isFrozen(loaded.files["model/nodes.json"]));
  assert.equal(duplex.clientSent[0].operation, "load-bundle");
  assert.equal(duplex.clientSent[0].input.source instanceof ArrayBuffer, true);

  client.close();
  endpoint.close();
  assert.equal(duplex.terminated, true);
});

test("move transfer detaches only complete ArrayBuffer sources", async () => {
  const bytes = encoder.encode(JSON.stringify(fixture()));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope);
  const client = createModelPackWorkerClient(duplex.worker, { clientId: "move-client" });

  const loading = client.loadBundle(buffer, { transfer: "move" });
  assert.equal(buffer.byteLength, 0);
  await loading;

  const padded = new Uint8Array(bytes.byteLength + 2);
  const view = padded.subarray(1, padded.byteLength - 1);
  await rejected(
    () => client.loadBundle(view, { transfer: "move" }),
    "MODEL_PACK_WORKER_BUNDLE_TRANSFER_INVALID"
  );
  await rejected(
    () => client.loadBundle(new Blob([bytes]), { transfer: "move" }),
    "MODEL_PACK_WORKER_BUNDLE_TRANSFER_INVALID"
  );

  client.close();
  endpoint.close();
});

test("HTTP requests use the bounded browser loader inside the endpoint", async () => {
  const pack = fixture();
  const calls = [];
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope, {
    fetch: makeFetch(transportValues(pack), calls)
  });
  const client = createModelPackWorkerClient(duplex.worker, { clientId: "http-client" });

  const loaded = await client.loadHttpDirectory(BASE_URL, {
    maxFileBytes: 1024 * 1024,
    maxTotalBytes: 8 * 1024 * 1024
  });
  assert.equal(canonicalize(loaded), canonicalize(pack));
  assert.deepEqual(calls.map((call) => call.relative), [
    "manifest.json",
    ...Object.values(modelPackFilePaths())
  ]);
  assert.ok(calls.every((call) => call.init.signal instanceof AbortSignal));
  assert.equal(duplex.clientSent[0].input.options.maxFileBytes, 1024 * 1024);
  assert.equal("signal" in duplex.clientSent[0].input.options, false);

  client.close();
  endpoint.close();
});

test("abort and timeout cancel active HTTP work without accepting a late result", async () => {
  const observedSignals = [];
  const hangingFetch = async (_input, init) => new Promise((_resolve, reject) => {
    observedSignals.push(init.signal);
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
      once: true
    });
  });
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope, { fetch: hangingFetch });
  const client = createModelPackWorkerClient(duplex.worker, { clientId: "cancel-client" });

  const controller = new AbortController();
  const aborted = client.loadHttpDirectory(BASE_URL, { signal: controller.signal });
  await delay();
  controller.abort();
  await rejected(() => aborted, "MODEL_PACK_WORKER_ABORTED");
  await delay();
  assert.equal(observedSignals[0].aborted, true);

  const timedOut = client.loadHttpDirectory(BASE_URL, { timeoutMs: 5 });
  await rejected(() => timedOut, "MODEL_PACK_WORKER_TIMEOUT");
  await delay();
  assert.equal(observedSignals[1].aborted, true);
  assert.ok(duplex.clientSent.some((message) => message.kind === "cancel"));

  client.close();
  endpoint.close();
});

test("closing the client cancels endpoint work and a post failure closes the transport", async () => {
  const observedSignals = [];
  const hangingFetch = async (_input, init) => new Promise((_resolve, reject) => {
    observedSignals.push(init.signal);
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
      once: true
    });
  });
  let duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope, { fetch: hangingFetch });
  let client = createModelPackWorkerClient(duplex.worker, { clientId: "close-client" });
  const pending = client.loadHttpDirectory(BASE_URL);
  await delay();
  client.close();
  await rejected(() => pending, "MODEL_PACK_WORKER_CLIENT_CLOSED");
  await delay();
  assert.equal(observedSignals[0].aborted, true);
  assert.ok(duplex.clientSent.some((message) => message.kind === "cancel"));
  endpoint.close();

  duplex = createDuplex();
  duplex.worker.postMessage = () => {
    throw new DOMException("closed", "InvalidStateError");
  };
  client = createModelPackWorkerClient(duplex.worker, {
    clientId: "post-failure-client",
    ownsWorker: true
  });
  await rejected(
    () => client.loadBundle(encoder.encode(JSON.stringify(fixture()))),
    "MODEL_PACK_WORKER_TRANSPORT_FAILED"
  );
  await rejected(
    () => client.loadBundle(new Uint8Array()),
    "MODEL_PACK_WORKER_CLIENT_CLOSED"
  );
  assert.equal(duplex.terminated, true);
});

test("client and endpoint capacity limits fail closed", async () => {
  const hangingFetch = async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
      once: true
    });
  });
  let duplex = createDuplex();
  let endpoint = installModelPackWorkerEndpoint(duplex.scope, { fetch: hangingFetch });
  let client = createModelPackWorkerClient(duplex.worker, {
    clientId: "client-capacity",
    maxPendingRequests: 1
  });
  const controller = new AbortController();
  const first = client.loadHttpDirectory(BASE_URL, { signal: controller.signal });
  await rejected(
    () => client.loadHttpDirectory(BASE_URL),
    "MODEL_PACK_WORKER_CAPACITY_EXCEEDED"
  );
  controller.abort();
  await rejected(() => first, "MODEL_PACK_WORKER_ABORTED");
  client.close();
  endpoint.close();

  duplex = createDuplex();
  endpoint = installModelPackWorkerEndpoint(duplex.scope, {
    fetch: hangingFetch,
    maxActiveRequests: 1
  });
  const firstClient = createModelPackWorkerClient(duplex.worker, { clientId: "endpoint-a" });
  const secondClient = createModelPackWorkerClient(duplex.worker, { clientId: "endpoint-b" });
  const endpointController = new AbortController();
  const active = firstClient.loadHttpDirectory(BASE_URL, { signal: endpointController.signal });
  await delay();
  await rejected(
    () => secondClient.loadHttpDirectory(BASE_URL),
    "MODEL_PACK_WORKER_CAPACITY_EXCEEDED"
  );
  endpointController.abort();
  await rejected(() => active, "MODEL_PACK_WORKER_ABORTED");
  firstClient.close();
  secondClient.close();
  endpoint.close();
});

test("verified data errors retain their ModelPackError code without serializing a stack", async () => {
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope);
  const client = createModelPackWorkerClient(duplex.worker, { clientId: "error-client" });

  await rejected(
    () => client.loadBundle(encoder.encode("{")),
    "MODEL_PACK_BROWSER_BUNDLE_JSON_INVALID"
  );
  const response = duplex.endpointSent.find((message) => message.kind === "error");
  assert.deepEqual(Object.keys(response.error).sort(), ["code", "details", "message", "name"]);
  assert.equal("stack" in response.error, false);

  client.close();
  endpoint.close();
});

test("protocol messages reject unknown fields, accessors, versions, and operations", async () => {
  const duplex = createDuplex();
  const endpoint = installModelPackWorkerEndpoint(duplex.scope);
  const replies = [];
  duplex.worker.addEventListener("message", (event) => replies.push(event.data));
  const base = {
    protocol: MODEL_PACK_WORKER_PROTOCOL.name,
    version: MODEL_PACK_WORKER_PROTOCOL.version,
    kind: "request",
    id: "raw-request",
    operation: "unknown",
    input: {}
  };
  duplex.worker.postMessage(base);
  await delay();
  assert.equal(replies.at(-1).error.code, "MODEL_PACK_WORKER_OPERATION_UNSUPPORTED");

  duplex.worker.postMessage({ ...base, version: "2" });
  await delay();
  assert.equal(replies.at(-1).error.code, "MODEL_PACK_WORKER_VERSION_UNSUPPORTED");

  duplex.worker.postMessage({ ...base, operation: "load-bundle", extra: true });
  await delay();
  assert.equal(replies.at(-1).error.code, "MODEL_PACK_WORKER_PROTOCOL_INVALID");

  let invoked = 0;
  const accessor = { ...base };
  Object.defineProperty(accessor, "version", {
    enumerable: true,
    get() {
      invoked += 1;
      return "1";
    }
  });
  duplex.emitEndpoint("message", { data: accessor });
  await delay();
  assert.equal(invoked, 0);
  assert.equal(replies.at(-1).error.code, "MODEL_PACK_WORKER_PROTOCOL_INVALID");

  endpoint.close();
});

test("malformed worker responses close and optionally terminate the client", async () => {
  const duplex = createDuplex();
  const client = createModelPackWorkerClient(duplex.worker, {
    clientId: "malformed-client",
    ownsWorker: true
  });
  const pending = client.loadBundle(encoder.encode(JSON.stringify(fixture())));
  const id = duplex.clientSent[0].id;
  duplex.emitClient("message", {
    data: {
      protocol: MODEL_PACK_WORKER_PROTOCOL.name,
      version: MODEL_PACK_WORKER_PROTOCOL.version,
      kind: "result",
      id,
      pack: { manifest: {}, files: {} }
    }
  });
  await rejected(() => pending, "MODEL_PACK_WORKER_RESPONSE_INVALID");
  assert.equal(duplex.terminated, true);
  await rejected(
    () => client.loadBundle(new Uint8Array()),
    "MODEL_PACK_WORKER_CLIENT_CLOSED"
  );

  const sparseDuplex = createDuplex();
  const sparseClient = createModelPackWorkerClient(sparseDuplex.worker, {
    clientId: "sparse-client"
  });
  const sparsePending = sparseClient.loadBundle(encoder.encode(JSON.stringify(fixture())));
  const sparseId = sparseDuplex.clientSent[0].id;
  const sparsePack = structuredClone(fixture());
  sparsePack.files["model/nodes.json"] = new Array(2);
  sparseDuplex.emitClient("message", {
    data: {
      protocol: MODEL_PACK_WORKER_PROTOCOL.name,
      version: MODEL_PACK_WORKER_PROTOCOL.version,
      kind: "result",
      id: sparseId,
      pack: sparsePack
    }
  });
  await rejected(() => sparsePending, "MODEL_PACK_WORKER_RESPONSE_INVALID");
});

test("worker options and source limits are strict before posting", async () => {
  const duplex = createDuplex();
  let invoked = 0;
  const accessor = {};
  Object.defineProperty(accessor, "clientId", {
    enumerable: true,
    get() {
      invoked += 1;
      return "hidden";
    }
  });
  assert.throws(
    () => createModelPackWorkerClient(duplex.worker, accessor),
    (error) => error.code === "MODEL_PACK_WORKER_OPTIONS_INVALID"
  );
  assert.equal(invoked, 0);

  const client = createModelPackWorkerClient(duplex.worker, { clientId: "strict-client" });
  await rejected(
    () => client.loadBundle(new Uint8Array(2), { maxBundleBytes: 1 }),
    "MODEL_PACK_WORKER_BUNDLE_LIMIT_EXCEEDED"
  );
  assert.equal(duplex.clientSent.length, 0);
  await rejected(
    () => client.loadHttpDirectory(BASE_URL, { maxFileBytes: undefined }),
    "MODEL_PACK_WORKER_LIMIT_INVALID"
  );
  await rejected(
    () => client.loadHttpDirectory(BASE_URL, { maxUrlLength: 12 }),
    "MODEL_PACK_WORKER_URL_LIMIT_EXCEEDED"
  );
  assert.equal(duplex.clientSent.length, 0);
  assert.equal(MODEL_PACK_WORKER_LIMITS.maxPendingRequests, 8);
  client.close();
});

test("the complete worker module graph contains no Node dependency", async () => {
  const entry = new URL("../src/worker.js", import.meta.url);
  const portableKernel = new URL("../../kernel/src/canonical-entry.js", import.meta.url);
  const pending = [entry];
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
        assert.fail(`unexpected worker dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
  assert.ok([...visited].some((url) => url.endsWith("/packages/kernel/src/sha256.js")));
});
