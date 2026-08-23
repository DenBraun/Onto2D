import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { hashCanonical } from "@onto2d/kernel/canonical";
import {
  AgreementStatus,
  ArtifactKind,
  DerivationOperation,
  EvidenceBasis,
  NativeSeshatCodes,
  Precision,
  ResolutionState,
  ReviewStatus,
  SupportGroupType,
  createNativeSeshatRange,
  createNativeSeshatTimeBounds,
  createEpistemicArtifact,
  directlyAttestsResolvedCategoricalValue,
  parseNativeSeshatCode,
  roundTripNativeSeshatCode,
  roundTripNativeSeshatRange,
  roundTripNativeSeshatTimeBounds,
  satisfiesResolvedCategoricalValue
} from "../lib/epistemic-model.mjs";
import { ablateSupportGroup, createSupportDag, exactSupportIdentity, firstCategoricalFlip } from "../lib/support-dag.mjs";
import { buildSeshatEpistemicProvenanceCase, verifySeshatEpistemicProvenanceCaseIdentity } from "../extract.mjs";

const artifactUrl = new URL("../artifacts/seshat-epistemic-provenance.json", import.meta.url);
const sourceUrl = new URL("../source/road-three-polity-source.json", import.meta.url);
const upstreamUrl = new URL("../upstream.json", import.meta.url);
const profileUrl = new URL("../selection-profile.json", import.meta.url);
const availabilityUrl = new URL("../data-availability.json", import.meta.url);
const authorityUrl = new URL("../source/authority-boundary.json", import.meta.url);
const schemaUrl = new URL("../schema/seshat-epistemic-provenance.schema.json", import.meta.url);
const roadmapUrl = new URL("../../../docs/cases/SESHAT_FULL_DEPENDENCY_EXPERIMENT.md", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);
const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:seshat-epistemic-provenance-case:v1", basis);
  return artifact;
};

test("the frozen Seshat epistemic provenance artifact reproduces and validates", async () => {
  const [committed, rebuilt, schema] = await Promise.all([load(), buildSeshatEpistemicProvenanceCase(), readFile(schemaUrl, "utf8").then(JSON.parse)]);
  assert.deepEqual(rebuilt, committed);
  const validate = new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, uri: /^https:\/\// } }).compile(schema);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  const promoted = structuredClone(committed);
  promoted.claims[0].support.minimumGroupCuts.expert = { value: 1, witnessGroupIds: ["invented"] };
  assert.equal(validate(promoted), false);
  const decorated = structuredClone(committed);
  decorated.stressAnalyses[0].qualitativeLabel = "STABLE";
  assert.equal(validate(decorated), false);
  assert.equal(verifySeshatEpistemicProvenanceCaseIdentity(committed).caseIdentity, "sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a");
});

test("source, Codebook, license, selection, and availability projections match exact byte locks", async () => {
  const [source, profile, availability, authority, upstream, artifact] = await Promise.all([readFile(sourceUrl), readFile(profileUrl), readFile(availabilityUrl), readFile(authorityUrl), readFile(upstreamUrl, "utf8").then(JSON.parse), load()]);
  const bytesByPath = new Map([["source/road-three-polity-source.json", source], ["selection-profile.json", profile], ["data-availability.json", availability], ["source/authority-boundary.json", authority]]);
  for (const locked of upstream.inputs) {
    const bytes = bytesByPath.get(locked.path);
    assert.equal(bytes.length, locked.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), locked.sha256);
  }
  assert.equal(artifact.source.liveNetworkRequiredByBuild, false);
  assert.equal(artifact.source.polarisWorkbookIdentity, "sha256:cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41");
  assert.equal(artifact.source.codebookVersion, "4.20.2021");
  assert.equal(artifact.source.codebookIdentity, "sha256:31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d");
  assert.equal(artifact.source.publicDataLicense, "CC BY-SA 4.0");
  assert.equal(artifact.source.publicDataTermsIdentity, "sha256:0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321");
});

test("every supported native Seshat code round-trips exactly", () => {
  assert.deepEqual(NativeSeshatCodes, ["A", "P", "A*", "P*", "U", "U*", "A~P", "P~A", "A;P", "NA", ""]);
  for (const code of NativeSeshatCodes) assert.equal(roundTripNativeSeshatCode(parseNativeSeshatCode(code)), code);
  assert.throws(() => parseNativeSeshatCode("present"), /unsupported native code/);
  const mutated = structuredClone(parseNativeSeshatCode("P"));
  mutated.semanticValue = "absent";
  assert.throws(() => roundTripNativeSeshatCode(mutated), /semantically mutated/);
});

