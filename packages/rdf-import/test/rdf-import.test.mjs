import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  RDF_IMPORT_FORMAT,
  RDF_IMPORT_LIMITS,
  RDF_IMPORT_PROFILE,
  RDF_IMPORT_PROFILE_ID,
  RDF_NEUTRAL_GRAPH_FORMAT,
  RdfImportError,
  importNTriples,
  matchRdfImportSource,
  projectRdfImportGraph,
  verifyRdfImportArtifact
} from "../src/index.js";

const line = (subject, predicate, object) => `${subject} ${predicate} ${object} .`;
const subject = "<https://example.test/a>";
const other = "<https://example.test/b>";
const predicate = "<https://example.test/relation>";
const typedPredicate = "<https://example.test/count>";
const labelPredicate = "<https://example.test/label>";
const source = [
  "# bounded RDF 1.1 fixture",
  line(subject, predicate, other),
  line("_:item", labelPredicate, '"caf\\u00E9"@FR'),
  line(subject, typedPredicate, '"42"^^<http://www.w3.org/2001/XMLSchema#integer>'),
  line(subject, labelPredicate, '"plain\\ntext"'),
  `${line(subject, predicate, other)} # duplicate graph statement`
].join("\r\n");

function rejected(action, code) {
  assert.throws(
    action,
    (error) => error instanceof RdfImportError && error.code === code
  );
}

test("the safe RDF 1.1 profile preserves terms, duplicate occurrences, and exact source identity", () => {
  const artifact = importNTriples(source, { sourceId: "rdf-fixture-v1" });
  assert.equal(artifact.format, RDF_IMPORT_FORMAT);
  assert.equal(artifact.profile, RDF_IMPORT_PROFILE_ID);
  assert.equal(artifact.source.mediaType, "application/n-triples");
  assert.equal(artifact.source.bytes, new TextEncoder().encode(source).byteLength);
  assert.deepEqual(artifact.statistics, {
    sourceStatementCount: 5,
    statementCount: 4,
    duplicateStatementCount: 1,
    termCount: 9,
    iriTermCount: 5,
    blankNodeCount: 1,
    literalCount: 3
  });
  const duplicate = artifact.statements.find((statement) => statement.occurrences.length === 2);
  const language = artifact.statements.find((statement) => statement.object.language === "fr");
  const plain = artifact.statements.find((statement) => statement.object.value === "plain\ntext");
  assert.deepEqual(duplicate.occurrences, [2, 6]);
  assert.equal(language.object.value, "caf\u00e9");
  assert.equal(
    language.object.datatype,
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
  );
  assert.equal(
    plain.object.datatype,
    "http://www.w3.org/2001/XMLSchema#string"
  );
  assert.equal(language.subject.scope, artifact.source.hash);
  assert.equal(verifyRdfImportArtifact(artifact).importHash, artifact.importHash);
  assert.equal(matchRdfImportSource(artifact, source).importHash, artifact.importHash);
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.statements[0].subject));
});

test("graph identity ignores lexical ordering but exact import identity does not", () => {
  const firstSource = [
    line(subject, predicate, other),
    line(other, predicate, subject)
  ].join("\n");
  const secondSource = [
    `  ${line(other, predicate, subject)}`,
    line(subject, predicate, other)
  ].join("\n");
  const first = importNTriples(firstSource, { sourceId: "first" });
  const second = importNTriples(secondSource, { sourceId: "second" });
  assert.equal(first.graphHash, second.graphHash);
  assert.notEqual(first.source.hash, second.source.hash);
  assert.notEqual(first.importHash, second.importHash);
});

test("empty documents and empty RDF string literals remain valid profile artifacts", () => {
  const empty = importNTriples("", { sourceId: "empty-document" });
  assert.equal(empty.source.bytes, 0);
  assert.equal(empty.statements.length, 0);
  assert.equal(verifyRdfImportArtifact(empty).statistics.statementCount, 0);

  const literal = importNTriples(line(subject, predicate, '""'), {
    sourceId: "empty-literal"
  });
  assert.equal(literal.statements[0].object.value, "");
  assert.equal(verifyRdfImportArtifact(literal).statements[0].object.value, "");
  assert.equal(projectRdfImportGraph(literal).statistics.literalNodeCount, 1);
});

