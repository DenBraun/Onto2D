import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  canonicalBytes,
  canonicalize,
  createCanonicalForm,
  hashCanonical
} from "../src/index.js";

const conformanceFixture = JSON.parse(await readFile(
  new URL("../../../test/fixtures/canonical-conformance-v1.json", import.meta.url),
  "utf8"
));

function binary64FromHex(hex) {
  const bytes = Buffer.from(hex, "hex");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0, false);
}

const RFC_8785_BINARY64_VECTORS = [
  ["0000000000000000", "0"],
  ["8000000000000000", "0"],
  ["0000000000000001", "5e-324"],
  ["8000000000000001", "-5e-324"],
  ["7fefffffffffffff", "1.7976931348623157e+308"],
  ["ffefffffffffffff", "-1.7976931348623157e+308"],
  ["4340000000000000", "9007199254740992"],
  ["c340000000000000", "-9007199254740992"],
  ["4430000000000000", "295147905179352830000"],
  ["44b52d02c7e14af5", "9.999999999999997e+22"],
  ["44b52d02c7e14af6", "1e+23"],
  ["44b52d02c7e14af7", "1.0000000000000001e+23"],
  ["444b1ae4d6e2ef4e", "999999999999999700000"],
  ["444b1ae4d6e2ef4f", "999999999999999900000"],
  ["444b1ae4d6e2ef50", "1e+21"],
  ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
  ["3eb0c6f7a0b5ed8d", "0.000001"],
  ["41b3de4355555553", "333333333.3333332"],
  ["41b3de4355555554", "333333333.33333325"],
  ["41b3de4355555555", "333333333.3333333"],
  ["41b3de4355555556", "333333333.3333334"],
  ["41b3de4355555557", "333333333.33333343"],
  ["becbf647612f3696", "-0.0000033333333333333333"],
  ["43143ff3c1cb0959", "1424953923781206.2"]
];

test("canonical bytes and framed hashes match independent Python goldens", () => {
  assert.equal(conformanceFixture.generatedBy.importsKernel, false);
  for (const fixture of conformanceFixture.cases) {
    const bytes = Buffer.from(canonicalBytes(fixture.value));
    assert.equal(canonicalize(fixture.value), fixture.canonicalJson, fixture.id);
    assert.equal(bytes.toString("base64"), fixture.bytesBase64, fixture.id);
    assert.equal(bytes.toString("hex"), fixture.bytesUtf8Hex, fixture.id);
    for (const [domain, expected] of Object.entries(fixture.hashes)) {
      assert.equal(hashCanonical(domain, fixture.value), expected, `${fixture.id}:${domain}`);
    }
  }
});

test("binary64 serialization matches every finite RFC 8785 Appendix B vector", () => {
  for (const [hex, expected] of RFC_8785_BINARY64_VECTORS) {
    assert.equal(canonicalize(binary64FromHex(hex)), expected, hex);
  }
});

test("RFC 8785 non-finite binary64 vectors fail explicitly", () => {
  for (const hex of ["7fffffffffffffff", "7ff0000000000000", "fff0000000000000"]) {
    assert.throws(
      () => canonicalize(binary64FromHex(hex)),
      (error) => error instanceof KernelError && error.code === "NUMERIC_NONFINITE",
      hex
    );
  }
});

test("Unicode key sorting matches the RFC 8785 UTF-16 example", () => {
  const value = {
    "\u20ac": "Euro Sign",
    "\r": "Carriage Return",
    "\ufb33": "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "\ud83d\ude00": "Emoji: Grinning Face",
    "\u0080": "Control",
    "\u00f6": "Latin Small Letter O With Diaeresis"
  };
  assert.equal(
    canonicalize(value),
    "{\"\\r\":\"Carriage Return\",\"1\":\"One\",\"\u0080\":\"Control\",\"ö\":\"Latin Small Letter O With Diaeresis\",\"€\":\"Euro Sign\",\"😀\":\"Emoji: Grinning Face\",\"דּ\":\"Hebrew Letter Dalet With Dagesh\"}"
  );
});

test("Unicode is preserved without normalization and unpaired surrogates fail", () => {
  assert.notEqual(canonicalize("é"), canonicalize("e\u0301"));
  for (const value of ["\ud800", "\udc00", { "\ud800": true }]) {
    assert.throws(
      () => canonicalize(value),
      (error) => error instanceof KernelError && error.code === "CANONICALIZATION_INVALID_UNICODE"
    );
  }
});

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
