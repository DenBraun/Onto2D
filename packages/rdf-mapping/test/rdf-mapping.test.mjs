import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { verifyModelPack } from "@onto2d/model-pack";
import { importNTriples } from "@onto2d/rdf-import";
import { validateShacl } from "@onto2d/shacl-validation";
import {
  RDF_MAPPING_ARTIFACT_FORMAT,
  RDF_MAPPING_POLICY_FORMAT,
  RDF_MAPPING_PROFILE,
  RdfMappingError,
  buildRdfMappedModelPack,
  createRdfMappingPolicy,
  mapRdfToOnto2D,
  verifyRdfMappingArtifact,
  verifyRdfMappingPolicy
} from "../src/index.js";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SH = "http://www.w3.org/ns/shacl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const EX = "http://example.com/ns#";
const iri = (value) => `<${value}>`;
const statement = (subject, predicate, object) => `${subject} ${iri(predicate)} ${object} .`;
const type = (subject, object) => statement(subject, `${RDF}type`, iri(object));
const integer = (value) => `"${value}"^^${iri(`${XSD}integer`)}`;
const string = (value) => `"${value}"`;

const DATA_LINES = [
  type(iri(`${EX}Alice`), `${EX}Person`),
  statement(iri(`${EX}Alice`), `${RDFS}label`, string("Alice")),
  statement(iri(`${EX}Alice`), `${EX}ssn`, string("987-65-4321")),
  statement(iri(`${EX}Alice`), `${EX}worksFor`, iri(`${EX}Acme`)),
  type(iri(`${EX}Bob`), `${EX}Person`),
  statement(iri(`${EX}Bob`), `${RDFS}label`, string("Bob")),
  statement(iri(`${EX}Bob`), `${EX}ssn`, string("123-45-6789")),
  statement(iri(`${EX}Bob`), `${EX}worksFor`, iri(`${EX}Acme`)),
  type(iri(`${EX}Acme`), `${EX}Company`),
  statement(iri(`${EX}Acme`), `${RDFS}label`, string("Acme"))
];

const SHAPES_SOURCE = [
  type(iri(`${EX}PersonShape`), `${SH}NodeShape`),
  statement(iri(`${EX}PersonShape`), `${SH}targetClass`, iri(`${EX}Person`)),
  statement(iri(`${EX}PersonShape`), `${SH}property`, iri(`${EX}LabelShape`)),
  statement(iri(`${EX}PersonShape`), `${SH}property`, iri(`${EX}SsnShape`)),
  statement(iri(`${EX}PersonShape`), `${SH}property`, iri(`${EX}EmployerShape`)),
  type(iri(`${EX}CompanyShape`), `${SH}NodeShape`),
  statement(iri(`${EX}CompanyShape`), `${SH}targetClass`, iri(`${EX}Company`)),
  statement(iri(`${EX}CompanyShape`), `${SH}property`, iri(`${EX}LabelShape`)),
  type(iri(`${EX}LabelShape`), `${SH}PropertyShape`),
  statement(iri(`${EX}LabelShape`), `${SH}path`, iri(`${RDFS}label`)),
  statement(iri(`${EX}LabelShape`), `${SH}minCount`, integer(1)),
  statement(iri(`${EX}LabelShape`), `${SH}maxCount`, integer(1)),
  statement(iri(`${EX}LabelShape`), `${SH}datatype`, iri(`${XSD}string`)),
  type(iri(`${EX}SsnShape`), `${SH}PropertyShape`),
  statement(iri(`${EX}SsnShape`), `${SH}path`, iri(`${EX}ssn`)),
  statement(iri(`${EX}SsnShape`), `${SH}maxCount`, integer(1)),
  statement(iri(`${EX}SsnShape`), `${SH}datatype`, iri(`${XSD}string`)),
  type(iri(`${EX}EmployerShape`), `${SH}PropertyShape`),
  statement(iri(`${EX}EmployerShape`), `${SH}path`, iri(`${EX}worksFor`)),
  statement(iri(`${EX}EmployerShape`), `${SH}minCount`, integer(1)),
  statement(iri(`${EX}EmployerShape`), `${SH}maxCount`, integer(1)),
  statement(iri(`${EX}EmployerShape`), `${SH}nodeKind`, iri(`${SH}IRI`)),
  statement(iri(`${EX}EmployerShape`), `${SH}class`, iri(`${EX}Company`))
].join("\n");

