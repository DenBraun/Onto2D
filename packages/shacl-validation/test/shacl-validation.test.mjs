import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { importNTriples } from "@onto2d/rdf-import";
import {
  SHACL_PLAN_FORMAT,
  SHACL_REPORT_FORMAT,
  SHACL_VALIDATION_LIMITS,
  SHACL_VALIDATION_PROFILE,
  ShaclValidationError,
  compileShaclShapes,
  validateShacl,
  validateShaclPlan,
  verifyShaclPlan,
  verifyShaclValidationReport
} from "../src/index.js";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SH = "http://www.w3.org/ns/shacl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const EX = "https://example.test/";
const iri = (value) => `<${value}>`;
const statement = (subject, predicate, object) => `${subject} ${iri(predicate)} ${object} .`;
const type = (subject, object) => statement(subject, `${RDF}type`, iri(object));
const integer = (value) => `"${value}"^^${iri(`${XSD}integer`)}`;
const boolean = (value) => `"${value}"^^${iri(`${XSD}boolean`)}`;
const string = (value) => `"${value}"`;

const DATA_SOURCE = [
  statement(iri(`${EX}Doctor`), `${RDFS}subClassOf`, iri(`${EX}Person`)),
  statement(iri(`${EX}Startup`), `${RDFS}subClassOf`, iri(`${EX}Company`)),
  type(iri(`${EX}alice`), `${EX}Doctor`),
  statement(iri(`${EX}alice`), `${EX}name`, string("Alice")),
  statement(iri(`${EX}alice`), `${EX}worksFor`, iri(`${EX}acme`)),
  type(iri(`${EX}bob`), `${EX}Person`),
  statement(iri(`${EX}bob`), `${EX}worksFor`, iri(`${EX}acme`)),
  type(iri(`${EX}carol`), `${EX}Person`),
  statement(iri(`${EX}carol`), `${EX}name`, string("Carol")),
  statement(iri(`${EX}carol`), `${EX}name`, integer(42)),
  statement(iri(`${EX}carol`), `${EX}worksFor`, string("nowhere")),
  type(iri(`${EX}acme`), `${EX}Startup`)
].join("\n");

const SHAPES_SOURCE = [
  type(iri(`${EX}PersonShape`), `${SH}NodeShape`),
  statement(iri(`${EX}PersonShape`), `${SH}targetClass`, iri(`${EX}Person`)),
  statement(iri(`${EX}PersonShape`), `${SH}targetNode`, iri(`${EX}alice`)),
  statement(iri(`${EX}PersonShape`), `${SH}property`, iri(`${EX}NameShape`)),
  statement(iri(`${EX}PersonShape`), `${SH}property`, iri(`${EX}EmployerShape`)),
  type(iri(`${EX}NameShape`), `${SH}PropertyShape`),
  statement(iri(`${EX}NameShape`), `${SH}path`, iri(`${EX}name`)),
  statement(iri(`${EX}NameShape`), `${SH}minCount`, integer(1)),
  statement(iri(`${EX}NameShape`), `${SH}maxCount`, integer(1)),
  statement(iri(`${EX}NameShape`), `${SH}datatype`, iri(`${XSD}string`)),
  statement(iri(`${EX}NameShape`), `${SH}severity`, iri(`${SH}Warning`)),
  statement(iri(`${EX}NameShape`), `${SH}message`, '"Exactly one name"@en'),
  type(iri(`${EX}EmployerShape`), `${SH}PropertyShape`),
  statement(iri(`${EX}EmployerShape`), `${SH}path`, iri(`${EX}worksFor`)),
  statement(iri(`${EX}EmployerShape`), `${SH}minCount`, integer(1)),
  statement(iri(`${EX}EmployerShape`), `${SH}maxCount`, integer(1)),
  statement(iri(`${EX}EmployerShape`), `${SH}nodeKind`, iri(`${SH}IRI`)),
  statement(iri(`${EX}EmployerShape`), `${SH}class`, iri(`${EX}Company`)),
  type(iri(`${EX}EmployerObjectShape`), `${SH}NodeShape`),
  statement(iri(`${EX}EmployerObjectShape`), `${SH}targetObjectsOf`, iri(`${EX}worksFor`)),
  statement(iri(`${EX}EmployerObjectShape`), `${SH}nodeKind`, iri(`${SH}IRI`)),
  type(iri(`${EX}EmployerSubjectShape`), `${SH}NodeShape`),
  statement(iri(`${EX}EmployerSubjectShape`), `${SH}targetSubjectsOf`, iri(`${EX}worksFor`)),
  statement(iri(`${EX}EmployerSubjectShape`), `${SH}nodeKind`, iri(`${SH}IRI`)),
  type(iri(`${EX}GhostShape`), `${SH}NodeShape`),
  statement(iri(`${EX}GhostShape`), `${SH}targetNode`, iri(`${EX}ghost`)),
  statement(iri(`${EX}GhostShape`), `${SH}class`, iri(`${EX}Person`)),
  type(iri(`${EX}DisabledShape`), `${SH}NodeShape`),
  statement(iri(`${EX}DisabledShape`), `${SH}targetNode`, iri(`${EX}ghost`)),
  statement(iri(`${EX}DisabledShape`), `${SH}nodeKind`, iri(`${SH}Literal`)),
  statement(iri(`${EX}DisabledShape`), `${SH}deactivated`, boolean("true"))
].join("\n");

