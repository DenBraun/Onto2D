import { IDENTITY_SCENARIOS, TRIANGLE_SKELETON_ID, inputView } from "./identity-model.js?v=20260816.10";
import { graphSvg } from "./identity-graph-renderer.js?v=20260816.10";

const $ = (selector, root = document) => root.querySelector(selector);
const state = { scenarioId: "base", permutationIndex: 0, reverseEdgeOrder: false };
const baselineId = IDENTITY_SCENARIOS.base.candidateId;

function shortHash(hash) { return `${hash.slice(7, 19)}...${hash.slice(-6)}`; }

function render() {
  const view = inputView(state.scenarioId, state.permutationIndex, state.reverseEdgeOrder);
  const scenario = view.scenario;
  const same = scenario.candidateId === baselineId;
  $("#input-graph").innerHTML = graphSvg(view);
  $("#input-name").textContent = scenario.name;
  $("#input-change").textContent = scenario.change === "none" ? "representation only" : `${scenario.change} changed`;
  $("#input-edges").innerHTML = view.edges.map((edge, index) => `<li><span>${index + 1}</span><code>${view.labels[edge.from]} -&gt; ${view.labels[edge.to]}</code><small>${edge.role}</small></li>`).join("");
  $("#candidate-id").textContent = scenario.candidateId;
  $("#baseline-id").textContent = shortHash(baselineId);
  $("#current-id").textContent = shortHash(scenario.candidateId);
  $("#skeleton-id").textContent = TRIANGLE_SKELETON_ID;
  $("#result-copy").textContent = scenario.message;
  $("#comparison-symbol").textContent = same ? "=" : "!=";
  $("#identity-stage").dataset.result = same ? "same" : "changed";
  $("#result-badge").innerHTML = `<i></i>${same ? "Identity stable" : "New identity"}`;
  $("#permutation-counter").textContent = `${state.permutationIndex + 1} / 6`;
  $(".permutation-counter small").textContent = `edge list: ${state.reverseEdgeOrder ? "reversed" : "forward"}`;
  $("[data-action='reverse']").classList.toggle("is-active", state.scenarioId === "reverse");
  $("[data-action='role']").classList.toggle("is-active", state.scenarioId === "role");
}

$(".controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "permute") {
    state.permutationIndex = (state.permutationIndex + 1) % 6;
    state.reverseEdgeOrder = !state.reverseEdgeOrder;
  } else if (action === "reverse") {
    state.scenarioId = state.scenarioId === "reverse" ? "base" : "reverse";
  } else if (action === "role") {
    state.scenarioId = state.scenarioId === "role" ? "base" : "role";
  } else if (action === "reset") {
    state.scenarioId = "base";
    state.permutationIndex = 0;
    state.reverseEdgeOrder = false;
  }
  render();
});

render();
