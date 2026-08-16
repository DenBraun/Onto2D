import {
  canonicalize,
  deepFreeze,
  hashCanonical
} from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyRdfImportArtifact } from "@onto2d/rdf-import";
import {
  compileShaclShapes,
  verifyShaclValidationReport
} from "@onto2d/shacl-validation";
import {
  ARTIFACT_DOMAIN,
  EDGE_DOMAIN,
  HASH_OPTIONS,
  RDF_MAPPING_ARTIFACT_FORMAT,
  RDF_MAPPING_ARTIFACT_FORMAT_VERSION,
  RDF_MAPPING_LIMITS,
  RDF_MAPPING_PROFILE,
  RDF_MAPPING_PROFILE_ID,
  RDF_TYPE,
  SH_IRI,
  XSD_STRING
} from "./constants.js";
import { assertPlainData, compareText } from "./data.js";
import { fail } from "./errors.js";
import { verifyRdfMappingPolicy } from "./policy.js";

function artifactIdentity(artifact) {
  return {
    sourceHash: artifact.source.hash,
    graphHash: artifact.graphHash,
    importHash: artifact.importHash
  };
}

function assertBindings(data, shapes, report, policy) {
  const mismatches = [];
  if (policy.inputs.dataSourceId !== data.source.id) mismatches.push("dataSourceId");
  if (policy.inputs.shapesSourceId !== shapes.source.id) mismatches.push("shapesSourceId");
  if (policy.inputs.dataImportHash !== data.importHash) mismatches.push("dataImportHash");
  if (policy.inputs.shapesImportHash !== shapes.importHash) mismatches.push("shapesImportHash");
  if (policy.inputs.validationReportHash !== report.reportHash) {
    mismatches.push("validationReportHash");
  }
  if (mismatches.length > 0) {
    fail("RDF_MAPPING_INPUT_MISMATCH", "The mapping policy is not bound to the exact inputs.", {
      mismatches
    });
  }
  if (!report.conforms) {
    fail("RDF_MAPPING_VALIDATION_REJECTED", "A non-conforming SHACL report cannot authorize mapping.", {
      reportHash: report.reportHash,
      resultCount: report.statistics.resultCount
    });
  }
}

function assertShapeCoverage(shapes, policy) {
  const plan = compileShaclShapes(shapes);
  const propertyById = new Map(plan.propertyShapes.map((shape) => [shape.id, shape]));
  const coveredClasses = new Set();
  const propertyCoverage = new Map();
  for (const shape of plan.nodeShapes) {
    if (shape.deactivated) continue;
    const targetClasses = shape.targets
      .filter((target) => target.kind === "class")
      .map((target) => target.class);
    for (const target of shape.targets) {
      if (target.kind === "class") coveredClasses.add(target.class);
    }
    for (const propertyShapeId of shape.propertyShapeIds) {
      const propertyShape = propertyById.get(propertyShapeId);
      if (propertyShape && !propertyShape.deactivated) {
        for (const classIri of targetClasses) {
          if (!propertyCoverage.has(classIri)) propertyCoverage.set(classIri, new Map());
          const classCoverage = propertyCoverage.get(classIri);
          if (!classCoverage.has(propertyShape.path.value)) {
            classCoverage.set(propertyShape.path.value, []);
          }
          classCoverage.get(propertyShape.path.value).push(propertyShape);
        }
      }
    }
  }
  const missingClasses = policy.nodeRules
    .map((rule) => rule.classIri)
    .filter((classIri) => !coveredClasses.has(classIri));
  const missingPredicates = [];
  for (const rule of policy.predicateRules) {
    if (rule.action === "ignore") continue;
    const sourceClasses = rule.action === "label"
      ? policy.nodeRules.map((entry) => entry.classIri)
      : rule.sourceClasses;
    for (const classIri of sourceClasses) {
      const candidates = propertyCoverage.get(classIri)?.get(rule.predicateIri) ?? [];
      const covered = rule.action === "label"
        ? candidates.some((shape) => (
          shape.constraints.datatype === XSD_STRING
          && shape.constraints.maxCount === 1
          && (!rule.required || shape.constraints.minCount === 1)
        ))
        : candidates.some((shape) => (
          shape.constraints.nodeKind === SH_IRI
          && shape.constraints.class === rule.targetClasses[0]
        ));
      if (!covered) missingPredicates.push({ classIri, predicateIri: rule.predicateIri });
    }
  }
  if (missingClasses.length > 0 || missingPredicates.length > 0) {
    fail("RDF_MAPPING_SHAPE_COVERAGE_MISSING", "Mapped classes and predicates require active SHACL coverage.", {
      missingClasses,
      missingPredicates
    });
  }
  return plan;
}

