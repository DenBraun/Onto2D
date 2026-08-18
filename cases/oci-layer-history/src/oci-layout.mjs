import { createHash } from "node:crypto";
import { hashCanonical } from "@onto2d/kernel/canonical";

export const OCI_MEDIA_TYPES = Object.freeze({
  index: "application/vnd.oci.image.index.v1+json",
  manifest: "application/vnd.oci.image.manifest.v1+json",
  config: "application/vnd.oci.image.config.v1+json",
  layer: "application/vnd.oci.image.layer.v1.tar"
});

const ROOTFS_DOMAIN = "onto2d:oci-normalized-rootfs:v1";
const LAYER_SEQUENCE_DOMAIN = "onto2d:oci-layer-sequence:v1";
const MAX_LAYER_BYTES = 64 * 1024;
const MAX_ENTRIES = 32;
const BLOCK = 512;
const FIXTURE_HISTORY_IDS = Object.freeze([
  "history-a",
  "history-b",
  "history-redundant",
  "history-grouped"
]);
const OCI_IMAGE_SPECIFICATION = Object.freeze({
  version: "1.1.1",
  releaseUrl: "https://github.com/opencontainers/image-spec/releases/tag/v1.1.1",
  layoutUrl: "https://github.com/opencontainers/image-spec/blob/v1.1.1/image-layout.md",
  manifestUrl: "https://github.com/opencontainers/image-spec/blob/v1.1.1/manifest.md",
  configUrl: "https://github.com/opencontainers/image-spec/blob/v1.1.1/config.md",
  layerUrl: "https://github.com/opencontainers/image-spec/blob/v1.1.1/layer.md"
});

function fail(message) {
  throw new Error(`OCI fixture error: ${message}`);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(object(value, label)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

function boundedText(value, label, maximum = 256) {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > maximum) fail(`${label} is invalid`);
}

export function validateOciFixtureSpec(input) {
  const spec = object(input, "fixture spec");
  exactKeys(spec, ["format", "formatVersion", "ociImageSpec", "profile", "histories"], "fixture spec");
  if (spec.format !== "onto2d-oci-layer-fixture-spec" || spec.formatVersion !== "1") fail("fixture format is unsupported");
  exactKeys(spec.ociImageSpec, ["version", "releaseUrl", "layoutUrl", "manifestUrl", "configUrl", "layerUrl"], "OCI specification pin");
  if (JSON.stringify(spec.ociImageSpec) !== JSON.stringify(OCI_IMAGE_SPECIFICATION)) fail("OCI Image Specification pin differs from the reviewed v1 contract");
  for (const [field, value] of Object.entries(spec.ociImageSpec)) boundedText(value, `OCI specification ${field}`, 512);

  exactKeys(spec.profile, ["layoutVersion", "architecture", "os", "layerMediaType", "created", "fileMode", "uid", "gid", "mtime"], "fixture profile");
  if (spec.profile.layoutVersion !== "1.0.0" || spec.profile.architecture !== "amd64" || spec.profile.os !== "linux" || spec.profile.layerMediaType !== OCI_MEDIA_TYPES.layer || spec.profile.created !== "2026-08-18T00:00:00Z") fail("fixture profile constants differ from the reviewed v1 contract");
  for (const field of ["fileMode", "uid", "gid", "mtime"]) {
    if (!Number.isSafeInteger(spec.profile[field]) || spec.profile[field] < 0) fail(`fixture profile ${field} is invalid`);
  }
  if (!Array.isArray(spec.histories) || spec.histories.length !== FIXTURE_HISTORY_IDS.length) fail("fixture must declare exactly four histories");
  const historyIds = new Set();
  const layerIds = new Set();
  for (const [historyIndex, history] of spec.histories.entries()) {
    exactKeys(history, ["id", "label", "layers"], `history ${historyIndex}`);
    boundedText(history.id, `history ${historyIndex} id`);
    boundedText(history.label, `history ${history.id} label`);
    if (history.id !== FIXTURE_HISTORY_IDS[historyIndex] || historyIds.has(history.id)) fail("fixture history inventory or order differs from the reviewed v1 contract");
    historyIds.add(history.id);
    if (!Array.isArray(history.layers) || history.layers.length === 0 || history.layers.length > 8) fail(`history ${history.id} layer count is outside the bounded profile`);
    for (const [layerIndex, layer] of history.layers.entries()) {
      exactKeys(layer, ["id", "label", "entries"], `layer ${history.id}/${layerIndex}`);
      boundedText(layer.id, `layer ${history.id}/${layerIndex} id`);
      boundedText(layer.label, `layer ${history.id}/${layerIndex} label`);
      if (layerIds.has(layer.id)) fail(`duplicate layer id ${layer.id}`);
      layerIds.add(layer.id);
      if (!Array.isArray(layer.entries) || layer.entries.length === 0 || layer.entries.length > MAX_ENTRIES) fail(`layer ${layer.id} entries are outside the bounded profile`);
      for (const [entryIndex, entry] of layer.entries.entries()) {
        exactKeys(entry, ["path", "content"], `entry ${layer.id}/${entryIndex}`);
        validatePath(entry.path);
        if (typeof entry.content !== "string" || Buffer.byteLength(entry.content, "utf8") > MAX_LAYER_BYTES) fail(`entry ${layer.id}/${entryIndex} content is invalid`);
      }
    }
  }
  return spec;
}

export function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function validatePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) fail("tar entry path is invalid");
  if (value.startsWith("/") || value.includes("\\") || value.split("/").some((part) => part === "" || part === "." || part === "..")) fail(`unsafe tar entry path ${value}`);
  return value;
}

