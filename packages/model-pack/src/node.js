import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { canonicalClone, canonicalize } from "@onto2d/kernel";
import {
  ModelPackError,
  modelPackFilePaths,
  verifyModelPack
} from "./index.js";

export const MODEL_PACK_DIRECTORY_LIMITS = Object.freeze({
  maxFileCount: 32,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024
});

const REQUIRED_PATHS = Object.freeze([
  "manifest.json",
  ...Object.values(modelPackFilePaths())
]);
const OPTIONAL_PATHS = Object.freeze(["bundle.json"]);
const ALLOWED_PATHS = new Set([...REQUIRED_PATHS, ...OPTIONAL_PATHS]);
const ALLOWED_DIRECTORIES = new Set(
  [...ALLOWED_PATHS].flatMap((filePath) => {
    const segments = filePath.split("/");
    return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
  })
);

function fail(code, message, details = {}) {
  throw new ModelPackError(code, message, details);
}

function requireOptions(value) {
  if (value === undefined) return MODEL_PACK_DIRECTORY_LIMITS;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("MODEL_PACK_DIRECTORY_OPTIONS_INVALID", "Directory loader options must be a plain object.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("MODEL_PACK_DIRECTORY_OPTIONS_INVALID", "Directory loader options must be a plain object.");
  }
  const safe = canonicalClone(value);
  const fields = new Set(Object.keys(MODEL_PACK_DIRECTORY_LIMITS));
  const unknown = Object.keys(safe).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    fail("MODEL_PACK_DIRECTORY_OPTIONS_INVALID", "Directory loader options contain unknown fields.", {
      unknown
    });
  }
  const limits = { ...MODEL_PACK_DIRECTORY_LIMITS, ...safe };
  for (const [field, maximum] of [
    ["maxFileCount", 4096],
    ["maxFileBytes", 1024 * 1024 * 1024],
    ["maxTotalBytes", 4 * 1024 * 1024 * 1024]
  ]) {
    if (!Number.isSafeInteger(limits[field]) || limits[field] < 1 || limits[field] > maximum) {
      fail("MODEL_PACK_DIRECTORY_LIMIT_INVALID", `${field} is outside the supported range.`, { field });
    }
  }
  if (limits.maxFileBytes > limits.maxTotalBytes) {
    fail("MODEL_PACK_DIRECTORY_LIMIT_INVALID", "maxFileBytes cannot exceed maxTotalBytes.");
  }
  return Object.freeze(limits);
}

async function inventory(directory, limits) {
  let root;
  try {
    root = await lstat(directory);
  } catch (error) {
    fail("MODEL_PACK_DIRECTORY_UNAVAILABLE", "The Model Pack directory cannot be inspected.", {
      cause: error.code ?? error.name
    });
  }
  if (root.isSymbolicLink() || !root.isDirectory()) {
    fail("MODEL_PACK_DIRECTORY_INVALID", "The Model Pack path must be a real directory, not a link.");
  }

  const files = [];
  const visit = async (relativeDirectory = "") => {
    const absolute = relativeDirectory
      ? path.join(directory, ...relativeDirectory.split("/"))
      : directory;
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch (error) {
      fail("MODEL_PACK_DIRECTORY_UNAVAILABLE", "A Model Pack directory entry cannot be read.", {
        path: relativeDirectory || ".",
        cause: error.code ?? error.name
      });
    }
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        fail("MODEL_PACK_DIRECTORY_SYMLINK_REJECTED", "Model Pack directories must not contain symbolic links.", {
          path: relative
        });
      }
      if (entry.isDirectory()) {
        if (!ALLOWED_DIRECTORIES.has(relative)) {
          fail("MODEL_PACK_DIRECTORY_ENTRY_UNEXPECTED", "The Model Pack contains an unexpected directory.", {
            path: relative
          });
        }
        await visit(relative);
      } else if (entry.isFile()) {
        if (!ALLOWED_PATHS.has(relative)) {
          fail("MODEL_PACK_DIRECTORY_ENTRY_UNEXPECTED", "The Model Pack contains an unexpected file.", {
            path: relative
          });
        }
        files.push(relative);
        if (files.length > limits.maxFileCount) {
          fail("MODEL_PACK_DIRECTORY_FILE_LIMIT_EXCEEDED", "The Model Pack exceeds maxFileCount.", {
            maxFileCount: limits.maxFileCount
          });
        }
      } else {
        fail("MODEL_PACK_DIRECTORY_ENTRY_UNSUPPORTED", "The Model Pack contains a non-file entry.", {
          path: relative
        });
      }
    }
  };
  await visit();
  for (const required of REQUIRED_PATHS) {
    if (!files.includes(required)) {
      fail("MODEL_PACK_DIRECTORY_FILE_MISSING", "The Model Pack directory is incomplete.", {
        path: required
      });
    }
  }
  return files.sort();
}

