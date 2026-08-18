import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  ManifestTraceSyntaxError,
  exportResolvedTrace,
  run
} from "./export.mjs";

const ROOT = new URL("../../", import.meta.url);
const TOOL_ROOT = new URL("./", import.meta.url);
const MANIFEST = new URL(
  "cases/live-bootstrap-provenance/fixtures/manifest/steps-manifest",
  ROOT
);
const CONFIGURATION = new URL("profiles/default-amd64.json", TOOL_ROOT);
const REPOSITORY = "https://github.com/fosslinux/live-bootstrap";
const REVISION = "9a268c4c39cae952b268bc86da342be2175f03d4";

async function inputs() {
  return {
    manifestBytes: await readFile(MANIFEST),
    configuration: JSON.parse(await readFile(CONFIGURATION, "utf8")),
    repository: REPOSITORY,
    revision: REVISION
  };
}

test("the neutral trace matches the pinned downstream event resolution", async () => {
  const [trace, downstream] = await Promise.all([
    inputs().then(exportResolvedTrace),
    readFile(new URL(
      "cases/live-bootstrap-provenance/generated/upstream-trace.json",
      ROOT
    ), "utf8").then(JSON.parse)
  ]);
  assert.deepEqual(trace.statistics, downstream.statistics);
  assert.deepEqual(trace.events.map((event) => ({
    ordinal: event.ordinal,
    directive: event.directive,
    target: event.target,
    targets: event.targets,
    definition: event.definition,
    predicate: event.predicate,
    source: event.source,
    active: event.resolution.active,
    reason: event.resolution.reason,
    inputs: event.resolution.inputs.map((input) => ({
      ...input,
      origin: input.origin === "configuration" ? "profile" : input.origin
    }))
  })), downstream.events.map((event) => ({
    ordinal: event.ordinal,
    directive: event.directive,
    target: event.target,
    targets: event.targets,
    definition: event.definition,
    predicate: event.predicate,
    source: event.source,
    active: event.profileStatus.active,
    reason: event.profileStatus.reason,
    inputs: event.profileStatus.inputs
  })));
});

test("the exported trace conforms to the standalone schema", async () => {
  const [trace, schema] = await Promise.all([
    inputs().then(exportResolvedTrace),
    readFile(new URL("live-bootstrap-trace.schema.json", TOOL_ROOT), "utf8").then(JSON.parse)
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(trace), true, JSON.stringify(validate.errors));
});

test("event order, syntax, and configuration fail or change deterministically", async () => {
  const base = await inputs();
  const first = exportResolvedTrace({
    ...base,
    manifestBytes: Buffer.from("build: alpha\nbuild: beta\n")
  });
  const reordered = exportResolvedTrace({
    ...base,
    manifestBytes: Buffer.from("build: beta\nbuild: alpha\n")
  });
  assert.notEqual(first.traceIdentity, reordered.traceIdentity);
  assert.throws(
    () => exportResolvedTrace({ ...base, manifestBytes: Buffer.from("fetch: alpha\n") }),
    (error) => error instanceof ManifestTraceSyntaxError && /unknown directive/.test(error.message)
  );
  assert.throws(
    () => exportResolvedTrace({ ...base, manifestBytes: Buffer.from("build: alpha ( FLAG == True\n") }),
    (error) => error instanceof ManifestTraceSyntaxError && /matching standalone/.test(error.message)
  );
});

test("the command writes stable JSON and the prototype carries no project-analysis vocabulary", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "live-bootstrap-trace-"));
  try {
    const output = path.join(temporary, "trace.json");
    const trace = await run([
      "--manifest", fileURLToPath(MANIFEST),
      "--config", fileURLToPath(CONFIGURATION),
      "--repository", REPOSITORY,
      "--revision", REVISION,
      "--output", output
    ]);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), trace);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  const forbidden = [
    `Onto${"2D"}`,
    `Historical ${"Load"}`,
    `Causal ${"Emergence"}`,
    `${"SO"}MA`
  ];
  for (const relative of [
    "export.mjs",
    "README.md",
    "live-bootstrap-trace.schema.json",
    "profiles/default-amd64.json"
  ]) {
    const source = await readFile(new URL(relative, TOOL_ROOT), "utf8");
    for (const term of forbidden) assert.equal(source.includes(term), false, `${relative} contains ${term}`);
  }
});
