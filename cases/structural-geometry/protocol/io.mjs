import { randomUUID } from "node:crypto";
import { lstat, link, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Publish complete bytes without replacing an existing accepted artifact. */
export async function publishExclusive(target, bytes) {
  const parent = new URL("./", target), info = await lstat(dirname(fileURLToPath(target)));
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Protocol output needs a real directory.");
  const temporary = new URL(`.protocol-${randomUUID()}.tmp`, parent);
  let handle, created = false;
  try {
    handle = await open(temporary, "wx"); created = true;
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
    // link is atomic and fails even when the destination is a dangling symlink.
    await link(temporary, target);
  } finally {
    if (handle) await handle.close();
    if (created) await unlink(temporary);
  }
}
