import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCUMENT_ROOTS = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "apps",
  "docs",
  "cases",
  "packages",
  "models",
  "tools"
];
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

export function localLinkTargets(markdown) {
  const targets = [];
  const pattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, "").split(/\s+[\"']/)[0];
    if (!raw || /^(?:https?:|mailto:|data:)/.test(raw)) continue;
    targets.push(decodeURIComponent(raw));
  }
  return targets;
}

export function markdownAnchors(markdown) {
  const anchors = new Set();
  const occurrences = new Map();
  // Fenced examples are not document headings or HTML anchors.
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, "");
  for (const match of prose.matchAll(/\bid=["']([^"']+)["']/g)) anchors.add(match[1]);
  for (const match of prose.matchAll(/^#{1,6} (.+)$/gm)) {
    const base = match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "").replace(/ /g, "-");
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
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
  const anchorCache = new Map();
  for (const file of [...new Set(files)].sort()) {
    const markdown = await readFile(file, "utf8");
    const relative = path.relative(REPOSITORY_ROOT, file);
    const fenceCount = (markdown.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) failures.push(`${relative}: unbalanced fenced code blocks`);
    if (!markdown.endsWith("\n")) failures.push(`${relative}: missing final newline`);

    for (const target of localLinkTargets(markdown)) {
      const [targetPath, fragment] = target.split("#");
      const resolved = targetPath ? path.resolve(path.dirname(file), targetPath) : file;
      if (!resolved.startsWith(`${REPOSITORY_ROOT}${path.sep}`) && resolved !== REPOSITORY_ROOT) {
        failures.push(`${relative}: local link escapes repository: ${target}`);
      } else if (!await exists(resolved)) {
        failures.push(`${relative}: broken local link: ${target}`);
      } else if (fragment && resolved.endsWith(".md")) {
        if (!anchorCache.has(resolved)) {
          anchorCache.set(resolved, markdownAnchors(await readFile(resolved, "utf8")));
        }
        if (!anchorCache.get(resolved).has(fragment)) {
          failures.push(`${relative}: broken Markdown anchor: ${target}`);
        }
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
