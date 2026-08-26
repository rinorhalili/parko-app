import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 4173)
const cache = new Map()

const upstreams = {
  '/api/overpass': ['https://overpass-api.de/api/interpreter', 5 * 60_000],
  '/api/route': ['https://router.project-osrm.org/route/v1/driving', 60_000],
  '/api/table': ['https://router.project-osrm.org/table/v1/driving', 60_000],
  '/api/geocode': ['https://nominatim.openstreetmap.org/search', 24 * 60 * 60_000],
  '/api/reverse': ['https://nominatim.openstreetmap.org/reverse', 24 * 60 * 60_000],
  '/api/osm': ['https://api.openstreetmap.org/api/0.6', 24 * 60 * 60_000],
}

function send(response, status, body = '', headers = {}) {
  response.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers })
  response.end(body)
}

async function bodyOf(request, limit = 64_000) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('Request too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function proxyGet(request, response, prefix, target, ttl) {
  const sourceUrl = new URL(request.url, 'http://localhost')
  const suffix = sourceUrl.pathname.slice(prefix.length)
  const targetUrl = new URL(`${target}${suffix}${sourceUrl.search}`)
  const key = targetUrl.toString()
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    send(response, cached.status, cached.body, { 'Content-Type': cached.type, 'X-Parko-Cache': 'HIT' })
    return
  }
  const upstream = await fetch(targetUrl, { headers: { Accept: 'application/json', 'User-Agent': 'Parko-Prishtina/1.0' }, signal: AbortSignal.timeout(15_000) })
  const body = Buffer.from(await upstream.arrayBuffer())
  const type = upstream.headers.get('content-type') ?? 'application/json'
  if (upstream.ok) cache.set(key, { status: upstream.status, body, type, expires: Date.now() + ttl })
  send(response, upstream.status, body, { 'Content-Type': type, 'X-Parko-Cache': 'MISS' })
}

async function optionalForward(request, response, target, emptyStatus = 204) {
  if (!target) { send(response, emptyStatus); return }
  const body = request.method === 'POST' ? await bodyOf(request) : undefined
  const upstream = await fetch(target, { method: request.method, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15_000) })
  send(response, upstream.status, Buffer.from(await upstream.arrayBuffer()), { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' })
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' }

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/api/occupancy') return await optionalForward(request, response, process.env.PARKO_OCCUPANCY_URL)
    if (pathname === '/api/telemetry') return await optionalForward(request, response, process.env.PARKO_TELEMETRY_URL)
    if (pathname === '/api/push-subscription') return await optionalForward(request, response, process.env.PARKO_PUSH_SUBSCRIPTION_URL)
    if (pathname === '/api/walking-route') return await optionalForward(request, response, `${process.env.PARKO_VALHALLA_URL || 'https://valhalla1.openstreetmap.de'}/route`, 502)
    for (const [prefix, [target, ttl]] of Object.entries(upstreams)) {
      if (pathname.startsWith(prefix)) return await proxyGet(request, response, prefix, target, ttl)
    }
    const relative = normalize(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
    const candidate = resolve(dist, relative)
    const safePath = (candidate === dist || candidate.startsWith(`${dist}${sep}`)) ? candidate : join(dist, 'index.html')
    let filePath = safePath
    try { if (!(await stat(filePath)).isFile()) filePath = join(dist, 'index.html') } catch { filePath = join(dist, 'index.html') }
    send(response, 200, await readFile(filePath), { 'Content-Type': mime[extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  } catch (error) {
    send(response, 502, JSON.stringify({ error: error instanceof Error ? error.message : 'Upstream failure' }), { 'Content-Type': 'application/json' })
  }
}).listen(port, '0.0.0.0', () => console.log(`Parko production server listening on http://0.0.0.0:${port}`))
