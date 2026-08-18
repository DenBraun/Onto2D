import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requestedPort = Number(process.argv[2] ?? 8080);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
  throw new Error("Port must be an integer from 1 to 65535.");
}

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
});

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const documentRequest = pathname.endsWith("/") || path.extname(pathname) === ".html";
    if (documentRequest && requestUrl.searchParams.has("v")) {
      requestUrl.searchParams.delete("v");
      response.writeHead(302, {
        "Cache-Control": "no-store, max-age=0",
        "Location": `${pathname}${requestUrl.search}`
      }).end();
      return;
    }
    const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const absolutePath = path.resolve(applicationRoot, `.${relativePath}`);

    if (absolutePath !== applicationRoot && !absolutePath.startsWith(`${applicationRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": fileStat.size,
      "Content-Type": contentTypes[path.extname(absolutePath)] ?? "application/octet-stream",
      "Expires": "0",
      "Pragma": "no-cache"
    });
    createReadStream(absolutePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Onto2D site: http://127.0.0.1:${requestedPort}`);
});
