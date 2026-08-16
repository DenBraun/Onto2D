import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import {
  HASH_OPTIONS,
  IRI,
  REPORT_DOMAIN,
  RESULT_DOMAIN,
  SHACL_REPORT_FORMAT,
  SHACL_REPORT_FORMAT_VERSION,
  SHACL_VALIDATION_LIMITS,
  SHACL_VALIDATION_PROFILE_ID
} from "./constants.js";
import { compileShaclShapes, verifyShaclPlan } from "./compile.js";
import { assertPlainData, compareText, exactObject } from "./data.js";
import { fail } from "./errors.js";
import { createGraphIndex } from "./graph.js";

const OPTION_FIELDS = new Set(["maxResults"]);

function options(value) {
  if (value === undefined) return { maxResults: SHACL_VALIDATION_LIMITS.maxResults };
  const entries = exactObject(value, OPTION_FIELDS, "options", "SHACL_OPTIONS_INVALID", new Set());
  const maxResults = entries.has("maxResults")
    ? entries.get("maxResults")
    : SHACL_VALIDATION_LIMITS.maxResults;
  if (
    !Number.isSafeInteger(maxResults)
    || maxResults < 1
    || maxResults > SHACL_VALIDATION_LIMITS.maxResults
  ) {
    fail("SHACL_OPTIONS_INVALID", "options.maxResults is outside the supported range.", {
      maximum: SHACL_VALIDATION_LIMITS.maxResults
    });
  }
  return { maxResults };
}

function createClassMatcher(index) {
  const superclasses = new Map();
  let invalidSubclassStatementId = null;
  for (const statement of index.statements(IRI.RDFS_SUBCLASS)) {
    if (statement.subject.termType !== "iri" || statement.object.termType !== "iri") {
      invalidSubclassStatementId ??= statement.id;
      continue;
    }
    const values = superclasses.get(statement.subject.value) ?? new Set();
    values.add(statement.object.value);
    superclasses.set(statement.subject.value, values);
  }
  const cache = new Map();
  let visits = 0;

  function isSubclass(type, expected) {
    const key = `${type}\u0000${expected}`;
    if (cache.has(key)) return cache.get(key);
    const pending = [type];
    const seen = new Set();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === expected) {
        cache.set(key, true);
        return true;
      }
      if (seen.has(current)) continue;
      seen.add(current);
      visits += 1;
      if (visits > SHACL_VALIDATION_LIMITS.maxSubclassVisits) {
        fail("SHACL_LIMIT_EXCEEDED", "Class traversal exceeds maxSubclassVisits.", {
          maximum: SHACL_VALIDATION_LIMITS.maxSubclassVisits
        });
      }
      for (const parent of superclasses.get(current) ?? []) pending.push(parent);
    }
    cache.set(key, false);
    return false;
  }

  return function isInstance(term, expectedClass) {
    if (term.termType === "literal") return false;
    if (invalidSubclassStatementId !== null) {
      fail("SHACL_PROFILE_UNSUPPORTED", "Class traversal requires IRI rdfs:subClassOf endpoints.", {
        statementId: invalidSubclassStatementId
      });
    }
    return index.objects(term.id, IRI.RDF_TYPE).some((type) => {
      if (type.termType !== "iri") {
        fail("SHACL_PROFILE_UNSUPPORTED", "Class traversal requires IRI rdf:type objects.", {
          termId: term.id,
          typeId: type.id
        });
      }
      return isSubclass(type.value, expectedClass);
    });
  };
}

function matchesNodeKind(term, nodeKind) {
  if (nodeKind === IRI.BLANK_NODE) return term.termType === "blank-node";
  if (nodeKind === IRI.IRI) return term.termType === "iri";
  if (nodeKind === IRI.LITERAL) return term.termType === "literal";
  if (nodeKind === IRI.BLANK_NODE_OR_IRI) return term.termType !== "literal";
  if (nodeKind === IRI.BLANK_NODE_OR_LITERAL) return term.termType !== "iri";
  if (nodeKind === IRI.IRI_OR_LITERAL) return term.termType !== "blank-node";
  return false;
}

function consume(budget, field, amount, maximum) {
  budget[field] += amount;
  if (budget[field] > maximum) {
    fail("SHACL_LIMIT_EXCEEDED", `Validation exceeds ${field}.`, { maximum });
  }
}

