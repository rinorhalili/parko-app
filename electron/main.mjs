import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appUrl = process.env.PARKO_APP_URL || 'http://127.0.0.1:4173'
const rootDir = fileURLToPath(new URL('..', import.meta.url))

function isExternalUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function openExternalUrl(url) {
  if (typeof url !== 'string' || !isExternalUrl(url)) {
    console.error('Refusing to open invalid external URL:', url)
    return false
  }

  try {
    await shell.openExternal(url)
    return true
  } catch (error) {
    console.error('Failed to open external URL:', url, error)
    return false
  }
}

ipcMain.handle('external:open', (_event, url) => openExternalUrl(url))

ipcMain.handle('window:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  window?.minimize()
})

ipcMain.handle('window:toggle-maximize', (event) => {
  if (!window) return false

  if (window.isMaximized()) {
    window.unmaximize()
    return false
  }

  window.maximize()
  return true
})

ipcMain.handle('window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  window?.close()
})

ipcMain.handle('window:is-maximized', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  return window?.isMaximized() ?? false
})

async function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 980,
    minWidth: 980,
    minHeight: 720,
    title: 'Parko',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(rootDir, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const notifyWindowState = () => {
    window.webContents.send('window-state-changed', window.isMaximized())
  }

  window.on('maximize', notifyWindowState)
  window.on('unmaximize', notifyWindowState)
  window.on('restore', notifyWindowState)
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url)
    return { action: 'deny' }
  })
  await window.loadURL(appUrl)
  notifyWindowState()
}

app.whenReady().then(() => {
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
