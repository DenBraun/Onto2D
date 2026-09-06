import { deepFreeze } from "@onto2d/kernel/canonical";

export const SOURCE_PARENT_DIRECTED_POLICY = deepFreeze({
  "id": "source-parent-directed-v1",
  "version": "1",
  "scope": "full-model",
  "direction": "native",
  "relationLayer": "source-parent",
  "includedOntologicalRoles": "all",
  "includedNecessities": "all",
  "includedDependencyTypes": "all",
  "includeQuantization": true,
  "higherOrderPolicy": "none",
  "selfLoops": "reject",
  "parallelEdges": "reject",
  "nodeAttributes": [
    "level",
    "phase",
    "phaseId",
    "typeRole",
    "typeRoleId",
    "scienceIds",
    "scientificStatus",
    "requirements"
  ],
  "edgeAttributes": [
    "relationLayer",
    "causalDirections",
    "causalDirectionIds",
    "interactionModes",
    "interactionModeIds",
    "weight",
    "necessity",
    "dependencyType",
    "dependencyTypeId",
    "ontologicalRole",
    "quantization"
  ],
  "limits": {
    "maxNodes": 4096,
    "maxEdges": 16384
  }
});

export const UNIT_METRIC_POLICY = deepFreeze({
  "id": "unit-v1",
  "version": "1",
  "vertexWeight": 1,
  "edgeWeight": 1,
  "edgeLength": 1,
  "sourceWeightUsage": "provenance-only"
});
