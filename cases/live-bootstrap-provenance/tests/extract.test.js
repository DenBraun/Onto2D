import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  ManifestSyntaxError,
  extractCase,
  verifySourceInputs
} from "../extract.mjs";
import {
  CASE_ROOT,
  readCaseJson,
  readManifestBytes,
  traceFromText
} from "./helpers.js";

test("the pinned manifest produces a complete schema-valid ordered trace", async () => {
  const [{ trace }, schema] = await Promise.all([
    extractCase(),
    readCaseJson("schema/upstream-trace.schema.json")
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(trace), true, JSON.stringify(validate.errors));
  assert.deepEqual(trace.statistics, {
    eventCount: 205,
    activeEventCount: 197,
    inactiveEventCount: 8,
    directiveCounts: {
      build: 170,
      improve: 22,
      define: 4,
      jump: 5,
      uninstall: 4
    }
  });
  assert.deepEqual(
    trace.events.map((event) => event.ordinal),
    Array.from({ length: 205 }, (_, index) => index)
  );
  assert.equal(trace.events[0].source.line, 34);
  assert.equal(trace.events.at(-1).source.line, 238);
});

test("all supported directives, predicates, comments, and repeated builds remain explicit", () => {
  const trace = traceFromText([
    "build: tool-1",
    "define: ENABLED = ( FLAG == yes )",
    "improve: tune ( ENABLED == True )",
    "jump: kernel ( ENABLED != False ) # retained comment",
    "uninstall: tool-1 /usr/bin/tool",
    "build: tool-1",
    ""
  ].join("\n"), { FLAG: "yes" });
  assert.deepEqual(trace.events.map((event) => event.directive), [
    "build", "define", "improve", "jump", "uninstall", "build"
  ]);
  assert.notEqual(trace.events[0].eventId, trace.events[5].eventId);
  assert.equal(trace.events[3].source.comment, "retained comment");
  assert.deepEqual(trace.events[4].targets, ["tool-1", "/usr/bin/tool"]);
  assert.equal(trace.events.every((event) => event.profileStatus.active), true);
});

test("the real repeated tcc builds are separate events with exact source locations", async () => {
  const { trace } = await extractCase();
  const repeated = trace.events.filter((event) =>
    event.directive === "build" && event.target === "tcc-0.9.27"
  );
  assert.equal(repeated.length, 5);
  assert.deepEqual(repeated.map((event) => event.source.line), [38, 61, 64, 66, 111]);
  assert.equal(new Set(repeated.map((event) => event.eventId)).size, 5);
});

test("profile evaluation preserves inactive events and reports its exact inputs", () => {
  const trace = traceFromText([
    "define: ENABLED = ( FLAG == yes )",
    "build: active ( ENABLED == True )",
    "build: inactive ( ENABLED != True )",
    "build: unset-is-empty ( MISSING != value )",
    ""
  ].join("\n"), { FLAG: "yes" });
  assert.deepEqual(trace.events.map((event) => event.profileStatus.active), [true, true, false, true]);
  assert.deepEqual(trace.events[0].profileStatus.inputs, [
    { name: "FLAG", value: "yes", origin: "profile" }
  ]);
  assert.deepEqual(trace.events[2].profileStatus.inputs, [
    { name: "ENABLED", value: "True", origin: "manifest-define" }
  ]);
  assert.deepEqual(trace.events[3].profileStatus.inputs, [
    { name: "MISSING", value: "", origin: "unset" }
  ]);
});

test("unknown directives and malformed syntax fail closed", () => {
  assert.throws(() => traceFromText("fetch: tool-1\n"), (error) =>
    error instanceof ManifestSyntaxError && /unknown directive/.test(error.message)
  );
  assert.throws(() => traceFromText("build: tool-1 ( FLAG == True\n"), (error) =>
    error instanceof ManifestSyntaxError && /matching standalone/.test(error.message)
  );
  assert.throws(() => traceFromText("build: tool-1 (FLAG == True )\n"), (error) =>
    error instanceof ManifestSyntaxError && /parentheses must be standalone/.test(error.message)
  );
  assert.throws(() => traceFromText("build: tool-1 ( flag == True )\n"), (error) =>
    error instanceof ManifestSyntaxError && /must be uppercase/.test(error.message)
  );
});

test("reordering executable lines changes trace identity", () => {
  const first = traceFromText("build: alpha\nbuild: beta\n");
  const second = traceFromText("build: beta\nbuild: alpha\n");
  assert.notEqual(first.traceIdentity, second.traceIdentity);
  assert.deepEqual(first.events.map((event) => event.target), ["alpha", "beta"]);
  assert.deepEqual(second.events.map((event) => event.target), ["beta", "alpha"]);
});

test("source verification rejects one changed byte before parsing", async () => {
  const [lock, manifest] = await Promise.all([
    readCaseJson("upstream.json"),
    readManifestBytes()
  ]);
  const manifestOnlyLock = structuredClone(lock);
  manifestOnlyLock.files = [manifestOnlyLock.files.find((file) => file.path === "steps/manifest")];
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "onto2d-live-bootstrap-source-"));
  try {
    await mkdir(path.join(temporaryRoot, "steps"));
    await writeFile(path.join(temporaryRoot, "steps/manifest"), manifest);
    await verifySourceInputs(manifestOnlyLock, { upstreamRoot: temporaryRoot });
    const changed = Buffer.from(manifest);
    changed[changed.length - 2] ^= 1;
    await writeFile(path.join(temporaryRoot, "steps/manifest"), changed);
    await assert.rejects(
      verifySourceInputs(manifestOnlyLock, { upstreamRoot: temporaryRoot }),
      /steps\/manifest hash mismatch/
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("the pinned upstream fixture is byte-for-byte identical to its declared hash", async () => {
  const lock = await readCaseJson("upstream.json");
  const verified = await verifySourceInputs(lock);
  assert.equal(verified.inputs.get("steps/manifest").byteLength, 6644);
  assert.equal(lock.files[0].fixturePath, "fixtures/manifest/steps-manifest");
  assert.equal(
    lock.files[0].sha256,
    "sha256:10d7fd566cdffab1802befcaaeb48484248c8e8eb0e2bc4efaa95fa8de54c592"
  );
});

test("changing the pinned revision changes source identity without changing fixture bytes", async () => {
  const lock = await readCaseJson("upstream.json");
  const first = await verifySourceInputs(lock);
  const changedLock = structuredClone(lock);
  changedLock.revision = `0${lock.revision.slice(1)}`;
  const second = await verifySourceInputs(changedLock);
  assert.notEqual(first.sourceIdentity, second.sourceIdentity);
});

test("committed generated JSON is exact replay output", async () => {
  const { trace } = await extractCase();
  const committed = JSON.parse(await readFile(path.join(
    CASE_ROOT,
    "generated/upstream-trace.json"
  ), "utf8"));
  assert.deepEqual(committed, trace);
});
