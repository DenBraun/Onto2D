import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createCanonicalForm,
  hashArtifactBytes,
  hashBytes
} from "../../kernel/src/hash.js";
import * as portableCanonical from "../../kernel/src/canonical-entry.js";

const encoder = new TextEncoder();

function nodeDomainHash(domain, bytes) {
  const domainBytes = encoder.encode(domain);
  const frame = Buffer.concat([
    Buffer.from("ONTO2D\0", "utf8"),
    Buffer.from(String(domainBytes.byteLength), "ascii"),
    Buffer.from("\0", "utf8"),
    Buffer.from(domainBytes),
    Buffer.from("\0", "utf8")
  ]);
  return `sha256:${createHash("sha256").update(frame).update(bytes).digest("hex")}`;
}

test("the portable SHA-256 implementation matches independent Node references", () => {
  const domain = "onto2d:artifact:v1";
  for (const length of [0, 1, 3, 55, 56, 63, 64, 65, 127, 128, 129, 1024]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 131 + 17) & 255);
    const raw = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    assert.equal(hashArtifactBytes(bytes), raw, `raw length ${length}`);
    assert.equal(hashBytes(domain, bytes), nodeDomainHash(domain, bytes), `framed length ${length}`);
  }
});

test("portable canonical entry exposes the bounded Model Pack hash surface", () => {
  assert.deepEqual(Object.keys(portableCanonical).sort(), [
    "canonicalClone",
    "canonicalize",
    "deepFreeze",
    "hashArtifactBytes",
    "hashCanonical",
    "isContentHash"
  ]);
  const input = { nested: [true, "browser"], value: 2 };
  const clone = portableCanonical.canonicalClone(input);
  assert.equal(portableCanonical.canonicalize(clone), JSON.stringify(input));
  assert.ok(Object.isFrozen(portableCanonical.deepFreeze(clone)));
  assert.ok(portableCanonical.isContentHash(
    portableCanonical.hashCanonical("onto2d:artifact:v1", input)
  ));
  const artifactBytes = encoder.encode("browser artifact");
  assert.equal(
    portableCanonical.hashArtifactBytes(artifactBytes),
    hashArtifactBytes(artifactBytes)
  );

  const form = createCanonicalForm("onto2d:artifact:v1", { text: "browser" });
  assert.equal(Buffer.from(form.bytesBase64, "base64").toString("utf8"), "{\"text\":\"browser\"}");
});
