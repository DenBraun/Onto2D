import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "runs"]);

async function collectFiles(directory, predicate) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(absolutePath, predicate));
    if (entry.isFile() && predicate(absolutePath)) result.push(absolutePath);
  }

  return result;
}

function isImportMetaUrl(node, sourceFile) {
  return node.getText(sourceFile) === "import.meta.url";
}

function isFileUrlExpression(node, fileUrlNames, sourceFile) {
  if (!node) return false;
  if (ts.isIdentifier(node)) return fileUrlNames.has(node.text);
  if (isImportMetaUrl(node, sourceFile)) return true;
  if (
    ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === "pathToFileURL"
  ) {
    return true;
  }
  return ts.isNewExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === "URL"
    && (node.arguments ?? []).some((argument) =>
      isFileUrlExpression(argument, fileUrlNames, sourceFile)
    );
}

export function findUnsafeFileUrlPathnames(source, fileName = "source.js") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const isNodeModule = sourceFile.statements.some((statement) =>
    ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text.startsWith("node:")
  );
  if (!isNodeModule) return [];

  const declarations = [];
  const fileUrlNames = new Set();

  function collectDeclarations(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(sourceFile);

  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (
        !fileUrlNames.has(declaration.name.text)
        && isFileUrlExpression(declaration.initializer, fileUrlNames, sourceFile)
      ) {
        fileUrlNames.add(declaration.name.text);
        changed = true;
      }
    }
  }

  const findings = [];
  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node)
      && node.name.text === "pathname"
      && isFileUrlExpression(node.expression, fileUrlNames, sourceFile)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      findings.push({ line: line + 1, column: character + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}

export async function run() {
  const sourceFiles = await collectFiles(
    REPOSITORY_ROOT,
    (file) => /\.(?:cjs|js|mjs)$/.test(file)
  );
  const jsonFiles = await collectFiles(
    REPOSITORY_ROOT,
    (file) => file.endsWith(".json")
  );
  const failures = [];

  for (const file of sourceFiles.sort()) {
    const source = await readFile(file, "utf8");
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      failures.push(`${path.relative(REPOSITORY_ROOT, file)}\n${result.stderr || result.stdout}`);
    }
    for (const finding of findUnsafeFileUrlPathnames(source, file)) {
      failures.push(
        `${path.relative(REPOSITORY_ROOT, file)}:${finding.line}:${finding.column}\n`
        + "Do not read pathname from a local file URL; use fileURLToPath() for filesystem paths."
      );
    }
  }

  for (const file of jsonFiles.sort()) {
    try {
      JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      failures.push(`${path.relative(REPOSITORY_ROOT, file)}\n${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Source validation failed:\n\n${failures.join("\n\n")}`);
  }

  console.log(`Source check passed: ${sourceFiles.length} JavaScript files and ${jsonFiles.length} JSON files.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
