import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { check, sha256 } from "./check.mjs";
import { eventEligibility } from "./functional.mjs";
import { prepareDreamPopulation } from "./populations.mjs";
import { publishExclusive } from "./io.mjs";

const here = new URL("./", import.meta.url);
// Commit measured audit content independently of the enclosing protocol lock,
// whose hash would otherwise create a circular freeze dependency.
export function auditContentHash(value) {
  const { protocolLockSha256, reportSha256, ...content } = value;
  return sha256(JSON.stringify(content));
}
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const increment = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1; };
const sortedCounts = counts => Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const count = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === "string" && value.length > 0;
function closed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getOwnPropertySymbols(value).length ||
      Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) throw new Error(`Expected a closed ${label}.`);
}
function list(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum || Object.getOwnPropertySymbols(value).length || Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index))) throw new Error(`Invalid ${label} population.`);
}
function counts(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getOwnPropertySymbols(value).length ||
      Object.entries(value).some(([key, number]) => !text(key) || !count(number))) {
    throw new Error(`Invalid ${label} count ledger.`);
  }
}

async function preparedFile(name, expectedHash) {
  for (const path of ["../datasets/cache", "../datasets/cache/prepared"]) {
    const info = await lstat(fileURLToPath(new URL(path, here)));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("D2 cache must use real directories.");
  }
  const path = new URL(`../datasets/cache/prepared/${name}`, here), info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Expected a regular D2 prepared artifact.");
  const bytes = await readFile(path);
  if (sha256(bytes) !== expectedHash) throw new Error(`D2 prepared ${name} differs from the accepted census.`);
  return JSON.parse(bytes);
}

