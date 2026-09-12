import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";
import { auditSourceCatalogue, loadSourceCatalogue } from "../packages/catalog-adapter/src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const array = (value) => Array.isArray(value) ? value : [];
const present = (value) => typeof value === "string" && value.trim().length > 0;
const histogram = (values) => values.reduce((result, value) => {
  result[value] = (result[value] ?? 0) + 1;
  return result;
}, {});

// This is an inventory of source defects and review candidates, not scientific validation.
// Keep the preserved catalogue audit and its release-bound hash unchanged.
export function auditReferences(catalogue, schema) {
  const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
  const dictionaries = catalogue.descriptions;
  const nodes = catalogue.levels.flat();
  const legacy = auditSourceCatalogue(catalogue);
  const findings = {
    schemaViolations: [],
    dictionaryIssues: [],
    unknownReferences: [],
    fileLevelMismatches: [],
    carrierGroupMismatches: [],
    thresholdOrderViolations: [],
    invalidPublicationLocators: [],
    missingPublicationLocators: [],
    overlappingRequirements: [],
    directionReviewCandidates: [],
    dictionaryKeyVariants: []
  };
  const ids = (name) => new Set(array(dictionaries[name]).map((entry) => entry.Id));
  const types = new Map(array(dictionaries.CarrierTypes).map((entry) => [entry.Id, entry]));
  const inventory = [];
  const edges = [];
  const evidence = [];
  const reference = (dictionary, value, location) => {
    if (!ids(dictionary).has(value)) findings.unknownReferences.push({ ...location, dictionary, value });
  };

  for (const [name, entries] of Object.entries(dictionaries)) {
    if (!Array.isArray(entries)) {
      findings.dictionaryIssues.push({ dictionary: name, reason: "not-an-array" });
      continue;
    }
    const seen = new Set();
    const spellings = new Map();
    for (const entry of entries) {
      if (!Number.isInteger(entry.Id) || seen.has(entry.Id) || !present(entry.Name)) {
        findings.dictionaryIssues.push({ dictionary: name, id: entry.Id, reason: "invalid-identity-or-name" });
      }
      seen.add(entry.Id);
      for (const key of Object.keys(entry)) {
        const normalized = key.toLowerCase();
        const variants = spellings.get(normalized) ?? new Set();
        variants.add(key);
        spellings.set(normalized, variants);
      }
      const location = { dictionary: name, id: entry.Id };
      if (name === "CarrierTypes") reference("CarrierGroups", entry.GroupId, { ...location, field: "GroupId" });
      for (const field of ["TypicalLevels", "AllowedLevels"]) {
        for (const value of array(entry[field])) reference("ComplexityLevels", value, { ...location, field });
      }
      for (const [field, dictionary] of [["TypicalInteractionModes", "InteractionModes"], ["TypicalCausalDirections", "CausalDirections"]]) {
        for (const value of array(entry[field])) reference(dictionary, value, { ...location, field });
      }
    }
    for (const variants of spellings.values()) {
      if (variants.size > 1) findings.dictionaryKeyVariants.push({ dictionary: name, keys: [...variants].sort() });
    }
  }

  catalogue.levels.forEach((levelNodes, levelIndex) => {
    const file = catalogue.levelFiles[levelIndex];
    const fileLevel = Number(file.match(/^level-(\d+)\.json$/)?.[1]);
    levelNodes.forEach((node, index) => {
      const code = `${node.Level}.${node.Id}`;
      const location = { file: `references/${file}`, index, code };
      validate(node);
      const violations = array(validate.errors).map((error) => ({ ...location, ...error }));
      findings.schemaViolations.push(...violations);
      if (node.Level !== fileLevel) findings.fileLevelMismatches.push({ ...location, level: node.Level });
      for (const [field, dictionary] of [["Level", "ComplexityLevels"], ["Phase", "LevelPhases"], ["TypeRole", "TypeRoles"]]) {
        reference(dictionary, node[field], { ...location, field });
      }
      for (const value of array(node.Science)) reference("Ontologicals", value, { ...location, field: "Science" });
      for (const value of array(node.CrossLevels)) reference("ComplexityLevels", value, { ...location, field: "CrossLevels" });
      const requirements = node.Requirements ?? {};
      const requiredIds = Object.values(requirements).flatMap(array);
      if (new Set(requiredIds).size !== requiredIds.length) findings.overlappingRequirements.push(location);
      for (const [field, values] of Object.entries(requirements)) {
        for (const value of array(values)) reference("DependencyTypes", value, { ...location, field: `Requirements.${field}` });
      }

      const nodeEvidence = array(node.Evidence);
      nodeEvidence.forEach((item, evidenceIndex) => {
        evidence.push(item);
        const entry = { ...location, evidenceIndex };
        if (!present(item.DOI) && !present(item.Link)) findings.missingPublicationLocators.push(entry);
        if (present(item.DOI) && !/^10\.\d{4,9}\/\S+$/u.test(item.DOI)) {
          findings.invalidPublicationLocators.push({ ...entry, field: "DOI", value: item.DOI });
        }
        if (present(item.Link)) {
          try {
            const url = new URL(item.Link);
            if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported publication URL scheme");
          } catch {
            findings.invalidPublicationLocators.push({ ...entry, field: "Link", value: item.Link });
          }
        }
      });

      const parentIds = [];
      array(node.Parents).forEach((parent, parentIndex) => {
        const id = `${parent.ParentCode}->${code}`;
        const entry = { ...location, parentIndex, edge: id };
        parentIds.push(id);
        reference("DependencyTypes", parent.DependencyType, { ...entry, field: "DependencyType" });
        for (const [field, dictionary] of [["CausalDirections", "CausalDirections"], ["InteractionModes", "InteractionModes"]]) {
          for (const value of array(parent[field])) reference(dictionary, value, { ...entry, field });
        }
        const quantization = parent.Quantization ?? {};
        reference("CarrierGroups", quantization.CarrierGroupId, { ...entry, field: "Quantization.CarrierGroupId" });
        reference("CarrierTypes", quantization.CarrierTypeId, { ...entry, field: "Quantization.CarrierTypeId" });
        const type = types.get(quantization.CarrierTypeId);
        if (type && type.GroupId !== quantization.CarrierGroupId) {
          findings.carrierGroupMismatches.push({ ...entry, declaredGroup: quantization.CarrierGroupId, type: type.Id, expectedGroup: type.GroupId });
        }
        const thresholds = [quantization.N_min, quantization.N_crit, quantization.N_sat].filter(Number.isFinite);
        if (thresholds.some((value, i) => i > 0 && value < thresholds[i - 1])) {
          findings.thresholdOrderViolations.push({ ...entry, quantization });
        }
        const parentLevel = Number(parent.ParentCode.split(".")[0]);
        const levelDirection = parentLevel < node.Level ? "up" : parentLevel > node.Level ? "down" : "same";
        const directions = array(parent.CausalDirections);
        // A heuristic only: catalogue level and the scale of the described effect may differ.
        if ((levelDirection === "up" && !directions.some((value) => [0, 3].includes(value)))
          || (levelDirection === "down" && !directions.some((value) => [1, 3].includes(value)))) {
          findings.directionReviewCandidates.push({ ...entry, levelDirection, causalDirections: directions });
        }
        edges.push({ id, source: parent.ParentCode, target: code, levelDirection, quantization });
      });
      inventory.push({
        ...location,
        name: node.Name,
        scientificStatus: node.ScientificStatus,
        incomingEdges: parentIds,
        evidenceCount: nodeEvidence.length,
        evidenceWithoutLocator: nodeEvidence.filter((item) => !present(item.DOI) && !present(item.Link)).length,
        schemaViolationCount: violations.length,
        uncoveredMustCover: legacy.findings.uncoveredRequirements.filter((item) => item.code === code).map((item) => item.dependencyType)
      });
    });
  });

  const schemaGroups = new Map();
  for (const item of findings.schemaViolations) {
    const key = `${item.schemaPath}:${item.keyword}`;
    const group = schemaGroups.get(key) ?? { schemaPath: item.schemaPath, keyword: item.keyword, count: 0, nodeCodes: new Set() };
    group.count += 1;
    group.nodeCodes.add(item.code);
    schemaGroups.set(key, group);
  }
  return {
    format: "onto2d-references-audit-v1",
    scope: "All source JSON records; local structural and completeness checks only.",
    limits: [
      "No publication retrieval, DOI resolution, claim verification or scientific-status adjudication.",
      "Missing locators and cross-level direction candidates require review; neither proves a claim false.",
      "Threshold order does not validate units, counting rules, numeric values or weight provenance.",
      "Dictionary semantics, PDF claims and compiler field preservation require separate review.",
      "The source schema has optional fields; schema success alone is not a completeness certificate."
    ],
    summary: {
      ...legacy.catalogue,
      dictionaryCount: Object.keys(dictionaries).length,
      dictionaryEntryCount: Object.values(dictionaries).reduce((sum, entries) => sum + array(entries).length, 0),
      evidenceCount: evidence.length,
      evidenceWithDoi: evidence.filter((item) => present(item.DOI)).length,
      evidenceWithLink: evidence.filter((item) => present(item.Link)).length,
      schemaInvalidNodeCount: inventory.filter((item) => item.schemaViolationCount > 0).length,
      ...Object.fromEntries(Object.entries(findings).map(([name, items]) => [`${name}Count`, items.length])),
      scientificStatuses: histogram(nodes.map((node) => node.ScientificStatus)),
      evidenceTypes: histogram(evidence.map((item) => item.Type)),
      edgeLevelDirections: histogram(edges.map((edge) => edge.levelDirection)),
      numericThresholdCounts: Object.fromEntries(["N_min", "N_crit", "N_sat"].map((key) => [key, edges.filter((edge) => Number.isFinite(edge.quantization[key])).length]))
    },
    levels: catalogue.levelFiles.map((file, index) => {
      const level = Number(file.match(/\d+/)[0]);
      const records = inventory.filter((item) => item.file === `references/${file}`);
      return {
        level, file: `references/${file}`, nodeCount: catalogue.levels[index].length,
        edgeCount: records.reduce((sum, item) => sum + item.incomingEdges.length, 0),
        evidenceCount: records.reduce((sum, item) => sum + item.evidenceCount, 0),
        uncoveredMustCover: records.reduce((sum, item) => sum + item.uncoveredMustCover.length, 0),
        nodesWithUncoveredMustCover: records.filter((item) => item.uncoveredMustCover.length > 0).length,
        carrierGroupMismatches: findings.carrierGroupMismatches.filter((item) => item.file === `references/${file}`).length
      };
    }),
    schemaGroups: [...schemaGroups.values()].map((group) => ({ ...group, nodeCodes: [...group.nodeCodes] })),
    legacy,
    findings,
    inventory
  };
}

export async function run({ json = false } = {}) {
  const catalogue = await loadSourceCatalogue({ catalogueDirectory: path.join(ROOT, "references") });
  const schema = JSON.parse(await readFile(path.join(ROOT, "references/arising-schema.json"), "utf8"));
  const report = auditReferences(catalogue, schema);
  const files = [...catalogue.levelFiles, "descriptions.json", "arising-schema.json", "topology-of-arising.pdf", "theory-of-causal-arisings.pdf"];
  report.sourceFiles = await Promise.all(files.map(async (file) => {
    const bytes = await readFile(path.join(ROOT, "references", file));
    return { path: `references/${file}`, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  }));
  console.log(JSON.stringify(json ? report : {
    scope: report.scope,
    summary: report.summary,
    levels: report.levels,
    preservedCatalogueFindings: report.legacy.summary,
    limits: report.limits
  }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ json: process.argv.includes("--json") }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