function artifacts(dataLines = DATA_LINES) {
  const data = importNTriples(dataLines.join("\n"), { sourceId: "w3c-people-data-v1" });
  const shapes = importNTriples(SHAPES_SOURCE, { sourceId: "w3c-people-shapes-v1" });
  const report = validateShacl(data, shapes);
  return { data, shapes, report };
}

function policyInput({ data, shapes, report }, predicateRules) {
  return {
    schemaVersion: "1",
    format: RDF_MAPPING_POLICY_FORMAT,
    formatVersion: "1",
    profile: "rdf-to-model-pack-explicit-v1",
    id: "w3c-person-company-v1",
    provenance: {
      title: "W3C SHACL Person and Company example",
      sourceUri: "https://www.w3.org/TR/2017/REC-shacl-20170720/#validation-example",
      sourceVersion: "W3C Recommendation 20 July 2017",
      licenseUri: "https://www.w3.org/copyright/software-license-2015/",
      adaptation: "Conforming data, explicit shape IRIs, labels, and closed-profile constraints."
    },
    inputs: {
      dataSourceId: data.source.id,
      shapesSourceId: shapes.source.id,
      dataImportHash: data.importHash,
      shapesImportHash: shapes.importHash,
      validationReportHash: report.reportHash
    },
    levelPolicy: {
      kind: "constant",
      value: 0,
      meaning: "Flat source layer; not an inferred Onto2D formation depth."
    },
    nodeRules: [
      {
        classIri: `${EX}Company`,
        typeRole: "Organization",
        scientificStatus: "external-reference"
      },
      {
        classIri: `${EX}Person`,
        typeRole: "Person",
        scientificStatus: "external-reference"
      }
    ],
    predicateRules: predicateRules ?? [
      {
        predicateIri: `${EX}ssn`,
        action: "ignore",
        reason: "Sensitive identifiers are excluded from the structural Model Pack."
      },
      {
        predicateIri: `${EX}worksFor`,
        action: "edge",
        sourceClasses: [`${EX}Person`],
        targetClasses: [`${EX}Company`],
        relationLayer: "external-reference",
        relationRole: "works-for"
      },
      {
        predicateIri: `${RDFS}label`,
        action: "label",
        required: true
      }
    ]
  };
}

function mapped(dataLines = DATA_LINES) {
  const evidence = artifacts(dataLines);
  const policy = createRdfMappingPolicy(policyInput(evidence));
  return {
    ...evidence,
    policy,
    mapping: mapRdfToOnto2D(evidence.data, evidence.shapes, evidence.report, policy)
  };
}

function rejected(action, code) {
  assert.throws(action, (error) => error instanceof RdfMappingError && error.code === code);
}

test("an exact conforming RDF graph maps deterministically with complete statement accounting", () => {
  const first = mapped();
  const second = mapped();
  assert.equal(first.report.conforms, true);
  assert.equal(first.mapping.format, RDF_MAPPING_ARTIFACT_FORMAT);
  assert.equal(first.mapping.mappingHash, second.mapping.mappingHash);
  assert.deepEqual(first.mapping.statistics, {
    sourceStatementCount: 10,
    statementCount: 10,
    duplicateStatementCount: 0,
    nodeCount: 3,
    edgeCount: 2,
    labelStatementCount: 3,
    ignoredStatementCount: 2
  });
  assert.equal(first.mapping.statementAccounting.length, 10);
  assert.equal(
    first.mapping.statementAccounting.reduce((sum, entry) => sum + entry.occurrenceCount, 0),
    first.mapping.statistics.sourceStatementCount
  );
  assert.deepEqual(
    new Set(first.mapping.statementAccounting.map((entry) => entry.statementId)),
    new Set(first.data.statements.map((entry) => entry.id))
  );
  assert.equal(first.mapping.ignoredStatements.every((entry) => entry.reason.includes("Sensitive")), true);
  assert.equal(first.mapping.nodes.find((node) => node.label === "Alice").level, 0);
  assert.equal(first.mapping.edges.every((edge) => edge.relationRole === "works-for"), true);
  assert.equal(RDF_MAPPING_PROFILE.inference, false);
  assert.equal(RDF_MAPPING_PROFILE.statementAccounting, "complete");
  assert.ok(Object.isFrozen(first.mapping));
  assert.equal(
    verifyRdfMappingArtifact(
      first.data,
      first.shapes,
      first.report,
      first.policy,
      first.mapping
    ).mappingHash,
    first.mapping.mappingHash
  );
});

