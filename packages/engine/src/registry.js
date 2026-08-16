import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { createModel } from "./model.js";
import { diffModels } from "./diff.js";
import { engineFail } from "./errors.js";
import { dataArray, dataEntries, safeIdentifier } from "./input.js";
import { verifyModelLineage } from "./lineage.js";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireReferencePart(value, name) {
  return safeIdentifier(value, "ENGINE_MODEL_REFERENCE_INVALID", name);
}

function lineageKey(left, right) {
  return hashCanonical("onto2d:model-lineage-registry-key:v1", {
    from: { modelId: left.id, modelVersion: left.version, modelRootHash: left.rootHash },
    to: { modelId: right.id, modelVersion: right.version, modelRootHash: right.rootHash }
  });
}

function parseReference(reference) {
  if (typeof reference === "string") {
    const separator = reference.lastIndexOf("@");
    if (separator <= 0 || separator === reference.length - 1) {
      engineFail("ENGINE_MODEL_REFERENCE_INVALID", "Model references use modelId@version.", { reference });
    }
    return {
      id: requireReferencePart(reference.slice(0, separator), "reference.id"),
      version: requireReferencePart(reference.slice(separator + 1), "reference.version")
    };
  }
  if (reference && typeof reference === "object" && !Array.isArray(reference)) {
    const entries = dataEntries(reference, {
      code: "ENGINE_MODEL_REFERENCE_INVALID",
      subject: "Model reference",
      allowed: new Set(["id", "version"]),
      required: new Set(["id", "version"])
    });
    return {
      id: requireReferencePart(entries.get("id"), "reference.id"),
      version: requireReferencePart(entries.get("version"), "reference.version")
    };
  }
  engineFail("ENGINE_MODEL_REFERENCE_INVALID", "A model reference requires id and version.");
}

export class ModelRegistry {
  #packs = new Map();
  #models = new Map();
  #aliases = new Map();
  #lineages = new Map();

  constructor(packs, aliases = {}, lineages = []) {
    const packValues = dataArray(
      packs,
      "ENGINE_MODEL_REGISTRY_INPUT_INVALID",
      "Model Packs"
    );
    if (packValues.length === 0) {
      engineFail("ENGINE_MODEL_REGISTRY_EMPTY", "The engine requires at least one Model Pack.");
    }
    for (const pack of packValues) this.register(pack);
    const aliasEntries = dataEntries(aliases, {
      code: "ENGINE_MODEL_REGISTRY_INPUT_INVALID",
      subject: "aliases"
    });
    for (const [modelId, modelAliases] of aliasEntries) {
      requireReferencePart(modelId, "alias.modelId");
      const modelAliasEntries = dataEntries(modelAliases, {
        code: "ENGINE_MODEL_REGISTRY_INPUT_INVALID",
        subject: `aliases.${modelId}`
      });
      for (const [alias, version] of modelAliasEntries) {
        requireReferencePart(alias, "alias");
        requireReferencePart(version, "alias.version");
        const exact = `${modelId}@${version}`;
        if (!this.#packs.has(exact)) {
          engineFail("ENGINE_MODEL_ALIAS_TARGET_MISSING", "A model alias must resolve to a registered exact version.", {
            modelId,
            alias,
            version
          });
        }
        this.#aliases.set(`${modelId}@${alias}`, exact);
      }
    }
    for (const lineage of dataArray(lineages, "ENGINE_LINEAGES_INVALID", "lineages")) {
      this.registerLineage(lineage);
    }
  }

  register(pack) {
    const verified = verifyModelPack(pack);
    const key = `${verified.manifest.model.id}@${verified.manifest.model.version}`;
    if (this.#packs.has(key)) {
      engineFail("ENGINE_MODEL_VERSION_DUPLICATE", "A model version can be registered only once.", { key });
    }
    this.#packs.set(key, verified);
    return key;
  }

  registerLineage(lineage) {
    const verified = verifyModelLineage(lineage);
    const left = this.get(`${verified.from.modelId}@${verified.from.modelVersion}`);
    const right = this.get(`${verified.to.modelId}@${verified.to.modelVersion}`);
    const bound = verifyModelLineage(verified, { from: left, to: right });
    diffModels(left, right, { lineage: bound });
    const key = lineageKey(left, right);
    if (this.#lineages.has(key)) {
      engineFail("ENGINE_LINEAGE_DUPLICATE", "Only one lineage record may bind an ordered release pair.", {
        key
      });
    }
    this.#lineages.set(key, bound);
    return bound.lineageHash;
  }

  resolve(reference) {
    const { id, version } = parseReference(reference);
    const supplied = `${id}@${version}`;
    const exact = this.#aliases.get(supplied) ?? supplied;
    const pack = this.#packs.get(exact);
    if (!pack) {
      engineFail("ENGINE_MODEL_RESOLUTION_FAILED", "The model reference cannot be resolved.", {
        reference: supplied
      });
    }
    return Object.freeze({
      requested: supplied,
      exact,
      modelId: pack.manifest.model.id,
      modelVersion: pack.manifest.model.version,
      modelRootHash: pack.manifest.rootHash
    });
  }

  get(reference) {
    const resolution = this.resolve(reference);
    if (!this.#models.has(resolution.exact)) {
      this.#models.set(resolution.exact, createModel(this.#packs.get(resolution.exact)));
    }
    return this.#models.get(resolution.exact);
  }

  list() {
    return Object.freeze([...this.#packs.values()].map((pack) => Object.freeze({
      id: pack.manifest.model.id,
      name: pack.manifest.model.name,
      version: pack.manifest.model.version,
      rootHash: pack.manifest.rootHash
    })).sort((left, right) => compareText(`${left.id}@${left.version}`, `${right.id}@${right.version}`)));
  }

  listLineages() {
    return Object.freeze([...this.#lineages.values()].map((lineage) => Object.freeze({
      from: lineage.from,
      to: lineage.to,
      lineageHash: lineage.lineageHash,
      eventCount: lineage.events.length
    })).sort((left, right) => compareText(left.lineageHash, right.lineageHash)));
  }

  async diff(leftReference, rightReference) {
    const left = this.get(leftReference);
    const right = this.get(rightReference);
    const lineage = this.#lineages.get(lineageKey(left, right));
    return diffModels(left, right, lineage === undefined ? {} : { lineage });
  }
}
