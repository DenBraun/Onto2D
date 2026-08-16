import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { inflateRaw } from "node:zlib";
import { zipCrc32 } from "./crc32.js";
import { ModelPackError } from "./index.js";
import {
  MODEL_PACK_ALLOWED_DIRECTORIES,
  MODEL_PACK_ALLOWED_PATHS,
  MODEL_PACK_REQUIRED_PATHS,
  inspectTransportOptions,
  modelPackTransportFail,
  verifyTransportFiles
} from "./transport-layout.js";

const inflateRawAsync = promisify(inflateRaw);
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_ENTRY = 0x04034b50;
const ZIP64_EXTRA_FIELD = 0x0001;
const UNICODE_PATH_EXTRA_FIELD = 0x7075;
const AES_EXTRA_FIELD = 0x9901;
const MAX_ZIP_COMMENT_BYTES = 65_535;
const ZIP32_MAX_16 = 0xffff;
const ZIP32_MAX_32 = 0xffffffff;
const SUPPORTED_FLAGS = 0x0806;

export const MODEL_PACK_ARCHIVE_LIMITS = Object.freeze({
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntryCount: 32,
  maxCompressedEntryBytes: 16 * 1024 * 1024,
  maxUncompressedEntryBytes: 16 * 1024 * 1024,
  maxTotalUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200
});

function fail(code, message, details = {}) {
  modelPackTransportFail(code, message, details);
}

function requirePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 16_384 ||
    value.includes("\0")
  ) {
    fail("MODEL_PACK_ARCHIVE_PATH_INVALID", "archive must be a non-empty bounded path string.");
  }
  return path.resolve(value);
}

export function normalizeModelPackArchiveLimits(value) {
  if (value === undefined) return MODEL_PACK_ARCHIVE_LIMITS;
  const entries = inspectTransportOptions(
    value,
    "MODEL_PACK_ARCHIVE_OPTIONS_INVALID",
    "Archive loader options"
  );
  const fields = new Set(Object.keys(MODEL_PACK_ARCHIVE_LIMITS));
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort();
  if (unknown.length > 0) {
    fail("MODEL_PACK_ARCHIVE_OPTIONS_INVALID", "Archive loader options contain unknown fields.", {
      unknown
    });
  }
  const limits = { ...MODEL_PACK_ARCHIVE_LIMITS };
  for (const field of fields) {
    if (entries.has(field)) limits[field] = entries.get(field);
  }
  for (const [field, maximum] of [
    ["maxArchiveBytes", 1024 * 1024 * 1024],
    ["maxEntryCount", 4096],
    ["maxCompressedEntryBytes", 1024 * 1024 * 1024],
    ["maxUncompressedEntryBytes", 1024 * 1024 * 1024],
    ["maxTotalUncompressedBytes", 4 * 1024 * 1024 * 1024],
    ["maxCompressionRatio", 100_000]
  ]) {
    if (!Number.isSafeInteger(limits[field]) || limits[field] < 1 || limits[field] > maximum) {
      fail("MODEL_PACK_ARCHIVE_LIMIT_INVALID", `${field} is outside the supported range.`, {
        field
      });
    }
  }
  if (limits.maxCompressedEntryBytes > limits.maxArchiveBytes) {
    fail(
      "MODEL_PACK_ARCHIVE_LIMIT_INVALID",
      "maxCompressedEntryBytes cannot exceed maxArchiveBytes."
    );
  }
  if (limits.maxUncompressedEntryBytes > limits.maxTotalUncompressedBytes) {
    fail(
      "MODEL_PACK_ARCHIVE_LIMIT_INVALID",
      "maxUncompressedEntryBytes cannot exceed maxTotalUncompressedBytes."
    );
  }
  return Object.freeze(limits);
}

function sameSnapshot(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function readArchive(archive, limits) {
  let inspected;
  try {
    inspected = await lstat(archive, { bigint: true });
  } catch (error) {
    fail("MODEL_PACK_ARCHIVE_UNAVAILABLE", "The Model Pack archive cannot be inspected.", {
      cause: error.code ?? error.name
    });
  }
  if (inspected.isSymbolicLink()) {
    fail("MODEL_PACK_ARCHIVE_SYMLINK_REJECTED", "The Model Pack archive must not be a symbolic link.");
  }
  if (!inspected.isFile()) {
    fail("MODEL_PACK_ARCHIVE_INVALID", "The Model Pack archive path must be a regular file.");
  }
  if (inspected.size > BigInt(limits.maxArchiveBytes)) {
    fail("MODEL_PACK_ARCHIVE_SIZE_LIMIT_EXCEEDED", "The archive exceeds maxArchiveBytes.", {
      maxArchiveBytes: limits.maxArchiveBytes
    });
  }

  let handle;
  try {
    handle = await open(archive, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      fail("MODEL_PACK_ARCHIVE_INVALID", "The Model Pack archive is not a regular file.");
    }
    if (before.size > BigInt(limits.maxArchiveBytes)) {
      fail("MODEL_PACK_ARCHIVE_SIZE_LIMIT_EXCEEDED", "The archive exceeds maxArchiveBytes.", {
        maxArchiveBytes: limits.maxArchiveBytes
      });
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.byteLength) !== before.size || !sameSnapshot(before, after)) {
      fail("MODEL_PACK_ARCHIVE_CHANGED", "The Model Pack archive changed while it was being read.");
    }
    return bytes;
  } catch (error) {
    if (error instanceof ModelPackError) throw error;
    fail("MODEL_PACK_ARCHIVE_READ_FAILED", "The Model Pack archive cannot be read safely.", {
      cause: error.code ?? error.name
    });
  } finally {
    await handle?.close();
  }
}

