import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("repository case sources match their locked hashes", async () => {
  const lock = JSON.parse(await readFile(
    path.join(repositoryRoot, "cases", "level-0-oscillator", "source-lock.json"),
    "utf8"
  ));
  const repositorySources = lock.sources.filter((source) => source.repositoryPath);
  assert.ok(repositorySources.length > 0);

  for (const source of repositorySources) {
    const bytes = await readFile(path.join(repositoryRoot, source.repositoryPath));
    assert.equal(bytes.length, source.bytes, `${source.name} byte length`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, `${source.name} SHA-256`);
  }
});
