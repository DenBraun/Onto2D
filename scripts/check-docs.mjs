import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCUMENT_ROOTS = ["README.md", "CONTRIBUTING.md", "docs", "cases", "packages"];
const IGNORED_DIRECTORIES = new Set(["dist", "node_modules"]);

async function collectMarkdown(relativePath) {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const child = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectMarkdown(path.relative(REPOSITORY_ROOT, child)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      result.push(child);
    }
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

function localLinkTargets(markdown) {
  const targets = [];
  const pattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, "").split(/\s+[\"']/)[0];
    if (!raw || raw.startsWith("#") || /^(?:https?:|mailto:|data:)/.test(raw)) continue;
    targets.push(decodeURIComponent(raw.split("#")[0]));
  }
  return targets;
}

export async function run() {
  const files = [];
  for (const entry of DOCUMENT_ROOTS) {
    const absolute = path.join(REPOSITORY_ROOT, entry);
    if (!await exists(absolute)) continue;
    if (entry.endsWith(".md")) files.push(absolute);
    else files.push(...await collectMarkdown(entry));
  }

  const failures = [];
  for (const file of [...new Set(files)].sort()) {
    const markdown = await readFile(file, "utf8");
    const relative = path.relative(REPOSITORY_ROOT, file);
    const fenceCount = (markdown.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) failures.push(`${relative}: unbalanced fenced code blocks`);
    if (!markdown.endsWith("\n")) failures.push(`${relative}: missing final newline`);

    for (const target of localLinkTargets(markdown)) {
      const resolved = path.resolve(path.dirname(file), target);
      if (!resolved.startsWith(`${REPOSITORY_ROOT}${path.sep}`) && resolved !== REPOSITORY_ROOT) {
        failures.push(`${relative}: local link escapes repository: ${target}`);
      } else if (!await exists(resolved)) {
        failures.push(`${relative}: broken local link: ${target}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Documentation validation failed:\n${failures.join("\n")}`);
  }

  console.log(`Documentation check passed: ${files.length} Markdown files.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
