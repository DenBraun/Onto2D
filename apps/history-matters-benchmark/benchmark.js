import { buildHistoryBenchmarkSuite } from "@onto2d/history-benchmark";
import { canonicalize } from "@onto2d/kernel/canonical";
import { PILOT_SHA256 } from "./pin.js?v=20260905.6";
import { benchmarkRows, filterBenchmarkRows, formatScore } from "./presentation.js?v=20260905.6";
import { readPilotBytes } from "./transport.js?v=20260905.6";

const root = new URL("../../", import.meta.url);
const filterFields = ["claimClass", "verdict", "historyMode", "effect"];
const controlExplanations = {
  "history-matters-reference-positive-v1": {
    expected: "Fewer errors", title: "History helps",
    explanation: "The present looks the same. History reveals the difference."
  },
  "history-matters-reference-negative-v1": {
    expected: "More errors", title: "History hurts",
    explanation: "The present is enough. Extra history creates irrelevant distinctions."
  },
  "history-matters-reference-neutral-v1": {
    expected: "Same error count", title: "Nothing changes",
    explanation: "History repeats what the present already tells us."
  }
};
let examples = [];
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(text, relative) {
  const a = node("a", text);
  const url = new URL(relative, root);
  if (!url.href.startsWith(root.href)) throw new Error("Link outside the project.");
  a.href = url.href;
  return a;
}
function card(row) {
  const article = node("article", undefined, `contrast ${row.claimClass}`);
  article.id = row.benchmarkId;
  const heading = node("header");
  const family = row.claimClass === "synthetic" ? "Synthetic control" : `${row.claimClass} / ${row.designClass}`;
  heading.append(node("span", family, "family"), node("h3", row.title), node("span", row.verdict.replaceAll("-", " "), `verdict ${row.verdict}`));
  article.append(heading, node("p", `${row.historyMode} history · ${row.effect.replaceAll("-", " ")} · ${row.status}`, "metadata"));
  if (!row.result) {
    article.append(node("p", row.reason));
    if (row.readiness) {
      const ready = row.readiness;
      article.append(node("p", `${ready.counts.trainingUnits} training engines · ${ready.counts.trainingSamples} observed prefixes · ${ready.counts.testUnits} test engines`, "null-result"));
      article.append(node("p", `Four frozen views compare current sensors, current sensors + history, and both alternatives with observed age. Each prediction uses ${row.contract.evaluator.neighbors} different training engines. Normalization uses training data only.`));
      article.append(node("p", "Predictions are ready for independent protocol review. Test error, history gain and predictive advantage have not been evaluated.", "boundary"));
      const links = node("p", undefined, "artifact-links");
      links.append(link("Frozen contract", row.contractPath), link("Preparation", row.preparationPath), link("Readiness", row.readinessPath));
      article.append(links);
    }
    article.append(link("Read the evaluation plan", row.planPath));
    return article;
  }
  appendEvidence(article, row);
  return article;
}
function appendEvidence(container, row) {
  const { result, contract } = row;
  const definitions = node("dl", undefined, "definitions");
  for (const [label, value] of [["Present", contract.presentView], ["History", contract.historyView], ["Target", contract.targetView]]) definitions.append(node("dt", label), node("dd", value));
  const scores = node("div", undefined, "scores");
  for (const [label, score] of [["Present only", result.primary?.presentOnly ?? null], ["Present + history", result.primary?.presentPlusHistory ?? null]]) {
    const panel = node("div");
    panel.append(node("span", label), node("strong", formatScore(score)));
    scores.append(panel);
  }
  container.append(definitions, scores, node("p", result.primary === null ? "No interpretable primary metric." : `Pairwise error; lower is better. Gain: ${result.primary.orientedGain.toFixed(3)}. Resolution: ${result.primary.resolution}.`));
  const nullText = result.nulls.meanError === null ? "Not available" : result.nulls.meanError.toFixed(3);
  container.append(node("p", `Wrong-history null: ${nullText} mean error across ${result.nulls.trials.length}/${result.nulls.requestedTrials} trials; ${result.nulls.status}.`, "null-result"));
  if (result.nulls.trueHistoryBeatsNullMean === false) container.append(node("p", "True history does not beat the null mean. Unique partitions can survive history reassignment; this diagnostic does not establish useful historical correspondence.", "null-caveat"));
  container.append(node("p", result.interpretationBoundary, "boundary"));
  const details = node("details");
  details.append(node("summary", "Protocol and exact artifacts"), node("p", "All source-fixture units are included. Current observations match the cutoff, history is ordered and does not extend beyond it, target labels use a separate input, and no model is fitted. Upstream field meaning and proxy leakage still require case review."));
  const links = node("p", undefined, "artifact-links");
  links.append(link("Contract", row.contractPath), link("Result JSON", row.resultPath));
  details.append(links, node("code", result.hash));
  for (const issue of result.issues) details.append(node("p", `${issue.code}: ${issue.message}`));
  container.append(details);
}
function controlCard(row) {
  const explanation = controlExplanations[row.benchmarkId];
  const article = node("article", undefined, "contrast synthetic control-check");
  article.id = row.benchmarkId;
  article.append(node("p", `Expected: ${explanation.expected}`, "check-expected"), node("h3", explanation.title), node("p", explanation.explanation, "check-copy"));
  const metric = node("p", undefined, "check-metric");
  const shortScore = (score) => score === null || score.value === null ? "N/A" : `${score.errors} / ${score.pairs}`;
  const primary = row.result.primary;
  metric.append(node("span", "Errors: present → with history"), node("strong", `${shortScore(primary?.presentOnly ?? null)} → ${shortScore(primary?.presentPlusHistory ?? null)}`));
  article.append(metric, node("span", `Observed: ${row.verdict.replaceAll("-", " ")}`, `verdict ${row.verdict}`));
  const details = node("details", undefined, "check-details");
  details.append(node("summary", "How this check works"), node("p", "Each pair is checked against the target: should these two items count as the same or different? Fewer wrong answers means lower error."));
  appendEvidence(details, row);
  article.append(details);
  return article;
}
function render() {
  const filters = Object.fromEntries(filterFields.map((field) => [field, document.getElementById(field).value]));
  const visible = filterBenchmarkRows(examples, filters);
  document.getElementById("contrasts").replaceChildren(...visible.map(card));
  document.getElementById("count").textContent = `${visible.length} of ${examples.length} examples and research candidates. No aggregate score.`;
  document.getElementById("empty-examples").hidden = visible.length !== 0;
}
async function initialize() {
  const response = await fetch(new URL("./pilot.json", import.meta.url), { cache: "no-store", redirect: "error", credentials: "same-origin", signal: AbortSignal.timeout(15000) });
  const bytes = await readPilotBytes(response);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (hash !== PILOT_SHA256) throw new Error("Pilot artifact hash mismatch.");
  const bundle = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (canonicalize(buildHistoryBenchmarkSuite(bundle.entries)) !== canonicalize(bundle.suite)) throw new Error("Suite failed exact replay.");
  const rows = benchmarkRows(bundle.registry, bundle.entries, bundle.preparations);
  examples = rows.filter((row) => row.claimClass !== "synthetic");
  const controls = rows.filter((row) => row.claimClass === "synthetic");
  document.getElementById("controls").replaceChildren(...controls.map(controlCard));
  document.getElementById("checks-count").textContent = `${controls.length} checks · Same pairs, with and without history · Fewer errors is better`;
  for (const field of filterFields) {
    const select = document.getElementById(field);
    for (const value of [...new Set(examples.map((row) => row[field]))].sort()) {
      const option = node("option", value.replaceAll("-", " "));
      option.value = value;
      select.append(option);
    }
    select.disabled = false;
    select.addEventListener("change", render);
  }
  render();
  document.getElementById("verification").textContent = `Data checked. All ${bundle.entries.length} saved results reproduced locally in your browser.`;
  document.body.dataset.ready = "true";
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
initialize().catch((error) => {
  examples = [];
  document.getElementById("contrasts").replaceChildren();
  document.getElementById("controls").replaceChildren();
  document.getElementById("count").textContent = "";
  document.getElementById("checks-count").textContent = "";
  document.getElementById("empty-examples").hidden = true;
  for (const field of filterFields) document.getElementById(field).disabled = true;
  document.getElementById("verification").textContent = `Results unavailable: ${error.message}`;
  document.body.dataset.ready = "error";
});