function unaccounted(statement) {
  fail("RDF_MAPPING_UNACCOUNTED_STATEMENT", "Every RDF statement requires one explicit mapping disposition.", {
    statementId: statement.id,
    predicateIri: statement.predicate.value
  });
}

function requireSelectedEntity(term, entities, statement, role) {
  if (term.termType !== "iri" || !entities.has(term.value)) {
    fail("RDF_MAPPING_ENDPOINT_UNMAPPED", `The ${role} must be a selected IRI entity.`, {
      statementId: statement.id,
      role,
      termType: term.termType,
      value: term.value
    });
  }
  return entities.get(term.value);
}

function selectEntities(data, classRules) {
  const entities = new Map();
  for (const statement of data.statements) {
    if (statement.predicate.value !== RDF_TYPE) continue;
    if (statement.object.termType !== "iri") continue;
    const rule = classRules.get(statement.object.value);
    if (!rule) continue;
    if (statement.subject.termType !== "iri") {
      fail("RDF_MAPPING_ENTITY_KIND_UNSUPPORTED", "Mapped entities must be source IRIs.", {
        statementId: statement.id,
        termType: statement.subject.termType
      });
    }
    const existing = entities.get(statement.subject.value);
    if (existing && existing.rule.classIri !== rule.classIri) {
      fail("RDF_MAPPING_CLASS_AMBIGUOUS", "An entity matches more than one mapping class rule.", {
        entityIri: statement.subject.value,
        classes: [existing.rule.classIri, rule.classIri].sort(compareText)
      });
    }
    entities.set(statement.subject.value, {
      term: statement.subject,
      rule,
      classStatement: statement,
      labelStatement: null
    });
  }
  if (entities.size === 0) {
    fail("RDF_MAPPING_EMPTY", "The mapping policy selected no RDF entities.");
  }
  if (entities.size > RDF_MAPPING_LIMITS.maxNodes) {
    fail("RDF_MAPPING_LIMIT_EXCEEDED", "Mapped node count exceeds the profile limit.", {
      limit: "maxNodes",
      maximum: RDF_MAPPING_LIMITS.maxNodes,
      actual: entities.size
    });
  }
  return entities;
}

function mappingSemantics() {
  return {
    classSelection: RDF_MAPPING_PROFILE.classSelection,
    nodeIdentity: RDF_MAPPING_PROFILE.nodeIdentity,
    edgeDirection: RDF_MAPPING_PROFILE.edgeDirection,
    statementAccounting: RDF_MAPPING_PROFILE.statementAccounting,
    shapeCoverage: RDF_MAPPING_PROFILE.shapeCoverage,
    inference: false,
    dereferencing: false,
    blankNodeEntities: false,
    validatedOnly: true
  };
}

