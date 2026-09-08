import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { check, readProtocol, sha256, validateProtocol } from "./check.mjs";
import { auditContentHash, functionalMetadataAudit, validateAuditPayload, verifyAuditReport } from "./audit.mjs";
import { publishExclusive } from "./io.mjs";

test("frozen protocol binds helper contracts, sources and independent controls", async () => {
  const protocol = await check();
  assert.equal(protocol.inspection.biologicalPredictiveScoresComputed, false);
  for (const alter of [p => { p.learner.lambdas.pop(); }, p => { p.celegans.primaryAnatomy = "Dataset8"; },
    p => { p.geometry.featureCounts.fullWithBaseline = 53; }, p => { p.inspection.externalPreregistration = true; }]) {
    const changed = structuredClone(protocol); alter(changed);
    assert.throws(() => validateProtocol(changed));
  }
  const lock = JSON.parse(await readFile(new URL("frozen.json", import.meta.url)));
  for (const file of ["reference.py", "model-reference.py", "baselines.test.mjs", "independent-model.test.mjs", "protocol.test.mjs"]) {
    assert.equal(lock.files[file], sha256(await readFile(new URL(file, import.meta.url))));
  }
});

function metadataFixture() {
  const scope = (root, eligible, kind = "closed-weak-one-hop") => ({ root, kind, graphHash: `hash-${root}`,
    nodeIds: ["A", "B"], providers: { commonGeometry: { state: eligible ? "prepared" : "ineligible" } } });
  const events = [[80, 0], [200, -1], [350, 0], [380, 1], [600, 2], [900, 0], [1100, 1]];
  const native = { randi: { recordings: [{ recording_id: "r1", time_coordinates: Array.from({ length: 1200 }, (_, i) => i / 2),
    get traces() { throw new Error("Metadata audit must not read traces"); },
    stimulations: events.map(([volume, column]) => ({ volume_index: volume, column_index: column < 0 ? null : column,
      native_neuron_index: column, time_coordinate: volume / 2 })) }] } };
  const applicability = { witvliet: [{ id: "Dataset7", parent: { nodes: ["A", "B"] },
    scopes: [scope(null, false, "full"), scope("A", true), scope("B", false)] }],
    mappings: [{ anatomicalUnitId: "Dataset7", recordings: [{ recordingId: "r1", labels: [
      { columnIndex: 0, anatomyNodeId: "A", state: "exact-label-candidate" },
      { columnIndex: 1, anatomyNodeId: null, state: "unidentified-or-marked" },
      { columnIndex: 2, anatomyNodeId: "B", state: "exact-label-candidate" }
    ] }] }] };
  const protocol = { celegans: { primaryAnatomy: "Dataset7" }, inspection: { functionalMetadataOnlyAudit: {
    anatomicalUnit: "Dataset7", preparedAnatomicalRoots: 1, mappedStimulusRows: 3,
    completeUncontaminatedWindows: 2, stimulatedSourceGroups: 1, traceValuesInspectedForThisAudit: false
  } } };
  return { native, applicability, protocol };
}

test("metadata audit separates parent from all roots and accounts for every native stimulus without trace access", () => {
  const { native, applicability, protocol } = metadataFixture();
  const audit = functionalMetadataAudit(native, applicability, protocol);
  assert.equal(audit.roots.length, 2);
  assert.equal(audit.nativeStimulusRows, 7);
  assert.equal(audit.completeUncontaminatedWindows, 2);
  assert.deepEqual(audit.exclusionCounts, { "negative-native-target-index": 1, "root-scope-ineligible": 1,
    "source-mapping:unidentified-or-marked": 2, "window-ineligible": 1 });
  assert.deepEqual(audit.overlappingWindowReasonCounts, { "another-stimulation-in-window": 1 });
  assert.deepEqual(audit.roots[0].recordingIds, ["r1"]);
  assert.equal(audit.receiverEligibility, "not-assessed");
  applicability.witvliet[0].scopes.push(applicability.witvliet[0].scopes[1]);
  assert.throws(() => functionalMetadataAudit(native, applicability, protocol), /every anatomical root/);
});

test("audit cannot silently change anatomy or the declared metadata census", () => {
  const { native, applicability, protocol } = metadataFixture();
  protocol.inspection.functionalMetadataOnlyAudit.completeUncontaminatedWindows++;
  assert.throws(() => functionalMetadataAudit(native, applicability, protocol), /pre-freeze/);
  protocol.celegans.primaryAnatomy = "Dataset8";
  assert.throws(() => functionalMetadataAudit(native, applicability, protocol), /anatomy/);
});

test("metadata audit rejects overwritten recording/column mappings and contradictory stimulus identities", () => {
  for (const alter of [
    f => { f.native.randi.recordings.push(f.native.randi.recordings[0]); },
    f => { f.applicability.mappings[0].recordings.push(f.applicability.mappings[0].recordings[0]); },
    f => { f.applicability.mappings[0].recordings.push({ recordingId: "foreign", labels: [] }); },
    f => { f.applicability.mappings[0].recordings[0].labels.push({ columnIndex: 0, anatomyNodeId: null, state: "unidentified-or-marked" }); },
    f => { f.applicability.mappings[0].recordings[0].labels.push({ columnIndex: 3, anatomyNodeId: "A", state: "exact-label-candidate" }); },
    f => { f.native.randi.recordings[0].stimulations[0].column_index = 2; },
    f => { f.applicability.witvliet[0].parent.nodes = ["A", "A"]; },
    f => { f.applicability.witvliet.push(f.applicability.witvliet[0]); },
    f => { f.applicability.mappings.push(f.applicability.mappings[0]); },
    f => { f.applicability.witvliet[0].scopes[1].nodeIds = ["A", "foreign"]; }
  ]) {
    const fixture = metadataFixture(); alter(fixture);
    assert.throws(() => functionalMetadataAudit(fixture.native, fixture.applicability, fixture.protocol));
  }
});

