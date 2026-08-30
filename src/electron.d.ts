declare global {
  interface Window {
    electronAPI?: {
      platform: string
      openExternal: (url: string) => Promise<boolean>
      windowControls: {
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<boolean>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        onChange: (callback: (state: boolean) => void) => () => void
      }
    }
  }
}

export {}
