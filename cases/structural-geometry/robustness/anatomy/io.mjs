import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../protocol/check.mjs";

export const HERE = new URL("./", import.meta.url);
export const encode = value => `${JSON.stringify(value)}\n`;
export async function readJson(path, { hash = null, maximum = 128000000 } = {}) {
  const url = new URL(path, HERE), info = await lstat(url);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new Error("Expected a bounded regular D6.2 input.");
  const bytes = await readFile(url);
  if (bytes.length > maximum || (hash !== null && sha256(bytes) !== hash)) throw new Error(`D6.2 source binding differs: ${path}`);
  return JSON.parse(bytes);
}
export async function realDirectories(paths) {
  for (const path of paths) {
    const info = await lstat(fileURLToPath(new URL(path, HERE)).replace(/\/$/, ""));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("D6.2 input/output directories must be real.");
  }
}
export async function writeJson(path, value, { pretty = false } = {}) {
  if (!["cache/details.json", "results.json", "costs.json"].includes(path)) throw new Error("Unknown D6.2 artifact destination.");
  if (path.startsWith("cache/")) await mkdir(new URL("cache", HERE), { recursive: true });
  await realDirectories([".", ...(path.startsWith("cache/") ? ["cache"] : [])]);
  const target = new URL(path, HERE), temporary = new URL(`${path}.${randomUUID()}.tmp`, HERE);
  const existing = await lstat(target).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error("D6.2 output must be a regular file.");
  let handle = await open(temporary, "wx");
  try {
    await handle.writeFile(pretty ? `${JSON.stringify(value, null, 2)}\n` : encode(value)); await handle.sync();
    await handle.close(); handle = null; await rename(temporary, target);
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}
export function python(script, args, input, { timeout = 600000, maximum = 128000000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", fileURLToPath(new URL(script, HERE)), ...args], { stdio: ["pipe", "pipe", "pipe"] });
    const buffers = []; let size = 0, stderr = "", failure = null;
    const stop = error => { failure ??= error; child.kill(); };
    const timer = setTimeout(() => stop(new Error(`D6.2 ${script} exceeded its execution limit.`)), timeout);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.stdin.on("error", error => { if (error.code !== "EPIPE") stop(error); });
    child.stdout.on("data", bytes => {
      size += bytes.length;
      if (size > maximum) stop(new Error("D6.2 Python output exceeds the complete-artifact bound."));
      else buffers.push(bytes);
    });
    child.stderr.on("data", bytes => { stderr = (stderr + bytes).slice(-10000); });
    child.on("close", code => {
      clearTimeout(timer);
      if (failure || code !== 0) reject(failure ?? new Error(`D6.2 ${script} failed: ${stderr}`));
      else { try { resolve(JSON.parse(Buffer.concat(buffers).toString("utf8"))); } catch (error) { reject(error); } }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