function executeMapping(dataInput, shapesInput, reportInput, policyInput) {
  const data = verifyRdfImportArtifact(dataInput);
  const shapes = verifyRdfImportArtifact(shapesInput);
  const report = verifyShaclValidationReport(data, shapes, reportInput);
  const policy = verifyRdfMappingPolicy(policyInput);
  assertBindings(data, shapes, report, policy);
  const plan = assertShapeCoverage(shapes, policy);
  const classRules = new Map(policy.nodeRules.map((rule) => [rule.classIri, rule]));
  const predicateRules = new Map(
    policy.predicateRules.map((rule) => [rule.predicateIri, rule])
  );
  const entities = selectEntities(data, classRules);
  const accounting = [];
  const ignoredStatements = [];
  const edges = [];
  let labelStatementCount = 0;

  if (data.statements.length > RDF_MAPPING_LIMITS.maxStatements) {
    fail("RDF_MAPPING_LIMIT_EXCEEDED", "RDF statement count exceeds the mapping limit.", {
      limit: "maxStatements",
      maximum: RDF_MAPPING_LIMITS.maxStatements,
      actual: data.statements.length
    });
  }

  for (const statement of data.statements) {
    const predicateIri = statement.predicate.value;
    if (predicateIri === RDF_TYPE) {
      if (
        statement.subject.termType !== "iri"
        || statement.object.termType !== "iri"
        || !classRules.has(statement.object.value)
        || !entities.has(statement.subject.value)
      ) {
        unaccounted(statement);
      }
      accounting.push({
        statementId: statement.id,
        predicateIri,
        occurrenceCount: statement.occurrences.length,
        disposition: "node-type",
        rule: `class:${statement.object.value}`,
        outputIds: [statement.subject.value]
      });
      continue;
    }

    const rule = predicateRules.get(predicateIri);
    if (!rule) unaccounted(statement);
    if (rule.action === "ignore") {
      ignoredStatements.push({
        statementId: statement.id,
        predicateIri,
        reason: rule.reason
      });
      accounting.push({
        statementId: statement.id,
        predicateIri,
        occurrenceCount: statement.occurrences.length,
        disposition: "ignored",
        rule: `predicate:${predicateIri}`,
        outputIds: []
      });
      continue;
    }

    const subject = requireSelectedEntity(statement.subject, entities, statement, "subject");
    if (rule.action === "label") {
      if (
        statement.object.termType !== "literal"
        || statement.object.datatype !== XSD_STRING
        || statement.object.language !== null
      ) {
        fail("RDF_MAPPING_LABEL_INVALID", "Mapped labels must be plain xsd:string literals.", {
          statementId: statement.id
        });
      }
      if (subject.labelStatement) {
        fail("RDF_MAPPING_LABEL_AMBIGUOUS", "A mapped entity has more than one label statement.", {
          entityIri: subject.term.value,
          statementIds: [subject.labelStatement.id, statement.id].sort(compareText)
        });
      }
      subject.labelStatement = statement;
      labelStatementCount += 1;
      accounting.push({
        statementId: statement.id,
        predicateIri,
        occurrenceCount: statement.occurrences.length,
        disposition: "node-label",
        rule: `predicate:${predicateIri}`,
        outputIds: [subject.term.value]
      });
      continue;
    }

    const target = requireSelectedEntity(statement.object, entities, statement, "object");
    if (
      !rule.sourceClasses.includes(subject.rule.classIri)
      || !rule.targetClasses.includes(target.rule.classIri)
    ) {
      fail("RDF_MAPPING_EDGE_CLASS_MISMATCH", "An edge violates its declared source or target class policy.", {
        statementId: statement.id,
        sourceClass: subject.rule.classIri,
        targetClass: target.rule.classIri,
        allowedSourceClasses: rule.sourceClasses,
        allowedTargetClasses: rule.targetClasses
      });
    }
    const edgeId = hashCanonical(EDGE_DOMAIN, {
      policyHash: policy.policyHash,
      statementId: statement.id
    }, HASH_OPTIONS);
    edges.push({
      id: edgeId,
      source: subject.term.value,
      target: target.term.value,
      relationLayer: rule.relationLayer,
      relationRole: rule.relationRole,
      rdfSource: {
        statementId: statement.id,
        predicateIri
      }
    });
    accounting.push({
      statementId: statement.id,
      predicateIri,
      occurrenceCount: statement.occurrences.length,
      disposition: "edge",
      rule: `predicate:${predicateIri}`,
      outputIds: [edgeId]
    });
  }

  if (edges.length > RDF_MAPPING_LIMITS.maxEdges) {
    fail("RDF_MAPPING_LIMIT_EXCEEDED", "Mapped edge count exceeds the profile limit.", {
      limit: "maxEdges",
      maximum: RDF_MAPPING_LIMITS.maxEdges,
      actual: edges.length
    });
  }

  const labelRule = policy.predicateRules.find((rule) => rule.action === "label");
  const nodes = [...entities.values()].map((entity) => {
    if (labelRule?.required && !entity.labelStatement) {
      fail("RDF_MAPPING_LABEL_REQUIRED", "Every selected entity requires one mapped label.", {
        entityIri: entity.term.value,
        predicateIri: labelRule.predicateIri
      });
    }
    const node = {
      id: entity.term.value,
      level: policy.levelPolicy.value,
      levelMeaning: policy.levelPolicy.meaning,
      typeRole: entity.rule.typeRole,
      scientificStatus: entity.rule.scientificStatus,
      rdfSource: {
        termId: entity.term.id,
        classIri: entity.rule.classIri,
        classStatementId: entity.classStatement.id,
        labelStatementId: entity.labelStatement?.id ?? null
      }
    };
    if (entity.labelStatement) node.label = entity.labelStatement.object.value;
    return node;
  }).sort((left, right) => compareText(left.id, right.id));

  edges.sort((left, right) => compareText(left.id, right.id));
  accounting.sort((left, right) => compareText(left.statementId, right.statementId));
  ignoredStatements.sort((left, right) => compareText(left.statementId, right.statementId));
  const basis = {
    schemaVersion: "1",
    format: RDF_MAPPING_ARTIFACT_FORMAT,
    formatVersion: RDF_MAPPING_ARTIFACT_FORMAT_VERSION,
    profile: RDF_MAPPING_PROFILE_ID,
    policyHash: policy.policyHash,
    inputs: {
      data: artifactIdentity(data),
      shapes: artifactIdentity(shapes),
      validation: {
        profile: report.profile,
        planHash: plan.planHash,
        reportHash: report.reportHash,
        conforms: true
      }
    },
    semantics: mappingSemantics(),
    nodes,
    edges,
    statementAccounting: accounting,
    ignoredStatements,
    statistics: {
      sourceStatementCount: data.statistics.sourceStatementCount,
      statementCount: data.statistics.statementCount,
      duplicateStatementCount: data.statistics.duplicateStatementCount,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      labelStatementCount,
      ignoredStatementCount: ignoredStatements.length
    }
  };
  return deepFreeze({
    data,
    shapes,
    policy,
    artifact: {
      ...basis,
      mappingHash: hashCanonical(ARTIFACT_DOMAIN, basis, HASH_OPTIONS)
    }
  });
}

