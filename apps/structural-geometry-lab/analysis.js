import { canonicalize } from "@onto2d/kernel/canonical";
import { verifyGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { compareStructuralModels, verifyStructuralComparison } from "@onto2d/structural-geometry/comparison";
import { runStructuralResponseSignature } from "@onto2d/structural-geometry/signature";
import { selection } from "./model.js";

export function replayControls(data) {
  return data.controls.map(c => {
    const a = verifyStructuralComparison(c.artifact, c.left, c.right, c.input);
    return { pairId: c.pairId, regimeId: c.input.regimeId, status: a.status, coverage: a.coverage, components: a.components, distance: a.distance };
  });
}
export function analyzeScene(data, sceneId, regimeId) {
  const { scene } = selection(sceneId, regimeId);
  const before = canonicalize(data.examples);
  const examples = [scene.left, scene.right].map(id => {
    const example = data.examples.find(x => x.id === id);
    if (!example) throw new Error("Missing example.");
    const { artifact, pack, input } = example;
    const geometric = verifyGeometricSignature(artifact, pack, input, { ollivier: artifact.evidence.ollivier, flow: artifact.evidence.flow });
    const response = runStructuralResponseSignature(pack, { regimeId });
    return { id, geometric, response, graph: { nodes: pack.files["model/nodes.json"].map(n => ({ id: n.id })), edges: pack.files["model/edges.json"].map(({ id, source, target }) => ({ id, source, target })) } };
  });
  const comparison = compareStructuralModels(data.examples.find(x => x.id === scene.left).pack, data.examples.find(x => x.id === scene.right).pack, { regimeId });
  if (canonicalize(data.examples) !== before) throw new Error("Source graph changed during analysis.");
  return { sceneId, regimeId, examples, comparison };
}