test("duplicate source occurrences remain visible while mapping one RDF statement once", () => {
  const exact = mapped([...DATA_LINES, DATA_LINES[0]]);
  assert.equal(exact.mapping.statistics.sourceStatementCount, 11);
  assert.equal(exact.mapping.statistics.statementCount, 10);
  assert.equal(exact.mapping.statistics.duplicateStatementCount, 1);
  assert.equal(exact.mapping.statementAccounting.length, 10);
  assert.equal(exact.mapping.statementAccounting.filter((entry) => entry.occurrenceCount === 2).length, 1);
});

test("the Model Pack bridge preserves the mapping policy, audit, and RDF source identities", () => {
  const { data, shapes, report, policy, mapping } = mapped();
  const pack = buildRdfMappedModelPack(data, shapes, report, policy, {
    id: "w3c-person-company",
    name: "W3C Person and Company reference",
    version: "1.0.0",
    status: "reference"
  });
  const verified = verifyModelPack(pack);
  assert.equal(verified.manifest.statistics.nodeCount, 3);
  assert.equal(verified.manifest.statistics.edgeCount, 2);
  assert.equal(verified.manifest.source.auditHash, mapping.mappingHash);
  assert.deepEqual(verified.manifest.source.files, [
    { path: "rdf/data.nt", hash: data.source.hash },
    { path: "rdf/shapes.nt", hash: shapes.source.hash }
  ]);
  const dictionary = verified.files["model/dictionaries.json"].rdfMapping;
  assert.equal(dictionary.policy.policyHash, policy.policyHash);
  assert.equal(dictionary.audit.mappingHash, mapping.mappingHash);
  assert.equal(dictionary.audit.statementAccounting.length, data.statements.length);
});

test("mapping rejects non-conforming validation and policy/input drift", () => {
  const evidence = artifacts(DATA_LINES.filter((line) => !line.includes(`${EX}Acme> <${RDF}type`)));
  assert.equal(evidence.report.conforms, false);
  const policy = createRdfMappingPolicy(policyInput(evidence));
  rejected(
    () => mapRdfToOnto2D(evidence.data, evidence.shapes, evidence.report, policy),
    "RDF_MAPPING_VALIDATION_REJECTED"
  );

  const exact = mapped();
  const other = artifacts([...DATA_LINES, statement(iri(`${EX}Alice`), `${EX}nickname`, string("Al"))]);
  rejected(
    () => mapRdfToOnto2D(other.data, other.shapes, other.report, exact.policy),
    "RDF_MAPPING_INPUT_MISMATCH"
  );
});

test("unaccounted statements and mapped predicates without SHACL coverage fail closed", () => {
  const extra = artifacts([
    ...DATA_LINES,
    statement(iri(`${EX}Alice`), `${EX}nickname`, string("Al"))
  ]);
  const extraPolicy = createRdfMappingPolicy(policyInput(extra));
  rejected(
    () => mapRdfToOnto2D(extra.data, extra.shapes, extra.report, extraPolicy),
    "RDF_MAPPING_UNACCOUNTED_STATEMENT"
  );

  const knows = artifacts([
    ...DATA_LINES,
    statement(iri(`${EX}Alice`), `${EX}knows`, iri(`${EX}Bob`))
  ]);
  const rules = [
    ...policyInput(knows).predicateRules,
    {
      predicateIri: `${EX}knows`,
      action: "edge",
      sourceClasses: [`${EX}Person`],
      targetClasses: [`${EX}Person`],
      relationLayer: "external-reference",
      relationRole: "knows"
    }
  ];
  const knowsPolicy = createRdfMappingPolicy(policyInput(knows, rules));
  rejected(
    () => mapRdfToOnto2D(knows.data, knows.shapes, knows.report, knowsPolicy),
    "RDF_MAPPING_SHAPE_COVERAGE_MISSING"
  );
});