// Only native event coordinates and the D2 exact-label mapping are read here.
// Trace values and receiver contrasts are deliberately a later D5 computation.
export function functionalMetadataAudit(native, applicability, protocol) {
  const anatomicalMatches = applicability.witvliet.filter(unit => unit.id === protocol.celegans.primaryAnatomy);
  const mappingMatches = applicability.mappings.filter(unit => unit.anatomicalUnitId === protocol.celegans.primaryAnatomy);
  if (anatomicalMatches.length !== 1 || mappingMatches.length !== 1) throw new Error("Selected primary anatomy or its mapping is absent or repeated.");
  const [anatomy] = anatomicalMatches, [mapping] = mappingMatches;
  if (new Set(anatomy.parent.nodes).size !== anatomy.parent.nodes.length) throw new Error("Repeated anatomical parent node.");
  const scopes = anatomy.scopes.filter(scope => scope.kind === "closed-weak-one-hop");
  if (scopes.some(scope => new Set(scope.nodeIds).size !== scope.nodeIds.length || !scope.nodeIds.includes(scope.root) ||
      scope.nodeIds.some(node => !anatomy.parent.nodes.includes(node)))) throw new Error("Functional root membership differs from its anatomical parent.");
  const roots = new Map(scopes.map(scope => [scope.root, {
    source: scope.root, graphHash: scope.graphHash, nodeCount: scope.nodeIds.length,
    scopeEligible: scope.providers.commonGeometry.state === "prepared",
    mappedStimulusRows: 0, eligibleWindowRows: 0, recordingIds: new Set()
  }]));
  if (roots.size !== scopes.length || roots.size !== anatomy.parent.nodes.length || anatomy.parent.nodes.some(node => !roots.has(node))) {
    throw new Error("Functional audit requires every anatomical root exactly once.");
  }
  const mappings = new Map(mapping.recordings.map(record => [record.recordingId, record]));
  const nativeIds = native.randi.recordings.map(record => record.recording_id);
  if (new Set(nativeIds).size !== nativeIds.length || mappings.size !== mapping.recordings.length ||
      mappings.size !== nativeIds.length || nativeIds.some(id => !mappings.has(id))) throw new Error("Functional recordings and mappings must align exactly without duplicates.");
  const exclusions = {}, windowReasons = {}, records = [];
  let nativeStimulusRows = 0;
  for (const recording of native.randi.recordings) {
    const mapped = mappings.get(recording.recording_id);
    if (!mapped) throw new Error("Functional recording mapping is absent.");
    const boundLabels = mapped.labels.filter(row => row.columnIndex !== null);
    const labels = new Map(boundLabels.map(row => [row.columnIndex, row]));
    if (labels.size !== boundLabels.length || boundLabels.some(row => !count(row.columnIndex))) throw new Error("Functional label columns must be distinct nonnegative indexes.");
    const exactLabels = boundLabels.filter(row => row.state === "exact-label-candidate").map(row => row.anatomyNodeId);
    if (new Set(exactLabels).size !== exactLabels.length || exactLabels.some(id => !roots.has(id))) throw new Error("Exact functional mappings must name distinct anatomical neurons.");
    const record = { recordingId: recording.recording_id, nativeStimulusRows: recording.stimulations.length,
      mappedScopedRows: 0, eligibleWindowRows: 0 };
    for (const [index, event] of recording.stimulations.entries()) {
      nativeStimulusRows++;
      if (event.native_neuron_index < 0) { increment(exclusions, "negative-native-target-index"); continue; }
      if (!count(event.native_neuron_index) || event.column_index !== event.native_neuron_index) throw new Error("Native stimulation and mapped column identities disagree.");
      const label = labels.get(event.column_index);
      if (label?.state !== "exact-label-candidate") { increment(exclusions, `source-mapping:${label?.state ?? "missing-column"}`); continue; }
      const root = roots.get(label.anatomyNodeId);
      if (!root) throw new Error("Exact source mapping names a neuron outside the selected anatomy.");
      if (!root.scopeEligible) { increment(exclusions, "root-scope-ineligible"); continue; }
      root.mappedStimulusRows++; record.mappedScopedRows++;
      const eligibility = eventEligibility(recording, index);
      if (!eligibility.eligible) {
        increment(exclusions, "window-ineligible");
        for (const reason of eligibility.reasons) increment(windowReasons, reason);
        continue;
      }
      root.eligibleWindowRows++; record.eligibleWindowRows++;
      root.recordingIds.add(recording.recording_id);
    }
    records.push(record);
  }
  const rootRows = [...roots.values()].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0)
    .map(root => ({ ...root, recordingIds: [...root.recordingIds].sort() }));
  const total = key => rootRows.reduce((sum, root) => sum + root[key], 0);
  const summary = {
    anatomicalUnit: anatomy.id, anatomicalRoots: rootRows.length,
    preparedAnatomicalRoots: rootRows.filter(root => root.scopeEligible).length,
    recordingCount: records.length, nativeStimulusRows,
    mappedStimulusRows: total("mappedStimulusRows"), completeUncontaminatedWindows: total("eligibleWindowRows"),
    stimulatedSourceGroups: rootRows.filter(root => root.eligibleWindowRows > 0).length,
    traceValuesInspectedForThisAudit: false, receiverEligibility: "not-assessed", predictiveScore: null
  };
  const expected = protocol.inspection.functionalMetadataOnlyAudit;
  if (Object.keys(expected).some(key => summary[key] !== expected[key])) throw new Error("Functional metadata differs from the declared pre-freeze inspection.");
  if (Object.values(exclusions).reduce((a, b) => a + b, 0) + summary.completeUncontaminatedWindows !== nativeStimulusRows) {
    throw new Error("Functional stimulus exclusion accounting is incomplete.");
  }
  return { ...summary, exclusionCounts: sortedCounts(exclusions), overlappingWindowReasonCounts: sortedCounts(windowReasons),
    roots: rootRows, recordings: records };
}

