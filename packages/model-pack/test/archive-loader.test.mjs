import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel";
import { buildModelPack, ModelPackError } from "../src/index.js";
import {
  loadModelPackArchive,
  loadModelPackPath
} from "../src/node.js";
import { createZip, modelPackZipEntries } from "./zip-fixture.mjs";

const sourceHash = `sha256:${"d".repeat(64)}`;

function fixture(version = "1") {
  return buildModelPack({
    model: { id: "archive-fixture", name: "Archive Fixture", version },
    source: { id: "archive-source", files: [{ path: "source.json", hash: sourceHash }] },
    nodes: [{ id: "a" }, { id: "b" }],
    edges: [{ id: "a-b", source: "a", target: "b" }],
    dictionaries: {}
  });
}

async function withRoot(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "onto2d-model-pack-archive-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeArchive(root, entries, options) {
  const archive = path.join(root, "fixture.onto2d.zip");
  const built = createZip(entries, options);
  await writeFile(archive, built.bytes);
  return { archive, ...built };
}

async function writeDirectory(root, pack) {
  const directory = path.join(root, "pack");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(pack.manifest)}\n`);
  for (const [relative, value] of Object.entries(pack.files)) {
    const target = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(value)}\n`);
  }
  return directory;
}

async function rejected(action, code) {
  await assert.rejects(
    action,
    (error) => error instanceof ModelPackError && error.code === code
  );
}

test("the archive loader verifies stored and deflated split files plus an optional bundle", async () => {
  await withRoot(async (root) => {
    const pack = fixture();
    const packEntries = modelPackZipEntries(pack, { bundle: true });
    const timestampExtra = Buffer.from([0x55, 0x54, 0x05, 0x00, 0x01, 0, 0, 0, 0]);
    packEntries[0] = {
      ...packEntries[0],
      method: 0,
      flags: 0,
      localFlags: 0,
      localExtra: timestampExtra,
      centralExtra: timestampExtra
    };
    const entries = [
      { name: "model/", directory: true },
      { name: "indexes/", directory: true },
      ...packEntries
    ];
    const { archive } = await writeArchive(root, entries, { comment: "bounded transport" });
    const loaded = await loadModelPackArchive(archive);
    assert.equal(canonicalize(loaded), canonicalize(pack));
    assert.ok(Object.isFrozen(loaded));
  });
});

test("the path loader dispatches exact directories and regular ZIP files", async () => {
  await withRoot(async (root) => {
    const pack = fixture();
    const directory = await writeDirectory(root, pack);
    const { archive } = await writeArchive(root, modelPackZipEntries(pack));
    assert.equal(canonicalize(await loadModelPackPath(directory)), canonicalize(pack));
    assert.equal(canonicalize(await loadModelPackPath(archive)), canonicalize(pack));
    await rejected(
      () => loadModelPackPath(path.join(root, "missing")),
      "MODEL_PACK_SOURCE_UNAVAILABLE"
    );
    await rejected(
      () => loadModelPackPath(archive, { unknown: {} }),
      "MODEL_PACK_SOURCE_OPTIONS_INVALID"
    );
    await rejected(
      () => loadModelPackPath(directory, { archive: null }),
      "MODEL_PACK_ARCHIVE_OPTIONS_INVALID"
    );
  });
});

