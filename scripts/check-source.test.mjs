import assert from "node:assert/strict";
import test from "node:test";
import { findUnsafeFileUrlPathnames } from "./check-source.mjs";

test("source validation rejects direct file URL pathname access", () => {
  const findings = findUnsafeFileUrlPathnames(
    `import "node:fs";
const root = new URL(import.meta.url).pathname;`,
    "direct.mjs"
  );
  assert.deepEqual(findings, [{ line: 2, column: 14 }]);
});

test("source validation follows derived file URL constants", () => {
  const findings = findUnsafeFileUrlPathnames(`
    import "node:fs";
    const root = new URL("../", import.meta.url);
    const manifest = new URL("manifest.json", root);
    consume(manifest.pathname);
  `, "derived.mjs");
  assert.deepEqual(findings, [{ line: 5, column: 13 }]);
});

test("source validation permits browser URL pathname inspection", () => {
  const findings = findUnsafeFileUrlPathnames(`
    const projectRoot = new URL("../", import.meta.url);
    const route = new URL(request.url, projectRoot);
    consume(route.pathname);
  `, "browser.js");
  assert.deepEqual(findings, []);
});