function writeString(header, offset, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) fail(`tar field exceeds ${length} bytes`);
  bytes.copy(header, offset);
}

function writeOctal(header, offset, length, value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("tar numeric field is invalid");
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) fail("tar numeric field overflows");
  writeString(header, offset, length, `${encoded}\0`);
}

function tarHeader(entry, profile) {
  const header = Buffer.alloc(BLOCK);
  writeString(header, 0, 100, validatePath(entry.path));
  writeOctal(header, 100, 8, profile.fileMode);
  writeOctal(header, 108, 8, profile.uid);
  writeOctal(header, 116, 8, profile.gid);
  writeOctal(header, 124, 12, entry.bytes.length);
  writeOctal(header, 136, 12, profile.mtime);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

export function createLayerTar(entries, profile) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRIES) fail("layer entries are outside the bounded profile");
  const seen = new Set();
  const chunks = [];
  for (const source of entries) {
    const path = validatePath(source.path);
    if (seen.has(path)) fail(`duplicate tar entry ${path}`);
    seen.add(path);
    const bytes = Buffer.from(source.content, "utf8");
    const entry = { path, bytes };
    chunks.push(tarHeader(entry, profile), bytes);
    const remainder = bytes.length % BLOCK;
    if (remainder !== 0) chunks.push(Buffer.alloc(BLOCK - remainder));
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  const result = Buffer.concat(chunks);
  if (result.length > MAX_LAYER_BYTES) fail("layer exceeds the bounded byte limit");
  return result;
}

function parseOctal(field, label) {
  const value = field.toString("ascii").replace(/\0.*$/s, "").trim();
  if (!/^[0-7]+$/.test(value)) fail(`${label} is not canonical octal`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed)) fail(`${label} is outside the safe integer range`);
  return parsed;
}

function zeroBlock(block) {
  return block.every((byte) => byte === 0);
}

export function parseLayerTar(bytesInput) {
  const bytes = Buffer.from(bytesInput);
  if (bytes.length === 0 || bytes.length > MAX_LAYER_BYTES || bytes.length % BLOCK !== 0) fail("layer byte length is outside the bounded tar profile");
  const entries = [];
  let offset = 0;
  while (offset + BLOCK <= bytes.length) {
    const header = bytes.subarray(offset, offset + BLOCK);
    if (zeroBlock(header)) {
      const second = bytes.subarray(offset + BLOCK, offset + BLOCK * 2);
      if (second.length !== BLOCK || !zeroBlock(second) || bytes.subarray(offset + BLOCK * 2).some((byte) => byte !== 0)) fail("tar end marker is malformed");
      return entries;
    }
    if (entries.length >= MAX_ENTRIES) fail("tar entry count exceeds the bounded profile");
    if (header.subarray(257, 263).toString("binary") !== "ustar\0" || header.subarray(263, 265).toString("ascii") !== "00") fail("unsupported tar format");
    const checksumBytes = Buffer.from(header);
    checksumBytes.fill(0x20, 148, 156);
    const expectedChecksum = checksumBytes.reduce((sum, byte) => sum + byte, 0);
    if (parseOctal(header.subarray(148, 156), "tar checksum") !== expectedChecksum) fail("tar checksum mismatch");
    const path = validatePath(header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, ""));
    const type = String.fromCharCode(header[156] || 0x30);
    if (type !== "0") fail(`unsupported tar entry type ${type}`);
    const size = parseOctal(header.subarray(124, 136), "tar size");
    const mode = parseOctal(header.subarray(100, 108), "tar mode");
    const uid = parseOctal(header.subarray(108, 116), "tar uid");
    const gid = parseOctal(header.subarray(116, 124), "tar gid");
    const mtime = parseOctal(header.subarray(136, 148), "tar mtime");
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) fail(`tar entry ${path} exceeds its layer`);
    entries.push({ path, bytes: Buffer.from(bytes.subarray(dataStart, dataEnd)), size, mode, uid, gid, mtime });
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }
  fail("tar layer has no two-block end marker");
}

function fileRecord(entry) {
  return {
    path: entry.path,
    size: entry.size,
    mode: entry.mode,
    uid: entry.uid,
    gid: entry.gid,
    mtime: entry.mtime,
    contentIdentity: sha256(entry.bytes),
    contentUtf8: new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes)
  };
}

