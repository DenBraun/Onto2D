import {
  canonicalize,
  deepFreeze,
  hashCanonical
} from "@onto2d/kernel/canonical";
import {
  HASH_OPTIONS,
  POLICY_DOMAIN,
  RDF_MAPPING_LIMITS,
  RDF_MAPPING_POLICY_FORMAT,
  RDF_MAPPING_POLICY_FORMAT_VERSION,
  RDF_MAPPING_PROFILE_ID,
  RDF_TYPE
} from "./constants.js";
import {
  absoluteIri,
  assertPlainData,
  boundedArray,
  boundedString,
  compareText,
  contentHash,
  exactObject,
  identifier,
  nonNegativeInteger
} from "./data.js";
import { fail } from "./errors.js";

const CREATE_FIELDS = new Set([
  "schemaVersion",
  "format",
  "formatVersion",
  "profile",
  "id",
  "provenance",
  "inputs",
  "levelPolicy",
  "nodeRules",
  "predicateRules"
]);
const VERIFIED_FIELDS = new Set([...CREATE_FIELDS, "policyHash"]);
const INPUT_FIELDS = new Set([
  "dataSourceId",
  "shapesSourceId",
  "dataImportHash",
  "shapesImportHash",
  "validationReportHash"
]);
const PROVENANCE_FIELDS = new Set([
  "title",
  "sourceUri",
  "sourceVersion",
  "licenseUri",
  "adaptation"
]);
const LEVEL_FIELDS = new Set(["kind", "value", "meaning"]);
const NODE_RULE_FIELDS = new Set(["classIri", "typeRole", "scientificStatus"]);
const LABEL_RULE_FIELDS = new Set(["predicateIri", "action", "required"]);
const EDGE_RULE_FIELDS = new Set([
  "predicateIri",
  "action",
  "sourceClasses",
  "targetClasses",
  "relationLayer",
  "relationRole"
]);
const IGNORE_RULE_FIELDS = new Set(["predicateIri", "action", "reason"]);

function literal(value, expected, path) {
  if (value !== expected) {
    fail("RDF_MAPPING_POLICY_INVALID", `${path} must equal ${expected}.`, { path, expected });
  }
  return value;
}

