import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const isDev = process.argv.includes('--dev')
const isWin = process.platform === 'win32'
const distReady = resolve(rootDir, 'dist', 'index.html')
const childProcesses = []

function trackProcess(processRef) {
  childProcesses.push(processRef)
  processRef.on('exit', () => {
    const index = childProcesses.indexOf(processRef)
    if (index >= 0) childProcesses.splice(index, 1)
  })
}

function shutdown() {
  for (const child of [...childProcesses]) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }

      try {
        const response = await fetch(url)
        if (response.ok || response.status === 404 || response.status === 204) {
          resolve()
          return
        }
      } catch {
        // Server is still starting.
      }

      setTimeout(tick, 250)
    }

    tick()
  })
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const available = await new Promise((resolvePort) => {
      const server = createServer()
      server.once('error', () => resolvePort(false))
      server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)))
    })
    if (available) return port
  }
  throw new Error(`No available port found starting at ${startPort}`)
}

function startProcess(command, args, extraEnv = {}) {
  const shellCommand = isWin && command.includes(' ') ? `"${command}"` : command
  const child = spawn(shellCommand, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...extraEnv },
  })

  trackProcess(child)
  return child
}

async function main() {
  if (isDev) {
    const devPort = await findAvailablePort(5173)
    const appUrl = `http://127.0.0.1:${devPort}`
    const devCommand = isWin ? 'npx.cmd' : 'npx'
    const devServer = startProcess(devCommand, ['vite', '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'])
    await waitForServer(appUrl)
    const electronProcess = startProcess(electron, [resolve(rootDir, 'electron', 'main.mjs')], { PARKO_APP_URL: appUrl, PARKO_DEV: 'true' })
    trackProcess(electronProcess)
    electronProcess.on('exit', (code) => {
      if (devServer && !devServer.killed) devServer.kill('SIGTERM')
      process.exit(code ?? 0)
    })
    return
  }

  const appUrl = 'http://127.0.0.1:4173'
  if (!existsSync(distReady)) {
    const build = startProcess(isWin ? 'npm.cmd' : 'npm', ['run', 'build'])
    await new Promise((resolve, reject) => {
      build.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`)))
    })
  }

  const server = startProcess(process.execPath, ['server/index.mjs'], { PORT: '4173' })
  await waitForServer(appUrl)

  const electronProcess = startProcess(electron, [resolve(rootDir, 'electron', 'main.mjs')], { PARKO_APP_URL: appUrl })
  trackProcess(electronProcess)

  electronProcess.on('exit', (code) => {
    if (server && !server.killed) server.kill('SIGTERM')
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error('Failed to start desktop app:', error)
  shutdown()
})
