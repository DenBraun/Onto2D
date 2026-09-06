import { canonicalize } from "@onto2d/kernel/canonical";
import { EngineError, Model } from "@onto2d/engine";
import { buildModelPack } from "@onto2d/model-pack";

function fail(code, message) {
  throw new EngineError(`STRUCTURAL_GEOMETRY_${code}`, message);
}

export function packFromEngineModel(model) {
  // The private Model brand prevents a caller-supplied lookalike from declaring
  // itself verified. Rebuilding also checks any overridden public record views.
  let manifest;
  try {
    manifest = Object.getOwnPropertyDescriptor(Model.prototype, "manifest").get.call(model);
  } catch {
    fail("MODEL_REQUIRED", "The engine analysis requires a verified engine Model.");
  }
  const pack = buildModelPack({
    model: manifest.model,
    source: manifest.source,
    nodes: model.nodes().map((node) => node.toJSON()),
    edges: model.edges(),
    dictionaries: model.dictionaries
  });
  if (canonicalize(pack.manifest) !== canonicalize(manifest)) {
    fail("MODEL_BINDING_MISMATCH", "Engine record views differ from their verified Model Pack.");
  }
  return pack;
}

