import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { canonicalBytes } from "./canonical.js";
import { KernelError } from "./errors.js";

const DOMAIN_PATTERN = /^onto2d:[a-z0-9]+(?:-[a-z0-9]+)*:v[1-9][0-9]*$/;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const encoder = new TextEncoder();

export const HASH_DOMAINS = Object.freeze({
  ARTIFACT: "onto2d:artifact:v1",
  CANDIDATE: "onto2d:candidate:v1",
  CLUSTER: "onto2d:cluster:v1",
  DEPTH_BASIS: "onto2d:depth-basis:v1",
  ELEMENT: "onto2d:element:v1",
  PREDICATE_EXPRESSION: "onto2d:predicate-expression:v1",
  PREDICATE_EXPRESSION_ANALYSIS: "onto2d:predicate-expression-analysis:v1",
  PREDICATE_PLAN: "onto2d:predicate-plan:v1",
  VALUE_EXPRESSION: "onto2d:value-expression:v1",
  VALUE_EXPRESSION_ANALYSIS: "onto2d:value-expression-analysis:v1",
  IDENTITY_POLICY: "onto2d:identity-policy:v1",
  PACKAGE: "onto2d:package:v1",
  PROFILE: "onto2d:profile:v1",
  RULES: "onto2d:rules:v1",
  SKELETON: "onto2d:skeleton:v1"
});

function assertDomain(domain) {
  if (typeof domain !== "string" || !DOMAIN_PATTERN.test(domain)) {
    throw new KernelError({
      code: "CANONICALIZATION_INVALID_DOMAIN",
      stage: "HASH",
      message: "Hash domain must be a versioned Onto2D domain identifier.",
      details: { domain }
    });
  }
}

function frameDomain(domain) {
  const bytes = encoder.encode(domain);
  return Buffer.concat([
    Buffer.from("ONTO2D\0", "utf8"),
    Buffer.from(String(bytes.byteLength), "ascii"),
    Buffer.from("\0", "utf8"),
    Buffer.from(bytes),
    Buffer.from("\0", "utf8")
  ]);
}

export function hashBytes(domain, bytes) {
  assertDomain(domain);
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("hashBytes requires a Uint8Array payload.");
  }
  const digest = createHash("sha256")
    .update(frameDomain(domain))
    .update(bytes)
    .digest("hex");
  return `sha256:${digest}`;
}

export function hashCanonical(domain, value, options) {
  return hashBytes(domain, canonicalBytes(value, options));
}

export function createCanonicalForm(domain, value, schemaVersion = "1", options) {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0 || schemaVersion !== schemaVersion.trim()) {
    throw new KernelError({
      code: "CANONICALIZATION_SCHEMA_VERSION_INVALID",
      stage: "HASH",
      message: "Canonical-form schema version must be a normalized non-empty string.",
      details: { schemaVersion }
    });
  }
  const bytes = canonicalBytes(value, options);
  return deepFreezeCanonicalForm({
    schemaVersion,
    bytesBase64: Buffer.from(bytes).toString("base64"),
    hash: hashBytes(domain, bytes)
  });
}

function deepFreezeCanonicalForm(form) {
  return Object.freeze(form);
}

export function isContentHash(value) {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export function assertContentHash(value, label = "hash") {
  if (!isContentHash(value)) {
    throw new KernelError({
      code: "ARTIFACT_HASH_INVALID",
      stage: "LOAD",
      message: `${label} must be a lowercase sha256 content identifier.`,
      details: { label, value }
    });
  }
  return value;
}
