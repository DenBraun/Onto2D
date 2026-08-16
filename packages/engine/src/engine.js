import { canonicalClone } from "@onto2d/kernel";
import { engineFail } from "./errors.js";
import { ModelRegistry } from "./registry.js";
import { Workspace } from "./workspace.js";

export const ENGINE_VERSION = "0.1.0";
export const ENGINE_API_VERSION = "1";

function normalizeStringList(value, name) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    engineFail("ENGINE_ANALYSIS_INVALID", `${name} must be an array.`);
  }
  const normalized = Array.from(value, (entry) => {
    if (typeof entry !== "string" || entry.length === 0 || entry.trim() !== entry) {
      engineFail("ENGINE_ANALYSIS_INVALID", `${name} entries must be normalized strings.`);
    }
    return entry;
  }).sort();
  if (new Set(normalized).size !== normalized.length) {
    engineFail("ENGINE_ANALYSIS_INVALID", `${name} entries must be unique.`);
  }
  return Object.freeze(normalized);
}

function normalizeAnalyses(analyses = []) {
  if (!Array.isArray(analyses)) {
    engineFail("ENGINE_ANALYSES_INVALID", "analyses must be an array.");
  }
  const result = new Map();
  for (const analysis of analyses) {
    if (
      !analysis ||
      typeof analysis !== "object" ||
      typeof analysis.id !== "string" ||
      analysis.id.length === 0 ||
      typeof analysis.version !== "string" ||
      analysis.version.length === 0 ||
      typeof analysis.run !== "function"
    ) {
      engineFail("ENGINE_ANALYSIS_INVALID", "Each analysis requires id, version, and run().");
    }
    if (result.has(analysis.id)) {
      engineFail("ENGINE_ANALYSIS_DUPLICATE", "Analysis identifiers must be unique.", {
        id: analysis.id
      });
    }
    if (analysis.inputSchema !== undefined && (
      typeof analysis.inputSchema !== "string" || analysis.inputSchema.length === 0
    )) {
      engineFail("ENGINE_ANALYSIS_INVALID", "analysis.inputSchema must be a non-empty string.");
    }
    result.set(analysis.id, Object.freeze({
      id: analysis.id,
      version: analysis.version,
      requiredModelCapabilities: normalizeStringList(
        analysis.requiredModelCapabilities,
        "analysis.requiredModelCapabilities"
      ),
      requiredAdapterCapabilities: normalizeStringList(
        analysis.requiredAdapterCapabilities,
        "analysis.requiredAdapterCapabilities"
      ),
      inputSchema: analysis.inputSchema ?? null,
      outputArtifacts: normalizeStringList(analysis.outputArtifacts, "analysis.outputArtifacts"),
      run: analysis.run
    }));
  }
  return result;
}

class Onto2DEngine {
  #registry;
  #analyses;

  constructor(options) {
    this.#registry = new ModelRegistry(options.models, options.aliases, options.lineages);
    const selected = options.model ?? `${this.#registry.list()[0].id}@${this.#registry.list()[0].version}`;
    this.modelResolution = this.#registry.resolve(selected);
    this.model = this.#registry.get(selected);
    this.workspace = new Workspace();
    this.workspace.add(this.model, { workspaceId: "default", modelKind: "default-model-pack" });
    this.#analyses = normalizeAnalyses(options.analyses);
    this.models = Object.freeze({
      list: () => this.#registry.list(),
      resolve: (reference) => this.#registry.resolve(reference),
      get: (reference) => this.#registry.get(reference),
      diff: (left, right) => this.#registry.diff(left, right),
      lineages: () => this.#registry.listLineages()
    });
    Object.freeze(this);
  }

  analyses() {
    return Object.freeze([...this.#analyses.values()].map(({ run: _run, ...metadata }) => Object.freeze(metadata)));
  }

  async analyze(id, input = {}) {
    if (typeof id !== "string" || id.length === 0) {
      engineFail("ENGINE_ANALYSIS_REFERENCE_INVALID", "analyze() requires an analysis identifier.");
    }
    const analysis = this.#analyses.get(id);
    if (!analysis) {
      engineFail("ENGINE_ANALYSIS_MISSING", "The requested analysis is not registered.", { id });
    }
    const missingModelCapabilities = analysis.requiredModelCapabilities.filter((capability) => (
      !(capability in this.model)
    ));
    if (missingModelCapabilities.length > 0) {
      engineFail("ENGINE_ANALYSIS_MODEL_CAPABILITY_MISSING", "The selected model lacks required analysis capabilities.", {
        id,
        missingModelCapabilities
      });
    }
    if (analysis.requiredAdapterCapabilities.length > 0) {
      engineFail("ENGINE_ANALYSIS_ADAPTER_CAPABILITY_MISSING", "The engine has no registered adapter capability provider.", {
        id,
        missingAdapterCapabilities: analysis.requiredAdapterCapabilities
      });
    }
    const normalizedInput = canonicalClone(input);
    const { run: _run, ...analysisMetadata } = analysis;
    return analysis.run(Object.freeze({
      analysis: Object.freeze(analysisMetadata),
      engine: Object.freeze({ version: ENGINE_VERSION, apiVersion: ENGINE_API_VERSION }),
      model: this.model,
      modelResolution: this.modelResolution,
      workspace: this.workspace
    }), normalizedInput);
  }
}

export class Onto2D {
  static async create(options = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      engineFail("ENGINE_OPTIONS_INVALID", "Onto2D.create options must be a plain object.");
    }
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      engineFail("ENGINE_OPTIONS_INVALID", "Onto2D.create options must be a plain object.");
    }
    return new Onto2DEngine(options);
  }
}
