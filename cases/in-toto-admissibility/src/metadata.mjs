import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const HEX_32 = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new TypeError(`in-toto metadata error: ${message}`);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  if (value === null || ["string", "boolean", "number"].includes(typeof value)) return value;
  fail("canonical JSON input contains an unsupported value");
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function artifactHash(bytes) {
  return { sha256: sha256(bytes) };
}

function privateKeyFromSeed(seed) {
  if (!HEX_32.test(seed)) fail("Ed25519 fixture seed must be 32 lowercase hexadecimal bytes");
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed, "hex")]), format: "der", type: "pkcs8" });
}

export function fixtureKey(seed) {
  const privateKey = privateKeyFromSeed(seed);
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  if (spki.length !== SPKI_ED25519_PREFIX.length + 32 || !spki.subarray(0, SPKI_ED25519_PREFIX.length).equals(SPKI_ED25519_PREFIX)) fail("unexpected Ed25519 public-key encoding");
  const publicHex = spki.subarray(SPKI_ED25519_PREFIX.length).toString("hex");
  const publicKey = { keytype: "ed25519", scheme: "ed25519", keyval: { public: publicHex } };
  return { keyid: sha256(canonicalJson(publicKey)), publicKey, privateKey };
}

export function signMetadata(signed, key) {
  const payload = Buffer.from(canonicalJson(signed), "utf8");
  return {
    signatures: [{ keyid: key.keyid, sig: sign(null, payload, key.privateKey).toString("hex") }],
    signed
  };
}

export function verifyMetadataSignature(metablock, publicKey, expectedKeyId) {
  if (metablock === null || typeof metablock !== "object" || Array.isArray(metablock)) return false;
  if (!Array.isArray(metablock.signatures) || metablock.signatures.length !== 1 || metablock.signed === null || typeof metablock.signed !== "object") return false;
  const signature = metablock.signatures[0];
  if (signature?.keyid !== expectedKeyId || !/^[0-9a-f]{128}$/.test(signature?.sig ?? "")) return false;
  if (publicKey?.keytype !== "ed25519" || publicKey?.scheme !== "ed25519" || !HEX_32.test(publicKey?.keyval?.public ?? "")) return false;
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey.keyval.public, "hex")]), format: "der", type: "spki" });
  return verify(null, Buffer.from(canonicalJson(metablock.signed), "utf8"), key, Buffer.from(signature.sig, "hex"));
}

export function metadataIdentity(metablock) {
  return `sha256:${sha256(Buffer.from(canonicalJson(metablock), "utf8"))}`;
}