test("native numeric ranges and time bounds retain exact source forms", () => {
  const time = createNativeSeshatTimeBounds({ yearFrom: -2650, yearTo: -2350 });
  assert.deepEqual(roundTripNativeSeshatTimeBounds(time), { yearFrom: -2650, yearTo: -2350 });
  assert.deepEqual(roundTripNativeSeshatTimeBounds(createNativeSeshatTimeBounds({ yearFrom: null, yearTo: null })), { yearFrom: null, yearTo: null });
  const range = createNativeSeshatRange({ valueFrom: "1.00e2", valueTo: "250", timeBounds: { yearFrom: -300, yearTo: -200 } });
  assert.equal(range.valueFrom, "1.00e2");
  assert.equal(range.valueTo, "250");
  assert.deepEqual(roundTripNativeSeshatRange(range), range);
  assert.throws(() => createNativeSeshatRange({ valueFrom: "251", valueTo: "250" }), /cannot exceed/);
  assert.throws(() => createNativeSeshatTimeBounds({ yearFrom: 10, yearTo: 9 }), /cannot exceed/);
  const extended = structuredClone(range);
  extended.unit = "km";
  assert.throws(() => roundTripNativeSeshatRange(extended), /mutated or extended/);
});

test("unresolved, disputed, and inferred codes cannot cross the direct-attestation firewall", () => {
  assert.equal(satisfiesResolvedCategoricalValue(parseNativeSeshatCode("P"), "present"), true);
  assert.equal(satisfiesResolvedCategoricalValue(parseNativeSeshatCode("A"), "absent"), true);
  assert.equal(satisfiesResolvedCategoricalValue(parseNativeSeshatCode("U"), "present"), false);
  assert.equal(satisfiesResolvedCategoricalValue(parseNativeSeshatCode("A;P"), "present"), false);
  assert.equal(satisfiesResolvedCategoricalValue(parseNativeSeshatCode("P*"), "present"), true);
  assert.equal(directlyAttestsResolvedCategoricalValue(parseNativeSeshatCode("P*"), "present"), false);
  assert.equal(directlyAttestsResolvedCategoricalValue(parseNativeSeshatCode("P"), "present"), true);
});

test("artifact kind, derivation, resolution, review, and precision axes cannot be collapsed", () => {
  const base = { id: "artifact:test", artifactSubtype: "TestArtifact", nativeIdentity: "sha256:test", claimIdentity: null, evidenceBasis: EvidenceBasis.UnknownBasis, reviewStatus: ReviewStatus.Unknown, agreementStatus: AgreementStatus.Unknown, precision: Precision.Unknown, mappingIdentity: null, labels: {} };
  assert.throws(() => createEpistemicArtifact({ ...base, artifactKind: ArtifactKind.EvidenceArtifact, derivationOperation: DerivationOperation.Inference, resolutionState: null }), /EvidenceArtifact cannot carry a derivation/);
  assert.throws(() => createEpistemicArtifact({ ...base, artifactKind: ArtifactKind.CodingClaim, claimIdentity: "claim:test", derivationOperation: DerivationOperation.DirectCoding, resolutionState: null, precision: Precision.Exact }), /requires a resolution state/);
  assert.throws(() => createEpistemicArtifact({ ...base, artifactKind: ArtifactKind.CodingClaim, claimIdentity: "claim:test", derivationOperation: DerivationOperation.DirectCoding, resolutionState: ResolutionState.Resolved, reviewStatus: "reviewed", precision: Precision.Exact }), /reviewStatus contains an unsupported value/);
});

test("exact identity uses the labelled DAG while composition remains descriptive", async () => {
  const artifact = await load();
  assert.equal(artifact.identityComparison.allNativeValuesEqual, true);
  assert.equal(artifact.identityComparison.allExactSupportIdentitiesEqual, false);
  assert.ok(artifact.identityComparison.pairs.every(({ sameMappedValue, sameExactSupportIdentity }) => sameMappedValue && !sameExactSupportIdentity));
  assert.equal(new Set(artifact.claims.map(({ support }) => support.supportRootHash)).size, 3);

  const graph = createSupportDag(artifact.supportGraph);
  const before = exactSupportIdentity(graph, artifact.claims[0].rootNodeId).supportRootHash;
  const mutated = structuredClone(artifact.supportGraph);
  mutated.nodes.find(({ id }) => id === "narrative:eg_old_k_1:road").labels.exactText += " altered";
  const after = exactSupportIdentity(createSupportDag(mutated), artifact.claims[0].rootNodeId).supportRootHash;
  assert.notEqual(after, before);
});