test("explicit multi-class selection, blank entities, and duplicate labels are rejected", () => {
  const ambiguous = artifacts([
    ...DATA_LINES,
    type(iri(`${EX}Alice`), `${EX}Company`)
  ]);
  const ambiguousPolicy = createRdfMappingPolicy(policyInput(ambiguous));
  rejected(
    () => mapRdfToOnto2D(ambiguous.data, ambiguous.shapes, ambiguous.report, ambiguousPolicy),
    "RDF_MAPPING_CLASS_AMBIGUOUS"
  );

  const blank = artifacts([
    ...DATA_LINES,
    type("_:anonymous", `${EX}Person`),
    statement("_:anonymous", `${RDFS}label`, string("Anonymous")),
    statement("_:anonymous", `${EX}worksFor`, iri(`${EX}Acme`))
  ]);
  const blankPolicy = createRdfMappingPolicy(policyInput(blank));
  rejected(
    () => mapRdfToOnto2D(blank.data, blank.shapes, blank.report, blankPolicy),
    "RDF_MAPPING_ENTITY_KIND_UNSUPPORTED"
  );

  const duplicateLabel = artifacts([
    ...DATA_LINES,
    statement(iri(`${EX}Alice`), `${RDFS}label`, string("A. Example"))
  ]);
  assert.equal(duplicateLabel.report.conforms, false);
});

test("policies and mapping artifacts reject tampering and accessor-bearing input", () => {
  const exact = mapped();
  assert.equal(verifyRdfMappingPolicy(exact.policy).policyHash, exact.policy.policyHash);
  const tamperedPolicy = structuredClone(exact.policy);
  tamperedPolicy.levelPolicy.value = 1;
  rejected(() => verifyRdfMappingPolicy(tamperedPolicy), "RDF_MAPPING_POLICY_MISMATCH");

  const tamperedArtifact = structuredClone(exact.mapping);
  tamperedArtifact.nodes[0].level = 1;
  rejected(
    () => verifyRdfMappingArtifact(
      exact.data,
      exact.shapes,
      exact.report,
      exact.policy,
      tamperedArtifact
    ),
    "RDF_MAPPING_ARTIFACT_MISMATCH"
  );

  const accessor = { ...policyInput(exact) };
  Object.defineProperty(accessor, "id", { enumerable: true, get: () => "unsafe" });
  rejected(() => createRdfMappingPolicy(accessor), "RDF_MAPPING_POLICY_INVALID");

  const unknownEdgeClass = policyInput(exact);
  unknownEdgeClass.predicateRules = unknownEdgeClass.predicateRules.map((rule) => (
    rule.action === "edge" ? { ...rule, sourceClasses: [`${EX}Unknown`] } : rule
  ));
  rejected(() => createRdfMappingPolicy(unknownEdgeClass), "RDF_MAPPING_POLICY_INVALID");
});

test("mapping policies and artifacts match their published JSON Schemas", async () => {
  const exact = mapped();
  const policySchema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/rdf-mapping-policy.schema.json", import.meta.url),
    "utf8"
  ));
  const artifactSchema = JSON.parse(await readFile(
    new URL("../../schemas/schemas/rdf-mapping-artifact.schema.json", import.meta.url),
    "utf8"
  ));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  assert.equal(ajv.compile(policySchema)(exact.policy), true);
  assert.equal(ajv.compile(artifactSchema)(exact.mapping), true);
});

test("the RDF mapping package has a browser-safe transitive module graph", async () => {
  const moduleMap = new Map([
    ["@onto2d/kernel/canonical", new URL("../../kernel/src/canonical-entry.js", import.meta.url)],
    ["@onto2d/model-pack", new URL("../../model-pack/src/index.js", import.meta.url)],
    ["@onto2d/rdf-import", new URL("../../rdf-import/src/index.js", import.meta.url)],
    ["@onto2d/shacl-validation", new URL("../../shacl-validation/src/index.js", import.meta.url)]
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
        assert.fail(`unexpected RDF mapping dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
});
