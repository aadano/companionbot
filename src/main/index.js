import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron'
import { join } from 'path'

// electron-vite injects .env vars into process.env automatically in dev mode

let mainWindow

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 300,
    height: 420,
    x: width - 320,
    y: height - 440,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setContentProtection(false)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIPC() {
  // ── Screen Capture (Phase 3) ───────────────────────────────────────────────
  ipcMain.handle('capture-screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 }
    })
    const primary = sources[0]
    if (!primary) return null
    return primary.thumbnail.toDataURL()
  })

  // ── Expose env vars to renderer safely ────────────────────────────────────
  ipcMain.handle('get-env', () => ({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FISH_API_KEY: process.env.FISH_API_KEY,
    FISH_REFERENCE_ID: process.env.FISH_REFERENCE_ID
  }))

  // ── Audio state relay (Phase 2) ───────────────────────────────────────────
  ipcMain.on('audio-started', () => {
    mainWindow?.webContents.send('set-expression', 'talking')
  })
  ipcMain.on('audio-ended', () => {
    mainWindow?.webContents.send('set-expression', 'idle')
  })
}

app.whenReady().then(() => {
  registerIPC()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