export function validateAuditPayload(value, protocol, census, protocolLockSha256) {
  closed(value, ["format", "status", "protocolId", "protocolLockSha256", "censusSha256", "nativeSha256", "applicabilitySha256",
    "biologicalPredictiveScoresComputed", "dream4", "celegans", "reportSha256"], "protocol audit");
  const { reportSha256, ...body } = value;
  closed(body.celegans, ["anatomicalUnit", "anatomicalRoots", "preparedAnatomicalRoots", "recordingCount", "nativeStimulusRows",
    "mappedStimulusRows", "completeUncontaminatedWindows", "stimulatedSourceGroups", "traceValuesInspectedForThisAudit",
    "receiverEligibility", "predictiveScore", "exclusionCounts", "overlappingWindowReasonCounts", "roots", "recordings"], "functional metadata audit");
  if (reportSha256 !== sha256(JSON.stringify(body)) || body.format !== "onto2d-biological-protocol-audit-v1" ||
      body.status !== "target-eligibility-and-metadata-only" || body.protocolId !== protocol.id ||
      body.protocolLockSha256 !== protocolLockSha256 ||
      body.censusSha256 !== protocol.sources.censusSha256 || body.nativeSha256 !== census.nativeSha256 ||
      body.applicabilitySha256 !== census.localApplicabilitySha256 || body.biologicalPredictiveScoresComputed !== false ||
      body.celegans.predictiveScore !== null || body.celegans.traceValuesInspectedForThisAudit !== false ||
      body.celegans.receiverEligibility !== "not-assessed") throw new Error("Biological protocol audit binding or scope differs.");
  if (Object.entries(protocol.inspection.functionalMetadataOnlyAudit).some(([key, expected]) => body.celegans[key] !== expected)) {
    throw new Error("Biological audit differs from the pre-freeze metadata inspection.");
  }
  const functional = body.celegans;
  for (const key of ["anatomicalRoots", "preparedAnatomicalRoots", "recordingCount", "nativeStimulusRows", "mappedStimulusRows", "completeUncontaminatedWindows", "stimulatedSourceGroups"]) {
    if (!count(functional[key])) throw new Error("Functional summary counts must be nonnegative integers.");
  }
  list(functional.recordings, 113, "functional recording"); list(functional.roots, 4096, "anatomical root");
  counts(functional.exclusionCounts, "functional exclusion"); counts(functional.overlappingWindowReasonCounts, "window reason");
  const exclusionReasons = ["negative-native-target-index", "root-scope-ineligible", "window-ineligible",
    "source-mapping:unidentified-or-marked", "source-mapping:ambiguous-within-recording",
    "source-mapping:absent-from-anatomy", "source-mapping:missing-column"];
  const windowReasons = ["invalid-time-grid", "stimulation-volume-outside-recording", "stimulation-time-mismatch",
    "negative-native-target-index", "duplicate-stimulation-volume", "incomplete-baseline-window",
    "incomplete-post-window", "another-stimulation-in-window"];
  const rejectedWindows = functional.exclusionCounts["window-ineligible"] ?? 0;
  if (Object.keys(functional.exclusionCounts).some(reason => !exclusionReasons.includes(reason)) ||
      Object.entries(functional.overlappingWindowReasonCounts).some(([reason, number]) => !windowReasons.includes(reason) || number > rejectedWindows) ||
      Object.values(functional.overlappingWindowReasonCounts).reduce((sum, number) => sum + number, 0) < rejectedWindows) {
    throw new Error("Functional exclusion reasons or overlapping-window counts disagree.");
  }
  for (const record of functional.recordings) {
    closed(record, ["recordingId", "nativeStimulusRows", "mappedScopedRows", "eligibleWindowRows"], "functional recording audit");
    if (!text(record.recordingId) || ![record.nativeStimulusRows, record.mappedScopedRows, record.eligibleWindowRows].every(count) ||
        record.eligibleWindowRows > record.mappedScopedRows || record.mappedScopedRows > record.nativeStimulusRows) throw new Error("Functional per-recording coverage counts disagree.");
  }
  const recordingIds = new Set(functional.recordings.map(record => record.recordingId));
  for (const root of functional.roots) {
    closed(root, ["source", "graphHash", "nodeCount", "scopeEligible", "mappedStimulusRows", "eligibleWindowRows", "recordingIds"], "anatomical root audit");
    list(root.recordingIds, 113, "root recording");
    if (!text(root.source) || typeof root.graphHash !== "string" || !/^[0-9a-f]{64}$/.test(root.graphHash) ||
        !count(root.nodeCount) || root.nodeCount < 1 || root.nodeCount > 4096 || typeof root.scopeEligible !== "boolean" ||
        ![root.mappedStimulusRows, root.eligibleWindowRows].every(count) || root.eligibleWindowRows > root.mappedStimulusRows ||
        (!root.scopeEligible && (root.mappedStimulusRows || root.eligibleWindowRows)) ||
        new Set(root.recordingIds).size !== root.recordingIds.length || root.recordingIds.some(id => !recordingIds.has(id)) ||
        root.recordingIds.length > root.eligibleWindowRows || (root.eligibleWindowRows > 0 && root.recordingIds.length === 0)) {
      throw new Error("Functional per-root identity or coverage counts disagree.");
    }
  }
  if (functional.recordingCount !== census.randi.census.recordings || functional.recordings.length !== functional.recordingCount ||
      new Set(functional.recordings.map(record => record.recordingId)).size !== functional.recordingCount ||
      functional.nativeStimulusRows !== census.randi.census.stimulations ||
      functional.anatomicalRoots !== census.witvliet.units.find(unit => unit.id === protocol.celegans.primaryAnatomy).graph.nodeCount ||
      functional.roots.length !== functional.anatomicalRoots || new Set(functional.roots.map(root => root.source)).size !== functional.anatomicalRoots ||
      Object.values(functional.exclusionCounts).some(value => !count(value)) ||
      Object.values(functional.exclusionCounts).reduce((sum, value) => sum + value, 0) + functional.completeUncontaminatedWindows !== functional.nativeStimulusRows ||
      functional.recordings.reduce((sum, record) => sum + record.nativeStimulusRows, 0) !== functional.nativeStimulusRows ||
      functional.recordings.reduce((sum, record) => sum + record.mappedScopedRows, 0) !== functional.mappedStimulusRows ||
      functional.recordings.reduce((sum, record) => sum + record.eligibleWindowRows, 0) !== functional.completeUncontaminatedWindows ||
      functional.roots.filter(root => root.scopeEligible).length !== functional.preparedAnatomicalRoots ||
      functional.roots.filter(root => root.eligibleWindowRows > 0).length !== functional.stimulatedSourceGroups ||
      functional.roots.reduce((sum, root) => sum + root.mappedStimulusRows, 0) !== functional.mappedStimulusRows ||
      functional.roots.reduce((sum, root) => sum + root.eligibleWindowRows, 0) !== functional.completeUncontaminatedWindows) {
    throw new Error("Functional metadata audit coverage accounting differs.");
  }
  list(body.dream4, 2, "DREAM4 contrast");
  if (body.dream4.length !== 2) throw new Error("Both separate DREAM4 contrasts must be retained.");
  for (const [index, contrast] of body.dream4.entries()) {
    closed(contrast, ["contrast", "role", "status", "reason", "coverage", "predictiveScore", "groups"], "DREAM4 contrast audit");
    closed(contrast.coverage, ["groups", "eligibleGroups", "interventions", "eligibleInterventions", "targetRows", "eligibleTargetRows"], "DREAM4 coverage");
    if (Object.values(contrast.coverage).some(value => !count(value))) throw new Error("DREAM4 coverage requires integer counts.");
    list(contrast.groups, 5, "DREAM4 group");
    for (const group of contrast.groups) {
      closed(group, ["id", "eligible", "reason", "interventions"], "DREAM4 group audit");
      list(group.interventions, 10, "DREAM4 intervention");
      group.interventions.forEach((intervention, geneIndex) => {
        closed(intervention, ["id", "source", "eligible", "reason", "distinctMagnitudeCount", "targetCount"], "DREAM4 intervention audit");
        const source = `G${geneIndex + 1}`;
        if (intervention.id !== `${group.id}:${contrast.contrast}:${source}` || intervention.source !== source ||
            !count(intervention.distinctMagnitudeCount) || intervention.distinctMagnitudeCount < 1 || intervention.distinctMagnitudeCount > 9 ||
            intervention.reason !== (intervention.distinctMagnitudeCount >= 2 ? null : "constant-observed-target")) throw new Error("DREAM4 intervention identity or reason differs.");
      });
      const eligible = group.interventions.every(intervention => intervention.eligible);
      if (group.eligible !== eligible || group.reason !== (eligible ? null : "one-or-more-constant-interventions")) throw new Error("DREAM4 group eligibility or reason differs.");
    }
    if (contrast.contrast !== ["knockouts", "knockdowns"][index] || contrast.role !== ["primary", "secondary"][index] ||
        contrast.predictiveScore !== null || contrast.coverage.groups !== 5 || contrast.coverage.interventions !== 50 ||
        contrast.coverage.targetRows !== 450 || contrast.groups.length !== 5 ||
        contrast.groups.some((group, i) => group.id !== protocol.dream4.unitIds[i] || group.interventions.length !== 10 ||
          group.interventions.some(intervention => intervention.targetCount !== 9 ||
            intervention.eligible !== (intervention.distinctMagnitudeCount >= 2)))) throw new Error("DREAM4 audit population or no-scoring boundary differs.");
    const groups = contrast.groups.filter(group => group.interventions.every(intervention => intervention.eligible)).length;
    const interventions = contrast.groups.reduce((sum, group) => sum + group.interventions.filter(item => item.eligible).length, 0);
    if (contrast.coverage.eligibleGroups !== groups || contrast.coverage.eligibleInterventions !== interventions ||
        contrast.coverage.eligibleTargetRows !== interventions * 9 || contrast.status !== (groups === 5 ? "complete" : "unavailable")) {
    throw new Error("DREAM4 audit eligibility accounting differs.");
    }
    if (contrast.reason !== (groups === 5 ? null : "all-fifty-nonconstant-interventions-required")) throw new Error("DREAM4 primary availability reason differs.");
  }
  if (auditContentHash(value) !== protocol.inspection.auditContentSha256) throw new Error("Biological audit content differs from the frozen source inspection.");
  return value;
}

