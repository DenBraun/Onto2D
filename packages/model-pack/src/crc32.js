const TABLE = new Uint32Array(256);

for (let index = 0; index < TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  TABLE[index] = value >>> 0;
}

export function zipCrc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}
