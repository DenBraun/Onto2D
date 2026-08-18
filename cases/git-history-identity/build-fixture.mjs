import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hashArtifactBytes, hashCanonical } from "@onto2d/kernel/canonical";
import { IDENTITY_REGIMES, ancestryProjection, compareHistories } from "./src/history-identity.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPEC = path.join(CASE_ROOT, "fixture-spec.json");
const DEFAULT_OUTPUT = path.join(CASE_ROOT, "artifacts", "history-identity.json");
const SOURCE_DOMAIN = "onto2d:git-history-fixture-source:v1";
const CASE_DOMAIN = "onto2d:git-history-identity-case:v1";
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fail(message) {
  throw new Error(`Git History Identity fixture failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function identifier(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) fail(`${label} must be a normalized identifier`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.length === 0 || !value.isWellFormed() || value.includes("\0")) fail(`${label} must be non-empty UTF-8 text without NUL`);
  return value;
}

function safeTreePath(value) {
  return typeof value === "string"
    && value.length <= 240
    && value.split("/").every((segment) => SAFE_PATH_SEGMENT.test(segment));
}

function uniqueRecords(records, label, validate) {
  if (!Array.isArray(records) || records.length === 0) fail(`${label} must be a non-empty array`);
  const result = new Map();
  records.forEach((record, index) => {
    exactKeys(record, validate.keys, `${label}[${index}]`);
    const id = identifier(record.id, `${label}[${index}].id`);
    if (result.has(id)) fail(`duplicate ${label} ID ${id}`);
    validate.record(record, index);
    result.set(id, record);
  });
  return result;
}

export function validateFixtureSpec(input) {
  const spec = structuredClone(input);
  exactKeys(spec, ["format", "formatVersion", "caseVersion", "objectFormat", "actors", "blobs", "trees", "commits", "histories", "experiments"], "fixture spec");
  if (spec.format !== "onto2d-git-history-fixture-spec" || spec.formatVersion !== "1" || spec.caseVersion !== "git-history-identity-v1") fail("unsupported fixture specification");
  if (spec.objectFormat !== "sha1") fail("v1 requires the Git sha1 object format");
  const actors = uniqueRecords(spec.actors, "actors", {
    keys: ["id", "name", "email"],
    record: (actor, index) => {
      text(actor.name, `actors[${index}].name`);
      if (typeof actor.email !== "string" || !/^[^<>\s@]+@[^<>\s@]+$/.test(actor.email)) fail(`actors[${index}].email is invalid`);
    }
  });
  const blobs = uniqueRecords(spec.blobs, "blobs", {
    keys: ["id", "content"],
    record: (blob, index) => text(blob.content, `blobs[${index}].content`)
  });
  const trees = uniqueRecords(spec.trees, "trees", {
    keys: ["id", "entries"],
    record: (tree, index) => {
      if (!Array.isArray(tree.entries) || tree.entries.length === 0) fail(`trees[${index}].entries must be non-empty`);
      const seenPaths = new Set();
      tree.entries.forEach((entry, entryIndex) => {
        exactKeys(entry, ["mode", "path", "blob"], `trees[${index}].entries[${entryIndex}]`);
        if (entry.mode !== "100644") fail(`trees[${index}] supports only mode 100644`);
        if (!safeTreePath(entry.path)) fail(`trees[${index}].entries[${entryIndex}].path is unsafe`);
        identifier(entry.blob, `trees[${index}].entries[${entryIndex}].blob`);
        if (!blobs.has(entry.blob)) fail(`tree ${tree.id} references unknown blob ${entry.blob}`);
        if (seenPaths.has(entry.path)) fail(`tree ${tree.id} repeats path ${entry.path}`);
        seenPaths.add(entry.path);
      });
    }
  });
  const seenCommits = new Set();
  const commits = uniqueRecords(spec.commits, "commits", {
    keys: ["id", "tree", "parents", "actor", "timestamp", "message"],
    record: (commit, index) => {
      identifier(commit.tree, `commits[${index}].tree`);
      identifier(commit.actor, `commits[${index}].actor`);
      if (!trees.has(commit.tree)) fail(`commit ${commit.id} references unknown tree ${commit.tree}`);
      if (!actors.has(commit.actor)) fail(`commit ${commit.id} references unknown actor ${commit.actor}`);
      if (!Array.isArray(commit.parents) || commit.parents.length > 2) fail(`commit ${commit.id} must have zero to two parents`);
      const parentSet = new Set();
      for (const parent of commit.parents) {
        identifier(parent, `commit ${commit.id} parent`);
        if (!seenCommits.has(parent)) fail(`commit ${commit.id} parent ${parent} must precede it`);
        if (parentSet.has(parent)) fail(`commit ${commit.id} repeats parent ${parent}`);
        parentSet.add(parent);
      }
      if (!Number.isSafeInteger(commit.timestamp) || commit.timestamp < 1) fail(`commit ${commit.id} timestamp is invalid`);
      text(commit.message, `commit ${commit.id} message`);
      if (commit.message.includes("\n")) fail(`commit ${commit.id} message must be one line`);
      seenCommits.add(commit.id);
    }
  });
  const histories = uniqueRecords(spec.histories, "histories", {
    keys: ["id", "label", "head"],
    record: (history, index) => {
      text(history.label, `histories[${index}].label`);
      identifier(history.head, `histories[${index}].head`);
      if (!commits.has(history.head)) fail(`history ${history.id} references unknown head ${history.head}`);
    }
  });
  uniqueRecords(spec.experiments, "experiments", {
    keys: ["id", "label", "left", "right", "claim"],
    record: (experiment, index) => {
      text(experiment.label, `experiments[${index}].label`);
      text(experiment.claim, `experiments[${index}].claim`);
      identifier(experiment.left, `experiments[${index}].left`);
      identifier(experiment.right, `experiments[${index}].right`);
      if (!histories.has(experiment.left) || !histories.has(experiment.right)) fail(`experiment ${experiment.id} references an unknown history`);
      if (experiment.left === experiment.right) fail(`experiment ${experiment.id} must compare distinct histories`);
    }
  });
  return Object.freeze(spec);
}

function runGit(gitBinary, repository, args, options = {}) {
  const result = spawnSync(gitBinary, args, {
    cwd: repository,
    input: options.input,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 4 * 1024 * 1024,
    env: options.env ?? {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      LC_ALL: "C",
      TZ: "UTC"
    }
  });
  if (result.error) fail(`cannot execute ${gitBinary}: ${result.error.message}`);
  if (result.status !== 0) fail(`git ${args.join(" ")} failed: ${String(result.stderr).trim()}`);
  return options.binary ? result.stdout : result.stdout.trim();
}

function gitObjectId(type, bytes) {
  const header = Buffer.from(`${type} ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function verifyGitObject(gitBinary, repository, type, oid) {
  const actualType = runGit(gitBinary, repository, ["cat-file", "-t", oid]);
  if (actualType !== type) fail(`object ${oid} has type ${actualType}, expected ${type}`);
  const bytes = runGit(gitBinary, repository, ["cat-file", type, oid], { binary: true });
  const independent = gitObjectId(type, bytes);
  if (independent !== oid) fail(`independent ${type} hash mismatch for ${oid}`);
  return bytes;
}

function resolveHistory(history, commits) {
  const visited = new Set();
  const visit = (fixtureId) => {
    if (visited.has(fixtureId)) return;
    const commit = commits.get(fixtureId);
    if (!commit) fail(`history ${history.id} cannot resolve ${fixtureId}`);
    for (const parent of commit.parents) visit(parent);
    visited.add(fixtureId);
  };
  visit(history.head);
  const ordered = [...visited];
  const projection = ancestryProjection(history.head, [...commits.values()]);
  return Object.freeze({
    id: history.id,
    label: history.label,
    head: history.head,
    commits: ordered,
    commitCount: ordered.length,
    ancestryIdentity: projection.identity
  });
}

export async function buildGitHistoryCase(options = {}) {
  const specPath = path.resolve(options.specPath ?? DEFAULT_SPEC);
  const gitBinary = options.gitBinary ?? "git";
  const specBytes = await readFile(specPath);
  let specText;
  let parsed;
  try {
    specText = new TextDecoder("utf-8", { fatal: true }).decode(specBytes);
  } catch {
    fail("fixture specification is not valid UTF-8");
  }
  try {
    parsed = JSON.parse(specText);
  } catch {
    fail("fixture specification is not valid JSON");
  }
  const spec = validateFixtureSpec(parsed);
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, spec);
  const repository = await mkdtemp(path.join(os.tmpdir(), "onto2d-git-history-"));
  try {
    runGit(gitBinary, repository, ["init", "--quiet", "--object-format=sha1", "."]);
    const blobOids = new Map();
    const blobs = spec.blobs.map((blob) => {
      const bytes = Buffer.from(blob.content, "utf8");
      const oid = runGit(gitBinary, repository, ["hash-object", "-w", "--stdin"], { input: bytes });
      if (gitObjectId("blob", bytes) !== oid) fail(`independent blob hash mismatch for ${blob.id}`);
      verifyGitObject(gitBinary, repository, "blob", oid);
      blobOids.set(blob.id, oid);
      return Object.freeze({ fixtureId: blob.id, oid, bytes: bytes.length, contentSha256: hashArtifactBytes(bytes), contentUtf8: blob.content });
    });

    const treeOids = new Map();
    const trees = spec.trees.map((tree) => {
      const entries = [...tree.entries].sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path))).map((entry) => ({
        mode: entry.mode,
        path: entry.path,
        blobFixtureId: entry.blob,
        oid: blobOids.get(entry.blob)
      }));
      const input = `${entries.map((entry) => `${entry.mode} blob ${entry.oid}\t${entry.path}`).join("\n")}\n`;
      const oid = runGit(gitBinary, repository, ["mktree"], { input });
      const raw = verifyGitObject(gitBinary, repository, "tree", oid);
      treeOids.set(tree.id, oid);
      return Object.freeze({ fixtureId: tree.id, oid, rawSha256: hashArtifactBytes(raw), entries: Object.freeze(entries) });
    });

    const actors = new Map(spec.actors.map((actor) => [actor.id, actor]));
    const commitRecords = new Map();
    const commits = spec.commits.map((commit) => {
      const actor = actors.get(commit.actor);
      const args = ["commit-tree", treeOids.get(commit.tree)];
      for (const parent of commit.parents) args.push("-p", commitRecords.get(parent).oid);
      const baseEnv = {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        LC_ALL: "C",
        TZ: "UTC",
        GIT_AUTHOR_NAME: actor.name,
        GIT_AUTHOR_EMAIL: actor.email,
        GIT_AUTHOR_DATE: `${commit.timestamp} +0000`,
        GIT_COMMITTER_NAME: actor.name,
        GIT_COMMITTER_EMAIL: actor.email,
        GIT_COMMITTER_DATE: `${commit.timestamp} +0000`
      };
      const oid = runGit(gitBinary, repository, args, { input: `${commit.message}\n`, env: baseEnv });
      const raw = verifyGitObject(gitBinary, repository, "commit", oid);
      const record = Object.freeze({
        fixtureId: commit.id,
        oid,
        treeFixtureId: commit.tree,
        tree: treeOids.get(commit.tree),
        parents: Object.freeze([...commit.parents]),
        parentOids: Object.freeze(commit.parents.map((parent) => commitRecords.get(parent).oid)),
        actor: Object.freeze({ id: actor.id, name: actor.name, email: actor.email }),
        timestamp: commit.timestamp,
        timezone: "+0000",
        message: commit.message,
        rawSha256: hashArtifactBytes(raw)
      });
      commitRecords.set(commit.id, record);
      return record;
    });

    const histories = spec.histories.map((history) => resolveHistory(history, commitRecords));
    const comparisons = spec.experiments.map((experiment) => compareHistories(experiment, spec.histories, commits));
    const basis = {
      format: "onto2d-git-history-identity-case",
      formatVersion: "1",
      caseVersion: spec.caseVersion,
      generatedBy: "cases/git-history-identity/build-fixture.mjs",
      source: {
        fixture: "cases/git-history-identity/fixture-spec.json",
        fixtureBytes: specBytes.length,
        fixtureSha256: hashArtifactBytes(specBytes),
        sourceIdentity
      },
      git: {
        objectFormat: "sha1",
        objectIdentityVerifiedIndependently: true,
        environmentFieldsInIdentity: ["tree", "parents", "author", "committer", "timestamp", "timezone", "message"]
      },
      regimes: IDENTITY_REGIMES,
      objects: { blobs, trees, commits },
      histories,
      comparisons
    };
    return Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
}

function parseArguments(argv) {
  const options = { verify: false, output: DEFAULT_OUTPUT, specPath: DEFAULT_SPEC };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--verify") options.verify = true;
    else if ((flag === "--output" || flag === "--spec") && argv[index + 1]) {
      if (flag === "--output") options.output = path.resolve(argv[index + 1]);
      else options.specPath = path.resolve(argv[index + 1]);
      index += 1;
    } else fail(`unknown or incomplete argument ${flag}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const artifact = await buildGitHistoryCase({ specPath: options.specPath });
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  if (options.verify) {
    const committed = await readFile(options.output, "utf8");
    if (committed !== serialized) fail(`committed artifact does not reproduce: ${options.output}`);
    process.stdout.write(`Verified ${options.output}\n`);
    return;
  }
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, serialized, "utf8");
  process.stdout.write(`Wrote ${options.output}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
