import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, "..");
const DEFAULT_PORT = 4173;
const ALLOWED_PREFIXES = ["packages/debug-map/", "packages/sim-core/dist/"];

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

/**
 * Resolves only assets required by the debug map. Returning null is safer than
 * exposing the repository root through a general-purpose static server.
 * @param {string} repositoryRoot
 * @param {string} requestTarget
 */
export function resolveDebugMapAsset(repositoryRoot, requestTarget) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestTarget, "http://localhost").pathname);
  } catch {
    return null;
  }

  const relativePath =
    pathname === "/"
      ? "packages/debug-map/index.html"
      : pathname.replace(/^\/+/, "");
  const normalized = path.posix.normalize(relativePath);

  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("\0") ||
    !ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    return null;
  }

  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(root, ...normalized.split("/"));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return resolved;
}

/** @param {string} filePath */
export function contentTypeForDebugMap(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ??
    "application/octet-stream";
}

/**
 * @param {{ repositoryRoot?: string, port?: number }} [options]
 */
export function startDebugMapServer(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const port = options.port ?? DEFAULT_PORT;
  assertPort(port);

  const server = createServer(async (request, response) => {
    const assetPath = resolveDebugMapAsset(repositoryRoot, request.url ?? "/");
    if (!assetPath) {
      respondText(response, 404, "Not found");
      return;
    }

    try {
      const metadata = await stat(assetPath);
      if (!metadata.isFile()) {
        respondText(response, 404, "Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": metadata.size,
        "Content-Type": contentTypeForDebugMap(assetPath),
      });
      createReadStream(assetPath).pipe(response);
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "code" in error && error.code === "ENOENT"
          ? 404
          : 500;
      respondText(response, statusCode, statusCode === 404 ? "Not found" : "Server error");
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Desert Caravan MMO debug map: http://127.0.0.1:${port}`);
    console.log("Press Ctrl+C to stop the local server.");
  });

  return server;
}

/** @param {import("node:http").ServerResponse} response @param {number} statusCode @param {string} text */
function respondText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

/** @param {number} port */
function assertPort(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError("debug map port must be an integer between 1 and 65535");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const configuredPort = process.env.DEBUG_MAP_PORT
    ? Number(process.env.DEBUG_MAP_PORT)
    : DEFAULT_PORT;
  startDebugMapServer({ port: configuredPort });
}
