import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const CATALOG_ADAPTER_STATUS = "audit-implemented/classification-pending";

export function catalogueNodeCode(node) {
  return `${node.Level}.${node.Id}`;
}

export async function loadSourceCatalogue(options = {}) {
  const catalogueDirectory = options.catalogueDirectory;
  if (!catalogueDirectory) {
    throw new TypeError("loadSourceCatalogue requires catalogueDirectory.");
  }

  const entries = await readdir(catalogueDirectory);
  const levelFiles = entries
    .filter((name) => /^level-\d+\.json$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));

  if (levelFiles.length === 0) {
    throw new Error(`No level-*.json files found in ${catalogueDirectory}.`);
  }

  const levels = [];
  for (const name of levelFiles) {
    const value = JSON.parse(await readFile(path.join(catalogueDirectory, name), "utf8"));
    if (!Array.isArray(value)) throw new TypeError(`${name} must contain an array.`);
    levels.push(value);
  }

  const descriptions = JSON.parse(
    await readFile(path.join(catalogueDirectory, "descriptions.json"), "utf8")
  );

  return { levels, descriptions, levelFiles };
}

function dictionaryIds(descriptions, name) {
  const entries = Array.isArray(descriptions[name]) ? descriptions[name] : [];
  return new Set(entries.map((entry) => entry.Id));
}

function compareCodes(left, right) {
  const [leftLevel, leftId] = left.split(".").map(Number);
  const [rightLevel, rightId] = right.split(".").map(Number);
  return leftLevel - rightLevel || leftId - rightId;
}

function stronglyConnectedComponents(codes, adjacency) {
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(code) {
    indexes.set(code, nextIndex);
    lowLinks.set(code, nextIndex);
    nextIndex += 1;
    stack.push(code);
    onStack.add(code);

    for (const child of adjacency.get(code) || []) {
      if (!indexes.has(child)) {
        visit(child);
        lowLinks.set(code, Math.min(lowLinks.get(code), lowLinks.get(child)));
      } else if (onStack.has(child)) {
        lowLinks.set(code, Math.min(lowLinks.get(code), indexes.get(child)));
      }
    }

    if (lowLinks.get(code) === indexes.get(code)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== code);
      components.push(component.sort(compareCodes));
    }
  }

  for (const code of [...codes].sort(compareCodes)) {
    if (!indexes.has(code)) visit(code);
  }
  return components;
}

