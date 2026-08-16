import { canonicalClone } from "@onto2d/kernel";
import { engineFail } from "./errors.js";
import { dataArray, dataEntries, safeIdentifier } from "./input.js";
import { ModelRegistry } from "./registry.js";
import { Workspace } from "./workspace.js";

export const ENGINE_VERSION = "0.1.0";
export const ENGINE_API_VERSION = "1";

const ENGINE_OPTION_FIELDS = new Set(["models", "aliases", "lineages", "model", "analyses"]);
const ANALYSIS_FIELDS = new Set([
  "id",
  "version",
  "requiredModelCapabilities",
  "requiredAdapterCapabilities",
  "inputSchema",
  "outputArtifacts",
  "run"
]);
const ANALYSIS_REQUIRED_FIELDS = new Set(["id", "version", "run"]);
const INHERITED_OBJECT_FIELDS = new Set(Object.getOwnPropertyNames(Object.prototype));

function normalizeStringList(value, name) {
  if (value === undefined) return Object.freeze([]);
  const normalized = dataArray(value, "ENGINE_ANALYSIS_INVALID", name)
    .map((entry) => safeIdentifier(entry, "ENGINE_ANALYSIS_INVALID", `${name} entry`))
    .sort();
  if (new Set(normalized).size !== normalized.length) {
    engineFail("ENGINE_ANALYSIS_INVALID", `${name} entries must be unique.`);
  }
  return Object.freeze(normalized);
}

function normalizeAnalyses(analyses = []) {
  const definitions = dataArray(analyses, "ENGINE_ANALYSES_INVALID", "analyses");
  const result = new Map();
  for (const [index, analysis] of definitions.entries()) {
    const entries = dataEntries(analysis, {
      code: "ENGINE_ANALYSIS_INVALID",
      subject: `analyses[${index}]`,
      allowed: ANALYSIS_FIELDS,
      required: ANALYSIS_REQUIRED_FIELDS
    });
    const id = safeIdentifier(entries.get("id"), "ENGINE_ANALYSIS_INVALID", `analyses[${index}].id`);
    const version = safeIdentifier(
      entries.get("version"),
      "ENGINE_ANALYSIS_INVALID",
      `analyses[${index}].version`
    );
    const run = entries.get("run");
    if (typeof run !== "function") {
      engineFail("ENGINE_ANALYSIS_INVALID", "Each analysis requires run().", { index });
    }
    if (result.has(id)) {
      engineFail("ENGINE_ANALYSIS_DUPLICATE", "Analysis identifiers must be unique.", {
        id
      });
    }
    const inputSchema = entries.get("inputSchema") !== undefined
      ? safeIdentifier(
        entries.get("inputSchema"),
        "ENGINE_ANALYSIS_INVALID",
        `analyses[${index}].inputSchema`
      )
      : null;
    result.set(id, Object.freeze({
      id,
      version,
      requiredModelCapabilities: normalizeStringList(
        entries.get("requiredModelCapabilities"),
        "analysis.requiredModelCapabilities"
      ),
      requiredAdapterCapabilities: normalizeStringList(
        entries.get("requiredAdapterCapabilities"),
        "analysis.requiredAdapterCapabilities"
      ),
      inputSchema,
      outputArtifacts: normalizeStringList(entries.get("outputArtifacts"), "analysis.outputArtifacts"),
      run
    }));
  }
  return result;
}

function normalizeCreateOptions(options) {
  const entries = dataEntries(options, {
    code: "ENGINE_OPTIONS_INVALID",
    subject: "Onto2D.create options",
    allowed: ENGINE_OPTION_FIELDS
  });
  return Object.freeze({
    models: entries.get("models"),
    aliases: entries.get("aliases") ?? {},
    lineages: entries.get("lineages") ?? [],
    model: entries.get("model"),
    analyses: entries.get("analyses") ?? []
  });
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
      INHERITED_OBJECT_FIELDS.has(capability) || !(capability in this.model)
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
    return new Onto2DEngine(normalizeCreateOptions(options));
  }
}
