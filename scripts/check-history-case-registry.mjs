import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repositoryRoot, "cases", "history-case-registry.json");
const schemaPath = path.join(repositoryRoot, "cases", "history-case-registry.schema.json");
const modelRegistryPath = path.join(repositoryRoot, "models", "registry.json");
const maturityRank = new Map([
  "DISCOVERED",
  "PLANNED",
  "SOURCE_PINNED",
  "EXTRACTABLE",
  "REPRODUCIBLE",
  "MODEL_PACK",
  "EXPLORER",
  "ANALYSIS_READY",
  "REVIEWED"
].map((status, index) => [status, index]));

function fail(message) {
  throw new Error(`History case registry check failed: ${message}`);
}

function repositoryPath(relativePath, caseId, field) {
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  if (absolutePath === repositoryRoot || !absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    fail(`${caseId}.${field} escapes the repository`);
  }
  return absolutePath;
}

async function requirePath(relativePath, caseId, field) {
  try {
    await access(repositoryPath(relativePath, caseId, field));
  } catch {
    fail(`${caseId}.${field} does not resolve: ${relativePath}`);
  }
}

export async function run() {
  const [registrySource, schemaSource, modelRegistrySource] = await Promise.all([
    readFile(registryPath, "utf8"),
    readFile(schemaPath, "utf8"),
    readFile(modelRegistryPath, "utf8")
  ]);
  const registry = JSON.parse(registrySource);
  const schema = JSON.parse(schemaSource);
  const modelRegistry = JSON.parse(modelRegistrySource);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    formats: { date: /^\d{4}-\d{2}-\d{2}$/ }
  });
  const validate = ajv.compile(schema);
  if (!validate(registry)) {
    fail(ajv.errorsText(validate.errors, { separator: "; " }));
  }

  const caseIds = new Set();
  const portfolioOrders = new Set();
  const pagePaths = new Set();
  const registeredModels = new Map(modelRegistry.entries.map((entry) => [`${entry.modelId}\u0000${entry.version}`, entry]));
  for (const entry of registry.cases) {
    if (caseIds.has(entry.caseId)) fail(`duplicate caseId ${entry.caseId}`);
    if (portfolioOrders.has(entry.portfolioOrder)) fail(`duplicate portfolioOrder ${entry.portfolioOrder}`);
    if (pagePaths.has(entry.casePagePath)) fail(`duplicate casePagePath ${entry.casePagePath}`);
    caseIds.add(entry.caseId);
    portfolioOrders.add(entry.portfolioOrder);
    pagePaths.add(entry.casePagePath);

    if (!entry.historyModes.includes(entry.primaryHistoryMode)) {
      fail(`${entry.caseId}.primaryHistoryMode is absent from historyModes`);
    }
    const overlappingEffects = entry.primaryEffects.filter((effect) => entry.secondaryEffects.includes(effect));
    if (overlappingEffects.length > 0) {
      fail(`${entry.caseId} repeats effects across primary and secondary: ${overlappingEffects.join(", ")}`);
    }
    const placementKeys = new Set();
    for (const placement of entry.matrixPlacements) {
      const key = `${placement.mode}/${placement.effect}`;
      if (placementKeys.has(key)) fail(`${entry.caseId} repeats matrix placement ${key}`);
      placementKeys.add(key);
      if (!entry.historyModes.includes(placement.mode)) {
        fail(`${entry.caseId} places an undeclared history mode: ${placement.mode}`);
      }
      if (![...entry.primaryEffects, ...entry.secondaryEffects].includes(placement.effect)) {
        fail(`${entry.caseId} places an undeclared effect: ${placement.effect}`);
      }
      if (placement.role === "primary"
        && (placement.mode !== entry.primaryHistoryMode || !entry.primaryEffects.includes(placement.effect))) {
        fail(`${entry.caseId} has a primary matrix placement outside its primary mode/effects`);
      }
    }
    for (const effect of entry.primaryEffects) {
      if (!entry.matrixPlacements.some((placement) => placement.role === "primary"
        && placement.mode === entry.primaryHistoryMode && placement.effect === effect)) {
        fail(`${entry.caseId} is missing the primary matrix placement for ${effect}`);
      }
    }
    for (const mode of entry.historyModes) {
      if (!entry.matrixPlacements.some((placement) => placement.mode === mode)) {
        fail(`${entry.caseId} has no matrix placement for declared mode ${mode}`);
      }
    }
    if (/(?:^|\/)(?:recorded|embodied|reconstructed)(?:\/|$)/.test(entry.casePagePath)) {
      fail(`${entry.caseId}.casePagePath hard-codes a taxonomy category`);
    }
    if (entry.casePagePath !== `apps/external-cases/${entry.caseId}/`) {
      fail(`${entry.caseId}.casePagePath is not bound to its stable caseId`);
    }

    await requirePath(entry.casePagePath, entry.caseId, "casePagePath");
    await requirePath(`${entry.casePagePath}index.html`, entry.caseId, "casePagePath index");
    await requirePath(entry.implementationDoc, entry.caseId, "implementationDoc");
    if (entry.modelPackPath !== null) {
      if (entry.modelId === null || entry.modelVersion === null) fail(`${entry.caseId} has modelPackPath without an exact model selection`);
      await requirePath(entry.modelPackPath, entry.caseId, "modelPackPath");
      const registered = registeredModels.get(`${entry.modelId}\u0000${entry.modelVersion}`);
      if (!registered) fail(`${entry.caseId} references an unregistered model release ${entry.modelId}@${entry.modelVersion}`);
      const exactReleasePath = `models/${registered.packPath}`;
      if (!exactReleasePath.startsWith(entry.modelPackPath)) fail(`${entry.caseId}.modelPackPath does not contain its registered exact release`);
      await requirePath(exactReleasePath, entry.caseId, "exact model release");
    } else if (entry.modelVersion !== null) {
      fail(`${entry.caseId} has modelVersion without modelPackPath`);
    }
    if (entry.explorerPath !== null) {
      if (entry.explorerId === null) fail(`${entry.caseId} has explorerPath without explorerId`);
      await requirePath(entry.explorerPath, entry.caseId, "explorerPath");
    }

    const doc = await readFile(repositoryPath(entry.implementationDoc, entry.caseId, "implementationDoc"), "utf8");
    for (const heading of [
      "History modes:",
      "Primary effects:",
      "Domain:",
      "Evidence profile:",
      "Historical Load:",
      "History Equivalence:",
      "Reachability:",
      "Reconstruction:"
    ]) {
      if (!doc.includes(heading)) fail(`${entry.implementationDoc} is missing ${heading}`);
    }

    const rank = maturityRank.get(entry.status);
    if (rank >= maturityRank.get("MODEL_PACK") && entry.status === "MODEL_PACK" && entry.modelPackPath === null) {
      fail(`${entry.caseId} claims MODEL_PACK without modelPackPath`);
    }
    if (rank >= maturityRank.get("EXPLORER") && entry.explorerPath === null) {
      fail(`${entry.caseId} claims ${entry.status} without explorerPath`);
    }
  }

  const expectedOrders = Array.from({ length: registry.cases.length }, (_, index) => index);
  const actualOrders = [...portfolioOrders].sort((left, right) => left - right);
  if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) {
    fail("portfolioOrder values must be contiguous from zero");
  }

  console.log(
    `History registry check passed: ${registry.cases.length} cases, ` +
    `${registry.historyModes.length} modes, ${registry.effects.length} effects.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
