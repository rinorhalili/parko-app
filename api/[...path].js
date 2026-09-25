const upstreams = {
  geocode: "https://nominatim.openstreetmap.org/search",
  reverse: "https://nominatim.openstreetmap.org/reverse",
  overpass: "https://overpass-api.de/api/interpreter",
  route: "https://router.project-osrm.org/route/v1/driving",
  table: "https://router.project-osrm.org/table/v1/driving",
  osm: "https://api.openstreetmap.org/api/0.6",
  "walking-route": "https://valhalla1.openstreetmap.de/route"
};

function resolveTarget(pathname, query) {
  const [segment, ...rest] = pathname.split("/");
  const base = upstreams[segment];
  if (!base) return null;
  const suffix = rest.length ? `/${rest.join("/")}` : "";
  return `${base}${suffix}${query}`;
}

export default async function handler(request, response) {
  const rawPath = Array.isArray(request.query.path) ? request.query.path.join("/") : request.query.path;
  const pathname = typeof rawPath === "string" ? rawPath.replace(/^\/+/, "") : "";
  if (pathname === "occupancy" || pathname === "telemetry" || pathname === "push-subscription") {
    response.status(204).end();
    return;
  }

  const queryStart = request.url.indexOf("?");
  const query = queryStart >= 0 ? request.url.slice(queryStart) : "";
  const target = resolveTarget(pathname, query);
  if (!target) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
    return;
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Accept: "application/json",
        "Accept-Language": "sq,en",
        "User-Agent": "Parko-Prishtina/1.0 (support@parko.app)",
        ...(request.method === "POST" ? { "Content-Type": "application/json" } : {})
      },
      body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000)
    });
    response.status(upstream.status);
    response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.status(502).json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "Shërbimi i hartës nuk është i disponueshëm." } });
  }
}