async function readJson(directory, relative, limits, budget) {
  const absolute = path.join(directory, ...relative.split("/"));
  let handle;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    handle = await open(absolute, constants.O_RDONLY | noFollow);
    const before = await handle.stat();
    if (!before.isFile()) {
      fail("MODEL_PACK_DIRECTORY_ENTRY_UNSUPPORTED", "A Model Pack JSON entry is not a regular file.", {
        path: relative
      });
    }
    if (before.size > limits.maxFileBytes) {
      fail("MODEL_PACK_DIRECTORY_FILE_LIMIT_EXCEEDED", "A Model Pack file exceeds maxFileBytes.", {
        path: relative,
        maxFileBytes: limits.maxFileBytes
      });
    }
    if (budget.bytes + before.size > limits.maxTotalBytes) {
      fail("MODEL_PACK_DIRECTORY_TOTAL_LIMIT_EXCEEDED", "The Model Pack exceeds maxTotalBytes.", {
        maxTotalBytes: limits.maxTotalBytes
      });
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== before.size) {
      fail("MODEL_PACK_DIRECTORY_CHANGED", "A Model Pack file changed while it was being read.", {
        path: relative
      });
    }
    budget.bytes += bytes.byteLength;
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("MODEL_PACK_DIRECTORY_UTF8_INVALID", "A Model Pack file is not valid UTF-8.", {
        path: relative
      });
    }
    try {
      return JSON.parse(text);
    } catch {
      fail("MODEL_PACK_DIRECTORY_JSON_INVALID", "A Model Pack file is not valid JSON.", {
        path: relative
      });
    }
  } catch (error) {
    if (error instanceof ModelPackError) throw error;
    fail("MODEL_PACK_DIRECTORY_READ_FAILED", "A Model Pack file cannot be read safely.", {
      path: relative,
      cause: error.code ?? error.name
    });
  } finally {
    await handle?.close();
  }
}

export async function loadModelPackDirectory(directory, options = {}) {
  if (
    typeof directory !== "string" ||
    directory.length === 0 ||
    directory.length > 16384 ||
    directory.includes("\0")
  ) {
    fail("MODEL_PACK_DIRECTORY_PATH_INVALID", "directory must be a non-empty bounded path string.");
  }
  const limits = requireOptions(options);
  const absolute = path.resolve(directory);
  const files = await inventory(absolute, limits);
  const budget = { bytes: 0 };
  const manifest = await readJson(absolute, "manifest.json", limits, budget);
  const packFiles = {};
  for (const relative of Object.values(modelPackFilePaths())) {
    packFiles[relative] = await readJson(absolute, relative, limits, budget);
  }
  const verified = verifyModelPack({ manifest, files: packFiles });
  if (files.includes("bundle.json")) {
    const bundle = verifyModelPack(await readJson(absolute, "bundle.json", limits, budget));
    if (canonicalize(bundle) !== canonicalize(verified)) {
      fail("MODEL_PACK_DIRECTORY_BUNDLE_MISMATCH", "bundle.json differs from the split Model Pack files.");
    }
  }
  return verified;
}
