import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function optionalApiPlugin(occupancyUrl: string, telemetryUrl: string): Plugin {
  return {
    name: 'parko-optional-apis',
    configureServer(server) {
      server.middlewares.use('/api/occupancy', async (_request, response) => {
        if (!occupancyUrl) { response.statusCode = 204; response.end(); return }
        try {
          const upstream = await fetch(occupancyUrl, { headers: { Accept: 'application/json' } })
          response.statusCode = upstream.status
          response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
          response.end(Buffer.from(await upstream.arrayBuffer()))
        } catch { response.statusCode = 502; response.end(JSON.stringify({ error: 'Occupancy feed unavailable' })) }
      })
      server.middlewares.use('/api/telemetry', async (request, response) => {
        if (!telemetryUrl || request.method !== 'POST') { response.statusCode = 204; response.end(); return }
        const chunks: Buffer[] = []
        request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        request.on('end', async () => {
          try {
            await fetch(telemetryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks) })
            response.statusCode = 204
          } catch { response.statusCode = 502 }
          response.end()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return ({
  plugins: [react(), optionalApiPlugin(env.PARKO_OCCUPANCY_URL ?? '', env.PARKO_TELEMETRY_URL ?? '')],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/overpass/, '/api/interpreter'),
      },
      '/api/route': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/route/, '/route/v1/driving'),
      },
      '/api/table': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/table/, '/table/v1/driving'),
      },
      '/api/geocode': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Parko-Prishtina/0.1 (local prototype)',
          'Accept-Language': 'sq,en',
        },
        rewrite: (path) => path.replace(/^\/api\/geocode/, '/search'),
      },
      '/api/reverse': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Parko-Prishtina/0.1 (local prototype)',
          'Accept-Language': 'sq,en',
        },
        rewrite: (path) => path.replace(/^\/api\/reverse/, '/reverse'),
      },
      '/api/osm': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osm/, '/api/0.6'),
      },
      '/api/walking-route': {
        target: env.PARKO_VALHALLA_URL || 'https://valhalla1.openstreetmap.de',
        changeOrigin: true,
        rewrite: () => '/route',
      },
    },
  },
})})