function normalizedState(state) {
  return [...state.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function rootfsIdentity(files) {
  return hashCanonical(ROOTFS_DOMAIN, files.map(({ contentUtf8: _contentUtf8, ...file }) => file));
}

export function applyLayer(stateInput, entriesInput, layerId) {
  const state = new Map(stateInput.map((file) => [file.path, structuredClone(file)]));
  const entries = entriesInput.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }));
  const operations = [];
  const additions = [];
  for (const entry of entries) {
    const parts = entry.path.split("/");
    const basename = parts.at(-1);
    const directory = parts.slice(0, -1).join("/");
    if (basename === ".wh..wh..opq") {
      if (entry.size !== 0) fail("opaque whiteout must be empty");
      const prefix = directory ? `${directory}/` : "";
      const removed = [...state.keys()].filter((path) => path.startsWith(prefix));
      for (const path of removed) state.delete(path);
      operations.push({ kind: "opaque-delete", marker: entry.path, target: directory || ".", removed, changedBytes: removed.reduce((sum, path) => sum + (stateInput.find((file) => file.path === path)?.size ?? 0), 0) });
    } else if (basename.startsWith(".wh.")) {
      if (entry.size !== 0 || basename === ".wh.") fail("whiteout marker is invalid");
      const target = [...parts.slice(0, -1), basename.slice(4)].filter(Boolean).join("/");
      const previous = state.get(target);
      state.delete(target);
      operations.push({ kind: "delete-file", marker: entry.path, target, existed: previous !== undefined, changedBytes: previous?.size ?? 0 });
    } else {
      additions.push(entry);
    }
  }
  for (const entry of additions) {
    const previous = state.get(entry.path);
    const file = fileRecord(entry);
    state.set(entry.path, file);
    operations.push({ kind: previous ? "replace-file" : "add-file", target: entry.path, contentIdentity: file.contentIdentity, changedBytes: file.size + (previous?.size ?? 0) });
  }
  const files = normalizedState(state);
  return { layerId, operations, files, identity: rootfsIdentity(files) };
}

export function replayLayers(layers) {
  let files = [];
  const states = [];
  for (const layer of layers) {
    const state = applyLayer(files, layer.entries, layer.id);
    states.push(state);
    files = state.files;
  }
  return { states, final: states.at(-1) ?? { files: [], identity: rootfsIdentity([]) } };
}

export function layerSequenceIdentity(diffIds) {
  return hashCanonical(LAYER_SEQUENCE_DOMAIN, diffIds);
}

function descriptor(mediaType, bytes, annotations) {
  return {
    mediaType,
    digest: sha256(bytes),
    size: bytes.length,
    ...(annotations ? { annotations } : {})
  };
}

export function buildOciLayout(spec) {
  validateOciFixtureSpec(spec);
  const blobs = new Map();
  const manifests = [];
  const records = [];
  for (const history of spec.histories) {
    const layerRecords = history.layers.map((layer) => {
      const bytes = createLayerTar(layer.entries, spec.profile);
      const value = descriptor(OCI_MEDIA_TYPES.layer, bytes, { "org.opencontainers.image.title": layer.label });
      blobs.set(value.digest, bytes);
      return { id: layer.id, label: layer.label, descriptor: value };
    });
    const config = {
      created: spec.profile.created,
      architecture: spec.profile.architecture,
      os: spec.profile.os,
      config: {},
      rootfs: { type: "layers", diff_ids: layerRecords.map((layer) => layer.descriptor.digest) },
      history: history.layers.map((layer) => ({ created: spec.profile.created, created_by: layer.label, comment: "Onto2D deterministic OCI history fixture" }))
    };
    const configBytes = jsonBytes(config);
    const configDescriptor = descriptor(OCI_MEDIA_TYPES.config, configBytes);
    blobs.set(configDescriptor.digest, configBytes);
    const manifest = { schemaVersion: 2, mediaType: OCI_MEDIA_TYPES.manifest, config: configDescriptor, layers: layerRecords.map((layer) => layer.descriptor) };
    const manifestBytes = jsonBytes(manifest);
    const manifestDescriptor = descriptor(OCI_MEDIA_TYPES.manifest, manifestBytes, { "org.opencontainers.image.ref.name": history.id });
    blobs.set(manifestDescriptor.digest, manifestBytes);
    manifests.push(manifestDescriptor);
    records.push({ id: history.id, label: history.label, manifestDescriptor, configDescriptor, layers: layerRecords });
  }
  const index = { schemaVersion: 2, mediaType: OCI_MEDIA_TYPES.index, manifests };
  return {
    files: new Map([
      ["oci-layout", jsonBytes({ imageLayoutVersion: spec.profile.layoutVersion })],
      ["index.json", jsonBytes(index)],
      ...[...blobs.entries()].map(([digest, bytes]) => [`blobs/sha256/${digest.slice("sha256:".length)}`, bytes])
    ]),
    records
  };
}
