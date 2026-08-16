import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import {
  ALLOWED_SHACL_PREDICATES,
  DATATYPE_CONSTRAINTS,
  HASH_OPTIONS,
  IRI,
  NODE_KINDS,
  NS,
  PLAN_DOMAIN,
  SHACL_PLAN_FORMAT,
  SHACL_PLAN_FORMAT_VERSION,
  SHACL_VALIDATION_LIMITS,
  SHACL_VALIDATION_PROFILE_ID
} from "./constants.js";
import { assertPlainData, compareText } from "./data.js";
import { fail } from "./errors.js";
import { createGraphIndex } from "./graph.js";

const NODE_PREDICATES = new Set([
  IRI.TARGET_NODE,
  IRI.TARGET_CLASS,
  IRI.TARGET_SUBJECTS_OF,
  IRI.TARGET_OBJECTS_OF,
  IRI.PROPERTY,
  IRI.DATATYPE,
  IRI.NODE_KIND,
  IRI.CLASS,
  IRI.SEVERITY,
  IRI.MESSAGE,
  IRI.DEACTIVATED
]);

const PROPERTY_PREDICATES = new Set([
  IRI.PATH,
  IRI.MIN_COUNT,
  IRI.MAX_COUNT,
  IRI.DATATYPE,
  IRI.NODE_KIND,
  IRI.CLASS,
  IRI.SEVERITY,
  IRI.MESSAGE,
  IRI.DEACTIVATED
]);

function one(index, subjectId, predicate, path, required = false) {
  const values = index.objects(subjectId, predicate);
  if (values.length > 1 || (required && values.length !== 1)) {
    fail("SHACL_SHAPE_INVALID", `${path} must have ${required ? "exactly" : "at most"} one value.`, {
      path,
      count: values.length
    });
  }
  return values[0] ?? null;
}

function iriValue(index, subjectId, predicate, path, required = false) {
  const value = one(index, subjectId, predicate, path, required);
  if (value !== null && value.termType !== "iri") {
    fail("SHACL_SHAPE_INVALID", `${path} must be an IRI.`, { path });
  }
  return value;
}

function nonNegativeInteger(index, subjectId, predicate, path) {
  const value = one(index, subjectId, predicate, path);
  if (value === null) return null;
  if (
    value.termType !== "literal"
    || value.datatype !== IRI.XSD_INTEGER
    || value.language !== null
    || !/^(?:0|[1-9][0-9]*)$/.test(value.value)
  ) {
    fail("SHACL_SHAPE_INVALID", `${path} must be a canonical non-negative xsd:integer literal.`, {
      path
    });
  }
  const parsed = Number(value.value);
  if (!Number.isSafeInteger(parsed)) {
    fail("SHACL_SHAPE_INVALID", `${path} exceeds the supported integer range.`, { path });
  }
  return parsed;
}

function booleanValue(index, subjectId, path) {
  const value = one(index, subjectId, IRI.DEACTIVATED, path);
  if (value === null) return false;
  if (
    value.termType !== "literal"
    || value.datatype !== IRI.XSD_BOOLEAN
    || value.language !== null
    || (value.value !== "true" && value.value !== "false")
  ) {
    fail("SHACL_SHAPE_INVALID", `${path} must be an xsd:boolean true or false literal.`, { path });
  }
  return value.value === "true";
}

function messages(index, subjectId, path) {
  const values = index.objects(subjectId, IRI.MESSAGE);
  if (values.length > SHACL_VALIDATION_LIMITS.maxMessagesPerShape) {
    fail("SHACL_LIMIT_EXCEEDED", `${path} exceeds maxMessagesPerShape.`, { path });
  }
  const result = values.map((value) => {
    if (
      value.termType !== "literal"
      || (value.datatype !== IRI.XSD_STRING && value.datatype !== IRI.RDF_LANG_STRING)
    ) {
      fail("SHACL_SHAPE_INVALID", `${path} must contain string or language-string literals.`, {
        path
      });
    }
    return { value: value.value, language: value.language };
  });
  return result.sort((left, right) => (
    compareText(left.language ?? "", right.language ?? "") || compareText(left.value, right.value)
  ));
}

function common(index, subjectId, path) {
  const datatype = iriValue(index, subjectId, IRI.DATATYPE, `${path}.datatype`);
  const nodeKind = iriValue(index, subjectId, IRI.NODE_KIND, `${path}.nodeKind`);
  const classTerm = iriValue(index, subjectId, IRI.CLASS, `${path}.class`);
  if (datatype !== null && !DATATYPE_CONSTRAINTS.has(datatype.value)) {
    fail("SHACL_PROFILE_UNSUPPORTED", `${path}.datatype is outside the supported lexical profile.`, {
      path: `${path}.datatype`,
      datatype: datatype.value
    });
  }
  if (nodeKind !== null && !NODE_KINDS.has(nodeKind.value)) {
    fail("SHACL_PROFILE_UNSUPPORTED", `${path}.nodeKind is outside the supported SHACL Core set.`, {
      path: `${path}.nodeKind`,
      nodeKind: nodeKind.value
    });
  }
  const severity = iriValue(index, subjectId, IRI.SEVERITY, `${path}.severity`);
  return {
    constraints: {
      minCount: null,
      maxCount: null,
      datatype: datatype?.value ?? null,
      nodeKind: nodeKind?.value ?? null,
      class: classTerm?.value ?? null
    },
    severity: severity?.value ?? IRI.VIOLATION,
    messages: messages(index, subjectId, `${path}.messages`),
    deactivated: booleanValue(index, subjectId, `${path}.deactivated`)
  };
}

