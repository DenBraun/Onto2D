import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel";
import { buildModelPack, modelPackFilePaths, ModelPackError } from "../src/index.js";
import { loadModelPackDirectory } from "../src/node.js";

const sourceHash = `sha256:${"c".repeat(64)}`;

function fixture(version = "1") {
  return buildModelPack({
    model: { id: "directory-fixture", name: "Directory Fixture", version },
    source: { id: "directory-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

async function writePack(directory, pack, { bundle = false } = {}) {
  await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(pack.manifest)}\n`);
  for (const [relative, value] of Object.entries(pack.files)) {
    const target = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(value)}\n`);
  }
  if (bundle) await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(pack)}\n`);
}

async function withDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "onto2d-model-pack-loader-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("the Node loader verifies a complete transparent Model Pack directory", async () => {
  await withDirectory(async (directory) => {
    const pack = fixture();
    await writePack(directory, pack, { bundle: true });
    const loaded = await loadModelPackDirectory(directory);
    assert.equal(canonicalize(loaded), canonicalize(pack));
    assert.ok(Object.isFrozen(loaded));
  });
});

test("the Node loader rejects unexpected executable content and links", async (context) => {
  await withDirectory(async (directory) => {
    await writePack(directory, fixture());
    await writeFile(path.join(directory, "model", "script.js"), "export default 1;\n");
    await assert.rejects(
      () => loadModelPackDirectory(directory),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_DIRECTORY_ENTRY_UNEXPECTED"
    );
  });

  if (process.platform === "win32") {
    context.diagnostic("Symbolic-link creation is not portable on Windows CI.");
    return;
  }
  await withDirectory(async (directory) => {
    await writePack(directory, fixture());
    await symlink("manifest.json", path.join(directory, "linked.json"));
    await assert.rejects(
      () => loadModelPackDirectory(directory),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_DIRECTORY_SYMLINK_REJECTED"
    );
  });
});

test("the Node loader rejects tampering, malformed encoding, and resource-limit violations", async () => {
  await withDirectory(async (directory) => {
    const pack = fixture();
    await writePack(directory, pack);
    const parentsPath = path.join(directory, ...modelPackFilePaths().parents.split("/"));
    await writeFile(parentsPath, "[]\n");
    await assert.rejects(
      () => loadModelPackDirectory(directory),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_VERIFICATION_FAILED"
    );
  });

  await withDirectory(async (directory) => {
    await writePack(directory, fixture());
    await writeFile(path.join(directory, "manifest.json"), new Uint8Array([0xff]));
    await assert.rejects(
      () => loadModelPackDirectory(directory),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_DIRECTORY_UTF8_INVALID"
    );
  });

  await withDirectory(async (directory) => {
    await writePack(directory, fixture());
    await assert.rejects(
      () => loadModelPackDirectory(directory, { maxFileCount: 2 }),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_DIRECTORY_FILE_LIMIT_EXCEEDED"
    );
  });
});

test("a convenience bundle must reproduce the authoritative split files", async () => {
  await withDirectory(async (directory) => {
    await writePack(directory, fixture());
    await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(fixture("2"))}\n`);
    await assert.rejects(
      () => loadModelPackDirectory(directory),
      (error) => error instanceof ModelPackError && error.code === "MODEL_PACK_DIRECTORY_BUNDLE_MISMATCH"
    );
  });
});
