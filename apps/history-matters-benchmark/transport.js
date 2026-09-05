export const MAX_PILOT_BYTES = 1024 * 1024;

/** Bound decoded bytes during transfer, including responses without Content-Length. */
export async function readPilotBytes(response) {
  if (!response.ok) throw new Error(`Artifact request failed (${response.status}).`);
  if (!response.body) throw new Error("Pilot response has no body.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    const length = response.headers.get("content-length");
    if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_PILOT_BYTES) throw new Error("Pilot exceeds the 1 MiB limit.");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_PILOT_BYTES - size) throw new Error("Pilot exceeds the 1 MiB limit.");
      chunks.push(value);
      size += value.byteLength;
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