export function auditSourceCatalogue(catalogue, options = {}) {
  const tolerance = options.weightTolerance ?? 0.05;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new TypeError("Catalogue weight tolerance must be finite and non-negative.");
  }
  const nodes = catalogue.levels.flat();
  const byCode = new Map();
  const duplicateNodeCodes = [];
  for (const node of nodes) {
    const code = catalogueNodeCode(node);
    if (byCode.has(code)) duplicateNodeCodes.push({ code });
    else byCode.set(code, node);
  }
  const adjacency = new Map([...byCode.keys()].map((code) => [code, []]));
  const dictionaries = {
    dependencyTypes: dictionaryIds(catalogue.descriptions, "DependencyTypes"),
    interactionModes: dictionaryIds(catalogue.descriptions, "InteractionModes"),
    causalDirections: dictionaryIds(catalogue.descriptions, "CausalDirections"),
    typeRoles: dictionaryIds(catalogue.descriptions, "TypeRoles"),
    levelPhases: dictionaryIds(catalogue.descriptions, "LevelPhases"),
    complexityLevels: dictionaryIds(catalogue.descriptions, "ComplexityLevels")
  };
  const findings = {
    duplicateNodeCodes,
    missingParents: [],
    selfParents: [],
    duplicateParents: [],
    unknownDependencyTypes: [],
    unknownInteractionModes: [],
    unknownCausalDirections: [],
    unknownTypeRoles: [],
    unknownLevelPhases: [],
    unknownComplexityLevels: [],
    weightsOutsideUnitInterval: [],
    weightSumAnomalies: [],
    uncoveredRequirements: []
  };
  let edgeCount = 0;

  for (const node of nodes) {
    const child = catalogueNodeCode(node);
    const parents = Array.isArray(node.Parents) ? node.Parents : [];
    const seen = new Set();
    let weightSum = 0;
    let weightsAreFiniteNumbers = true;

    if (!dictionaries.typeRoles.has(node.TypeRole)) {
      findings.unknownTypeRoles.push({ code: child, value: node.TypeRole });
    }
    if (!dictionaries.levelPhases.has(node.Phase)) {
      findings.unknownLevelPhases.push({ code: child, value: node.Phase });
    }
    if (!dictionaries.complexityLevels.has(node.Level)) {
      findings.unknownComplexityLevels.push({ code: child, value: node.Level });
    }

    for (const relation of parents) {
      edgeCount += 1;
      if (Number.isFinite(relation.Weight)) weightSum += relation.Weight;
      else weightsAreFiniteNumbers = false;
      if (!byCode.has(relation.ParentCode)) {
        findings.missingParents.push({ child, parent: relation.ParentCode });
      } else {
        adjacency.get(relation.ParentCode).push(child);
      }
      if (relation.ParentCode === child) findings.selfParents.push({ child });
      if (seen.has(relation.ParentCode)) findings.duplicateParents.push({ child, parent: relation.ParentCode });
      seen.add(relation.ParentCode);

      if (!dictionaries.dependencyTypes.has(relation.DependencyType)) {
        findings.unknownDependencyTypes.push({ child, parent: relation.ParentCode, value: relation.DependencyType });
      }
      for (const value of relation.InteractionModes || []) {
        if (!dictionaries.interactionModes.has(value)) {
          findings.unknownInteractionModes.push({ child, parent: relation.ParentCode, value });
        }
      }
      for (const value of relation.CausalDirections || []) {
        if (!dictionaries.causalDirections.has(value)) {
          findings.unknownCausalDirections.push({ child, parent: relation.ParentCode, value });
        }
      }
      if (!Number.isFinite(relation.Weight) || relation.Weight < 0 || relation.Weight > 1) {
        findings.weightsOutsideUnitInterval.push({
          child,
          parent: relation.ParentCode,
          value: Number.isFinite(relation.Weight) ? relation.Weight : String(relation.Weight)
        });
      }
    }

    if (parents.length > 0 && weightsAreFiniteNumbers && Math.abs(weightSum - 1) > tolerance) {
      findings.weightSumAnomalies.push({ code: child, sum: Number(weightSum.toFixed(10)) });
    }

    const mustCover = node.Requirements?.MustCover || [];
    const covered = new Set(parents.map((relation) => relation.DependencyType));
    for (const dependencyType of mustCover) {
      if (!covered.has(dependencyType)) {
        findings.uncoveredRequirements.push({ code: child, dependencyType });
      }
    }
  }

  const nontrivialSccs = stronglyConnectedComponents(byCode.keys(), adjacency)
    .filter((component) => component.length > 1)
    .sort((left, right) => compareCodes(left[0], right[0]));
  const nodesWithUncoveredRequirements = new Set(
    findings.uncoveredRequirements.map((finding) => finding.code)
  ).size;

  return {
    catalogue: {
      levelCount: catalogue.levels.length,
      nodeCount: nodes.length,
      edgeCount
    },
    summary: {
      duplicateNodeCodeCount: findings.duplicateNodeCodes.length,
      missingParentCount: findings.missingParents.length,
      selfParentCount: findings.selfParents.length,
      duplicateParentCount: findings.duplicateParents.length,
      unknownDictionaryReferenceCount:
        findings.unknownDependencyTypes.length +
        findings.unknownInteractionModes.length +
        findings.unknownCausalDirections.length +
        findings.unknownTypeRoles.length +
        findings.unknownLevelPhases.length +
        findings.unknownComplexityLevels.length,
      weightsOutsideUnitIntervalCount: findings.weightsOutsideUnitInterval.length,
      weightSumAnomalyCount: findings.weightSumAnomalies.length,
      nodesWithUncoveredRequirements,
      uncoveredRequirementCount: findings.uncoveredRequirements.length,
      nontrivialSccCount: nontrivialSccs.length,
      nontrivialSccNodeCount: nontrivialSccs.reduce((total, component) => total + component.length, 0)
    },
    findings,
    nontrivialSccs
  };
}
