import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { catalogueNodeCode } from "@onto2d/catalog-adapter";

const MODEL_VERSION = "2026.08.15";

function dictionaryMap(descriptions, name) {
  const entries = descriptions[name];
  if (!Array.isArray(entries)) throw new TypeError(`Missing ${name} dictionary.`);
  return new Map(entries.map((entry) => [entry.Id, entry]));
}

function dictionaryName(dictionary, id, label) {
  const entry = dictionary.get(id);
  if (!entry || typeof entry.Name !== "string") {
    throw new TypeError(`Unknown ${label} dictionary identifier ${id}.`);
  }
  return entry.Name;
}

function phaseCode(id) {
  if (!Number.isInteger(id) || id < 0 || id > 25) {
    throw new TypeError(`Unsupported phase identifier ${id}.`);
  }
  return String.fromCharCode(65 + id);
}

export function compileCausalEmergenceModelPack({ catalogue, audit, sourceFiles }) {
  if (!catalogue || !Array.isArray(catalogue.levels) || !catalogue.descriptions) {
    throw new TypeError("A loaded source catalogue is required.");
  }
  if (!audit || !audit.catalogue || !audit.summary) {
    throw new TypeError("A complete source catalogue audit is required.");
  }
  if (!Array.isArray(sourceFiles)) throw new TypeError("sourceFiles must be an array.");

  const typeRoles = dictionaryMap(catalogue.descriptions, "TypeRoles");
  const phases = dictionaryMap(catalogue.descriptions, "LevelPhases");
  const dependencyTypes = dictionaryMap(catalogue.descriptions, "DependencyTypes");
  const interactionModes = dictionaryMap(catalogue.descriptions, "InteractionModes");
  const causalDirections = dictionaryMap(catalogue.descriptions, "CausalDirections");
  const sourceNodes = catalogue.levels.flat();
  const nodes = sourceNodes.map((node) => ({
    id: catalogueNodeCode(node),
    localId: node.Id,
    name: node.Name,
    shortDescription: node.ShortDescription,
    description: node.Description,
    level: node.Level,
    phase: phaseCode(node.Phase),
    phaseId: node.Phase,
    phaseName: dictionaryName(phases, node.Phase, "phase"),
    typeRole: dictionaryName(typeRoles, node.TypeRole, "type role"),
    typeRoleId: node.TypeRole,
    scienceIds: canonicalClone(node.Science),
    scientificStatus: node.ScientificStatus,
    requirements: canonicalClone(node.Requirements),
    evidence: canonicalClone(node.Evidence)
  }));
  const edges = sourceNodes.flatMap((node) => {
    const target = catalogueNodeCode(node);
    return node.Parents.map((relation) => ({
      id: `${relation.ParentCode}->${target}`,
      source: relation.ParentCode,
      target,
      relationLayer: "source-parent",
      causalDirections: relation.CausalDirections.map((id) => (
        dictionaryName(causalDirections, id, "causal direction")
      )),
      causalDirectionIds: canonicalClone(relation.CausalDirections),
      interactionModes: relation.InteractionModes.map((id) => (
        dictionaryName(interactionModes, id, "interaction mode")
      )),
      interactionModeIds: canonicalClone(relation.InteractionModes),
      weight: relation.Weight,
      necessity: relation.Necessity,
      dependencyType: dictionaryName(
        dependencyTypes,
        relation.DependencyType,
        "dependency type"
      ),
      dependencyTypeId: relation.DependencyType,
      ontologicalRole: relation.OntologicalRole,
      quantization: canonicalClone(relation.Quantization)
    }));
  });
  if (audit.catalogue.nodeCount !== nodes.length || audit.catalogue.edgeCount !== edges.length) {
    throw new TypeError("The source audit inventory differs from the compiled model inventory.");
  }

  return buildModelPack({
    model: {
      id: "causal-emergence",
      name: "Causal Emergence Catalogue",
      version: MODEL_VERSION,
      description: "Preserved source-catalogue snapshot with typed source-parent relations.",
      status: "source-snapshot-known-findings"
    },
    source: {
      id: "preserved-causal-emergence-source",
      files: sourceFiles,
      auditHash: hashCanonical("onto2d:model-pack-source-audit:v1", audit)
    },
    nodes,
    edges,
    dictionaries: canonicalClone(catalogue.descriptions)
  });
}

export const CAUSAL_EMERGENCE_MODEL_VERSION = MODEL_VERSION;
