import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalize } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { importNTriples } from "@onto2d/rdf-import";
import {
  buildRdfMappedModelPack,
  mapRdfToOnto2D,
  verifyRdfMappingArtifact,
  verifyRdfMappingPolicy
} from "@onto2d/rdf-mapping";
import { validateShacl, verifyShaclValidationReport } from "@onto2d/shacl-validation";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_ROOT = path.join(CASE_ROOT, "artifacts");
const OUTPUTS = Object.freeze({
  validation: "validation-report.json",
  mapping: "mapping-artifact.json",
  modelPack: "model-pack.json"
});

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(CASE_ROOT, relativePath), "utf8"));
}

async function materialize(name, value, verify) {
  const target = path.join(ARTIFACT_ROOT, name);
  const expected = serialized(value);
  if (verify) {
    assert.equal(await readFile(target, "utf8"), expected, `${name} differs from exact replay`);
    return;
  }
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  await writeFile(target, expected, "utf8");
}

function verifySourceLock(lock, data, shapes, policy) {
  assert.equal(lock.schemaVersion, "1");
  assert.equal(lock.caseId, policy.id);
  assert.equal(lock.reference.url, policy.provenance.sourceUri);
  assert.equal(lock.reference.version, policy.provenance.sourceVersion);
  assert.equal(lock.reference.license, policy.provenance.licenseUri);
  assert.equal(lock.adaptation.status, "derived-reference-fixture");
  assert.deepEqual(lock.localInputs, [
    {
      path: "data.nt",
      role: "conforming RDF data",
      hash: data.source.hash
    },
    {
      path: "shapes.nt",
      role: "closed-profile SHACL shapes",
      hash: shapes.source.hash
    }
  ]);
}

export async function run(options = {}) {
  const verify = options.verify === true;
  const [dataBytes, shapesBytes, policyInput, sourceLock] = await Promise.all([
    readFile(path.join(CASE_ROOT, "data.nt")),
    readFile(path.join(CASE_ROOT, "shapes.nt")),
    readJson("mapping-policy.json"),
    readJson("source-lock.json")
  ]);
  const policy = verifyRdfMappingPolicy(policyInput);
  const data = importNTriples(dataBytes, { sourceId: policy.inputs.dataSourceId });
  const shapes = importNTriples(shapesBytes, { sourceId: policy.inputs.shapesSourceId });
  const validation = validateShacl(data, shapes);
  assert.equal(validation.conforms, true, "reference data must pass its exact SHACL shapes");
  verifySourceLock(sourceLock, data, shapes, policy);
  const mapping = mapRdfToOnto2D(data, shapes, validation, policy);
  const modelPack = buildRdfMappedModelPack(data, shapes, validation, policy, {
    id: "w3c-person-company",
    name: "W3C Person and Company reference",
    version: "1.0.0",
    description: "Reviewed RDF-to-Onto2D mapping boundary reference.",
    status: "reference"
  });
  verifyShaclValidationReport(data, shapes, validation);
  verifyRdfMappingArtifact(data, shapes, validation, policy, mapping);
  verifyModelPack(modelPack);
  assert.equal(mapping.statementAccounting.length, data.statements.length);
  assert.equal(
    mapping.statementAccounting.reduce((sum, entry) => sum + entry.occurrenceCount, 0),
    data.statistics.sourceStatementCount
  );
  assert.equal(modelPack.manifest.source.auditHash, mapping.mappingHash);
  assert.equal(
    canonicalize(modelPack.files["model/dictionaries.json"].rdfMapping.policy),
    canonicalize(policy)
  );

  await materialize(OUTPUTS.validation, validation, verify);
  await materialize(OUTPUTS.mapping, mapping, verify);
  await materialize(OUTPUTS.modelPack, modelPack, verify);
  return Object.freeze({ data, shapes, validation, policy, mapping, modelPack });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).then((result) => {
    console.log(
      `RDF mapping case ${process.argv.includes("--verify") ? "verified" : "materialized"}: `
      + `${result.mapping.statistics.nodeCount} nodes, `
      + `${result.mapping.statistics.edgeCount} edges, `
      + `${result.mapping.statistics.statementCount} accounted statements.`
    );
  }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