function boundedEnd(offset, length, maximum, code = "MODEL_PACK_ARCHIVE_FORMAT_INVALID") {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset > maximum ||
    length > maximum - offset
  ) {
    fail(code, "The ZIP archive contains an out-of-bounds structure.");
  }
  return offset + length;
}

function decodeName(bytes, pathHint = null) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("MODEL_PACK_ARCHIVE_NAME_ENCODING_INVALID", "A ZIP entry name is not valid UTF-8.", {
      path: pathHint
    });
  }
}

function inspectExtraFields(bytes, start, length, entryPath) {
  const end = boundedEnd(start, length, bytes.length);
  let offset = start;
  while (offset < end) {
    if (end - offset < 4) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "A ZIP extra field is truncated.", {
        path: entryPath
      });
    }
    const identifier = bytes.readUInt16LE(offset);
    const size = bytes.readUInt16LE(offset + 2);
    offset += 4;
    offset = boundedEnd(offset, size, end);
    if (
      identifier === ZIP64_EXTRA_FIELD ||
      identifier === UNICODE_PATH_EXTRA_FIELD ||
      identifier === AES_EXTRA_FIELD
    ) {
      fail("MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED", "The ZIP entry uses an unsupported extra field.", {
        path: entryPath,
        identifier
      });
    }
  }
}

function locateEndOfCentralDirectory(bytes) {
  if (bytes.length < 22) {
    fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "The file is too short to be a ZIP archive.");
  }
  const minimum = Math.max(0, bytes.length - 22 - MAX_ZIP_COMMENT_BYTES);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "The ZIP end-of-central-directory record is missing.");
}

function validateFlags(flags, method, entryPath) {
  if ((flags & ~SUPPORTED_FLAGS) !== 0 || (method === 0 && (flags & 0x0006) !== 0)) {
    fail("MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED", "The ZIP entry uses unsupported flags.", {
      path: entryPath,
      flags
    });
  }
}

function validateExternalAttributes(versionMadeBy, externalAttributes, directory, entryPath) {
  const platform = versionMadeBy >>> 8;
  const dosDirectory = (externalAttributes & 0x10) !== 0;
  if (dosDirectory !== directory && dosDirectory) {
    fail("MODEL_PACK_ARCHIVE_ENTRY_TYPE_INVALID", "A ZIP file entry is marked as a directory.", {
      path: entryPath
    });
  }
  if (platform !== 3) return;
  const mode = externalAttributes >>> 16;
  const type = mode & 0xf000;
  if (type === 0xa000) {
    fail("MODEL_PACK_ARCHIVE_SYMLINK_REJECTED", "ZIP symbolic-link entries are not accepted.", {
      path: entryPath
    });
  }
  const expected = directory ? 0x4000 : 0x8000;
  if (type !== 0 && type !== expected) {
    fail("MODEL_PACK_ARCHIVE_ENTRY_TYPE_INVALID", "The ZIP entry is not a regular file or directory.", {
      path: entryPath
    });
  }
}