test("blank-node identities cannot leak across exact source scopes", () => {
  const first = importNTriples(line("_:local", predicate, other), { sourceId: "first" });
  const second = importNTriples(`${line("_:local", predicate, other)}\n`, { sourceId: "second" });
  assert.notEqual(first.source.hash, second.source.hash);
  assert.notEqual(first.statements[0].subject.id, second.statements[0].subject.id);
  assert.notEqual(first.graphHash, second.graphHash);
});

test("neutral projection preserves RDF direction without assigning Onto2D semantics", () => {
  const artifact = importNTriples(source, { sourceId: "rdf-fixture-v1" });
  const graph = projectRdfImportGraph(artifact);
  assert.equal(graph.format, RDF_NEUTRAL_GRAPH_FORMAT);
  assert.deepEqual(graph.identity, {
    sourceHash: artifact.source.hash,
    graphHash: artifact.graphHash,
    importHash: artifact.importHash
  });
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.statistics.nodeCount, 6);
  assert.deepEqual(graph.semantics, {
    inference: false,
    relationKind: "rdf-predicate",
    modelPackReady: false
  });
  assert.ok(graph.edges.every((edge) => edge.predicate.startsWith("https://example.test/")));
  assert.ok(graph.nodes.every((node) => node.level === undefined && node.typeRole === undefined));
  assert.ok(Object.isFrozen(graph));
});