function artifacts(dataSource = DATA_SOURCE, shapesSource = SHAPES_SOURCE) {
  return {
    data: importNTriples(dataSource, { sourceId: "people-data-v1" }),
    shapes: importNTriples(shapesSource, { sourceId: "people-shapes-v1" })
  };
}

function rejected(action, code) {
  assert.throws(action, (error) => error instanceof ShaclValidationError && error.code === code);
}

test("the closed SHACL Core profile compiles exact shapes into a hash-bound plan", () => {
  const { shapes } = artifacts();
  const plan = compileShaclShapes(shapes);
  assert.equal(plan.format, SHACL_PLAN_FORMAT);
  assert.equal(plan.shapesIdentity.importHash, shapes.importHash);
  assert.deepEqual(plan.statistics, {
    nodeShapeCount: 5,
    propertyShapeCount: 2,
    targetCount: 6,
    propertyReferenceCount: 2,
    deactivatedShapeCount: 1
  });
  assert.equal(verifyShaclPlan(shapes, plan).planHash, plan.planHash);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.nodeShapes[0]));
  assert.equal(SHACL_VALIDATION_PROFILE.standard, "SHACL 1.0 Core");
  assert.equal(SHACL_VALIDATION_PROFILE.semanticMapping, false);
});

test("validation covers all four target forms, property values, severities, and subclass closure", () => {
  const { data, shapes } = artifacts();
  const report = validateShacl(data, shapes);
  assert.equal(report.format, SHACL_REPORT_FORMAT);
  assert.equal(report.conforms, false);
  assert.equal(report.dataIdentity.importHash, data.importHash);
  assert.equal(report.shapesIdentity.importHash, shapes.importHash);
  assert.deepEqual(report.statistics, {
    evaluatedNodeShapeCount: 4,
    evaluatedFocusNodeCount: 6,
    resultCount: 7,
    violationCount: 4,
    warningCount: 3,
    infoCount: 0,
    otherSeverityCount: 0
  });
  assert.equal(report.results.filter((result) => result.focusNode.value === `${EX}alice`).length, 0);
  assert.equal(report.results.filter((result) => result.focusNode.value === `${EX}carol`).length, 4);
  assert.equal(report.results.filter((result) => result.focusNode.value === `${EX}bob`).length, 1);
  assert.equal(report.results.filter((result) => result.focusNode.value === `${EX}ghost`).length, 1);
  assert.equal(report.results.filter((result) => result.focusNode.value === "nowhere").length, 1);
  assert.equal(report.results.every((result) => result.id.startsWith("sha256:")), true);
  assert.equal(verifyShaclValidationReport(data, shapes, report).reportHash, report.reportHash);
  assert.ok(Object.isFrozen(report.results));
});

