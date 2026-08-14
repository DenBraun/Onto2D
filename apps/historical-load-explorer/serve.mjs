import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const applicationRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedPort = Number(process.argv[2] ?? 8080);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
  throw new Error("Port must be an integer from 1 to 65535.");
}

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
});

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const absolutePath = path.resolve(applicationRoot, `.${relativePath}`);

    if (absolutePath !== applicationRoot && !absolutePath.startsWith(`${applicationRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": fileStat.size,
      "Content-Type": contentTypes[path.extname(absolutePath)] ?? "application/octet-stream"
    });
    createReadStream(absolutePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Historical Load Explorer: http://127.0.0.1:${requestedPort}`);
});
