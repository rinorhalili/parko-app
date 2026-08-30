import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const isDev = process.argv.includes('--dev')
const appUrl = isDev ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:4173'
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

function startProcess(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  })

  trackProcess(child)
  return child
}

async function main() {
  if (isDev) {
    const devCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const devServer = startProcess(devCommand, ['vite', '--host', '127.0.0.1', '--port', '5173'])
    await waitForServer(appUrl)
    const electronProcess = spawn(electron, [resolve(rootDir, 'electron', 'main.mjs')], {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, PARKO_APP_URL: appUrl },
    })
    trackProcess(electronProcess)
    electronProcess.on('exit', (code) => {
      if (devServer && !devServer.killed) devServer.kill('SIGTERM')
      process.exit(code ?? 0)
    })
    return
  }

  if (!existsSync(distReady)) {
    const build = startProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])
    await new Promise((resolve, reject) => {
      build.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`)))
    })
  }

  const server = startProcess(process.execPath, ['server/index.mjs'], { PORT: '4173' })
  await waitForServer(appUrl)

  const electronProcess = spawn(electron, [resolve(rootDir, 'electron', 'main.mjs')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PARKO_APP_URL: appUrl },
  })
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
