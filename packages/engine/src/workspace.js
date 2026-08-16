import { canonicalClone, deepFreeze } from "@onto2d/kernel";
import { engineFail } from "./errors.js";

function requireIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    engineFail("ENGINE_WORKSPACE_IDENTIFIER_INVALID", `${name} must be a non-empty bounded string.`, { name });
  }
  return value;
}

function requireRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    engineFail("ENGINE_WORKSPACE_RECORD_INVALID", `${name} must be a plain object.`, { name });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    engineFail("ENGINE_WORKSPACE_RECORD_INVALID", `${name} must be a plain object.`, { name });
  }
  return canonicalClone(value);
}

export class Workspace {
  #models = new Map();
  #bindings = new Map();
  #runs = new Map();

  add(model, options = {}) {
    if (!model?.rootHash || typeof model.get !== "function") {
      engineFail("ENGINE_WORKSPACE_MODEL_INVALID", "Workspace.add requires a verified engine model.");
    }
    const normalizedOptions = requireRecord(options, "options");
    const workspaceId = requireIdentifier(
      normalizedOptions.workspaceId ?? `${model.id}@${model.version}`,
      "workspaceId"
    );
    const modelKind = requireIdentifier(normalizedOptions.modelKind ?? "model-pack", "modelKind");
    if (this.#models.has(workspaceId)) {
      engineFail("ENGINE_WORKSPACE_MODEL_DUPLICATE", "The Workspace model identifier already exists.", {
        workspaceId
      });
    }
    this.#models.set(workspaceId, Object.freeze({
      workspaceId,
      modelKind,
      modelSemanticIdentity: model.rootHash,
      modelVersion: model.version,
      model
    }));
    return this.#models.get(workspaceId);
  }

  remove(workspaceId) {
    const id = requireIdentifier(workspaceId, "workspaceId");
    for (const binding of this.#bindings.values()) {
      if (binding.sourceModel === id || binding.targetModel === id) {
        engineFail("ENGINE_WORKSPACE_MODEL_REFERENCED", "Remove bindings before removing their model.", {
          workspaceId: id,
          bindingId: binding.id
        });
      }
    }
    for (const run of this.#runs.values()) {
      if (run.modelWorkspaceId === id) {
        engineFail("ENGINE_WORKSPACE_MODEL_REFERENCED", "Remove runs before removing their model.", {
          workspaceId: id,
          runId: run.id
        });
      }
    }
    return this.#models.delete(id);
  }

  has(workspaceId) {
    return this.#models.has(workspaceId);
  }

  get(workspaceId) {
    return this.#models.get(workspaceId);
  }

  models() {
    return Object.freeze([...this.#models.values()]);
  }

  addBinding(binding) {
    const value = requireRecord(binding, "binding");
    const id = requireIdentifier(value.id, "binding.id");
    const sourceModel = requireIdentifier(value.sourceModel, "binding.sourceModel");
    const targetModel = requireIdentifier(value.targetModel, "binding.targetModel");
    if (!this.#models.has(sourceModel) || !this.#models.has(targetModel)) {
      engineFail("ENGINE_WORKSPACE_BINDING_MODEL_MISSING", "Binding models must exist in the Workspace.", {
        sourceModel,
        targetModel
      });
    }
    if (this.#bindings.has(id)) {
      engineFail("ENGINE_WORKSPACE_BINDING_DUPLICATE", "The binding identifier already exists.", { id });
    }
    this.#bindings.set(id, deepFreeze(value));
    return this.#bindings.get(id);
  }

  removeBinding(id) {
    return this.#bindings.delete(requireIdentifier(id, "binding.id"));
  }

  bindings() {
    return Object.freeze([...this.#bindings.values()]);
  }

  addRun(run) {
    const value = requireRecord(run, "run");
    const id = requireIdentifier(value.id, "run.id");
    const modelWorkspaceId = requireIdentifier(value.modelWorkspaceId, "run.modelWorkspaceId");
    const instance = this.#models.get(modelWorkspaceId);
    if (!instance) {
      engineFail("ENGINE_WORKSPACE_RUN_MODEL_MISSING", "The run model must exist in the Workspace.", {
        modelWorkspaceId
      });
    }
    if (value.modelRootHash !== instance.modelSemanticIdentity) {
      engineFail("ENGINE_WORKSPACE_RUN_MODEL_DRIFT", "The run root hash differs from its Workspace model.", {
        modelWorkspaceId
      });
    }
    if (this.#runs.has(id)) {
      engineFail("ENGINE_WORKSPACE_RUN_DUPLICATE", "The run identifier already exists.", { id });
    }
    this.#runs.set(id, deepFreeze(value));
    return this.#runs.get(id);
  }

  removeRun(id) {
    return this.#runs.delete(requireIdentifier(id, "run.id"));
  }

  runs() {
    return Object.freeze([...this.#runs.values()]);
  }
}
