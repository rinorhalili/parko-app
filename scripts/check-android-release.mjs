import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const errors = []
const envPath = resolve(root, '.env.android')
const keystorePath = resolve(root, 'android', 'keystore.properties')

if (!existsSync(envPath)) errors.push('Mungon .env.android (kopjoje nga .env.android.example).')
if (!existsSync(keystorePath)) errors.push('Mungon android/keystore.properties dhe upload keystore-i i Play Store.')

if (existsSync(envPath)) {
  const values = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf('=')
    return index < 0 ? [line, ''] : [line.slice(0, index), line.slice(index + 1).trim()]
  }))
  for (const key of ['VITE_API_BASE_URL', 'VITE_SOCKET_URL', 'VITE_WEB_ORIGIN']) {
    const value = values[key] || ''
    if (!value.startsWith('https://') || value.includes('example.com')) errors.push(`${key} duhet të jetë URL reale HTTPS.`)
  }
  if (!values.VITE_SUPPORT_EMAIL || values.VITE_SUPPORT_EMAIL.includes('example.com')) errors.push('VITE_SUPPORT_EMAIL duhet të jetë email real i suportit.')
}

if (errors.length) {
  console.error(`Android release nuk është gati:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log('Kontrolli i Android release kaloi.')
