const CACHE_REVISION_PATTERN = /^\d{8}\.\d+$/u;

function scriptBlocks(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)].map((match) => ({
    attributes: match[1],
    body: match[2]
  }));
}

function attribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu"));
  return match?.[1] ?? null;
}

function isLocalJavaScriptResource(resource) {
  if (!resource?.startsWith(".")) return false;
  return resource.split(/[?#]/u, 1)[0].endsWith(".js");
}

function resourceRevision(resource) {
  const query = resource.split("?", 2)[1]?.split("#", 1)[0] ?? "";
  return new URLSearchParams(query).get("v");
}

function setResourceRevision(resource, revision) {
  const hashIndex = resource.indexOf("#");
  const hash = hashIndex === -1 ? "" : resource.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? resource : resource.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1));
  query.set("v", revision);
  return `${pathname}?${query.toString()}${hash}`;
}

function modelStudioEntryResources(indexSource) {
  return scriptBlocks(indexSource)
    .filter(({ attributes }) => attribute(attributes, "type") === "module")
    .map(({ attributes }) => attribute(attributes, "src"))
    .filter((resource) => resource?.split(/[?#]/u, 1)[0].endsWith("/model-studio.js"));
}

function modelStudioImportMapResources(indexSource, errors) {
  const maps = scriptBlocks(indexSource)
    .filter(({ attributes }) => attribute(attributes, "type") === "importmap");
  if (maps.length !== 1) {
    errors.push(`expected one Model Studio import map, found ${maps.length}`);
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(maps[0].body.trim());
  } catch (error) {
    errors.push(`Model Studio import map is not valid JSON: ${error.message}`);
    return [];
  }
  if (!parsed.imports || typeof parsed.imports !== "object" || Array.isArray(parsed.imports)) {
    errors.push("Model Studio import map must define an imports object");
    return [];
  }
  return Object.entries(parsed.imports)
    .filter(([, resource]) => isLocalJavaScriptResource(resource))
    .map(([name, resource]) => ({ label: `import map ${name}`, resource }));
}

function modelStudioAppResources(appSource) {
  const references = [];
  const patterns = [
    { label: "dynamic module import", pattern: /\bimport\s*\(\s*["']([^"']+)["']/gu },
    { label: "module import", pattern: /(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/gu },
    { label: "URL dependency", pattern: /\bnew\s+URL\(\s*["']([^"']+)["']/gu }
  ];
  for (const { label, pattern } of patterns) {
    for (const match of appSource.matchAll(pattern)) {
      if (isLocalJavaScriptResource(match[1])) references.push({ label, resource: match[1] });
    }
  }

  const unique = new Map();
  for (const reference of references) unique.set(`${reference.label}\u0000${reference.resource}`, reference);
  return [...unique.values()];
}

function replaceResources(source, resources, revision) {
  let updated = source;
  for (const resource of new Set(resources)) {
    updated = updated.split(resource).join(setResourceRevision(resource, revision));
  }
  return updated;
}

export function inspectModelStudioRevisionGraph(indexSource, appSource) {
  const errors = [];
  const entries = modelStudioEntryResources(indexSource);
  if (entries.length !== 1) {
    errors.push(`expected one versioned Model Studio module entrypoint, found ${entries.length}`);
  }

  const revision = entries.length === 1 ? resourceRevision(entries[0]) : null;
  if (revision === null) errors.push("Model Studio module entrypoint must carry a ?v= cache revision");
  if (revision !== null && !CACHE_REVISION_PATTERN.test(revision)) {
    errors.push(`Model Studio module entrypoint has invalid cache revision ${JSON.stringify(revision)}`);
  }

  const references = [
    ...modelStudioImportMapResources(indexSource, errors),
    ...modelStudioAppResources(appSource)
  ];
  if (references.length === 0) errors.push("Model Studio module graph has no versioned dependencies");

  for (const { label, resource } of references) {
    const dependencyRevision = resourceRevision(resource);
    if (dependencyRevision === null) {
      errors.push(`${label} ${resource} must carry a ?v= cache revision`);
    } else if (revision !== null && dependencyRevision !== revision) {
      errors.push(`${label} ${resource} uses ${dependencyRevision}; expected ${revision}`);
    }
  }

  return { revision, references, errors };
}

export function synchronizeModelStudioRevision(indexSource, appSource, revision) {
  if (!CACHE_REVISION_PATTERN.test(revision)) {
    throw new Error(`Model Studio cache revision must match YYYYMMDD.N; received ${JSON.stringify(revision)}`);
  }

  const importMapErrors = [];
  const entries = modelStudioEntryResources(indexSource);
  const importMapReferences = modelStudioImportMapResources(indexSource, importMapErrors);
  const appReferences = modelStudioAppResources(appSource);
  if (entries.length !== 1 || importMapErrors.length > 0 || appReferences.length === 0) {
    const details = [
      entries.length !== 1 ? `expected one Model Studio entrypoint, found ${entries.length}` : null,
      ...importMapErrors,
      appReferences.length === 0 ? "Model Studio app has no local JavaScript dependencies" : null
    ].filter(Boolean);
    throw new Error(`Cannot synchronize Model Studio revision:\n- ${details.join("\n- ")}`);
  }

  const updatedIndex = replaceResources(
    indexSource,
    [...entries, ...importMapReferences.map(({ resource }) => resource)],
    revision
  );
  const updatedApp = replaceResources(
    appSource,
    appReferences.map(({ resource }) => resource),
    revision
  );
  const inspection = inspectModelStudioRevisionGraph(updatedIndex, updatedApp);
  if (inspection.errors.length > 0) {
    throw new Error(`Synchronized Model Studio graph is invalid:\n- ${inspection.errors.join("\n- ")}`);
  }
  return { indexSource: updatedIndex, appSource: updatedApp };
}