test("closed audit validation rejects forged identities, no-scoring extensions and impossible count ledgers", async () => {
  const audit = JSON.parse(await readFile(new URL("audit.json", import.meta.url)));
  const protocol = await readProtocol();
  const census = JSON.parse(await readFile(new URL("../datasets/census.json", import.meta.url)));
  const frozenHash = sha256(await readFile(new URL("frozen.json", import.meta.url)));
  assert.equal(validateAuditPayload(audit, protocol, census, frozenHash), audit);
  for (const alter of [
    r => { r.dream4[0].groups[0].interventions[1] = r.dream4[0].groups[0].interventions[0]; },
    r => { r.dream4[0].groups[0].eligible = false; },
    r => { r.dream4[0].groups[0].interventions[0].distinctMagnitudeCount = "9"; },
    r => { r.dream4[0].groups[0].interventions[0].distinctMagnitudeCount = 10; },
    r => { r.dream4[0].reason = "made-up"; },
    r => { r.comparativePredictiveScore = 0.75; },
    r => { r.dream4.comparativePredictiveScore = 0.75; },
    r => { r.celegans.roots[0].predictiveScore = 0; },
    r => { r.celegans.recordings[0].eligibleWindowRows = -100; },
    r => { r.celegans.recordings[0].mappedScopedRows++; },
    r => { r.celegans.roots[Symbol("unexpected")] = 1; },
    r => { r.celegans.exclusionCounts[Symbol("unexpected")] = 1; },
    r => { r.celegans.roots.find(root => root.recordingIds.length).recordingIds[0] = "unknown-recording"; },
    r => { r.celegans.overlappingWindowReasonCounts["another-stimulation-in-window"] = r.celegans.nativeStimulusRows; }
  ]) {
    const changed = structuredClone(audit); alter(changed);
    const { reportSha256, ...body } = changed; changed.reportSha256 = sha256(JSON.stringify(body));
    assert.throws(() => validateAuditPayload(changed, protocol, census, frozenHash));
  }
});

test("accepted audit binds actual D2 artifacts and cannot contain biological scores", async () => {
  const audit = await verifyAuditReport();
  const protocol = await readProtocol();
  assert.equal(audit.protocolId, protocol.id);
  for (const alter of [r => { r.nativeSha256 = "0".repeat(64); }, r => { r.applicabilitySha256 = "0".repeat(64); },
    r => { r.dream4[0].predictiveScore = 0; }, r => { r.dream4[1].coverage.targetRows--; },
    r => { r.celegans.completeUncontaminatedWindows++; }]) {
    const changed = structuredClone(audit); alter(changed);
    const { reportSha256, ...body } = changed;
    changed.reportSha256 = sha256(JSON.stringify(body));
    await assert.rejects(verifyAuditReport(changed));
  }
});

test("frozen audit content rejects plausible but false source identities even after rehashing", async () => {
  const audit = await verifyAuditReport(), protocol = await readProtocol();
  assert.equal(auditContentHash(audit), protocol.inspection.auditContentSha256);
  for (const alter of [r => { r.celegans.roots[0].graphHash = "0".repeat(64); },
    r => { r.celegans.roots[0].source = "UNDECLARED_NEURON"; }]) {
    const changed = structuredClone(audit); alter(changed);
    const { reportSha256, ...body } = changed;
    changed.reportSha256 = sha256(JSON.stringify(body));
    await assert.rejects(verifyAuditReport(changed), /frozen source inspection/);
  }
});

test("exclusive atomic publication preserves existing files and dangling symlinks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "onto2d-protocol-"));
  const target = pathToFileURL(join(directory, "accepted.json"));
  try {
    const result = await Promise.allSettled([publishExclusive(target, "first\n"), publishExclusive(target, "second\n")]);
    assert.equal(result.filter(row => row.status === "fulfilled").length, 1);
    const accepted = await readFile(target, "utf8");
    assert.ok(["first\n", "second\n"].includes(accepted));
    await assert.rejects(publishExclusive(target, "replacement\n"), { code: "EEXIST" });
    assert.equal(await readFile(target, "utf8"), accepted);
    const dangling = pathToFileURL(join(directory, "dangling.json"));
    await symlink(join(directory, "absent.json"), dangling);
    await assert.rejects(publishExclusive(dangling, "replacement\n"), { code: "EEXIST" });
    assert.deepEqual((await readdir(directory)).sort(), ["accepted.json", "dangling.json"]);
    await mkdir(join(directory, "real"));
    await symlink(join(directory, "real"), join(directory, "linked"));
    await assert.rejects(publishExclusive(pathToFileURL(join(directory, "linked", "output.json")), "blocked\n"), /real directory/);
    assert.deepEqual(await readdir(join(directory, "real")), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
