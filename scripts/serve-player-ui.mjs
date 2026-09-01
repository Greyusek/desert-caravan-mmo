import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPlayerSessionController } from "../packages/sim-core/dist/src/index.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, "..");
const DEFAULT_PORT = 4174;
const PLAYER_UI_PREFIX = "packages/player-ui/";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

/**
 * @param {string} repositoryRoot
 * @param {string} requestTarget
 */
export function resolvePlayerUiAsset(repositoryRoot, requestTarget) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestTarget, "http://localhost").pathname);
  } catch {
    return null;
  }
  const relativePath =
    pathname === "/"
      ? "packages/player-ui/index.html"
      : pathname.replace(/^\/+/, "");
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("\0") ||
    !normalized.startsWith(PLAYER_UI_PREFIX)
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
export function contentTypeForPlayerUi(filePath) {
  return (
    CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ??
    "application/octet-stream"
  );
}

/** @param {string} worldSeed */
export function createPlayerUiSessionPayload(worldSeed) {
  return JSON.stringify(createPlayerSessionController(worldSeed).getView());
}

/** @param {string} worldSeed */
export function createPlayerUiSessionStore(worldSeed) {
  let controller = createPlayerSessionController(worldSeed);
  return Object.freeze({
    getPayload() {
      return JSON.stringify(controller.getView());
    },
    /** @param {unknown} input */
    dispatch(input) {
      controller = controller.dispatch(parsePlayerAction(input));
      return JSON.stringify(controller.getView());
    },
  });
}

/**
 * @param {{ repositoryRoot?: string, port?: number, worldSeed?: string }} [options]
 */
export function startPlayerUiServer(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const port = options.port ?? DEFAULT_PORT;
  const worldSeed = options.worldSeed ?? "player-shell-local-session";
  assertPort(port);
  const sessionStore = createPlayerUiSessionStore(worldSeed);

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname === "/api/player-session") {
      if (request.method !== "GET") {
        respondText(response, 405, "Method not allowed");
        return;
      }
      respondJson(response, 200, sessionStore.getPayload());
      return;
    }
    if (requestUrl.pathname === "/api/player-session/actions") {
      if (request.method !== "POST") {
        respondText(response, 405, "Method not allowed");
        return;
      }
      try {
        const action = await readJsonRequest(request);
        respondJson(response, 200, sessionStore.dispatch(action));
      } catch (error) {
        console.error("Player UI action rejected", error);
        respondJson(response, 400, JSON.stringify({ error: "Action rejected." }));
      }
      return;
    }

    const assetPath = resolvePlayerUiAsset(repositoryRoot, request.url ?? "/");
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
        "Content-Type": contentTypeForPlayerUi(assetPath),
        "X-Content-Type-Options": "nosniff",
      });
      createReadStream(assetPath).pipe(response);
    } catch (error) {
      const statusCode =
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
          ? 404
          : 500;
      respondText(
        response,
        statusCode,
        statusCode === 404 ? "Not found" : "Server error",
      );
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Desert Caravan MMO Player UI: http://127.0.0.1:${port}`);
    console.log("Press Ctrl+C to stop the local server.");
  });
  return server;
}

/** @param {unknown} input */
function parsePlayerAction(input) {
  if (!input || typeof input !== "object" || !("kind" in input)) {
    throw new TypeError("player action must have a kind");
  }
  if (input.kind === "START_JOURNEY") {
    return { kind: "START_JOURNEY" };
  }
  if (
    input.kind === "SELECT_DESTINATION" &&
    "destinationRef" in input &&
    typeof input.destinationRef === "string"
  ) {
    return {
      kind: "SELECT_DESTINATION",
      destinationRef: input.destinationRef,
    };
  }
  throw new RangeError("unsupported player action");
}

/** @param {import("node:http").IncomingMessage} request */
function readJsonRequest(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) reject(new RangeError("request body is too large"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

/** @param {import("node:http").ServerResponse} response @param {number} statusCode @param {string} json */
function respondJson(response, statusCode, json) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(json);
}

/** @param {import("node:http").ServerResponse} response @param {number} statusCode @param {string} text */
function respondText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

/** @param {number} port */
function assertPort(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError("player UI port must be an integer between 1 and 65535");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const configuredPort = process.env.PLAYER_UI_PORT
    ? Number(process.env.PLAYER_UI_PORT)
    : DEFAULT_PORT;
  const configuredSeed =
    process.env.PLAYER_UI_SEED ?? "player-shell-local-session";
  startPlayerUiServer({ port: configuredPort, worldSeed: configuredSeed });
}
