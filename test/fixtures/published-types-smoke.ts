import {
  canonicalizeCandidate,
  type CandidateId
} from "@onto2d/kernel";
import { schemaUrls } from "@onto2d/schemas";
import { auditSourceCatalogue } from "@onto2d/catalog-adapter";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";
import { writePackageRunArtifactBundle } from "@onto2d/run-store";
import { buildModelPack, type ModelPack } from "@onto2d/model-pack";
import { loadModelPackDirectory } from "@onto2d/model-pack/node";
import {
  canonicalIdentityAnalysis,
  verifyCanonicalIdentityArtifact,
  type CanonicalIdentityArtifact
} from "@onto2d/canonical-identity-analysis";
import {
  Onto2D as EngineOnto2D,
  buildModelLineage,
  type Model,
  type ModelIdentity
} from "@onto2d/engine";
import { Onto2D as DefaultOnto2D } from "onto2d";
import { createModelView, layoutNeighborhood, type NeighborhoodLayout } from "@onto2d/view";

const ref = `sha256:${"a".repeat(64)}` as const;
const result = canonicalizeCandidate({
  domain: "element-exact",
  nodes: [{ ref }, { ref }],
  edges: [{ from: 0, to: 1, role: "supports" }]
});
const candidateId: CandidateId = result.candidateId;
const adapter = defineScientificAdapter({
  id: "typescript-smoke",
  version: "1.0.0",
  method: "identity",
  async evaluate(request: unknown) {
    return request;
  }
});

void candidateId;
void adapter;
void schemaUrls.candidate;
void auditSourceCatalogue;
void writePackageRunArtifactBundle;
const modelPack: ModelPack = buildModelPack({
  model: { id: "types", name: "Types", version: "1" },
  source: { id: "types", files: [{ path: "types.json", hash: ref }] },
  nodes: [{ id: "a" }],
  edges: [],
  dictionaries: {}
});
const enginePromise = EngineOnto2D.create({
  models: [modelPack],
  analyses: [canonicalIdentityAnalysis]
});
const typedModel: Model | undefined = undefined;
const typedIdentity: ModelIdentity = {
  modelId: "types",
  modelVersion: "1",
  modelRootHash: modelPack.manifest.rootHash
};
const lineage = buildModelLineage({ from: typedIdentity, to: { ...typedIdentity, modelVersion: "2" }, events: [] });
const artifact: CanonicalIdentityArtifact | undefined = undefined;
void enginePromise;
void typedModel;
void lineage;
void artifact;
void verifyCanonicalIdentityArtifact;
void loadModelPackDirectory;
void DefaultOnto2D.create();
const modelView = createModelView({ nodes: [{ id: "a" }], edges: [] });
const modelLayout: NeighborhoodLayout = layoutNeighborhood(
  modelView.neighborhood({ focusId: "a" })
);
void modelLayout;
