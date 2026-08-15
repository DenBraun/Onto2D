import { THREE_NODE_MOTIF_EXPLORER_DATA as DATA } from "./data.js?v=20260815.4";
import { analyzeFflConstruction, deriveEcoliReading } from "./reading-model.js?v=20260815.4";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motifByCode = new Map(DATA.motifs.map((motif) => [motif.triadCode, motif]));
const catalogueOrder = new Map(DATA.motifs.map((motif, index) => [motif.triadCode, index]));
const state = { filter: "all", sort: "catalogue", selected: "030T", constructionRegime: "observed" };
const ecoliReading = deriveEcoliReading(DATA);

function statusFor(motif) {
  if (motif.significant) return { key: "enriched", label: "enriched motif" };
  if (Number.isFinite(motif.zScore) && motif.zScore < -2) return { key: "under", label: "under-represented" };
  if (Number.isFinite(motif.zScore)) return { key: "measured", label: "not enriched" };
  return { key: "fixed", label: "null-fixed absence" };
}

function number(value, digits = 3) {
  if (value === null) return "-";
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(digits);
}

function signed(value, digits = 2) {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function hasMutualEdge(motif) {
  const edges = new Set(motif.edges.map(([from, to]) => `${from}:${to}`));
  return motif.edges.some(([from, to]) => edges.has(`${to}:${from}`));
}

function motifSvg(motif, suffix, large = false) {
  const positions = [{ x: 50, y: 15 }, { x: 17, y: 74 }, { x: 83, y: 74 }];
  const edgeSet = new Set(motif.edges.map(([from, to]) => `${from}:${to}`));
  const markerId = `arrow-${motif.triadCode.toLowerCase()}-${suffix}`;
  const paths = motif.edges.map(([from, to]) => {
    const start = positions[from];
    const end = positions[to];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const x1 = start.x + ux * 9;
    const y1 = start.y + uy * 9;
    const x2 = end.x - ux * 11;
    const y2 = end.y - uy * 11;
    const mutual = edgeSet.has(`${to}:${from}`);
    const path = mutual
      ? `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${((start.x + end.x) / 2 - uy * 7).toFixed(1)} ${((start.y + end.y) / 2 + ux * 7).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
      : `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    return `<path d="${path}" marker-end="url(#${markerId})"></path>`;
  }).join("");
  const nodes = positions.map((position, index) => `<g transform="translate(${position.x} ${position.y})"><circle r="8"></circle><text y="3.5">${"abc"[index]}</text></g>`).join("");
  return `<svg class="motif-diagram${large ? " is-large" : ""}" viewBox="0 0 100 92" role="img" aria-label="${motif.name}: ${motif.edges.length} directed edges"><defs><marker id="${markerId}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7z"></path></marker></defs><g class="motif-edges">${paths}</g><g class="motif-nodes">${nodes}</g></svg>`;
}

function filteredMotifs() {
  const filtered = DATA.motifs.filter((motif) => {
    if (state.filter === "observed") return motif.observed > 0;
    if (state.filter === "mutual") return hasMutualEdge(motif);
    return true;
  });
  return [...filtered].sort((left, right) => {
    if (state.sort === "observed") return right.observed - left.observed || catalogueOrder.get(left.triadCode) - catalogueOrder.get(right.triadCode);
    if (state.sort === "z") {
      const leftZ = Number.isFinite(left.zScore) ? left.zScore : Number.NEGATIVE_INFINITY;
      const rightZ = Number.isFinite(right.zScore) ? right.zScore : Number.NEGATIVE_INFINITY;
      return rightZ - leftZ || catalogueOrder.get(left.triadCode) - catalogueOrder.get(right.triadCode);
    }
    return catalogueOrder.get(left.triadCode) - catalogueOrder.get(right.triadCode);
  });
}

function renderPrimary() {
  $("#primary-graph").innerHTML = motifSvg(motifByCode.get("030T"), "primary", true);
}

function renderClosureReading() {
  $("#ffl-share").textContent = `${(ecoliReading.targetOccurrenceShare * 100).toFixed(3)}%`;
  $("#ffl-fold").textContent = `${ecoliReading.target.foldEnrichment.toFixed(3)}x`;
  $("#ffl-excess-share").textContent = `${(ecoliReading.targetExcessFraction * 100).toFixed(1)}%`;
  $("#observed-class-count").textContent = String(ecoliReading.observedClassCount);
  $("#allowed-absent-count").textContent = String(ecoliReading.allowedButAbsentCodes.length);
  $("#allowed-absent-codes").textContent = ecoliReading.allowedButAbsentCodes.join(", ");
  $("#null-fixed-count").textContent = String(ecoliReading.nullFixedClassCount);

  $("#closure-precursors").innerHTML = ecoliReading.precursors.map((motif) => `
    <div class="closure-state is-open">
      ${motifSvg(motif, `closure-${motif.triadCode}`)}
      <div><strong>${motif.triadCode}</strong><span>Observed ${number(motif.observed, 0)}</span><b>${signed(motif.deltaFromNull, 3)} vs null</b></div>
    </div>`).join("");
  const target = ecoliReading.target;
  $("#closure-target").innerHTML = `
    <div class="closure-state is-closed">
      ${motifSvg(target, "closure-target", true)}
      <div><strong>${target.triadCode}</strong><span>Observed ${number(target.observed, 0)}</span><b>${signed(ecoliReading.targetDeltaFromNull, 3)} vs null</b></div>
    </div>`;
}

function renderConstructionProbe() {
  const result = analyzeFflConstruction(DATA, state.constructionRegime);
  const accepted = new Set(result.acceptedPrecursorCodes);
  $("#construction-paths").innerHTML = ecoliReading.precursors.map((motif) => {
    const survives = accepted.has(motif.triadCode);
    return `<div class="probe-path${survives ? " is-accepted" : " is-rejected"}"><strong>${motif.triadCode}</strong><span>${survives ? "passes F" : "removed by F"}</span><small>${number(motif.observed, 0)} observed | Z ${signed(motif.zScore)}</small></div>`;
  }).join("");
  const finite = Number.isFinite(result.historicalLoad);
  $("#construction-result").innerHTML = `
    <div><span>Free minimum</span><strong>a0 = ${result.freePathLength}</strong></div>
    <div><span>Admissible minimum</span><strong>aF = ${finite ? result.admissiblePathLength : "INF"}</strong></div>
    <div class="load-value"><span>Historical load</span><strong>dH = ${finite ? result.historicalLoad : "INF"}</strong></div>
    <p>${finite
      ? `All three connected precursors survive; ${result.survivingEdgeOrders} of ${result.totalEdgeOrders} edge orders still reach 030T in three steps.`
      : `030T is significant, but none of its connected two-edge precursors is. No declared edge-addition history survives this filter.`}</p>`;
  $$("[data-regime]").forEach((button) => {
    const active = button.dataset.regime === state.constructionRegime;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSelected() {
  const motif = motifByCode.get(state.selected);
  const status = statusFor(motif);
  const edges = motif.edges.map(([from, to]) => `${"abc"[from]}->${"abc"[to]}`).join(" | ");
  $("#selected-panel").innerHTML = `
    <div class="selected-top"><div><p class="overline">Selected class</p><h3>${motif.triadCode}</h3></div><span class="status is-${status.key}">${status.label}</span></div>
    ${motifSvg(motif, "selected", true)}
    <h4>${motif.name}</h4><p>${motif.description}</p>
    <dl><div><dt>Observed</dt><dd>${number(motif.observed, 0)}</dd></div><div><dt>Null mu +/- sigma</dt><dd>${motif.nullStandardDeviation === 0 ? `${number(motif.nullMean)} +/- 0` : `${number(motif.nullMean)} +/- ${number(motif.nullStandardDeviation)}`}</dd></div><div><dt>Z-score</dt><dd>${signed(motif.zScore, 3)}</dd></div><div><dt>Z rank</dt><dd>${Number.isFinite(motif.zScore) ? motif.rank : "-"}</dd></div></dl>
    <div class="edge-list"><span>Edge list</span><code>${edges}</code></div>
    <div class="identity"><span>Onto2D canonical ID</span><code>${motif.canonicalId}</code></div>`;
}

function renderGrid() {
  const motifs = filteredMotifs();
  $("#motif-grid").innerHTML = motifs.map((motif) => {
    const status = statusFor(motif);
    const selected = motif.triadCode === state.selected;
    return `<button class="motif-card is-${status.key}${selected ? " is-selected" : ""}" type="button" data-motif="${motif.triadCode}" aria-pressed="${selected}"><header><div><strong>${motif.triadCode}</strong><small>mFinder ${motif.mfinderId}</small></div><span>${status.label}</span></header><div class="card-body">${motifSvg(motif, `card-${motif.triadCode}`)}<div><h3>${motif.name}</h3><p>${motif.description}</p></div></div><dl><div><dt>Observed</dt><dd>${number(motif.observed, 0)}</dd></div><div><dt>Null mu</dt><dd>${number(motif.nullMean)}</dd></div><div><dt>Z</dt><dd>${signed(motif.zScore)}</dd></div></dl><footer><span>Onto2D ID</span><code>${motif.canonicalId.slice(7, 19)}...</code></footer></button>`;
  }).join("");
}

function render() {
  renderSelected();
  renderGrid();
  $$("[data-filter]").forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#sort-select").value = state.sort;
}

$("#filter-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  const visible = filteredMotifs();
  if (!visible.some((motif) => motif.triadCode === state.selected)) state.selected = visible[0].triadCode;
  render();
});

$("#construction-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-regime]");
  if (!button) return;
  state.constructionRegime = button.dataset.regime;
  renderConstructionProbe();
});

$("#sort-select").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
$("#motif-grid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-motif]");
  if (!card) return;
  state.selected = card.dataset.motif;
  render();
  if (window.matchMedia("(max-width: 760px)").matches) $("#selected-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderPrimary();
renderClosureReading();
renderConstructionProbe();
render();