function centralDirectory(bytes, limits) {
  const endOffset = locateEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (
    disk === ZIP32_MAX_16 ||
    centralDisk === ZIP32_MAX_16 ||
    diskEntries === ZIP32_MAX_16 ||
    entryCount === ZIP32_MAX_16 ||
    centralSize === ZIP32_MAX_32 ||
    centralOffset === ZIP32_MAX_32
  ) {
    fail("MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED", "ZIP64 archives are not supported.");
  }
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount) {
    fail("MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED", "Multi-disk ZIP archives are not supported.");
  }
  if (entryCount < 1 || entryCount > limits.maxEntryCount) {
    fail("MODEL_PACK_ARCHIVE_ENTRY_LIMIT_EXCEEDED", "The archive entry count is outside the limit.", {
      maxEntryCount: limits.maxEntryCount
    });
  }
  if (boundedEnd(centralOffset, centralSize, endOffset) !== endOffset) {
    fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "The ZIP central directory is not contiguous.");
  }

  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (boundedEnd(offset, 46, endOffset) > endOffset || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "A ZIP central-directory entry is invalid.", {
        index
      });
    }
    const versionMadeBy = bytes.readUInt16LE(offset + 4);
    const versionNeeded = bytes.readUInt16LE(offset + 6);
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const checksum = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const startDisk = bytes.readUInt16LE(offset + 34);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const variableEnd = boundedEnd(offset + 46, nameLength + extraLength + commentLength, endOffset);
    const nameStart = offset + 46;
    const entryPath = decodeName(bytes.subarray(nameStart, nameStart + nameLength));
    inspectExtraFields(bytes, nameStart + nameLength, extraLength, entryPath);
    if (
      versionNeeded > 20 ||
      compressedSize === ZIP32_MAX_32 ||
      uncompressedSize === ZIP32_MAX_32 ||
      localOffset === ZIP32_MAX_32 ||
      startDisk !== 0
    ) {
      fail("MODEL_PACK_ARCHIVE_FEATURE_UNSUPPORTED", "The ZIP entry requires an unsupported feature.", {
        path: entryPath
      });
    }
    if (method !== 0 && method !== 8) {
      fail("MODEL_PACK_ARCHIVE_COMPRESSION_UNSUPPORTED", "The ZIP compression method is not supported.", {
        path: entryPath,
        method
      });
    }
    validateFlags(flags, method, entryPath);
    if (names.has(entryPath)) {
      fail("MODEL_PACK_ARCHIVE_ENTRY_DUPLICATE", "ZIP entry names must be unique.", {
        path: entryPath
      });
    }
    names.add(entryPath);
    const directory = entryPath.endsWith("/");
    const normalizedPath = directory ? entryPath.slice(0, -1) : entryPath;
    if (
      (directory && !MODEL_PACK_ALLOWED_DIRECTORIES.has(normalizedPath)) ||
      (!directory && !MODEL_PACK_ALLOWED_PATHS.has(normalizedPath))
    ) {
      fail("MODEL_PACK_ARCHIVE_ENTRY_UNEXPECTED", "The archive contains an unexpected entry.", {
        path: entryPath
      });
    }
    validateExternalAttributes(versionMadeBy, externalAttributes, directory, entryPath);
    entries.push({
      path: normalizedPath,
      directory,
      flags,
      method,
      checksum,
      compressedSize,
      uncompressedSize,
      localOffset
    });
    offset = variableEnd;
  }
  if (offset !== endOffset) {
    fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "The ZIP central-directory size is inconsistent.");
  }
  for (const required of MODEL_PACK_REQUIRED_PATHS) {
    if (!entries.some((entry) => !entry.directory && entry.path === required)) {
      fail("MODEL_PACK_ARCHIVE_FILE_MISSING", "The Model Pack archive is incomplete.", {
        path: required
      });
    }
  }
  return { entries, centralOffset };
}