test("artifact and neutral projection satisfy their published schemas", async () => {
  const schemaFiles = [
    new URL("../../schemas/schemas/rdf-import-artifact.schema.json", import.meta.url),
    new URL("../../schemas/schemas/rdf-neutral-graph.schema.json", import.meta.url)
  ];
  const [artifactSchema, graphSchema] = await Promise.all(
    schemaFiles.map(async (url) => JSON.parse(await readFile(url, "utf8")))
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const artifact = importNTriples(source, { sourceId: "rdf-fixture-v1" });
  const graph = projectRdfImportGraph(artifact);
  const validateArtifact = ajv.compile(artifactSchema);
  const validateGraph = ajv.compile(graphSchema);
  assert.equal(validateArtifact(artifact), true, JSON.stringify(validateArtifact.errors));
  assert.equal(validateGraph(graph), true, JSON.stringify(validateGraph.errors));
});

test("RDF 1.2, Turtle, relative IRIs, unsafe encoding, and invalid term positions fail closed", () => {
  const invalid = [
    ["VERSION \"1.2\"", "RDF_IMPORT_PROFILE_UNSUPPORTED"],
    [`<< ${subject} ${predicate} ${other} >> ${predicate} ${other} .`, "RDF_IMPORT_PROFILE_UNSUPPORTED"],
    ["@prefix ex: <https://example.test/> .", "RDF_IMPORT_PROFILE_UNSUPPORTED"],
    [line("<relative>", predicate, other), "RDF_IMPORT_SYNTAX_INVALID"],
    [line("<https://example.test/\\u003E>", predicate, other), "RDF_IMPORT_SYNTAX_INVALID"],
    [line("<https://example.test/%XX>", predicate, other), "RDF_IMPORT_SYNTAX_INVALID"],
    [line(subject, "_:predicate", other), "RDF_IMPORT_SYNTAX_INVALID"],
    [line('"literal-subject"', predicate, other), "RDF_IMPORT_SYNTAX_INVALID"],
    [line(subject, predicate, '"text"@en--ltr'), "RDF_IMPORT_PROFILE_UNSUPPORTED"],
    [`${line(subject, predicate, other)} trailing`, "RDF_IMPORT_SYNTAX_INVALID"]
  ];
  for (const [input, code] of invalid) {
    rejected(() => importNTriples(input, { sourceId: "invalid" }), code);
  }
  rejected(
    () => importNTriples(`"${String.fromCharCode(0xe9)}"`, { sourceId: "unicode" }),
    "RDF_IMPORT_PROFILE_UNSUPPORTED"
  );
  rejected(
    () => importNTriples(new Uint8Array([0xc3, 0x28]), { sourceId: "utf8" }),
    "RDF_IMPORT_ENCODING_INVALID"
  );
  rejected(
    () => importNTriples(new Uint8Array([0xef, 0xbb, 0xbf, 0x23]), { sourceId: "bom" }),
    "RDF_IMPORT_ENCODING_INVALID"
  );
  rejected(
    () => importNTriples(`${line(subject, predicate, other)}\r`, { sourceId: "cr" }),
    "RDF_IMPORT_ENCODING_INVALID"
  );
});

test("resource limits and option objects are explicit and accessor-safe", () => {
  const two = `${line(subject, predicate, other)}\n${line(other, predicate, subject)}`;
  rejected(
    () => importNTriples(two, { sourceId: "limited", limits: { maxStatements: 1 } }),
    "RDF_IMPORT_LIMIT_EXCEEDED"
  );
  rejected(
    () => importNTriples(line(subject, predicate, other), {
      sourceId: "limited",
      limits: { maxLineBytes: 4 }
    }),
    "RDF_IMPORT_LIMIT_EXCEEDED"
  );
  rejected(
    () => importNTriples("", { sourceId: "bad id" }),
    "RDF_IMPORT_OPTIONS_INVALID"
  );
  rejected(
    () => importNTriples("", { sourceId: "extra", unknown: true }),
    "RDF_IMPORT_OPTIONS_INVALID"
  );
  let invoked = false;
  const options = {};
  Object.defineProperty(options, "sourceId", {
    enumerable: true,
    get() {
      invoked = true;
      return "unsafe";
    }
  });
  rejected(() => importNTriples("", options), "RDF_IMPORT_OPTIONS_INVALID");
  assert.equal(invoked, false);
  assert.equal(RDF_IMPORT_LIMITS.maxBytes, 8 * 1024 * 1024);
  assert.equal(RDF_IMPORT_PROFILE.inference, false);
});

test("artifact tampering and source mismatch fail before projection", () => {
  const artifact = importNTriples(source, { sourceId: "rdf-fixture-v1" });
  const changedTerm = structuredClone(artifact);
  changedTerm.statements[0].object.value = "changed";
  rejected(() => verifyRdfImportArtifact(changedTerm), "RDF_IMPORT_ARTIFACT_INVALID");

  const changedOccurrence = structuredClone(artifact);
  changedOccurrence.statements.find((statement) => statement.occurrences.length === 2)
    .occurrences.reverse();
  rejected(() => verifyRdfImportArtifact(changedOccurrence), "RDF_IMPORT_ARTIFACT_INVALID");

  const reusedOccurrence = structuredClone(artifact);
  reusedOccurrence.statements[1].occurrences = [...reusedOccurrence.statements[0].occurrences];
  rejected(() => verifyRdfImportArtifact(reusedOccurrence), "RDF_IMPORT_ARTIFACT_INVALID");

  rejected(
    () => matchRdfImportSource(artifact, `${source}\n`),
    "RDF_IMPORT_SOURCE_MISMATCH"
  );
  rejected(
    () => projectRdfImportGraph(changedTerm),
    "RDF_IMPORT_ARTIFACT_INVALID"
  );
});

test("the RDF import package has a browser-safe transitive module graph", async () => {
  const moduleMap = new Map([
    ["@onto2d/kernel/canonical", new URL("../../kernel/src/canonical-entry.js", import.meta.url)]
  ]);
  const pending = [new URL("../src/index.js", import.meta.url)];
  const visited = new Set();
  while (pending.length > 0) {
    const moduleUrl = pending.pop();
    if (visited.has(moduleUrl.href)) continue;
    visited.add(moduleUrl.href);
    const moduleSource = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(moduleSource, /(?:^|["'])node:/, moduleUrl.pathname);
    for (const match of moduleSource.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (moduleMap.has(specifier)) {
        pending.push(moduleMap.get(specifier));
      } else if (specifier.startsWith(".")) {
        pending.push(new URL(specifier, moduleUrl));
      } else {
        assert.fail(`unexpected RDF import dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
});
