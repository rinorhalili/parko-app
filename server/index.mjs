import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const port = Number(process.env.PORT || 4173);
const cache = new Map();
const nativeOrigins = new Set(
  (process.env.PARKO_NATIVE_ORIGINS || "https://localhost")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const upstreams = {
  "/api/overpass": ["https://overpass-api.de/api/interpreter", 5 * 60_000],
  "/api/route": ["https://router.project-osrm.org/route/v1/driving", 60_000],
  "/api/table": ["https://router.project-osrm.org/table/v1/driving", 60_000],
  "/api/geocode": [
    "https://nominatim.openstreetmap.org/search",
    24 * 60 * 60_000,
  ],
  "/api/reverse": [
    "https://nominatim.openstreetmap.org/reverse",
    24 * 60 * 60_000,
  ],
  "/api/osm": ["https://api.openstreetmap.org/api/0.6", 24 * 60 * 60_000],
};

function send(response, status, body = "", headers = {}) {
  response.writeHead(status, {
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    ...headers,
  });
  response.end(body);
}

async function bodyOf(request, limit = 64_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyGet(request, response, prefix, target, ttl) {
  const sourceUrl = new URL(request.url, "http://localhost");
  const suffix = sourceUrl.pathname.slice(prefix.length);
  const targetUrl = new URL(`${target}${suffix}${sourceUrl.search}`);
  const key = targetUrl.toString();
  const cached = cache.get(key);
  if (cached && cached.expires <= Date.now()) cache.delete(key);
  if (cached && cached.expires > Date.now()) {
    send(response, cached.status, cached.body, {
      "Content-Type": cached.type,
      "X-Parko-Cache": "HIT",
    });
    return;
  }
  const upstream = await fetch(targetUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Parko-Prishtina/1.0",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const chunks = [];
  let size = 0;
  for await (const chunk of upstream.body ?? []) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error("Upstream response too large");
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const type = upstream.headers.get("content-type") ?? "application/json";
  if (upstream.ok) {
    const now = Date.now();
    for (const [oldKey, value] of cache)
      if (value.expires <= now) cache.delete(oldKey);
    let bytes = [...cache.values()].reduce(
      (sum, value) => sum + value.body.length,
      0,
    );
    while (
      cache.size &&
      (cache.size >= 128 || bytes + body.length > 16 * 1024 * 1024)
    ) {
      const oldest = cache.keys().next().value;
      bytes -= cache.get(oldest).body.length;
      cache.delete(oldest);
    }
    cache.set(key, { status: upstream.status, body, type, expires: now + ttl });
  }
  send(response, upstream.status, body, {
    "Content-Type": type,
    "X-Parko-Cache": "MISS",
  });
}

async function optionalForward(request, response, target, emptyStatus = 204) {
  if (!target) {
    send(response, emptyStatus);
    return;
  }
  const body = request.method === "POST" ? await bodyOf(request) : undefined;
  const upstream = await fetch(target, {
    method: request.method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  send(response, upstream.status, Buffer.from(await upstream.arrayBuffer()), {
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// Keep credentials and HttpOnly refresh cookies on the application's own origin.
function proxyBackend(request, response) {
  const target = new URL(
    request.url,
    process.env.PARKO_API_URL || "http://127.0.0.1:4000",
  );
  const forward = target.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = forward(
    target,
    {
      method: request.method,
      headers: { ...request.headers, host: target.host },
      timeout: 15_000,
    },
    (incoming) => {
      response.writeHead(incoming.statusCode || 502, {
        ...incoming.headers,
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
      });
      incoming.pipe(response);
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("Backend timeout")));
  upstream.on("error", () => {
    if (!response.headersSent)
      send(
        response,
        502,
        JSON.stringify({
          error: {
            code: "BACKEND_UNAVAILABLE",
            message: "Serveri nuk është i disponueshëm.",
          },
        }),
        { "Content-Type": "application/json" },
      );
    else response.destroy();
  });
  request.pipe(upstream);
}

createServer(async (request, response) => {
  try {
    if (request.headers["x-forwarded-proto"] === "http") {
      const forwardedHost = request.headers["x-forwarded-host"];
      const host =
        typeof forwardedHost === "string"
          ? forwardedHost
          : request.headers.host;
      const url = new URL(request.url, `https://${host || "localhost"}`);
      url.protocol = "https:";
      return send(response, 301, "", { Location: url.toString() });
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    const origin = request.headers.origin;
    if (pathname.startsWith("/api/") && typeof origin === "string" && nativeOrigins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Parko-Client");
      response.setHeader("Vary", "Origin");
      if (request.method === "OPTIONS") return send(response, 204);
    }
    if (pathname.startsWith("/api/v1/") || pathname.startsWith("/socket.io/"))
      return proxyBackend(request, response);
    if (pathname === "/api/occupancy")
      return await optionalForward(
        request,
        response,
        process.env.PARKO_OCCUPANCY_URL,
      );
    if (pathname === "/api/telemetry")
      return await optionalForward(
        request,
        response,
        process.env.PARKO_TELEMETRY_URL,
      );
    if (pathname === "/api/push-subscription")
      return await optionalForward(
        request,
        response,
        process.env.PARKO_PUSH_SUBSCRIPTION_URL,
      );
    if (pathname === "/api/walking-route")
      return await optionalForward(
        request,
        response,
        `${process.env.PARKO_VALHALLA_URL || "https://valhalla1.openstreetmap.de"}/route`,
        502,
      );
    for (const [prefix, [target, ttl]] of Object.entries(upstreams)) {
      if (pathname.startsWith(prefix))
        return await proxyGet(request, response, prefix, target, ttl);
    }
    const relative = normalize(
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""),
    );
    const candidate = resolve(dist, relative);
    const safePath =
      candidate === dist || candidate.startsWith(`${dist}${sep}`)
        ? candidate
        : join(dist, "index.html");
    let filePath = safePath;
    try {
      if (!(await stat(filePath)).isFile()) filePath = join(dist, "index.html");
    } catch {
      filePath = join(dist, "index.html");
    }
    send(response, 200, await readFile(filePath), {
      "Content-Type": mime[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": filePath.includes(`${sep}assets${sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
  } catch (error) {
    send(
      response,
      502,
      JSON.stringify({
        error: error instanceof Error ? error.message : "Upstream failure",
      }),
      { "Content-Type": "application/json" },
    );
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Parko production server listening on http://0.0.0.0:${port}`),
);