function targetNodes(shape, index, isInstance, targetCache, budget) {
  const focus = new Map();
  for (const target of shape.targets) {
    if (target.kind === "node") {
      focus.set(target.term.id, target.term);
    } else if (target.kind === "class") {
      let terms = targetCache.classes.get(target.class);
      if (terms === undefined) {
        const statements = index.statements(IRI.RDF_TYPE);
        consume(
          budget,
          "targetStatementScans",
          statements.length,
          SHACL_VALIDATION_LIMITS.maxTargetStatementScans
        );
        const matched = new Map();
        for (const statement of statements) {
          if (isInstance(statement.subject, target.class)) {
            matched.set(statement.subject.id, statement.subject);
          }
        }
        terms = [...matched.values()].sort((left, right) => compareText(left.id, right.id));
        targetCache.classes.set(target.class, terms);
      }
      for (const term of terms) focus.set(term.id, term);
    } else if (target.kind === "subjects-of") {
      let terms = targetCache.subjects.get(target.predicate);
      if (terms === undefined) {
        const statements = index.statements(target.predicate);
        consume(
          budget,
          "targetStatementScans",
          statements.length,
          SHACL_VALIDATION_LIMITS.maxTargetStatementScans
        );
        const matched = new Map(statements.map((statement) => [statement.subject.id, statement.subject]));
        terms = [...matched.values()].sort((left, right) => compareText(left.id, right.id));
        targetCache.subjects.set(target.predicate, terms);
      }
      for (const term of terms) focus.set(term.id, term);
    } else if (target.kind === "objects-of") {
      let terms = targetCache.objects.get(target.predicate);
      if (terms === undefined) {
        const statements = index.statements(target.predicate);
        consume(
          budget,
          "targetStatementScans",
          statements.length,
          SHACL_VALIDATION_LIMITS.maxTargetStatementScans
        );
        const matched = new Map(statements.map((statement) => [statement.object.id, statement.object]));
        terms = [...matched.values()].sort((left, right) => compareText(left.id, right.id));
        targetCache.objects.set(target.predicate, terms);
      }
      for (const term of terms) focus.set(term.id, term);
    }
  }
  return [...focus.values()].sort((left, right) => compareText(left.id, right.id));
}

function createResult(focusNode, resultPath, value, sourceShape, component, severity, messages) {
  const basis = {
    focusNode,
    resultPath,
    value,
    sourceShape,
    sourceConstraintComponent: component,
    severity,
    messages
  };
  return {
    id: hashCanonical(RESULT_DOMAIN, basis, HASH_OPTIONS),
    ...basis
  };
}

function emit(results, maximum, result) {
  if (results.has(result.id)) return;
  if (results.size >= maximum) {
    fail("SHACL_RESULT_LIMIT_EXCEEDED", "Validation exceeds options.maxResults; no partial report was returned.", {
      maximum
    });
  }
  results.set(result.id, result);
}