test("the support graph rejects cycles and ablation leaves its frozen source unchanged", async () => {
  const artifact = await load();
  const cyclic = structuredClone(artifact.supportGraph);
  cyclic.edges.push({ id: "edge:test-cycle", from: "claim:eg_old_k_1:road", to: "native-record:eg_old_k_1:road", semanticType: "test-cycle", dependencyMode: "required" });
  assert.throws(() => createSupportDag(cyclic), /graph must be acyclic/);

  const graph = createSupportDag(artifact.supportGraph);
  const before = JSON.stringify(graph);
  const ablated = ablateSupportGroup(graph, "group:source-work:pauketat-2014");
  assert.equal(ablated.sourceGraphMutated, false);
  assert.equal(ablated.graph.nodes.some(({ id }) => id === "claim:us_emergent_mississippian_2:road"), false);
  assert.equal(JSON.stringify(graph), before);
});

test("first categorical flip is explicit and fails closed when the group type is unavailable", async () => {
  const artifact = await load();
  const graph = createSupportDag(artifact.supportGraph);
  assert.deepEqual(firstCategoricalFlip(graph, "claim:eg_old_k_1:road", SupportGroupType.SourceWork), {
    value: 1,
    kind: "categorical-value",
    baselineValue: "present",
    perturbedValue: null,
    response: "unresolved",
    witnessGroupIds: ["group:source-work:partridge-2010"]
  });
  const unavailable = firstCategoricalFlip(graph, "claim:it_roman_principate:road", SupportGroupType.SourceWork);
  assert.equal(unavailable.value, null);
  assert.match(unavailable.reason, /no-SourceWork-group/);
  assert.equal(firstCategoricalFlip(graph, "claim:eg_old_k_1:road", SupportGroupType.Expert).value, null);
});

test("public metadata gaps remain unknown and perturbations remain raw", async () => {
  const artifact = await load();
  for (const claim of artifact.claims) {
    assert.equal(claim.support.minimumGroupCuts.researchAssistant.value, null);
    assert.equal(claim.support.minimumGroupCuts.expert.value, null);
    assert.equal(claim.support.minimumGroupCuts.reviewEpisode.value, null);
  }
  assert.equal(artifact.claims.find(({ polityId }) => polityId === "it_roman_principate").support.minimumGroupCuts.sourceWork.value, null);
  assert.equal(artifact.stressAnalyses.length, 4);
  assert.ok(artifact.stressAnalyses.every(({ rawResponse, threshold, qualitativeLabel, sourceGraphMutated }) => rawResponse.baseline === "Resolved" && rawResponse.perturbed === "Unknown" && threshold === null && qualitativeLabel === null && sourceGraphMutated === false));
  assert.ok(artifact.claims.every(({ support }) => support.firstCategoricalFlips.expert.value === null && support.firstCategoricalFlips.reviewEpisode.value === null));
  assert.deepEqual([artifact.audit.researchAssistantGroupsInvented, artifact.audit.expertGroupsInvented, artifact.audit.reviewEpisodeGroupsInvented], [0, 0, 0]);
});

test("the approved release rejects rehashed epistemic promotions", async () => {
  const expertPromotion = await load();
  expertPromotion.supportGraph.groups.push({ id: "group:expert:invented", type: "Expert", label: "Invented expert", memberNodeIds: ["api-record:eg_old_k_1:road"] });
  expertPromotion.audit.expertGroupsInvented = 1;
  assert.throws(() => verifySeshatEpistemicProvenanceCaseIdentity(resign(expertPromotion)), /approved release/);

  const qualitativePromotion = await load();
  qualitativePromotion.stressAnalyses[0].qualitativeLabel = "SENSITIVE";
  assert.throws(() => verifySeshatEpistemicProvenanceCaseIdentity(resign(qualitativePromotion)), /approved release/);
});

test("the full experiment roadmap is outcome-blind and contains no organizational scenario", async () => {
  const roadmap = await readFile(roadmapUrl, "utf8");
  for (const term of ["D_source", "D_leaf", "R_source", "R_coder", "discordance", "Spearman", "frozen cohort", "negative result"]) assert.match(roadmap, new RegExp(term, "i"));
  assert.doesNotMatch(roadmap, /contact|outreach|inquiry|e-?mail/i);
});
