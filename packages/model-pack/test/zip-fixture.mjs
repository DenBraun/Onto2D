import { crc32, deflateRawSync } from "node:zlib";

const textEncoder = new TextEncoder();

function bytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value), "utf8");
}

export function modelPackZipEntries(pack, { bundle = false } = {}) {
  const entries = [
    { name: "manifest.json", data: `${JSON.stringify(pack.manifest)}\n` },
    ...Object.entries(pack.files).map(([name, value]) => ({
      name,
      data: `${JSON.stringify(value)}\n`
    }))
  ];
  if (bundle) entries.push({ name: "bundle.json", data: `${JSON.stringify(pack)}\n` });
  return entries;
}

export function createZip(entryInputs, options = {}) {
  const localParts = [];
  const centralParts = [];
  const records = [];
  let localOffset = 0;

  for (const input of entryInputs) {
    const name = bytes(input.name);
    const directory = input.directory ?? String(input.name).endsWith("/");
    const data = directory ? Buffer.alloc(0) : bytes(input.data ?? "");
    const method = input.method ?? (directory ? 0 : 8);
    const compressed = input.compressedData !== undefined
      ? bytes(input.compressedData)
      : method === 8
        ? deflateRawSync(data)
        : data;
    const checksum = input.checksum ?? (crc32(data) >>> 0);
    const flags = input.flags ?? 0x0800;
    const localExtra = bytes(input.localExtra ?? Buffer.alloc(0));
    const centralExtra = bytes(input.centralExtra ?? Buffer.alloc(0));
    const comment = bytes(input.comment ?? Buffer.alloc(0));
    const compressedSize = input.compressedSize ?? compressed.byteLength;
    const uncompressedSize = input.uncompressedSize ?? data.byteLength;
    const localChecksum = input.localChecksum ?? checksum;
    const localCompressedSize = input.localCompressedSize ?? compressedSize;
    const localUncompressedSize = input.localUncompressedSize ?? uncompressedSize;
    const localFlags = input.localFlags ?? flags;
    const localMethod = input.localMethod ?? method;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(localFlags, 6);
    local.writeUInt16LE(localMethod, 8);
    local.writeUInt32LE(localChecksum >>> 0, 14);
    local.writeUInt32LE(localCompressedSize >>> 0, 18);
    local.writeUInt32LE(localUncompressedSize >>> 0, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.writeUInt16LE(localExtra.byteLength, 28);
    const dataStart = localOffset + local.byteLength + name.byteLength + localExtra.byteLength;
    localParts.push(local, name, localExtra, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(input.versionNeeded ?? 20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum >>> 0, 16);
    central.writeUInt32LE(compressedSize >>> 0, 20);
    central.writeUInt32LE(uncompressedSize >>> 0, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt16LE(centralExtra.byteLength, 30);
    central.writeUInt16LE(comment.byteLength, 32);
    central.writeUInt16LE(input.startDisk ?? 0, 34);
    const defaultMode = directory ? 0o040755 : 0o100644;
    const externalAttributes = input.externalAttributes ?? ((defaultMode << 16) >>> 0);
    central.writeUInt32LE(externalAttributes >>> 0, 38);
    central.writeUInt32LE((input.localOffset ?? localOffset) >>> 0, 42);
    centralParts.push(central, name, centralExtra, comment);
    records.push({
      name: textEncoder.encode(String(input.name)),
      localHeaderOffset: localOffset,
      dataStart,
      compressedSize: compressed.byteLength
    });
    localOffset += local.byteLength + name.byteLength + localExtra.byteLength + compressed.byteLength;
  }

  const centralOffset = localOffset;
  const centralBytes = Buffer.concat(centralParts);
  const archiveComment = bytes(options.comment ?? Buffer.alloc(0));
  const end = Buffer.alloc(22);
  const entryCount = options.entryCount ?? entryInputs.length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(options.disk ?? 0, 4);
  end.writeUInt16LE(options.centralDisk ?? 0, 6);
  end.writeUInt16LE(options.diskEntries ?? entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE((options.centralSize ?? centralBytes.byteLength) >>> 0, 12);
  end.writeUInt32LE((options.centralOffset ?? centralOffset) >>> 0, 16);
  end.writeUInt16LE(archiveComment.byteLength, 20);

  return {
    bytes: Buffer.concat([...localParts, centralBytes, end, archiveComment]),
    records,
    centralOffset
  };
}
