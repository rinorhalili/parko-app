const ALLOWED_QUERY_FIELDS = [
  "q",
  "format",
  "addressdetails",
  "namedetails",
  "limit",
  "viewbox",
  "bounded",
  "accept-language",
];

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const target = new URL("https://nominatim.openstreetmap.org/search");
  for (const field of ALLOWED_QUERY_FIELDS) {
    const value = request.query[field];
    if (typeof value === "string") target.searchParams.set(field, value);
  }
  if (!target.searchParams.has("q")) {
    response.status(400).json({ error: "Missing search query" });
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "sq,en",
        "User-Agent": "Parko-Prishtina/1.0 (support@parko.app)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    response.status(upstream.status);
    response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.status(502).json({ error: "Geocoding service unavailable" });
  }
}