function normalizeInputs(value) {
  const fields = exactObject(value, INPUT_FIELDS, "policy.inputs", "RDF_MAPPING_POLICY_INVALID");
  return {
    dataSourceId: identifier(
      fields.get("dataSourceId"),
      "policy.inputs.dataSourceId",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    shapesSourceId: identifier(
      fields.get("shapesSourceId"),
      "policy.inputs.shapesSourceId",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    dataImportHash: contentHash(
      fields.get("dataImportHash"),
      "policy.inputs.dataImportHash",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    shapesImportHash: contentHash(
      fields.get("shapesImportHash"),
      "policy.inputs.shapesImportHash",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    validationReportHash: contentHash(
      fields.get("validationReportHash"),
      "policy.inputs.validationReportHash",
      "RDF_MAPPING_POLICY_INVALID"
    )
  };
}

function normalizeProvenance(value) {
  const fields = exactObject(
    value,
    PROVENANCE_FIELDS,
    "policy.provenance",
    "RDF_MAPPING_POLICY_INVALID"
  );
  return {
    title: boundedString(
      fields.get("title"),
      "policy.provenance.title",
      "RDF_MAPPING_POLICY_INVALID",
      1_024
    ),
    sourceUri: absoluteIri(
      fields.get("sourceUri"),
      "policy.provenance.sourceUri",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    sourceVersion: boundedString(
      fields.get("sourceVersion"),
      "policy.provenance.sourceVersion",
      "RDF_MAPPING_POLICY_INVALID",
      1_024
    ),
    licenseUri: absoluteIri(
      fields.get("licenseUri"),
      "policy.provenance.licenseUri",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    adaptation: boundedString(
      fields.get("adaptation"),
      "policy.provenance.adaptation",
      "RDF_MAPPING_POLICY_INVALID",
      4_096
    )
  };
}

function normalizeLevelPolicy(value) {
  const fields = exactObject(
    value,
    LEVEL_FIELDS,
    "policy.levelPolicy",
    "RDF_MAPPING_POLICY_INVALID"
  );
  return {
    kind: literal(fields.get("kind"), "constant", "policy.levelPolicy.kind"),
    value: nonNegativeInteger(
      fields.get("value"),
      "policy.levelPolicy.value",
      "RDF_MAPPING_POLICY_INVALID"
    ),
    meaning: boundedString(
      fields.get("meaning"),
      "policy.levelPolicy.meaning",
      "RDF_MAPPING_POLICY_INVALID",
      1_024
    )
  };
}

function normalizeNodeRules(value) {
  const rules = boundedArray(
    value,
    "policy.nodeRules",
    RDF_MAPPING_LIMITS.maxNodeRules,
    "RDF_MAPPING_POLICY_INVALID"
  ).map((rule, index) => {
    const path = `policy.nodeRules[${index}]`;
    const fields = exactObject(rule, NODE_RULE_FIELDS, path, "RDF_MAPPING_POLICY_INVALID");
    return {
      classIri: absoluteIri(
        fields.get("classIri"),
        `${path}.classIri`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      typeRole: identifier(
        fields.get("typeRole"),
        `${path}.typeRole`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      scientificStatus: identifier(
        fields.get("scientificStatus"),
        `${path}.scientificStatus`,
        "RDF_MAPPING_POLICY_INVALID"
      )
    };
  }).sort((left, right) => compareText(left.classIri, right.classIri));
  const classIris = new Set();
  for (const rule of rules) {
    if (classIris.has(rule.classIri)) {
      fail("RDF_MAPPING_POLICY_DUPLICATE_RULE", "Node class rules must be unique.", {
        classIri: rule.classIri
      });
    }
    classIris.add(rule.classIri);
  }
  return rules;
}

function normalizeClassList(value, path) {
  const classes = boundedArray(
    value,
    path,
    RDF_MAPPING_LIMITS.maxNodeRules,
    "RDF_MAPPING_POLICY_INVALID"
  ).map((classIri, index) => absoluteIri(
    classIri,
    `${path}[${index}]`,
    "RDF_MAPPING_POLICY_INVALID"
  )).sort(compareText);
  if (new Set(classes).size !== classes.length) {
    fail("RDF_MAPPING_POLICY_DUPLICATE_RULE", `${path} must contain unique class IRIs.`, { path });
  }
  return classes;
}

function normalizePredicateRule(rule, index) {
  const path = `policy.predicateRules[${index}]`;
  assertPlainData(rule, "RDF_MAPPING_POLICY_INVALID", path);
  const action = rule.action;
  let fields;
  if (action === "label") {
    fields = exactObject(rule, LABEL_RULE_FIELDS, path, "RDF_MAPPING_POLICY_INVALID");
    if (typeof fields.get("required") !== "boolean") {
      fail("RDF_MAPPING_POLICY_INVALID", `${path}.required must be boolean.`, { path });
    }
    return {
      predicateIri: absoluteIri(
        fields.get("predicateIri"),
        `${path}.predicateIri`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      action,
      required: fields.get("required")
    };
  }
  if (action === "edge") {
    fields = exactObject(rule, EDGE_RULE_FIELDS, path, "RDF_MAPPING_POLICY_INVALID");
    return {
      predicateIri: absoluteIri(
        fields.get("predicateIri"),
        `${path}.predicateIri`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      action,
      sourceClasses: normalizeClassList(fields.get("sourceClasses"), `${path}.sourceClasses`),
      targetClasses: normalizeClassList(fields.get("targetClasses"), `${path}.targetClasses`),
      relationLayer: identifier(
        fields.get("relationLayer"),
        `${path}.relationLayer`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      relationRole: identifier(
        fields.get("relationRole"),
        `${path}.relationRole`,
        "RDF_MAPPING_POLICY_INVALID"
      )
    };
  }
  if (action === "ignore") {
    fields = exactObject(rule, IGNORE_RULE_FIELDS, path, "RDF_MAPPING_POLICY_INVALID");
    return {
      predicateIri: absoluteIri(
        fields.get("predicateIri"),
        `${path}.predicateIri`,
        "RDF_MAPPING_POLICY_INVALID"
      ),
      action,
      reason: boundedString(
        fields.get("reason"),
        `${path}.reason`,
        "RDF_MAPPING_POLICY_INVALID",
        1_024
      )
    };
  }
  fail("RDF_MAPPING_POLICY_INVALID", `${path}.action is not supported.`, { path, action });
}

function normalizePredicateRules(value, nodeRules) {
  const rules = boundedArray(
    value,
    "policy.predicateRules",
    RDF_MAPPING_LIMITS.maxPredicateRules,
    "RDF_MAPPING_POLICY_INVALID",
    true
  ).map(normalizePredicateRule)
    .sort((left, right) => compareText(left.predicateIri, right.predicateIri));
  const predicates = new Set();
  let labelCount = 0;
  for (const rule of rules) {
    if (rule.predicateIri === RDF_TYPE) {
      fail("RDF_MAPPING_POLICY_INVALID", "rdf:type is reserved for explicit node class selection.", {
        predicateIri: rule.predicateIri
      });
    }
    if (predicates.has(rule.predicateIri)) {
      fail("RDF_MAPPING_POLICY_DUPLICATE_RULE", "Predicate rules must be unique.", {
        predicateIri: rule.predicateIri
      });
    }
    predicates.add(rule.predicateIri);
    if (rule.action === "label") labelCount += 1;
  }
  if (labelCount > 1) {
    fail("RDF_MAPPING_POLICY_AMBIGUOUS", "This profile permits at most one label predicate.");
  }
  const mappedClasses = new Set(nodeRules.map((rule) => rule.classIri));
  for (const rule of rules) {
    if (rule.action !== "edge") continue;
    const unknownClasses = [...rule.sourceClasses, ...rule.targetClasses]
      .filter((classIri) => !mappedClasses.has(classIri));
    if (unknownClasses.length > 0) {
      fail("RDF_MAPPING_POLICY_INVALID", "Edge class policy must reference mapped node classes.", {
        predicateIri: rule.predicateIri,
        unknownClasses: [...new Set(unknownClasses)].sort(compareText)
      });
    }
    if (rule.targetClasses.length !== 1) {
      fail("RDF_MAPPING_POLICY_AMBIGUOUS", "This profile requires exactly one edge target class.", {
        predicateIri: rule.predicateIri
      });
    }
  }
  return rules;
}

function normalizeBasis(input, fields) {
  assertPlainData(input, "RDF_MAPPING_POLICY_INVALID", "policy");
  const entries = exactObject(input, fields, "policy", "RDF_MAPPING_POLICY_INVALID");
  const nodeRules = normalizeNodeRules(entries.get("nodeRules"));
  return {
    schemaVersion: literal(entries.get("schemaVersion"), "1", "policy.schemaVersion"),
    format: literal(entries.get("format"), RDF_MAPPING_POLICY_FORMAT, "policy.format"),
    formatVersion: literal(
      entries.get("formatVersion"),
      RDF_MAPPING_POLICY_FORMAT_VERSION,
      "policy.formatVersion"
    ),
    profile: literal(entries.get("profile"), RDF_MAPPING_PROFILE_ID, "policy.profile"),
    id: identifier(entries.get("id"), "policy.id", "RDF_MAPPING_POLICY_INVALID"),
    provenance: normalizeProvenance(entries.get("provenance")),
    inputs: normalizeInputs(entries.get("inputs")),
    levelPolicy: normalizeLevelPolicy(entries.get("levelPolicy")),
    nodeRules,
    predicateRules: normalizePredicateRules(entries.get("predicateRules"), nodeRules)
  };
}

export function createRdfMappingPolicy(input) {
  const basis = normalizeBasis(input, CREATE_FIELDS);
  return deepFreeze({
    ...basis,
    policyHash: hashCanonical(POLICY_DOMAIN, basis, HASH_OPTIONS)
  });
}

export function verifyRdfMappingPolicy(input) {
  const basis = normalizeBasis(input, VERIFIED_FIELDS);
  const expected = deepFreeze({
    ...basis,
    policyHash: hashCanonical(POLICY_DOMAIN, basis, HASH_OPTIONS)
  });
  if (canonicalize(input, HASH_OPTIONS) !== canonicalize(expected, HASH_OPTIONS)) {
    fail("RDF_MAPPING_POLICY_MISMATCH", "The mapping policy differs from canonical reconstruction.", {
      expectedPolicyHash: expected.policyHash
    });
  }
  return expected;
}