function assertShapePredicates(index, term, allowed, path) {
  for (const predicate of index.predicates(term.id)) {
    if (predicate !== IRI.RDF_TYPE && !allowed.has(predicate)) {
      fail(
        predicate.startsWith(NS.SH) ? "SHACL_PROFILE_UNSUPPORTED" : "SHACL_SHAPE_INVALID",
        `${path} uses a predicate outside the closed validation profile.`,
        { path, predicate }
      );
    }
  }
}

function shapeTypes(index) {
  const types = new Map();
  for (const statement of index.statements(IRI.RDF_TYPE)) {
    if (statement.object.termType !== "iri") continue;
    if (statement.object.value !== IRI.NODE_SHAPE && statement.object.value !== IRI.PROPERTY_SHAPE) continue;
    const current = types.get(statement.subject.id) ?? { term: statement.subject, kinds: new Set() };
    current.kinds.add(statement.object.value);
    types.set(statement.subject.id, current);
  }
  for (const [id, entry] of types) {
    const allTypes = index.objects(id, IRI.RDF_TYPE);
    if (entry.kinds.size !== 1 || allTypes.length !== 1) {
      fail("SHACL_SHAPE_INVALID", "Each supported shape must have exactly one explicit shape type.", {
        shapeId: id
      });
    }
  }
  return types;
}

function compileTargets(index, subjectId, path) {
  const targets = [];
  for (const term of index.objects(subjectId, IRI.TARGET_NODE)) {
    if (term.termType === "blank-node") {
      fail("SHACL_PROFILE_UNSUPPORTED", `${path}.targetNode cannot cross import-local blank-node scope.`, {
        path: `${path}.targetNode`
      });
    }
    targets.push({ kind: "node", term });
  }
  const iriTargets = [
    [IRI.TARGET_CLASS, "class", "class"],
    [IRI.TARGET_SUBJECTS_OF, "subjects-of", "predicate"],
    [IRI.TARGET_OBJECTS_OF, "objects-of", "predicate"]
  ];
  for (const [predicate, kind, field] of iriTargets) {
    for (const term of index.objects(subjectId, predicate)) {
      if (term.termType !== "iri") {
        fail("SHACL_SHAPE_INVALID", `${path}.${kind} target must be an IRI.`, { path });
      }
      targets.push({ kind, [field]: term.value });
    }
  }
  targets.sort((left, right) => compareText(canonicalize(left, HASH_OPTIONS), canonicalize(right, HASH_OPTIONS)));
  return targets;
}

function compileNodeShape(index, entry, shapeNumber) {
  const path = `nodeShapes[${shapeNumber}]`;
  assertShapePredicates(index, entry.term, NODE_PREDICATES, path);
  if (index.objects(entry.term.id, IRI.MIN_COUNT).length > 0 || index.objects(entry.term.id, IRI.MAX_COUNT).length > 0) {
    fail("SHACL_PROFILE_UNSUPPORTED", `${path} uses a property-only cardinality constraint.`, { path });
  }
  const commonFields = common(index, entry.term.id, path);
  const properties = index.objects(entry.term.id, IRI.PROPERTY);
  const propertyShapeIds = properties.map((term) => term.id).sort(compareText);
  return {
    id: entry.term.id,
    term: entry.term,
    targets: compileTargets(index, entry.term.id, path),
    propertyShapeIds,
    ...commonFields
  };
}

function compilePropertyShape(index, entry, shapeNumber) {
  const path = `propertyShapes[${shapeNumber}]`;
  assertShapePredicates(index, entry.term, PROPERTY_PREDICATES, path);
  const pathTerm = iriValue(index, entry.term.id, IRI.PATH, `${path}.path`, true);
  const commonFields = common(index, entry.term.id, path);
  commonFields.constraints.minCount = nonNegativeInteger(
    index,
    entry.term.id,
    IRI.MIN_COUNT,
    `${path}.minCount`
  );
  commonFields.constraints.maxCount = nonNegativeInteger(
    index,
    entry.term.id,
    IRI.MAX_COUNT,
    `${path}.maxCount`
  );
  if (
    commonFields.constraints.minCount !== null
    && commonFields.constraints.maxCount !== null
    && commonFields.constraints.minCount > commonFields.constraints.maxCount
  ) {
    fail("SHACL_SHAPE_INVALID", `${path} has minCount greater than maxCount.`, { path });
  }
  if (Object.values(commonFields.constraints).every((value) => value === null)) {
    fail("SHACL_SHAPE_INVALID", `${path} must declare at least one supported constraint.`, { path });
  }
  return {
    id: entry.term.id,
    term: entry.term,
    path: pathTerm,
    ...commonFields
  };
}

