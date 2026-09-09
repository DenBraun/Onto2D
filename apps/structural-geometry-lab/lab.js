import { RELEASE } from "./release.js?v=20260909.2";
import { REGIMES, SCENES, VIEWS, selection, rational, format, replayScore, pairedGain, verifyEvidence, frameAt, fetchPinned } from "./model.js?v=20260909.2";
const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
const option = (value, text) => { const n = el("option", text); n.value = value; return n; };
const title = id => ({ path: "Directed path", "diamond-dag": "Branching diamond", "partial-ollivier": "Path \u00b7 partial measurement", "dream4-knockouts": "DREAM4 \u00b7 knockouts", "dream4-knockdowns": "DREAM4 \u00b7 knockdowns", "celegans-Dataset7": "C. elegans \u00b7 Dataset7" }[id] ?? id);
const stateName = value => ({ "indistinguishable-under-regime": "Indistinguishable under this regime", "distinguishable-under-regime": "Distinguishable under this regime", indeterminate: "Indeterminate", observed: "Observed", partial: "Partial", unavailable: "Unavailable" }[value] ?? value);
const coverage = c => `${c.numerator}/${c.denominator}`;
const jsonDetails = (label, value) => { const d = el("details"); d.append(el("summary", label), el("pre", JSON.stringify(value, null, 2))); return d; };
function table(caption, headers, rows) {
  const wrap = el("div", undefined, "table-scroll"), t = el("table"), head = el("thead"), tr = el("tr"), body = el("tbody");
  t.append(el("caption", caption));
  for (const name of headers) { const th = el("th", name); th.scope = "col"; tr.append(th); } head.append(tr);
  for (const row of rows) { const tr = el("tr"); row.forEach((value, i) => { const cell = el(i ? "td" : "th", String(value), i ? "num" : undefined); if (!i) cell.scope = "row"; tr.append(cell); }); body.append(tr); }
  t.append(head, body); wrap.append(t); return wrap;
}
function status(id, message, error = false) { $(id).textContent = message; $(id).dataset.state = error ? "error" : "ready"; }
const ui = { scene: SCENES[0].id, regime: REGIMES[0].id, view: "graph", iteration: 0, edges: ["a->b", "a->b"] };
let payload, evidence, analysis, worker, job = 0, workerTimer, playTimer, labFinished = false, evidenceFinished = false, labFailed = false, evidenceFailed = false;
function ready() { document.body.dataset.ready = labFinished && evidenceFinished ? (labFailed || evidenceFailed ? "error" : "true") : "loading"; }
function stop() { clearInterval(playTimer); playTimer = undefined; $("play").textContent = "Play flow"; }
function disposeWorker() { clearTimeout(workerTimer); worker?.terminate(); worker = undefined; }
function failLab(message) {
  disposeWorker(); stop(); analysis = undefined; $("lab-panel").setAttribute("aria-busy", "false");
  $("graphs").replaceChildren(); $("view-details").replaceChildren(); $("comparison-components").replaceChildren(); $("comparison-result").textContent = "Unavailable"; $("flow-controls").hidden = true;
  $("graph-legend").textContent = "";
  for (const output of document.querySelectorAll(".control-card output")) output.textContent = "Replay unavailable";
  status("lab-status", `Laboratory unavailable: ${message} Reload the page to retry.`, true); labFinished = true; labFailed = true; ready();
}
function run() {
  stop(); disposeWorker(); analysis = undefined; labFinished = false; labFailed = false; ready(); const id = ++job;
  const selected = selection(ui.scene, ui.regime, ui.view);
  $("regime-description").textContent = selected.regime.description;
  $("scene-description").textContent = selected.scene.description;
  $("graphs").replaceChildren(); $("view-details").replaceChildren(); $("comparison-components").replaceChildren(); $("comparison-result").textContent = "Replaying\u2026"; $("flow-controls").hidden = true;
  $("lab-panel").setAttribute("aria-busy", "true"); status("lab-status", "Replaying the selected observations and checking geometric certificates\u2026");
  try {
    worker = new Worker(new URL(`./worker.js?v=${RELEASE["worker.js"].sha256}`, import.meta.url), { type: "module" });
    workerTimer = setTimeout(() => { if (id === job) failLab("The bounded replay timed out."); }, 30000);
    worker.onerror = () => { if (id === job) failLab("The analysis worker could not run."); };
    worker.onmessage = ({ data }) => {
      if (id !== job || data.id !== id) return;
      disposeWorker();
      if (!data.ok) return failLab(data.message);
      analysis = data.result;
      const texts = ["Verified \u00b7 invariant in all three regimes", "Verified \u00b7 typed relations reveal the difference", "Verified \u00b7 missing evidence stays indeterminate"];
      const expected = ["indistinguishable-under-regime", "distinguishable-under-regime", "indeterminate"];
      for (const [i, pairId] of ["relabel", "joint-fields", "missing-evidence"].entries()) {
        const check = data.controls.find(c => c.pairId === pairId && c.regimeId === "typed-relations-v1");
        if (check?.status !== expected[i]) return failLab("An instrument control disagrees with the released expectation.");
      }
      document.querySelectorAll(".control-card output").forEach((output, i) => { output.textContent = texts[i]; });
      status("lab-status", `Nine controls replayed; selected graph certificates verified. Browser analysis: ${(data.elapsedMs / 1000).toFixed(2)} s.`);
      $("lab-panel").setAttribute("aria-busy", "false"); labFinished = true; render(); ready();
    };
    worker.postMessage({ id, payload, sceneId: ui.scene, regimeId: ui.regime });
  } catch (error) { failLab(error.message); }
}
const explanations = {
  graph: "Start with the directed connections. Node positions are fixed drawing coordinates; they are not measured distances. Select an edge to keep it in focus across views.",
  geometry: "Forman summarizes local branching. Ollivier compares neighboring distributions. Their values use different definitions and need not have the same sign. Edge color here shows static Ollivier curvature.",
  flow: "Step through verified changes of edge length in a shadow copy. Width encodes length and color encodes current Ollivier curvature. The drawing and source graph stay fixed; screen distance is not the metric.",
  signature: "Read the features separately. The geometric signature summarizes Forman, Ollivier and the declared flow horizon. Response signatures record what structural probes can observe under the selected regime; they are not biological response measurements."
};
const svgNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attributes = {}) { const n = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attributes)) n.setAttribute(k, String(v)); return n; }
function edgeData(example, edgeId) {
  const a = example.geometric, f = a.evidence.forman?.legacyArtifact.result.edges.find(e => e.id === edgeId), o = a.evidence.ollivier?.result.edges.find(e => e.id === edgeId);
  const frame = frameAt(a.evidence.flow, ui.iteration), current = frame.state.edges.find(e => e.id === edgeId);
  return { forman: f?.curvature ?? null, ollivier: o ? rational(o.curvature) : null, length: current ? rational(current.length) : null, currentCurvature: current ? rational(current.curvature) : null, frame };
}
function graphCard(example, side) {
  const card = el("article", undefined, "graph-card"), header = el("header"); header.append(el("h3", `${side ? "B" : "A"} / ${title(example.id)}`), el("small", `${example.graph.nodes.length} nodes \u00b7 ${example.graph.edges.length} arcs`)); card.append(header);
  const svg = svgEl("svg", { viewBox: "0 0 400 225", role: "img", "aria-label": `${title(example.id)}: ${example.graph.edges.map(e => `${e.source} to ${e.target}`).join(", ")}` });
  const coords = { a: [45, 112], b: [150, 45], c: [245, 178], d: [350, 112] }, defs = svgEl("defs");
  const marker = svgEl("marker", { id: `arrow-${side}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse", markerUnits: "strokeWidth" });
  marker.append(svgEl("path", { d: "M0 0 L10 5 L0 10Z", fill: "context-stroke" })); defs.append(marker); svg.append(defs);
  if (!example.graph.edges.some(e => e.id === ui.edges[side])) ui.edges[side] = example.graph.edges[0].id;
  for (const edge of example.graph.edges) {
    const a = coords[edge.source], b = coords[edge.target], dx = b[0] - a[0], dy = b[1] - a[1], distance = Math.hypot(dx, dy), gap = 20;
    const line = { x1: a[0] + dx * gap / distance, y1: a[1] + dy * gap / distance, x2: b[0] - dx * gap / distance, y2: b[1] - dy * gap / distance };
    const v = edgeData(example, edge.id), curvature = ui.view === "flow" ? v.currentCurvature : v.ollivier;
    const colored = ["flow", "geometry"].includes(ui.view), color = !colored ? "#688176" : curvature === null ? "#899085" : curvature < 0 ? "#a94427" : curvature > 0 ? "#286650" : "#688176";
    if (ui.edges[side] === edge.id) svg.append(svgEl("line", { ...line, stroke: "#cbd8bb", "stroke-width": 13, "stroke-linecap": "round" }));
    svg.append(svgEl("line", { ...line, class: "edge", stroke: color, "stroke-width": ui.view === "flow" ? 2 + 3 * v.length : 2.5, "stroke-dasharray": colored && curvature === null ? "5 5" : "none", "marker-end": `url(#arrow-${side})` }));
    const text = svgEl("text", { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 13, class: "edge-label" });
    text.textContent = ui.view === "flow" ? `\u2113 ${format(v.length)}` : ui.view === "geometry" ? curvature === null ? "unmeasured" : `\u03ba ${format(curvature)}` : ""; svg.append(text);
  }
  for (const node of example.graph.nodes) { const [cx, cy] = coords[node.id]; svg.append(svgEl("circle", { cx, cy, r: 17, class: "node" })); const label = svgEl("text", { x: cx, y: cy + 1 }); label.textContent = node.id; svg.append(label); }
  card.append(svg);
  const label = el("label", "Selected connection"), select = el("select"); select.id = `edge-${side}`; label.htmlFor = select.id;
  for (const edge of example.graph.edges) select.append(option(edge.id, `${edge.source} \u2192 ${edge.target}`)); select.value = ui.edges[side];
  select.addEventListener("focus", stop);
  select.addEventListener("change", () => { stop(); ui.edges[side] = select.value; render(); $(`edge-${side}`).focus(); }); card.append(label, select);
  const v = edgeData(example, ui.edges[side]);
  card.append(el("p", ui.view === "flow" ? `Length ${format(v.length)} \u00b7 Ollivier ${format(v.currentCurvature)}` : ui.view === "geometry" ? `Forman ${format(v.forman)} \u00b7 Ollivier ${format(v.ollivier)}` : `Source connection ${select.selectedOptions[0].textContent} \u00b7 source graph unchanged`, "edge-facts"));
  if (ui.view === "flow") card.append(el("p", v.frame.held ? `Stopped at iteration ${v.frame.termination.iteration}: ${v.frame.termination.reason}. Showing the last measured state; no later state was computed.` : `Measured iteration ${v.frame.state.iteration}. Run outcome: ${v.frame.termination.reason} at ${v.frame.termination.iteration}.`, "stop-note"));
  return card;
}
function signatureCard(example) {
  const card = el("article", undefined, "signature-card"); card.append(el("h3", title(example.id)), el("p", `Geometric signature: ${coverage(example.geometric.summary.coverage)} complete feature families. ${stateName(example.geometric.summary.status)}.`));
  for (const feature of example.geometric.features) {
    const item = el("div", undefined, "feature"); item.append(el("strong", feature.id.replace(/-v1$/, "").replaceAll("-", " ")), el("span", ` \u00b7 ${stateName(feature.state)}`, `feature-state ${feature.state}`), el("small", `Coverage ${coverage(feature.coverage)}${feature.reasons.length ? ` \u00b7 ${feature.reasons.map(r => typeof r === "string" ? r : `${r.code} (${r.count})`).join(", ")}` : ""}`));
    if (feature.value?.distribution) item.append(el("p", feature.value.distribution.map(d => `${format(rational(d.value.lower))}${rational(d.value.lower) === rational(d.value.upper) ? "" : `\u2026${format(rational(d.value.upper))}`} \u00d7 ${d.count} edges`).join(" \u00b7 ")));
    if (feature.id === "flow-trajectory-v1") item.append(el("p", `${example.geometric.evidence.flow.states.length} measured states \u00b7 ${example.geometric.evidence.flow.termination.reason} at iteration ${example.geometric.evidence.flow.termination.iteration}. The declared signature horizon requires 9 states (0\u20138).`));
    item.append(jsonDetails("Measured components and provenance", { value: feature.value, provenance: feature.provenance })); card.append(item);
  }
  card.append(el("p", `Response probes: ${coverage(example.response.summary.coverage)} observed \u00b7 ${stateName(example.response.summary.status)}.`));
  for (const feature of example.response.features) { const item = el("div", undefined, "feature"); item.append(el("strong", feature.id.replace("-response-multiset-v0", "")), el("span", ` \u00b7 ${stateName(feature.state)}`, `feature-state ${feature.state}`), el("small", `Coverage ${coverage(feature.coverage)}${feature.reasons.length ? ` \u00b7 ${feature.reasons.map(r => typeof r === "string" ? r : `${r.code} (${r.count})`).join(", ")}` : ""}`), jsonDetails("Probe response components", feature.value)); card.append(item); }
  return card;
}
function render() {
  $("view-explanation").textContent = explanations[ui.view];
  if (!analysis) return;
  $("graphs").replaceChildren(...analysis.examples.map(graphCard)); $("view-details").replaceChildren();
  $("flow-controls").hidden = ui.view !== "flow"; $("iteration").value = ui.iteration; $("iteration-value").textContent = ui.iteration;
  $("graph-legend").textContent = ["geometry", "flow"].includes(ui.view) ? "Ollivier sign: rust = negative \u00b7 green = positive \u00b7 gray = zero \u00b7 dashed = unmeasured. The pale outline marks the selected edge." : "Arrows show direction. The pale outline marks the selected edge. Drawing coordinates stay fixed across all views.";
  if (ui.view === "signature") { const grid = el("div", undefined, "signature-grid"); grid.append(...analysis.examples.map(signatureCard)); $("view-details").append(grid); }
  if (ui.view === "geometry") $("view-details").append(table("All static edge measurements; missing measurements remain unavailable.", ["Graph / connection", "Forman", "Ollivier"], analysis.examples.flatMap((e, side) => e.graph.edges.map(edge => { const v = edgeData(e, edge.id); return [`${side ? "B" : "A"} / ${edge.source} \u2192 ${edge.target}`, format(v.forman), format(v.ollivier)]; }))));
  const comparison = analysis.comparison;
  $("comparison-result").textContent = `${stateName(comparison.status)} \u00b7 coverage ${coverage(comparison.coverage)}`;
  $("comparison-components").replaceChildren(table("Only these observables contribute to the selected structural comparison. Geometric and response signatures are shown separately.", ["Observable", "Result", "Left evidence", "Right evidence", "Reasons"], comparison.components.map(c => [c.observable.id, stateName(c.state), c.left.availability, c.right.availability, c.reasons.map(r => typeof r === "string" ? r : r.code).join(", ") || "\u2014"])), jsonDetails("Exact comparison values", comparison.components.map(c => ({ observable: c.observable.id, values: c.values }))));
}
function setView(view, focus = false) {
  selection(ui.scene, ui.regime, view); stop(); ui.view = view;
  for (const button of document.querySelectorAll("[data-view]")) { const active = button.dataset.view === view; button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; if (active && focus) button.focus(); }
  $("lab-panel").setAttribute("aria-labelledby", `tab-${view}`); render();
}
for (const scene of SCENES) $("scene").append(option(scene.id, scene.name));
for (const regime of REGIMES) $("regime").append(option(regime.id, regime.name));
$("scene").addEventListener("change", () => { ui.scene = $("scene").value; ui.iteration = 0; run(); });
$("regime").addEventListener("change", () => { ui.regime = $("regime").value; run(); });
for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => setView(button.dataset.view));
  button.addEventListener("keydown", event => {
    const index = VIEWS.indexOf(ui.view); let next;
    if (event.key === "ArrowRight") next = (index + 1) % 4; else if (event.key === "ArrowLeft") next = (index + 3) % 4; else if (event.key === "Home") next = 0; else if (event.key === "End") next = 3; else return;
    event.preventDefault(); setView(VIEWS[next], true);
  });
}
$("iteration").addEventListener("input", () => { stop(); ui.iteration = Number($("iteration").value); render(); });
$("play").addEventListener("click", () => {
  if (playTimer) return stop(); if (!analysis || ui.view !== "flow") return;
  if (ui.iteration === 8) ui.iteration = 0;
  $("play").textContent = "Pause flow"; render();
  playTimer = setInterval(() => { ui.iteration += 1; render(); if (ui.iteration >= 8) stop(); }, 850);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
window.addEventListener("pagehide", () => { stop(); disposeWorker(); });
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", stop);

function renderPrimary() {
  $("primary-results").replaceChildren(...evidence.studies.map((study, i) => {
    const b = replayScore(study.models.B), g = replayScore(study.models["B+G"]), delta = pairedGain(study.models.B, study.models["B+G"]), card = el("article", undefined, "result-card");
    card.append(el("p", i < 2 ? "Simulated regulatory networks" : "Processed fluorescence responses", "eyebrow"), el("h3", title(study.id)), el("div", format(delta, true), `delta ${delta > 0 ? "positive" : "negative"}`), el("p", `B ${format(b.value)} \u2192 B + G ${format(g.value)} \u00b7 mean paired rank-skill difference`, "score-line"), el("p", `${b.targets} target rows \u00b7 ${b.groups.length} held-out ${i < 2 ? "networks" : "stimulus sources"}`, "coverage"), el("p", i === 0 ? "Positive on this simulated knockout panel; sensitive to the comparison baseline." : i === 1 ? "Geometry lowers rank skill here. Knockdown results do not reproduce the knockout gain." : "Geometry lowers rank skill on this restricted population. Low-degree neurons have no eligible primary pairs.", "limitation"));
    return card;
  }));
}
function selectFilter(label, options, value, change) { const l = el("label", label), s = el("select"); for (const [id, name] of options) s.append(option(id, name)); s.value = value; s.addEventListener("change", () => change(s.value)); l.append(s); return l; }
let researchStudy = "dream4-knockouts", coverageDataset = "Dataset7", coverageVariant = "weak-one";
function research() {
  const target = $("research-detail"), view = $("evidence-view").value; target.replaceChildren();
  const add = (...nodes) => target.append(...nodes), paragraph = text => el("p", text);
  if (["ablations", "capacity", "metric"].includes(view)) {
    const study = evidence.studies.find(s => s.id === researchStudy), filters = el("div", undefined, "research-filter"); filters.append(selectFilter("Study", evidence.studies.map(s => [s.id, title(s.id)]), researchStudy, id => { researchStudy = id; research(); })); add(filters);
    if (view === "ablations") {
      add(el("h3", "Separate the geometric feature families"), paragraph("F: directed unit Forman. O: directed Ollivier. flow: normalized shadow-flow descriptors. B + F + O + flow is the full B + G model used in the result cards. Each row uses the same fixed population and learning procedure."), table(title(study.id), ["Model", "Features", "Rank skill", "Difference from B"], Object.entries(study.ablations).map(([name, m]) => [name, m.featureCount, format(replayScore(m).value), format(pairedGain(study.ablations.B, m), true)])), paragraph("These ablations show which feature sets were evaluated; they do not identify a biological cause or select a new model after seeing the results."));
    } else if (view === "capacity") {
      add(el("h3", "Compare against a stronger baseline"), paragraph("B: 23 graph features. G: 31 geometric features. Q: 31 fixed squares and products of B as a nonlinear capacity control. S: 31 expanded graph features. The same nested ridge procedure evaluates all six models."), table(title(study.id), ["Model", "Features", "Rank skill", "Difference from B"], Object.entries(study.models).map(([name, m]) => [name, m.featureCount, format(replayScore(m).value), format(pairedGain(study.models.B, m), true)])), paragraph(`Adding G to the expanded baseline B + S changes rank skill by ${format(pairedGain(study.models["B+S"], study.models["B+S+G"]), true)}. Geometric features do not add information beyond the full graph; this tests their usefulness relative to particular feature sets.`));
    } else {
      add(el("h3", "A result depends on the declared metric"), paragraph("Five fixed variants retain the same populations and learning procedure. Idleness is the mass left at the endpoint. Inverse-share uses synthetic unit masses, not measured biological weights; Forman remains the unit convention."), table(`${title(study.id)} \u00b7 all five variants`, ["Variant", "B + G", "Gain over B", "B + S + G", "Gain over B + S"], evidence.metric.map(v => { const m = v.studies.find(s => s.id === study.id).models; return [v.id, format(replayScore(m["B+G"]).value), format(pairedGain(study.models.B, m["B+G"]), true), format(replayScore(m["B+S+G"]).value), format(pairedGain(study.models["B+S"], m["B+S+G"]), true)]; })), paragraph("unit-half is the primary metric; unit-zero changes idleness to 0; inverse-share-half changes the metric provider; outdegree-initial changes initial lengths. double-unit-initial doubles all starting lengths and is a scale-invariance control. It gives the same scores, not a second biological replication."));
    }
    add(jsonDetails("Held-out group scores and rank-count inputs", study.models));
  } else if (view === "scope") {
    add(el("h3", "Keep the target population matched"), paragraph("A different neighborhood can change both graph features and which targets qualify. Each complete alternative is compared with the reference geometry refitted on exactly the same target rows, using both the original and expanded baselines."), table("C. elegans Dataset7 \u00b7 every planned selection retained", ["Selection", "Target rows", "Source groups", "Outcome"], evidence.scope.map(v => [v.variant, v.population.rows, v.population.groups, v.status === "complete" ? "Complete" : `Unavailable: ${v.reason}`])));
    for (const v of evidence.scope.filter(v => v.status === "complete")) add(table(`${v.variant} \u00b7 ${v.population.rows} matched rows; gains are relative to each context\u2019s own baseline`, ["Context", "B", "B + G", "Gain", "B + S", "B + S + G", "Gain"], v.contexts.map(c => { const m = c.models; return [c.id === "reference" ? "Reference weak neighborhood" : "Selected neighborhood", format(replayScore(m.B).value), format(replayScore(m["B+G"]).value), format(pairedGain(m.B, m["B+G"]), true), format(replayScore(m["B+S"]).value), format(replayScore(m["B+S+G"]).value), format(pairedGain(m["B+S"], m["B+S+G"]), true)]; })));
    add(paragraph("On the 35 incoming-neighborhood rows, the original-baseline gain is positive for the selected context, while the expanded-baseline gain is negative. The weak-neighborhood reference also changes when refitted on these 35 rows. This does not select a winning neighborhood or a new default."));
  } else if (view === "coverage") {
    const filters = el("div", undefined, "research-filter"); filters.append(selectFilter("Anatomy", [["Dataset7", "Dataset7 \u00b7 primary"], ["Dataset8", "Dataset8 \u00b7 candidate population"]], coverageDataset, id => { coverageDataset = id; research(); }), selectFilter("Neighborhood", evidence.scope.map(v => [v.variant, v.variant]), coverageVariant, id => { coverageVariant = id; research(); })); add(filters);
    const data = evidence.coverage.find(c => c.id === coverageDataset);
    add(el("h3", "Prepared graphs are not the same as evaluated nodes"), paragraph("Degree is the number of unique neighbors in the full parent anatomy. A prepared root has a computable bounded neighborhood. A represented node appears in at least one prepared neighborhood. Eligible pairs additionally require the response evidence gates. The pair columns describe the fixed reference target population and do not change with the neighborhood selector; matched alternative populations are listed under Subgraph selection."), table(`${coverageDataset} \u00b7 ${data.targetCoverageRole}; pair counts are counted once by source and once by receiver, not added together`, ["Parent degree", "Nodes", "Prepared roots", "Represented", "Pairs as source", "Pairs as receiver"], data.bins.map(b => { const v = b.variants.find(v => v.variant === coverageVariant); return [b.bin, b.parentNodes, v.preparedRoots, v.representedNodes, b.eligiblePairsBySource, b.eligiblePairsByReceiver]; })), paragraph(coverageDataset === "Dataset7" ? "All five low-degree neurons (degree \u2264 5) have prepared weak neighborhoods, but none participates in an eligible primary pair. Their predictive performance has not been tested. Missing repeated recordings prevent source eligibility." : "Seven low-degree neurons occur in Dataset8. Candidate response coverage does not make this a completed evaluation: the alternative-anatomy study remains unavailable."), paragraph("DREAM4 retains all 50 network-local genes, including 48 with degree \u2264 5. Each gene contributes nine source and nine receiver rows per contrast. This establishes coverage, not a separately measured low-degree performance result."), jsonDetails("Individual low-degree coverage records", evidence.lowDegree.find(d => d.id === coverageDataset).nodes));
  } else if (view === "nulls") {
    add(el("h3", "Retain unsuccessful checks"), table("Deterministic degree/component-preserving null graphs; 32 planned replicates per study", ["Study", "Complete", "Unavailable", "Original gain exceeds"], evidence.nulls.map(s => [title(s.id), `${s.complete}/${s.planned}`, s.planned - s.complete, s.complete > 0 && s.relativeToOriginal ? `${s.relativeToOriginal.below}/${s.complete} null gains` : "Unavailable"])), paragraph("The knockout result exceeds 31 of 32 null gains. This is a descriptive sensitivity result, not a calibrated p-value: the deterministic swap sampler is not uniform. All C. elegans null comparisons are unavailable because required scopes fail the sampling gate; these are not zero-effect results."), el("h3", "Alternative anatomy: unavailable"), paragraph("Dataset8 has 37 candidate pairs across eight sources. The ALML scope exceeds the exact arithmetic limit, preventing the complete matched study. Only 18 pairs across four groups overlap the primary population, below the required five-group floor. This remains unavailable even if the numeric limit is resolved."), jsonDetails("Alternative-anatomy coverage and comparison outcome", evidence.anatomy), jsonDetails("All null outcomes, including failures", evidence.nulls));
  } else if (view === "synthetic") {
    const s = evidence.synthetic;
    add(el("h3", "Zero additional distinctions on the available synthetic panel"), paragraph(`${s.gained} added distinctions among ${s.eligiblePairs} eligible pairs; ${s.excludedPairs} pairs excluded from ${s.totalPairs} planned pairs. The baseline already distinguishes every eligible pair. There are no eligible degree-matched hard-negative pairs in this panel.`), paragraph("This is a ceiling-limited discrimination check, not a biological response-prediction score. It neither demonstrates general usefulness nor establishes that structural geometry cannot help. The biological studies ask a separate question with their own baselines and populations."), jsonDetails("Exact synthetic primary counts", s));
  }
}
async function loadEvidence() {
  try {
    evidence = verifyEvidence(await fetchPinned(new URL("./evidence.json", import.meta.url), RELEASE["evidence.json"])); renderPrimary(); research(); $("evidence-view").disabled = false;
    const list = $("source-list");
    for (const source of evidence.sources) { const item = el("div", undefined, "source-item"), link = el("a", source.path); link.href = `../../${source.path}`; item.append(link, el("code", `Report: ${source.reportHash}`), el("code", `File SHA-256: ${source.sha256} \u00b7 ${source.bytes.toLocaleString("en-US")} bytes`)); if (source.costs) { const cost = el("a", "Recorded offline computation costs \u2197"); cost.href = `../../${source.costs}`; item.append(cost); } list.append(item); }
    status("evidence-status", "Release checksums verified. Displayed model scores replayed from stored rank counts; biological models were not retrained.");
  } catch (error) { evidence = undefined; $("primary-results").replaceChildren(); $("research-detail").replaceChildren(); $("source-list").replaceChildren(); $("evidence-view").disabled = true; status("evidence-status", `Research evidence unavailable: ${error.message} Reload the page to retry.`, true); evidenceFailed = true; }
  evidenceFinished = true; ready();
}
$("evidence-view").addEventListener("change", research);
async function loadLab() {
  try { payload = await fetchPinned(new URL("./controls.json", import.meta.url), RELEASE["controls.json"]); $("scene").disabled = false; $("regime").disabled = false; run(); }
  catch (error) { failLab(error.message); }
}
render();
await Promise.allSettled([loadEvidence(), loadLab()]);
