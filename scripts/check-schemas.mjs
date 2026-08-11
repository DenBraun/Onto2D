import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_ROOT = path.join(REPOSITORY_ROOT, "packages", "schemas", "schemas");
const SCHEMA_EXPORT_FILE = path.join(REPOSITORY_ROOT, "packages", "schemas", "src", "index.js");

function collectReferences(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, result);
  } else if (value && typeof value === "object") {
    if (typeof value.$ref === "string") result.push(value.$ref);
    for (const nested of Object.values(value)) collectReferences(nested, result);
  }
  return result;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function run() {
  const schemaNames = (await readdir(SCHEMA_ROOT)).filter((name) => name.endsWith(".schema.json")).sort();
  const ids = new Map();
  const failures = [];
  const parsedSchemas = [];
  const exportSource = await readFile(SCHEMA_EXPORT_FILE, "utf8");
  const exportedSchemaNames = [...exportSource.matchAll(/schema\("([a-z0-9-]+)"\)/g)]
    .map((match) => `${match[1]}.schema.json`);
  const exportedSchemas = new Set(exportedSchemaNames);

  if (exportedSchemas.size !== exportedSchemaNames.length) {
    failures.push("packages/schemas/src/index.js: duplicate schema export target");
  }
  for (const name of schemaNames) {
    if (!exportedSchemas.has(name)) failures.push(`${name}: schema is not exported by @onto2d/schemas`);
  }
  for (const name of exportedSchemas) {
    if (!schemaNames.includes(name)) failures.push(`${name}: exported schema file does not exist`);
  }

  for (const name of schemaNames) {
    const file = path.join(SCHEMA_ROOT, name);
    let schema;
    try {
      schema = JSON.parse(await readFile(file, "utf8"));
      parsedSchemas.push(schema);
    } catch (error) {
      failures.push(`${name}: invalid JSON: ${error.message}`);
      continue;
    }

    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      failures.push(`${name}: expected JSON Schema draft 2020-12 declaration`);
    }
    if (typeof schema.$id !== "string" || schema.$id.length === 0) {
      failures.push(`${name}: missing $id`);
    } else if (schema.$id !== `https://onto2d.dev/schemas/v1/${name}`) {
      failures.push(`${name}: unexpected $id ${schema.$id}`);
    } else if (ids.has(schema.$id)) {
      failures.push(`${name}: duplicate $id also used by ${ids.get(schema.$id)}`);
    } else {
      ids.set(schema.$id, name);
    }
    if (schema.additionalProperties !== false) {
      failures.push(`${name}: top-level additionalProperties must be false`);
    }

    for (const reference of collectReferences(schema)) {
      const target = reference.split("#")[0];
      if (!target || /^(?:https?:|urn:)/.test(target)) continue;
      if (!await exists(path.resolve(path.dirname(file), target))) {
        failures.push(`${name}: unresolved local $ref ${reference}`);
      }
    }
  }

  if (parsedSchemas.length === schemaNames.length) {
    try {
      const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
      parsedSchemas.forEach((schema) => ajv.addSchema(schema));
      parsedSchemas.forEach((schema) => {
        if (ajv.getSchema(schema.$id) === undefined) {
          failures.push(`${schema.$id}: schema did not compile`);
        }
      });
    } catch (error) {
      failures.push(`JSON Schema compilation failed: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Schema validation failed:\n${failures.join("\n")}`);
  }

  console.log(`Schema check passed: ${schemaNames.length} versioned contracts.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
