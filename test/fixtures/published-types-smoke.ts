import {
  canonicalizeCandidate,
  type CandidateId
} from "@onto2d/kernel";
import { schemaUrls } from "@onto2d/schemas";
import { auditSourceCatalogue } from "@onto2d/catalog-adapter";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";
import { writePackageRunArtifactBundle } from "@onto2d/run-store";

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
