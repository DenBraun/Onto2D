import assert from "node:assert/strict";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalize,
  createCanonicalForm,
  hashCanonical
} from "../src/index.js";

test("canonical JSON is independent of object insertion order", () => {
  assert.equal(
    canonicalize({ z: [3, 2, 1], a: { y: true, x: -0 } }),
    canonicalize({ a: { x: 0, y: true }, z: [3, 2, 1] })
  );
});

test("hash domains separate equal canonical payloads", () => {
  const value = { id: "same-payload" };
  assert.notEqual(
    hashCanonical(HASH_DOMAINS.ELEMENT, value),
    hashCanonical(HASH_DOMAINS.CANDIDATE, value)
  );
});

test("canonicalizer rejects non-finite numbers and prototype-sensitive keys", () => {
  assert.throws(
    () => canonicalize({ value: Number.NaN }),
    (error) => error instanceof KernelError && error.code === "NUMERIC_NONFINITE"
  );
  assert.throws(
    () => canonicalize(JSON.parse('{"__proto__":true}')),
    (error) => error instanceof KernelError && error.code === "PACKAGE_PROTOTYPE_KEY"
  );
});

test("canonicalizer never invokes object accessors", () => {
  const value = {};
  Object.defineProperty(value, "unsafe", {
    enumerable: true,
    get() {
      throw new Error("accessor was executed");
    }
  });
  assert.throws(
    () => canonicalize(value),
    (error) => error instanceof KernelError && error.code === "CANONICALIZATION_ACCESSOR"
  );
});

test("canonicalizer rejects numeric-looking named array properties", () => {
  const value = [];
  Object.defineProperty(value, "4294967295", {
    enumerable: true,
    value: "not-an-array-index"
  });
  assert.throws(
    () => canonicalize(value),
    (error) => error instanceof KernelError && error.code === "CANONICALIZATION_ARRAY_PROPERTY"
  );
});

test("canonicalizer rejects option accessors without invoking them", () => {
  const options = {};
  Object.defineProperty(options, "limits", {
    enumerable: true,
    get() {
      throw new Error("option accessor was executed");
    }
  });
  assert.throws(
    () => canonicalize({}, options),
    (error) => error instanceof KernelError && error.code === "CANONICALIZATION_ACCESSOR"
  );
});

test("canonical forms require a normalized non-empty schema version", () => {
  assert.throws(
    () => createCanonicalForm(HASH_DOMAINS.ARTIFACT, {}, " 1"),
    (error) => error instanceof KernelError &&
      error.code === "CANONICALIZATION_SCHEMA_VERSION_INVALID"
  );
});

test("invalid canonicalization limits use the stable kernel error contract", () => {
  assert.throws(
    () => canonicalize({}, { limits: { maxDepth: 0 } }),
    (error) => error instanceof KernelError &&
      error.code === "CANONICALIZATION_LIMIT_INVALID" &&
      error.stage === "CANONICALIZE"
  );
});