export function compileShaclShapes(shapesInput) {
  const index = createGraphIndex(shapesInput);
  for (const statement of index.artifact.statements) {
    if (statement.predicate.value.startsWith(NS.SH) && !ALLOWED_SHACL_PREDICATES.has(statement.predicate.value)) {
      fail("SHACL_PROFILE_UNSUPPORTED", "The shapes graph uses an unsupported SHACL predicate.", {
        predicate: statement.predicate.value,
        statementId: statement.id
      });
    }
  }

  const types = shapeTypes(index);
  for (const statement of index.artifact.statements) {
    if (ALLOWED_SHACL_PREDICATES.has(statement.predicate.value) && !types.has(statement.subject.id)) {
      fail("SHACL_SHAPE_INVALID", "Every supported shape must have an explicit sh:NodeShape or sh:PropertyShape type.", {
        subjectId: statement.subject.id,
        predicate: statement.predicate.value
      });
    }
  }

  const entries = [...types.values()].sort((left, right) => compareText(left.term.id, right.term.id));
  const nodeEntries = entries.filter((entry) => entry.kinds.has(IRI.NODE_SHAPE));
  const propertyEntries = entries.filter((entry) => entry.kinds.has(IRI.PROPERTY_SHAPE));
  if (nodeEntries.length > SHACL_VALIDATION_LIMITS.maxNodeShapes) {
    fail("SHACL_LIMIT_EXCEEDED", "The shapes graph exceeds maxNodeShapes.");
  }
  if (propertyEntries.length > SHACL_VALIDATION_LIMITS.maxPropertyShapes) {
    fail("SHACL_LIMIT_EXCEEDED", "The shapes graph exceeds maxPropertyShapes.");
  }

  const nodeShapes = nodeEntries.map((entry, indexValue) => compileNodeShape(index, entry, indexValue));
  const propertyShapes = propertyEntries.map((entry, indexValue) => (
    compilePropertyShape(index, entry, indexValue)
  ));
  const propertyById = new Map(propertyShapes.map((shape) => [shape.id, shape]));
  const referenced = new Set();
  let targetCount = 0;
  let propertyReferenceCount = 0;
  for (const shape of nodeShapes) {
    targetCount += shape.targets.length;
    propertyReferenceCount += shape.propertyShapeIds.length;
    for (const propertyShapeId of shape.propertyShapeIds) {
      if (!propertyById.has(propertyShapeId)) {
        fail("SHACL_SHAPE_INVALID", "sh:property must reference an explicit supported PropertyShape.", {
          shapeId: shape.id,
          propertyShapeId
        });
      }
      referenced.add(propertyShapeId);
    }
  }
  if (targetCount > SHACL_VALIDATION_LIMITS.maxTargets) {
    fail("SHACL_LIMIT_EXCEEDED", "The shapes graph exceeds maxTargets.", { targetCount });
  }
  if (propertyReferenceCount > SHACL_VALIDATION_LIMITS.maxPropertyReferences) {
    fail("SHACL_LIMIT_EXCEEDED", "The shapes graph exceeds maxPropertyReferences.", {
      propertyReferenceCount
    });
  }
  const unreferenced = propertyShapes.filter((shape) => !referenced.has(shape.id)).map((shape) => shape.id);
  if (unreferenced.length > 0) {
    fail("SHACL_SHAPE_INVALID", "Every PropertyShape must be referenced by a NodeShape.", { unreferenced });
  }

  const basis = {
    schemaVersion: "1",
    format: SHACL_PLAN_FORMAT,
    formatVersion: SHACL_PLAN_FORMAT_VERSION,
    profile: SHACL_VALIDATION_PROFILE_ID,
    shapesIdentity: index.identity,
    nodeShapes,
    propertyShapes,
    statistics: {
      nodeShapeCount: nodeShapes.length,
      propertyShapeCount: propertyShapes.length,
      targetCount,
      propertyReferenceCount,
      deactivatedShapeCount: [...nodeShapes, ...propertyShapes].filter((shape) => shape.deactivated).length
    }
  };
  return deepFreeze({
    ...basis,
    planHash: hashCanonical(PLAN_DOMAIN, basis, HASH_OPTIONS)
  });
}

export function verifyShaclPlan(shapesInput, planInput) {
  const actual = assertPlainData(planInput, "SHACL_PLAN_INVALID", "plan");
  const expected = compileShaclShapes(shapesInput);
  if (actual !== canonicalize(expected, HASH_OPTIONS)) {
    fail("SHACL_PLAN_MISMATCH", "The supplied SHACL plan does not match the exact shapes artifact.", {
      expectedPlanHash: expected.planHash
    });
  }
  return expected;
}