function localEntries(bytes, entries, centralOffset, limits) {
  const ranges = [];
  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    const { localOffset } = entry;
    if (
      boundedEnd(localOffset, 30, centralOffset) > centralOffset ||
      bytes.readUInt32LE(localOffset) !== LOCAL_FILE_ENTRY
    ) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "A ZIP local entry is invalid.", {
        path: entry.path
      });
    }
    const flags = bytes.readUInt16LE(localOffset + 6);
    const method = bytes.readUInt16LE(localOffset + 8);
    const checksum = bytes.readUInt32LE(localOffset + 14);
    const compressedSize = bytes.readUInt32LE(localOffset + 18);
    const uncompressedSize = bytes.readUInt32LE(localOffset + 22);
    const nameLength = bytes.readUInt16LE(localOffset + 26);
    const extraLength = bytes.readUInt16LE(localOffset + 28);
    const nameStart = localOffset + 30;
    const dataStart = boundedEnd(nameStart, nameLength + extraLength, centralOffset);
    const localPath = decodeName(bytes.subarray(nameStart, nameStart + nameLength), entry.path);
    inspectExtraFields(bytes, nameStart + nameLength, extraLength, entry.path);
    if (
      localPath !== `${entry.path}${entry.directory ? "/" : ""}` ||
      flags !== entry.flags ||
      method !== entry.method ||
      checksum !== entry.checksum ||
      compressedSize !== entry.compressedSize ||
      uncompressedSize !== entry.uncompressedSize
    ) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "ZIP local and central entry metadata differ.", {
        path: entry.path
      });
    }
    const dataEnd = boundedEnd(dataStart, compressedSize, centralOffset);
    ranges.push({ start: localOffset, end: dataEnd, path: entry.path });
    entry.dataStart = dataStart;

    if (entry.directory) {
      if (compressedSize !== 0 || uncompressedSize !== 0 || checksum !== 0 || method !== 0) {
        fail("MODEL_PACK_ARCHIVE_ENTRY_TYPE_INVALID", "ZIP directory entries must be empty and stored.", {
          path: entry.path
        });
      }
      continue;
    }
    if (compressedSize > limits.maxCompressedEntryBytes) {
      fail("MODEL_PACK_ARCHIVE_COMPRESSED_LIMIT_EXCEEDED", "A ZIP entry exceeds maxCompressedEntryBytes.", {
        path: entry.path,
        maxCompressedEntryBytes: limits.maxCompressedEntryBytes
      });
    }
    if (uncompressedSize > limits.maxUncompressedEntryBytes) {
      fail("MODEL_PACK_ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED", "A ZIP entry exceeds maxUncompressedEntryBytes.", {
        path: entry.path,
        maxUncompressedEntryBytes: limits.maxUncompressedEntryBytes
      });
    }
    if (method === 0 && compressedSize !== uncompressedSize) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "A stored ZIP entry has inconsistent sizes.", {
        path: entry.path
      });
    }
    if (
      uncompressedSize > 0 &&
      (compressedSize === 0 || uncompressedSize > compressedSize * limits.maxCompressionRatio)
    ) {
      fail("MODEL_PACK_ARCHIVE_RATIO_LIMIT_EXCEEDED", "A ZIP entry exceeds maxCompressionRatio.", {
        path: entry.path,
        maxCompressionRatio: limits.maxCompressionRatio
      });
    }
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes - uncompressedSize) {
      fail("MODEL_PACK_ARCHIVE_TOTAL_LIMIT_EXCEEDED", "The archive exceeds maxTotalUncompressedBytes.", {
        maxTotalUncompressedBytes: limits.maxTotalUncompressedBytes
      });
    }
    totalUncompressedBytes += uncompressedSize;
  }

  ranges.sort((left, right) => left.start - right.start);
  let end = 0;
  for (const range of ranges) {
    if (range.start !== end) {
      fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "ZIP local entries overlap or contain unreferenced bytes.", {
        path: range.path
      });
    }
    end = range.end;
  }
  if (end !== centralOffset) {
    fail("MODEL_PACK_ARCHIVE_FORMAT_INVALID", "ZIP local entries are not contiguous with the central directory.");
  }
}

async function extractJsonValues(bytes, entries) {
  const values = new Map();
  for (const entry of entries) {
    if (entry.directory) continue;
    const compressed = bytes.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
    let uncompressed;
    if (entry.method === 0) {
      uncompressed = Buffer.from(compressed);
    } else {
      try {
        uncompressed = await inflateRawAsync(compressed, {
          maxOutputLength: entry.uncompressedSize
        });
      } catch {
        fail("MODEL_PACK_ARCHIVE_DECOMPRESSION_FAILED", "A ZIP entry cannot be decompressed safely.", {
          path: entry.path
        });
      }
    }
    if (uncompressed.byteLength !== entry.uncompressedSize) {
      fail("MODEL_PACK_ARCHIVE_SIZE_MISMATCH", "A ZIP entry decompressed to an unexpected size.", {
        path: entry.path
      });
    }
    if (zipCrc32(uncompressed) !== entry.checksum) {
      fail("MODEL_PACK_ARCHIVE_CRC_MISMATCH", "A ZIP entry failed its CRC-32 check.", {
        path: entry.path
      });
    }
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(uncompressed);
    } catch {
      fail("MODEL_PACK_ARCHIVE_UTF8_INVALID", "A Model Pack archive entry is not valid UTF-8.", {
        path: entry.path
      });
    }
    try {
      values.set(entry.path, JSON.parse(text));
    } catch {
      fail("MODEL_PACK_ARCHIVE_JSON_INVALID", "A Model Pack archive entry is not valid JSON.", {
        path: entry.path
      });
    }
  }
  return values;
}

export async function loadModelPackArchive(archive, options = {}) {
  const absolute = requirePath(archive);
  const limits = normalizeModelPackArchiveLimits(options);
  const bytes = await readArchive(absolute, limits);
  const { entries, centralOffset } = centralDirectory(bytes, limits);
  localEntries(bytes, entries, centralOffset, limits);
  const values = await extractJsonValues(bytes, entries);
  try {
    return verifyTransportFiles(values);
  } catch (error) {
    if (error instanceof ModelPackError && error.code === "MODEL_PACK_TRANSPORT_BUNDLE_MISMATCH") {
      fail("MODEL_PACK_ARCHIVE_BUNDLE_MISMATCH", error.message);
    }
    throw error;
  }
}