export async function verifyAuditReport(report = undefined) {
  const value = report ?? JSON.parse(await readFile(new URL("audit.json", here), "utf8"));
  const protocol = await check();
  const census = JSON.parse(await readFile(new URL("../datasets/census.json", here), "utf8"));
  return validateAuditPayload(value, protocol, census, sha256(await readFile(new URL("frozen.json", here))));
}

export async function audit({ write = false } = {}) {
  const protocol = await check();
  const census = JSON.parse(await readFile(new URL("../datasets/census.json", here), "utf8"));
  const native = await preparedFile("native.json", census.nativeSha256);
  const applicability = await preparedFile("applicability.json", census.localApplicabilitySha256);
  const body = {
    format: "onto2d-biological-protocol-audit-v1", status: "target-eligibility-and-metadata-only",
    protocolId: protocol.id, protocolLockSha256: sha256(await readFile(new URL("frozen.json", here))),
    censusSha256: protocol.sources.censusSha256, nativeSha256: census.nativeSha256,
    applicabilitySha256: census.localApplicabilitySha256, biologicalPredictiveScoresComputed: false,
    dream4: ["knockouts", "knockdowns"].map(contrast => {
      const population = prepareDreamPopulation(native.dream4.units, contrast);
      return { contrast, role: population.role, status: population.status, reason: population.reason,
        coverage: population.coverage, predictiveScore: null,
        groups: population.groups.map(group => ({ id: group.id, eligible: group.eligible, reason: group.reason,
          interventions: group.interventions.map(({ id, source, eligible, reason, distinctMagnitudeCount, targetCount }) =>
            ({ id, source, eligible, reason, distinctMagnitudeCount, targetCount })) })) };
    }),
    celegans: functionalMetadataAudit(native, applicability, protocol)
  };
  const report = { ...body, reportSha256: sha256(JSON.stringify(body)) }, encoded = encode(report);
  await verifyAuditReport(report);
  // A new audit is an exclusive publication. Changed protocol or inputs need a
  // separately identified study, not an overwritten accepted audit.
  if (write) await publishExclusive(new URL("audit.json", here), encoded);
  else if (await readFile(new URL("audit.json", here), "utf8") !== encoded) throw new Error("Biological protocol audit replay differs.");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/protocol/audit.mjs --write|--verify"); process.exitCode = 1;
  } else audit({ write: args[0] === "--write" }).then(report => console.log(
    `Protocol eligibility audit verified: ${report.dream4[0].coverage.eligibleTargetRows}/450 knockout targets; ${report.celegans.completeUncontaminatedWindows} functional metadata windows; no predictive scores.`
  )).catch(error => { console.error(error.code === "ENOENT" ? `Required D2 cache or protocol audit is missing: ${error.path}. See the dataset source guide.` : error.message); process.exitCode = 1; });
}
