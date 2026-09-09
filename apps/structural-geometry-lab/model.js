// Browser-safe presentation rules. Missing evidence never becomes a numeric zero.
export const REGIMES = Object.freeze([
  { id: "canonical-structure-v1", name: "Canonical structure", description: "Directed graph identity, independent of node names. Relation types are outside this observation regime." },
  { id: "topology-only-v1", name: "Topology only", description: "Declared topology summaries. Matching summaries do not prove that two graphs are isomorphic." },
  { id: "typed-relations-v1", name: "Typed relations", description: "Joint relation fields and an approved vocabulary correspondence. Missing fields or mappings can leave the comparison indeterminate." }
]);
export const SCENES = Object.freeze([
  { id: "branching", name: "A path and branching routes", left: "path", right: "diamond-dag", description: "The same four nodes, organized differently. Follow both graphs through the same measurements." },
  { id: "missing", name: "Same graph, incomplete measurements", left: "path", right: "partial-ollivier", description: "Both sides contain the same path. The right side has a static Ollivier measurement for only one of its three edges." }
]);
export const VIEWS = ["graph", "geometry", "flow", "signature"];
export function selection(sceneId, regimeId, view = "graph") {
  const scene = SCENES.find(x => x.id === sceneId), regime = REGIMES.find(x => x.id === regimeId);
  if (!scene || !regime || !VIEWS.includes(view)) throw new Error("Unknown laboratory selection.");
  return { scene, regime, view };
}
export function rational(value) {
  if (!value || !/^-?\d+$/.test(value.numerator) || !/^\d+$/.test(value.denominator) || BigInt(value.denominator) === 0n) throw new Error("Invalid rational measurement.");
  const n = Number(value.numerator), d = Number(value.denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d)) throw new Error("Measurement exceeds display precision.");
  return n / d;
}
export function format(value, signed = false) {
  if (value === null || value === undefined) return "Unavailable";
  if (!Number.isFinite(value)) throw new Error("Non-finite display value.");
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(4).replace(/^-0\.0000$/, "0.0000")}`;
}
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export function replayScore(summary) {
  if (!summary || !Array.isArray(summary.groups) || !summary.groups.length) throw new Error("Missing evaluation groups.");
  const ids = new Set();
  const groups = summary.groups.map(g => {
    if (ids.has(g.id) || !g.interventions?.length) throw new Error("Invalid evaluation group.");
    ids.add(g.id);
    const seen = new Set();
    const scores = g.interventions.map(i => {
      if (seen.has(i.id) || !Number.isInteger(i.count) || i.count < 2 || i.rankSkill?.reason !== null) throw new Error("Invalid evaluated intervention.");
      seen.add(i.id);
      const value = rational(i.rankSkill);
      if (value < -1 || value > 1 || value !== i.rankSkill.value) throw new Error("Rank counts disagree with score.");
      return value;
    });
    const value = mean(scores);
    if (value !== g.meanRankSkill) throw new Error("Group score disagrees with replay.");
    return { id: g.id, value, targets: g.interventions.reduce((n, i) => n + i.count, 0) };
  });
  const value = mean(groups.map(g => g.value));
  if (value !== summary.meanRankSkill) throw new Error("Study score disagrees with replay.");
  return { value, groups, targets: groups.reduce((n, g) => n + g.targets, 0) };
}
export function pairedGain(left, right) {
  const l = replayScore(left), r = replayScore(right);
  if (JSON.stringify(left.groups.map(g => [g.id, g.interventions.map(i => [i.id, i.count])])) !== JSON.stringify(right.groups.map(g => [g.id, g.interventions.map(i => [i.id, i.count])]))) throw new Error("Cannot compare unmatched populations.");
  return mean(l.groups.map((g, i) => r.groups[i].value - g.value));
}
export function verifyEvidence(data) {
  if (data?.format !== "onto2d-geometry-site-v1" || data.studies?.length !== 3 || data.metric?.length !== 5 || data.scope?.length !== 4) throw new Error("Unexpected evidence release.");
  for (const study of data.studies) {
    for (const model of [...Object.values(study.models), ...Object.values(study.ablations)]) replayScore(model);
  }
  for (const variant of data.metric) for (const study of variant.studies) for (const model of Object.values(study.models)) replayScore(model);
  for (const variant of data.scope) {
    if (variant.status === "complete") {
      if (variant.contexts?.length !== 2) throw new Error("Missing matched context.");
      for (const c of variant.contexts) for (const model of Object.values(c.models)) replayScore(model);
      pairedGain(variant.contexts[0].models.B, variant.contexts[1].models.B);
    } else if (variant.status !== "unavailable" || variant.contexts !== null || !variant.reason) throw new Error("Unavailable evidence must stay unavailable.");
  }
  return data;
}
export function frameAt(flow, iteration) {
  if (!Number.isInteger(iteration) || iteration < 0 || iteration > flow.request.parameters.maxIterations) throw new Error("Invalid flow step.");
  const state = flow.states.find(s => s.iteration === iteration);
  return { state: state ?? flow.states.at(-1), held: !state, termination: flow.termination };
}
export async function fetchPinned(path, pin, fetcher = fetch, cryptography = globalThis.crypto) {
  const response = await fetcher(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Evidence request failed (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== pin.bytes) throw new Error("Evidence byte length does not match this release.");
  const hash = [...new Uint8Array(await cryptography.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
  if (hash !== pin.sha256) throw new Error("Evidence checksum does not match this release.");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
