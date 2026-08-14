import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const caseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(caseRoot, "sources");
const sourceLock = JSON.parse(await readFile(path.join(caseRoot, "source-lock.json"), "utf8"));
await mkdir(destination, { recursive: true });

for (const source of sourceLock.sources) {
  const response = await fetch(source.snapshotUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed for ${source.name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== source.bytes || digest !== source.sha256) {
    throw new Error(`${source.name} failed its frozen byte-length/SHA-256 check.`);
  }
  const finalPath = path.join(destination, source.localName);
  const temporaryPath = `${finalPath}.partial`;
  await rm(temporaryPath, { force: true });
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, finalPath);
  process.stdout.write(`Verified ${source.localName} (${bytes.length} bytes)\n`);
}