test("a warning-only result still makes the SHACL report non-conforming", () => {
  const data = importNTriples(type(iri(`${EX}bob`), `${EX}Person`), { sourceId: "warning-data" });
  const shapes = importNTriples([
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetClass`, iri(`${EX}Person`)),
    statement(iri(`${EX}Shape`), `${SH}property`, iri(`${EX}Property`)),
    type(iri(`${EX}Property`), `${SH}PropertyShape`),
    statement(iri(`${EX}Property`), `${SH}path`, iri(`${EX}name`)),
    statement(iri(`${EX}Property`), `${SH}minCount`, integer(1)),
    statement(iri(`${EX}Property`), `${SH}severity`, iri(`${SH}Warning`))
  ].join("\n"), { sourceId: "warning-shapes" });
  const report = validateShacl(data, shapes);
  assert.equal(report.statistics.resultCount, 1);
  assert.equal(report.statistics.warningCount, 1);
  assert.equal(report.conforms, false);
});

test("datatype validation checks lexical form and rejects datatypes outside the closed profile", () => {
  const data = importNTriples([
    type(iri(`${EX}alice`), `${EX}Person`),
    statement(iri(`${EX}alice`), `${EX}count`, `"not-an-integer"^^${iri(`${XSD}integer`)}`)
  ].join("\n"), { sourceId: "ill-typed-data" });
  const shapeLines = [
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
    statement(iri(`${EX}Shape`), `${SH}property`, iri(`${EX}Property`)),
    type(iri(`${EX}Property`), `${SH}PropertyShape`),
    statement(iri(`${EX}Property`), `${SH}path`, iri(`${EX}count`))
  ];
  const integerShapes = importNTriples([
    ...shapeLines,
    statement(iri(`${EX}Property`), `${SH}datatype`, iri(`${XSD}integer`))
  ].join("\n"), { sourceId: "integer-shapes" });
  const report = validateShacl(data, integerShapes);
  assert.equal(report.statistics.resultCount, 1);
  assert.equal(report.results[0].sourceConstraintComponent, `${SH}DatatypeConstraintComponent`);

  const dateShapes = importNTriples([
    ...shapeLines,
    statement(iri(`${EX}Property`), `${SH}datatype`, iri(`${XSD}dateTime`))
  ].join("\n"), { sourceId: "date-shapes" });
  rejected(() => compileShaclShapes(dateShapes), "SHACL_PROFILE_UNSUPPORTED");
});

test("class traversal is cycle-safe and fails closed on non-IRI subclass endpoints", () => {
  const cyclicData = importNTriples([
    statement(iri(`${EX}A`), `${RDFS}subClassOf`, iri(`${EX}B`)),
    statement(iri(`${EX}B`), `${RDFS}subClassOf`, iri(`${EX}A`)),
    type(iri(`${EX}alice`), `${EX}A`)
  ].join("\n"), { sourceId: "cyclic-classes" });
  const shapes = importNTriples([
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetClass`, iri(`${EX}B`)),
    statement(iri(`${EX}Shape`), `${SH}nodeKind`, iri(`${SH}IRI`))
  ].join("\n"), { sourceId: "class-shapes" });
  const report = validateShacl(cyclicData, shapes);
  assert.equal(report.conforms, true);
  assert.equal(report.statistics.evaluatedFocusNodeCount, 1);

  const unsupportedData = importNTriples([
    statement("_:A", `${RDFS}subClassOf`, iri(`${EX}B`)),
    type(iri(`${EX}alice`), `${EX}A`)
  ].join("\n"), { sourceId: "blank-class" });
  rejected(() => validateShacl(unsupportedData, shapes), "SHACL_PROFILE_UNSUPPORTED");
});

test("reusing a PropertyShape does not duplicate one content-identical result", () => {
  const data = importNTriples(type(iri(`${EX}alice`), `${EX}Person`), {
    sourceId: "shared-property-data"
  });
  const shapes = importNTriples([
    type(iri(`${EX}First`), `${SH}NodeShape`),
    statement(iri(`${EX}First`), `${SH}targetNode`, iri(`${EX}alice`)),
    statement(iri(`${EX}First`), `${SH}property`, iri(`${EX}Shared`)),
    type(iri(`${EX}Second`), `${SH}NodeShape`),
    statement(iri(`${EX}Second`), `${SH}targetNode`, iri(`${EX}alice`)),
    statement(iri(`${EX}Second`), `${SH}property`, iri(`${EX}Shared`)),
    type(iri(`${EX}Shared`), `${SH}PropertyShape`),
    statement(iri(`${EX}Shared`), `${SH}path`, iri(`${EX}name`)),
    statement(iri(`${EX}Shared`), `${SH}minCount`, integer(1))
  ].join("\n"), { sourceId: "shared-property-shapes" });
  const report = validateShacl(data, shapes);
  assert.equal(report.statistics.evaluatedNodeShapeCount, 2);
  assert.equal(report.statistics.resultCount, 1);
  assert.equal(new Set(report.results.map((result) => result.id)).size, 1);
});

