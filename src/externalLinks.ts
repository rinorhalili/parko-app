function isWebUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isElectronEnvironment() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

export function handleOpenExternal(url: string) {
  if (!isWebUrl(url)) {
    console.error('Refusing to open invalid external URL:', url)
    return Promise.resolve(false)
  }

  if (isElectronEnvironment() && window.electronAPI?.openExternal) {
    return window.electronAPI.openExternal(url)
  }

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
  if (!openedWindow) {
    console.error('The browser blocked opening the external URL:', url)
    return Promise.resolve(false)
  }

  return Promise.resolve(true)
}