export function mapRdfToOnto2D(data, shapes, report, policy) {
  return executeMapping(data, shapes, report, policy).artifact;
}

export function verifyRdfMappingArtifact(data, shapes, report, policy, artifactInput) {
  assertPlainData(artifactInput, "RDF_MAPPING_ARTIFACT_INVALID", "artifact");
  const expected = executeMapping(data, shapes, report, policy).artifact;
  if (canonicalize(artifactInput, HASH_OPTIONS) !== canonicalize(expected, HASH_OPTIONS)) {
    fail("RDF_MAPPING_ARTIFACT_MISMATCH", "The mapping artifact differs from exact replay.", {
      expectedMappingHash: expected.mappingHash
    });
  }
  return expected;
}

export function buildRdfMappedModelPack(data, shapes, report, policyInput, model) {
  assertPlainData(model, "RDF_MAPPING_MODEL_INVALID", "model");
  const {
    data: verifiedData,
    shapes: verifiedShapes,
    policy,
    artifact
  } = executeMapping(data, shapes, report, policyInput);
  const { nodes: _nodes, edges: _edges, ...mappingAudit } = artifact;
  return buildModelPack({
    model,
    source: {
      id: policy.id,
      files: [
        { path: "rdf/data.nt", hash: verifiedData.source.hash },
        { path: "rdf/shapes.nt", hash: verifiedShapes.source.hash }
      ],
      auditHash: artifact.mappingHash
    },
    nodes: artifact.nodes,
    edges: artifact.edges,
    dictionaries: {
      rdfMapping: {
        policy,
        audit: mappingAudit
      }
    }
  });
}