test("a conforming report is deterministic and compiled plans replay exactly", () => {
  const data = importNTriples([
    type(iri(`${EX}alice`), `${EX}Person`),
    statement(iri(`${EX}alice`), `${EX}name`, string("Alice"))
  ].join("\n"), { sourceId: "conforming-data" });
  const shapes = importNTriples([
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetClass`, iri(`${EX}Person`)),
    statement(iri(`${EX}Shape`), `${SH}property`, iri(`${EX}Property`)),
    type(iri(`${EX}Property`), `${SH}PropertyShape`),
    statement(iri(`${EX}Property`), `${SH}path`, iri(`${EX}name`)),
    statement(iri(`${EX}Property`), `${SH}minCount`, integer(1)),
    statement(iri(`${EX}Property`), `${SH}datatype`, iri(`${XSD}string`))
  ].join("\n"), { sourceId: "conforming-shapes" });
  const plan = compileShaclShapes(shapes);
  const direct = validateShacl(data, shapes);
  const replayed = validateShaclPlan(data, shapes, plan);
  assert.equal(direct.conforms, true);
  assert.equal(direct.results.length, 0);
  assert.deepEqual(replayed, direct);
  assert.equal(validateShacl(data, shapes).reportHash, direct.reportHash);
});

test("the profile fails closed on unsupported and ambiguous shape constructs", () => {
  const invalidSources = [
    [
      type(iri(`${EX}Shape`), `${SH}NodeShape`),
      statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
      statement(iri(`${EX}Shape`), `${SH}sparql`, iri(`${EX}query`))
    ].join("\n"),
    [
      type(iri(`${EX}Shape`), `${SH}NodeShape`),
      statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
      statement(iri(`${EX}Shape`), `${SH}property`, iri(`${EX}Property`)),
      type(iri(`${EX}Property`), `${SH}PropertyShape`),
      statement(iri(`${EX}Property`), `${SH}path`, "_:complex"),
      statement(iri(`${EX}Property`), `${SH}minCount`, integer(1))
    ].join("\n")
  ];
  rejected(
    () => compileShaclShapes(importNTriples(invalidSources[0], { sourceId: "sparql" })),
    "SHACL_PROFILE_UNSUPPORTED"
  );
  rejected(
    () => compileShaclShapes(importNTriples(invalidSources[1], { sourceId: "complex-path" })),
    "SHACL_SHAPE_INVALID"
  );

  const implicit = importNTriples(
    statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
    { sourceId: "implicit-shape" }
  );
  rejected(() => compileShaclShapes(implicit), "SHACL_SHAPE_INVALID");

  const unreferenced = importNTriples([
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
    type(iri(`${EX}Property`), `${SH}PropertyShape`),
    statement(iri(`${EX}Property`), `${SH}path`, iri(`${EX}name`)),
    statement(iri(`${EX}Property`), `${SH}minCount`, integer(1))
  ].join("\n"), { sourceId: "unreferenced" });
  rejected(() => compileShaclShapes(unreferenced), "SHACL_SHAPE_INVALID");
});

test("canonical literals, shape multiplicity, and blank-node scope are enforced", () => {
  const base = [
    type(iri(`${EX}Shape`), `${SH}NodeShape`),
    statement(iri(`${EX}Shape`), `${SH}targetNode`, iri(`${EX}alice`)),
    statement(iri(`${EX}Shape`), `${SH}property`, iri(`${EX}Property`)),
    type(iri(`${EX}Property`), `${SH}PropertyShape`),
    statement(iri(`${EX}Property`), `${SH}path`, iri(`${EX}name`))
  ];
  const invalid = [
    [...base, statement(iri(`${EX}Property`), `${SH}minCount`, integer("01"))],
    [
      ...base,
      statement(iri(`${EX}Property`), `${SH}minCount`, integer(2)),
      statement(iri(`${EX}Property`), `${SH}maxCount`, integer(1))
    ],
    [
      ...base,
      statement(iri(`${EX}Property`), `${SH}minCount`, integer(1)),
      statement(iri(`${EX}Property`), `${SH}minCount`, integer(2))
    ],
    [
      type(iri(`${EX}Shape`), `${SH}NodeShape`),
      statement(iri(`${EX}Shape`), `${SH}targetNode`, "_:local")
    ]
  ];
  for (const [index, source] of invalid.entries()) {
    rejected(
      () => compileShaclShapes(importNTriples(source.join("\n"), { sourceId: `invalid-${index}` })),
      index === 3 ? "SHACL_PROFILE_UNSUPPORTED" : "SHACL_SHAPE_INVALID"
    );
  }
});

test("plans, reports, limits, and option objects are exact and accessor-safe", () => {
  const { data, shapes } = artifacts();
  const plan = compileShaclShapes(shapes);
  const report = validateShacl(data, shapes);

  const changedPlan = structuredClone(plan);
  changedPlan.statistics.targetCount += 1;
  rejected(() => verifyShaclPlan(shapes, changedPlan), "SHACL_PLAN_MISMATCH");
  rejected(() => validateShaclPlan(data, shapes, changedPlan), "SHACL_PLAN_MISMATCH");

  const changedReport = structuredClone(report);
  changedReport.conforms = true;
  rejected(
    () => verifyShaclValidationReport(data, shapes, changedReport),
    "SHACL_REPORT_MISMATCH"
  );
  const changedData = importNTriples(`${DATA_SOURCE}\n# exact source changed`, {
    sourceId: "people-data-v1"
  });
  assert.equal(changedData.graphHash, data.graphHash);
  rejected(
    () => verifyShaclValidationReport(changedData, shapes, report),
    "SHACL_REPORT_MISMATCH"
  );
  rejected(() => validateShacl(data, shapes, { maxResults: 1 }), "SHACL_RESULT_LIMIT_EXCEEDED");
  rejected(
    () => validateShacl(data, shapes, { maxResults: SHACL_VALIDATION_LIMITS.maxResults + 1 }),
    "SHACL_OPTIONS_INVALID"
  );

  let invoked = false;
  const unsafeOptions = {};
  Object.defineProperty(unsafeOptions, "maxResults", {
    enumerable: true,
    get() {
      invoked = true;
      return 1;
    }
  });
  rejected(() => validateShacl(data, shapes, unsafeOptions), "SHACL_OPTIONS_INVALID");
  assert.equal(invoked, false);

  const unsafePlan = structuredClone(plan);
  Object.defineProperty(unsafePlan, "hidden", { enumerable: false, value: true });
  rejected(() => verifyShaclPlan(shapes, unsafePlan), "SHACL_PLAN_INVALID");
});

test("plan and report satisfy their published schemas", async () => {
  const [planSchema, reportSchema] = await Promise.all([
    "shacl-validation-plan",
    "shacl-validation-report"
  ].map(async (name) => JSON.parse(await readFile(
    new URL(`../../schemas/schemas/${name}.schema.json`, import.meta.url),
    "utf8"
  ))));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validatePlan = ajv.compile(planSchema);
  const validateReport = ajv.compile(reportSchema);
  const { data, shapes } = artifacts();
  const plan = compileShaclShapes(shapes);
  const report = validateShaclPlan(data, shapes, plan);
  assert.equal(validatePlan(plan), true, JSON.stringify(validatePlan.errors));
  assert.equal(validateReport(report), true, JSON.stringify(validateReport.errors));
});

test("the SHACL validation package has a browser-safe transitive module graph", async () => {
  const moduleMap = new Map([
    ["@onto2d/kernel/canonical", new URL("../../kernel/src/canonical-entry.js", import.meta.url)],
    ["@onto2d/rdf-import", new URL("../../rdf-import/src/index.js", import.meta.url)]
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
        assert.fail(`unexpected SHACL validation dependency ${specifier} in ${moduleUrl.pathname}`);
      }
    }
  }
});