test("archives reject unexpected, duplicate, and missing entries", async () => {
  await withRoot(async (root) => {
    const pack = fixture();
    const base = modelPackZipEntries(pack);
    let built = await writeArchive(root, [...base, { name: "../manifest.json", data: "{}" }]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_ENTRY_UNEXPECTED");

    built = await writeArchive(root, [...base, base[0]]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_ENTRY_DUPLICATE");

    built = await writeArchive(root, base.filter((entry) => entry.name !== "manifest.json"));
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_FILE_MISSING");
  });
});

test("archives reject ambiguous ZIP features and non-regular entries", async () => {
  await withRoot(async (root) => {
    const pack = fixture();
    const base = modelPackZipEntries(pack);
    const variants = [
      {
        entry: { ...base[0], flags: 0x0808, localFlags: 0x0808 },
        code: "MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED"
      },
      {
        entry: { ...base[0], method: 12, localMethod: 12 },
        code: "MODEL_PACK_ARCHIVE_COMPRESSION_UNSUPPORTED"
      },
      {
        entry: { ...base[0], externalAttributes: (0o120777 << 16) >>> 0 },
        code: "MODEL_PACK_ARCHIVE_SYMLINK_REJECTED"
      },
      {
        entry: { ...base[0], localMethod: 0 },
        code: "MODEL_PACK_ARCHIVE_FORMAT_INVALID"
      },
      {
        entry: { ...base[0], centralExtra: Buffer.from([0x01, 0x00, 0x00, 0x00]) },
        code: "MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED"
      }
    ];
    for (const variant of variants) {
      const { archive } = await writeArchive(root, [variant.entry, ...base.slice(1)]);
      await rejected(() => loadModelPackArchive(archive), variant.code);
    }
  });
});

test("archives reject ZIP64, multi-disk, inconsistent central records, and hidden bytes", async () => {
  await withRoot(async (root) => {
    const base = modelPackZipEntries(fixture());
    let built = await writeArchive(root, base, { entryCount: 0xffff });
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED");

    built = await writeArchive(root, base, { disk: 1 });
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED");

    built = await writeArchive(root, base, { centralSize: 1 });
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_FORMAT_INVALID");

    built = await writeArchive(root, base);
    await writeFile(built.archive, Buffer.concat([Buffer.from([0]), built.bytes]));
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_FORMAT_INVALID");
  });
});

test("archives authenticate compressed bytes, declared size, and CRC before verification", async () => {
  await withRoot(async (root) => {
    const base = modelPackZipEntries(fixture());
    let built = await writeArchive(root, [{ ...base[0], checksum: 0, localChecksum: 0 }, ...base.slice(1)]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_CRC_MISMATCH");

    built = await writeArchive(root, [
      { ...base[0], compressedData: Buffer.from([0xff]), compressedSize: 1 },
      ...base.slice(1)
    ]);
    await rejected(
      () => loadModelPackArchive(built.archive, { maxCompressionRatio: 100_000 }),
      "MODEL_PACK_ARCHIVE_DECOMPRESSION_FAILED"
    );

    built = await writeArchive(root, [
      { ...base[0], uncompressedSize: Buffer.byteLength(base[0].data) + 1 },
      ...base.slice(1)
    ]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_SIZE_MISMATCH");
  });
});

test("archive, entry, expansion, total, and ratio limits fail before unsafe use", async () => {
  await withRoot(async (root) => {
    const base = modelPackZipEntries(fixture());
    const built = await writeArchive(root, base);
    const largestCompressed = Math.max(...built.records.map((entry) => entry.compressedSize));
    const uncompressedSizes = base.map((entry) => Buffer.byteLength(entry.data));
    const largestUncompressed = Math.max(...uncompressedSizes);
    const totalUncompressed = uncompressedSizes.reduce((sum, size) => sum + size, 0);
    const cases = [
      [{
        maxArchiveBytes: built.bytes.byteLength - 1,
        maxCompressedEntryBytes: largestCompressed
      }, "MODEL_PACK_ARCHIVE_SIZE_LIMIT_EXCEEDED"],
      [{ maxEntryCount: base.length - 1 }, "MODEL_PACK_ARCHIVE_ENTRY_LIMIT_EXCEEDED"],
      [{ maxCompressedEntryBytes: 1 }, "MODEL_PACK_ARCHIVE_COMPRESSED_LIMIT_EXCEEDED"],
      [{ maxUncompressedEntryBytes: 1 }, "MODEL_PACK_ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED"],
      [{ maxTotalUncompressedBytes: 1 }, "MODEL_PACK_ARCHIVE_LIMIT_INVALID"],
      [{ maxCompressionRatio: 1 }, "MODEL_PACK_ARCHIVE_RATIO_LIMIT_EXCEEDED"]
    ];
    for (const [options, code] of cases) {
      await rejected(() => loadModelPackArchive(built.archive, options), code);
    }
    await rejected(
      () => loadModelPackArchive(built.archive, {
        maxUncompressedEntryBytes: largestUncompressed,
        maxTotalUncompressedBytes: totalUncompressed - 1
      }),
      "MODEL_PACK_ARCHIVE_TOTAL_LIMIT_EXCEEDED"
    );
    await rejected(
      () => loadModelPackArchive(built.archive, { maxArchiveBytes: 64, maxCompressedEntryBytes: 65 }),
      "MODEL_PACK_ARCHIVE_LIMIT_INVALID"
    );
  });
});

test("archive JSON and UTF-8 decoding are fail-closed", async () => {
  await withRoot(async (root) => {
    const base = modelPackZipEntries(fixture());
    let built = await writeArchive(root, [{ ...base[0], data: "{" }, ...base.slice(1)]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_JSON_INVALID");

    built = await writeArchive(root, [{ ...base[0], data: Buffer.from([0xff]) }, ...base.slice(1)]);
    await rejected(() => loadModelPackArchive(built.archive), "MODEL_PACK_ARCHIVE_UTF8_INVALID");

    built = await writeArchive(root, [{ ...base[0], name: Buffer.from([0xff]) }, ...base.slice(1)]);
    await rejected(
      () => loadModelPackArchive(built.archive),
      "MODEL_PACK_ARCHIVE_NAME_ENCODING_INVALID"
    );
  });
});

test("an optional archive bundle must match the authoritative split files", async () => {
  await withRoot(async (root) => {
    const entries = modelPackZipEntries(fixture(), { bundle: true });
    entries.at(-1).data = `${JSON.stringify(fixture("2"))}\n`;
    const { archive } = await writeArchive(root, entries);
    await rejected(() => loadModelPackArchive(archive), "MODEL_PACK_ARCHIVE_BUNDLE_MISMATCH");
  });
});

test("archive paths and ZIP symlinks are rejected before content is trusted", async (context) => {
  if (process.platform === "win32") {
    context.diagnostic("Symbolic-link creation is not portable on Windows CI.");
    return;
  }
  await withRoot(async (root) => {
    const { archive } = await writeArchive(root, modelPackZipEntries(fixture()));
    const linked = path.join(root, "linked.zip");
    await symlink(path.basename(archive), linked);
    await rejected(() => loadModelPackArchive(linked), "MODEL_PACK_ARCHIVE_SYMLINK_REJECTED");
    await rejected(() => loadModelPackPath(linked), "MODEL_PACK_SOURCE_SYMLINK_REJECTED");
  });
});

test("transport options reject accessors and symbols without invoking user code", async () => {
  await withRoot(async (root) => {
    const pack = fixture();
    const directory = await writeDirectory(root, pack);
    const { archive } = await writeArchive(root, modelPackZipEntries(pack));
    let invoked = 0;
    const accessor = {};
    Object.defineProperty(accessor, "maxArchiveBytes", {
      enumerable: true,
      get() {
        invoked += 1;
        return 1024;
      }
    });
    await rejected(
      () => loadModelPackArchive(archive, accessor),
      "MODEL_PACK_ARCHIVE_OPTIONS_INVALID"
    );
    assert.equal(invoked, 0);

    const symbolOptions = { [Symbol("limit")]: 1 };
    await rejected(
      () => loadModelPackPath(directory, { directory: symbolOptions }),
      "MODEL_PACK_DIRECTORY_OPTIONS_INVALID"
    );
  });
});
