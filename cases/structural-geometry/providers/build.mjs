import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { createStructuralMetricContext, createStructuralMetricProvider, buildStructuralProvider,
  analyzeStructuralGeometryWithProvider, verifyStructuralProviderArtifact, verifyStructuralProviderAnalysis } from "@onto2d/structural-geometry/providers";
import { TYPED_SELECTION_POLICY } from "@onto2d/structural-geometry/experiments";
import { directory, examplePack, examples, readJson } from "./fixtures.mjs";

const codec = { limits: { maxEntries: 500000 } };
const encoded = (value) => `${JSON.stringify(canonicalClone(value, codec), null, 2)}\n`;
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const source = await readJson("../../../models/causal-emergence/releases/2026.08.15/bundle.json");
  const context = createStructuralMetricContext(source);
  if (canonicalize(context.binding.model) !== canonicalize(await readJson("../causal-emergence/source-lock.json"))) throw new Error("Provider source lock differs.");
  const legacySuite = await readJson("../experiments/suite.json");
  if (legacySuite.runs.length !== 72 || legacySuite.sourceProjectionHash !== context.binding.sourceProjectionHash) throw new Error("Legacy experiment coverage/source differs.");
  const requests = [{ providerId: "unit-v1" }, { providerId: "inverse-target-share-v1" }, { providerId: "necessity-filtration-v1" },
    ...legacySuite.runs.filter((r) => r.request.metricPolicyId === "unit-v1" && r.request.selection.kind === "roles")
      .map((r) => ({ providerId: "role-subset-v1", parameters: { roles: r.request.selection.roles } })),
    ...TYPED_SELECTION_POLICY.channels.map((field) => ({ providerId: "typed-channel-v1", parameters: { field,
      values: legacySuite.runs.filter((r) => r.request.metricPolicyId === "unit-v1" && r.request.selection.kind === "channel" && r.request.selection.field === field)
        .map((r) => r.request.selection.value) } }))];
  const providers = requests.map((input) => {
    const a = createStructuralMetricProvider(input.providerId).build(context.projection, context, input.parameters);
    const counts = a.result.kind === "metric-values" ? [a.result.edges.length] : a.result.kind === "filtration" ? a.result.stages.map((v) => v.edges.length)
      : a.result.kind === "selection" ? [a.result.view.edges.length] : a.result.channels.map((v) => v.edges.length);
    return { request: a.request, artifactHash: a.artifactHash, kind: a.result.kind, edgeCounts: counts };
  });
  const analyses = [];
  const root = analyzeStructuralGeometryWithProvider(source, { analysis: "structural-geometry", metricProviderId: "unit-v1" });
  if (encoded(root.legacyArtifact) !== await readFile(new URL("../causal-emergence/artifact.json", directory), "utf8")) throw new Error("Provider root output differs from legacy bytes.");
  const record = (a) => ({ request: a.request, artifactHash: a.artifactHash, legacyArtifactHash: a.legacyArtifact.artifactHash,
    metricArtifactHash: a.metricArtifact.artifactHash, viewArtifactHash: a.viewArtifact?.artifactHash ?? null });
  analyses.push(record(root));
  for (const entry of legacySuite.runs) {
    const a = analyzeStructuralGeometryWithProvider(source, { analysis: "structural-metric-experiment", metricProviderId: entry.request.metricPolicyId,
      selection: entry.request.selection });
    if (a.legacyArtifact.artifactHash !== entry.artifactHash || a.metricArtifact.result.metricContextHash !== entry.metricContextHash) {
      throw new Error("Provider experiment differs from frozen legacy output/context.");
    }
    if (entry.request.selection.kind === "all" && entry.request.metricPolicyId === "inverse-target-share-v1"
      && encoded(a.legacyArtifact) !== await readFile(new URL("../experiments/weighted-full.json", directory), "utf8")) {
      throw new Error("Provider weighted output differs from legacy bytes.");
    }
    if (a.viewArtifact) {
      const view = a.viewArtifact.result.kind === "filtration" ? a.viewArtifact.result.stages.find((v) => v.selection.through === entry.request.selection.through)
        : a.viewArtifact.result.kind === "selection" ? a.viewArtifact.result.view : a.viewArtifact.result.channels[0];
      if (view.projectionHash !== entry.projectionHash || canonicalize(view.accounting) !== canonicalize(a.legacyArtifact.accounting)) throw new Error("Provider view differs from legacy selection.");
    }
    analyses.push(record(a));
  }
  const pack = await examplePack(); const outputs = [];
  for (const example of examples) {
    const a = example.type === "provider" ? buildStructuralProvider(pack, example.input) : analyzeStructuralGeometryWithProvider(pack, example.input);
    if (example.type === "provider") verifyStructuralProviderArtifact(a, pack, example.input);
    else verifyStructuralProviderAnalysis(a, pack, example.input);
    const file = `artifacts/${example.id}.json`;
    outputs.push([file, encoded(a)]);
    if (!write && await readFile(new URL(file, directory), "utf8") !== encoded(a)) throw new Error(`Provider example differs: ${example.id}`);
  }
  const body = { schemaVersion: "1", suiteId: "structural-provider-compatibility-v1", status: "compatibility-and-computational-agreement-only",
    context: context.binding, legacyExperimentSuiteHash: legacySuite.artifactHash, providers, analyses,
    examples: examples.map((example, i) => ({ id: example.id, file: outputs[i][0], input: example.input,
      artifactHash: JSON.parse(outputs[i][1]).artifactHash })) };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-provider-suite:v1", body, codec) };
  if (write) {
    await mkdir(new URL("artifacts/", directory), { recursive: true });
    for (const [file, bytes] of [...outputs, ["suite.json", encoded(suite)]]) await writeFile(new URL(file, directory), bytes);
  } else if (await readFile(new URL("suite.json", directory), "utf8") !== encoded(suite)) throw new Error("Provider compatibility suite differs.");
  if (report) console.table(providers.map((p) => ({ provider: p.request.providerId, kind: p.kind,
    parameters: JSON.stringify(p.request.parameters), edgeCounts: p.edgeCounts.join(", ") })));
  console.log(`Provider suite ${write ? "written" : "verified"}: ${providers.length} full-source profiles, ${analyses.length} exact legacy analyses, ${examples.length} frozen examples.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/providers/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