function wellTypedLiteral(term, datatype) {
  if (term.termType !== "literal" || term.datatype !== datatype) return false;
  if (datatype === IRI.XSD_STRING) return term.language === null;
  if (datatype === IRI.RDF_LANG_STRING) return term.language !== null;
  if (datatype === IRI.XSD_BOOLEAN) return /^(?:true|false|0|1)$/.test(term.value);
  if (datatype === IRI.XSD_INTEGER) return /^[+-]?[0-9]+$/.test(term.value);
  if (datatype === "http://www.w3.org/2001/XMLSchema#decimal") {
    return /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(term.value);
  }
  if (
    datatype === "http://www.w3.org/2001/XMLSchema#float"
    || datatype === "http://www.w3.org/2001/XMLSchema#double"
  ) {
    return /^(?:[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|INF|-INF|NaN)$/.test(term.value);
  }
  return false;
}

function evaluateValueConstraints(context, shape, focusNode, path, values) {
  const { results, maximum, isInstance, budget } = context;
  const { constraints } = shape;
  const add = (value, component) => emit(
    results,
    maximum,
    createResult(focusNode, path, value, shape.term, component, shape.severity, shape.messages)
  );

  if (constraints.minCount !== null && values.length < constraints.minCount) {
    add(null, IRI.MIN_COUNT_COMPONENT);
  }
  if (constraints.maxCount !== null && values.length > constraints.maxCount) {
    add(null, IRI.MAX_COUNT_COMPONENT);
  }
  if (constraints.datatype !== null) {
    consume(budget, "valueChecks", values.length, SHACL_VALIDATION_LIMITS.maxValueChecks);
    for (const value of values) {
      if (!wellTypedLiteral(value, constraints.datatype)) {
        add(value, IRI.DATATYPE_COMPONENT);
      }
    }
  }
  if (constraints.nodeKind !== null) {
    consume(budget, "valueChecks", values.length, SHACL_VALIDATION_LIMITS.maxValueChecks);
    for (const value of values) {
      if (!matchesNodeKind(value, constraints.nodeKind)) add(value, IRI.NODE_KIND_COMPONENT);
    }
  }
  if (constraints.class !== null) {
    consume(budget, "valueChecks", values.length, SHACL_VALIDATION_LIMITS.maxValueChecks);
    for (const value of values) {
      if (!isInstance(value, constraints.class)) add(value, IRI.CLASS_COMPONENT);
    }
  }
}

function execute(dataInput, plan, suppliedOptions) {
  const normalizedOptions = options(suppliedOptions);
  const index = createGraphIndex(dataInput);
  const isInstance = createClassMatcher(index);
  const propertyById = new Map(plan.propertyShapes.map((shape) => [shape.id, shape]));
  const resultMap = new Map();
  const evaluatedFocus = new Set();
  const budget = { targetStatementScans: 0, shapeEvaluations: 0, valueChecks: 0 };
  const targetCache = { classes: new Map(), subjects: new Map(), objects: new Map() };
  let evaluatedNodeShapeCount = 0;
  const context = {
    results: resultMap,
    maximum: normalizedOptions.maxResults,
    isInstance,
    budget
  };

  for (const nodeShape of plan.nodeShapes) {
    if (nodeShape.deactivated) continue;
    evaluatedNodeShapeCount += 1;
    const focusNodes = targetNodes(nodeShape, index, isInstance, targetCache, budget);
    for (const focusNode of focusNodes) {
      consume(budget, "shapeEvaluations", 1, SHACL_VALIDATION_LIMITS.maxShapeEvaluations);
      evaluatedFocus.add(focusNode.id);
      evaluateValueConstraints(context, nodeShape, focusNode, null, [focusNode]);
      for (const propertyShapeId of nodeShape.propertyShapeIds) {
        const propertyShape = propertyById.get(propertyShapeId);
        if (propertyShape.deactivated) continue;
        consume(budget, "shapeEvaluations", 1, SHACL_VALIDATION_LIMITS.maxShapeEvaluations);
        const values = focusNode.termType === "literal"
          ? []
          : index.objects(focusNode.id, propertyShape.path.value);
        evaluateValueConstraints(
          context,
          propertyShape,
          focusNode,
          propertyShape.path,
          values
        );
      }
    }
  }

  const results = [...resultMap.values()].sort((left, right) => compareText(left.id, right.id));
  const violationCount = results.filter((result) => result.severity === IRI.VIOLATION).length;
  const warningCount = results.filter((result) => result.severity === IRI.WARNING).length;
  const infoCount = results.filter((result) => result.severity === IRI.INFO).length;
  const basis = {
    schemaVersion: "1",
    format: SHACL_REPORT_FORMAT,
    formatVersion: SHACL_REPORT_FORMAT_VERSION,
    profile: SHACL_VALIDATION_PROFILE_ID,
    dataIdentity: index.identity,
    shapesIdentity: plan.shapesIdentity,
    planHash: plan.planHash,
    conforms: results.length === 0,
    results,
    statistics: {
      evaluatedNodeShapeCount,
      evaluatedFocusNodeCount: evaluatedFocus.size,
      resultCount: results.length,
      violationCount,
      warningCount,
      infoCount,
      otherSeverityCount: results.length - violationCount - warningCount - infoCount
    }
  };
  return deepFreeze({
    ...basis,
    reportHash: hashCanonical(REPORT_DOMAIN, basis, HASH_OPTIONS)
  });
}

export function validateShacl(dataInput, shapesInput, suppliedOptions) {
  return execute(dataInput, compileShaclShapes(shapesInput), suppliedOptions);
}

export function validateShaclPlan(dataInput, shapesInput, planInput, suppliedOptions) {
  return execute(dataInput, verifyShaclPlan(shapesInput, planInput), suppliedOptions);
}

export function verifyShaclValidationReport(dataInput, shapesInput, reportInput) {
  const actual = assertPlainData(reportInput, "SHACL_REPORT_INVALID", "report");
  const expected = validateShacl(dataInput, shapesInput);
  if (actual !== canonicalize(expected, HASH_OPTIONS)) {
    fail("SHACL_REPORT_MISMATCH", "The supplied SHACL report does not match the exact data and shapes artifacts.", {
      expectedReportHash: expected.reportHash
    });
  }
  return expected;
}
