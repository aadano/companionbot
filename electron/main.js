const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { loadConfig, saveConfig } = require('./store')

// Apply stored config over .env — stored values take precedence in production
;(function applyStoredConfig() {
  const stored = loadConfig()
  for (const [k, v] of Object.entries(stored)) {
    if (v) process.env[k] = v
  }
})()

const isDev = process.env.NODE_ENV !== 'production'

let mainWindow
let historyWindow
let settingsWindow
let tray = null
let muteState = false

// ── Settings window helper ─────────────────────────────────────────────────────
function openOrFocusSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); return }
  settingsWindow = new BrowserWindow({
    width: 420, height: 600,
    title: 'Teto Settings',
    frame: false, transparent: false, alwaysOnTop: true, resizable: false,
    backgroundColor: '#0a0814',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false }
  })
  settingsWindow.on('closed', () => { settingsWindow = null })
  if (isDev) settingsWindow.loadURL('http://localhost:5173?view=settings')
  else settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { view: 'settings' } })
}

// ── Tray ───────────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: muteState ? 'Unmute Teto' : 'Mute Teto',
      click: () => {
        muteState = !muteState
        mainWindow?.webContents.send('toggle-mute')
        tray.setContextMenu(buildTrayMenu())
      }
    },
    { type: 'separator' },
    { label: 'Settings', click: openOrFocusSettings },
    { label: 'Quit', click: () => app.quit() }
  ])
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/sprites/idle.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 })
    else icon = nativeImage.createEmpty()
  } catch {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)
  tray.setToolTip('Teto')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const stored = loadConfig()

  const defaultX = width - 320
  const defaultY = height - 450

  mainWindow = new BrowserWindow({
    width: 300,
    height: 430,
    x: stored.windowX ?? defaultX,
    y: stored.windowY ?? defaultY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: stored.alwaysOnTop !== false,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  mainWindow.setBackgroundColor('#00000000')
  mainWindow.setContentProtection(false)

  // Save position whenever the window is moved
  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition()
    saveConfig({ windowX: x, windowY: y })
  })

  // Global hotkeys
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    muteState = !muteState
    mainWindow?.webContents.send('toggle-mute')
    tray?.setContextMenu(buildTrayMenu())
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIPC() {
  // ── Screen capture ─────────────────────────────────────────────────────────
  ipcMain.handle('capture-screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 }
    })
    if (!sources[0]) return null
    return sources[0].thumbnail.toDataURL()
  })

  // ── Env / API keys (cached by renderer services) ───────────────────────────
  ipcMain.handle('get-env', () => {
    const stored = loadConfig()
    return {
      // API keys
      ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY:    stored.GEMINI_API_KEY    || process.env.GEMINI_API_KEY,
      FISH_API_KEY:      stored.FISH_API_KEY      || process.env.FISH_API_KEY,
      FISH_REFERENCE_ID: stored.FISH_REFERENCE_ID || process.env.FISH_REFERENCE_ID,
      OPENAI_API_KEY:    stored.OPENAI_API_KEY    || process.env.OPENAI_API_KEY,
      TAVILY_API_KEY:    stored.TAVILY_API_KEY    || process.env.TAVILY_API_KEY,
      // Behavior settings (read fresh each reload)
      REACTION_FREQUENCY:   stored.reactionFrequency  || 'normal',
      SCREEN_WATCH_ENABLED: stored.screenWatchEnabled !== false,
      SCREEN_SENSITIVITY:   stored.screenSensitivity  || 'medium',
      GAME_INTENSITY:       stored.gameIntensity       || 'standard',
      WINDOW_OPACITY:       stored.windowOpacity       ?? 1,
    }
  })

  // ── Settings: read (returns raw stored values for the UI) ──────────────────
  ipcMain.handle('get-settings', () => {
    const stored = loadConfig()
    return {
      ANTHROPIC_API_KEY: stored.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      GEMINI_API_KEY:    stored.GEMINI_API_KEY    || process.env.GEMINI_API_KEY    || '',
      FISH_API_KEY:      stored.FISH_API_KEY      || process.env.FISH_API_KEY      || '',
      FISH_REFERENCE_ID: stored.FISH_REFERENCE_ID || process.env.FISH_REFERENCE_ID || '',
      OPENAI_API_KEY:    stored.OPENAI_API_KEY    || process.env.OPENAI_API_KEY    || '',
      TAVILY_API_KEY:    stored.TAVILY_API_KEY    || process.env.TAVILY_API_KEY    || '',
      reactionFrequency:  stored.reactionFrequency  ?? 'normal',
      screenWatchEnabled: stored.screenWatchEnabled ?? true,
      screenSensitivity:  stored.screenSensitivity  ?? 'medium',
      gameIntensity:      stored.gameIntensity       ?? 'standard',
      windowOpacity:      stored.windowOpacity       ?? 1,
      alwaysOnTop:        stored.alwaysOnTop         ?? true,
      resizable:          false,
      loginItemStartup:   app.getLoginItemSettings().openAtLogin,
    }
  })

  // ── Settings: write ────────────────────────────────────────────────────────
  ipcMain.handle('save-settings', (_event, updates) => {
    const allowedKeys  = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'FISH_API_KEY', 'FISH_REFERENCE_ID', 'OPENAI_API_KEY', 'TAVILY_API_KEY']
    const allowedBools = ['screenWatchEnabled', 'alwaysOnTop', 'loginItemStartup']
    const allowedStr   = ['reactionFrequency', 'screenSensitivity', 'gameIntensity']
    const allowedNum   = ['windowOpacity']
    const safe = {}
    for (const k of allowedKeys)  if (typeof updates[k] === 'string')  safe[k] = updates[k].trim()
    for (const k of allowedBools) if (typeof updates[k] === 'boolean') safe[k] = updates[k]
    for (const k of allowedStr)   if (typeof updates[k] === 'string')  safe[k] = updates[k]
    for (const k of allowedNum)   if (typeof updates[k] === 'number')  safe[k] = updates[k]
    if (typeof safe.loginItemStartup === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: safe.loginItemStartup })
      delete safe.loginItemStartup  // don't persist — OS owns this
    }
    saveConfig(safe)
    for (const [k, v] of Object.entries(safe)) {
      if (typeof v === 'string' && v) process.env[k] = v
    }
    return { ok: true }
  })

  // ── Appearance: apply immediately (no reload) ──────────────────────────────
  ipcMain.handle('apply-appearance', (_event, { opacity, alwaysOnTop, resizable }) => {
    if (opacity     != null) mainWindow?.webContents.send('set-ui-opacity', Math.min(1, Math.max(0.1, opacity)))
    if (alwaysOnTop != null) mainWindow?.setAlwaysOnTop(!!alwaysOnTop)
    if (resizable   != null) mainWindow?.setResizable(!!resizable)
  })

  // ── Reload main renderer (flushes envCache in all services) ───────────────
  ipcMain.handle('reload-renderer', () => {
    mainWindow?.webContents.reload()
  })

  // ── Quit ───────────────────────────────────────────────────────────────────
  ipcMain.handle('quit-app', () => {
    app.quit()
  })

  // ── Sync mute state from renderer (keeps tray label accurate) ─────────────
  ipcMain.handle('sync-mute-state', (_event, muted) => {
    muteState = !!muted
    tray?.setContextMenu(buildTrayMenu())
  })

  // ── Chat history window ───────────────────────────────────────────────────
  ipcMain.handle('open-chat-history', () => {
    if (historyWindow && !historyWindow.isDestroyed()) { historyWindow.focus(); return }
    historyWindow = new BrowserWindow({
      width: 340, height: 480,
      title: 'Chat History',
      frame: false, transparent: true, alwaysOnTop: true, resizable: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false }
    })
    historyWindow.on('closed', () => { historyWindow = null })
    if (isDev) historyWindow.loadURL('http://localhost:5173?view=history')
    else historyWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { view: 'history' } })
  })

  // ── Settings window ───────────────────────────────────────────────────────
  ipcMain.handle('open-settings', openOrFocusSettings)
}

function sendEmotion(emotion, talking = false) {
  mainWindow?.webContents.send('set-emotion', { emotion, talking })
}

app.whenReady().then(() => {
  registerIPC()
  createWindow()
  createTray()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// App lives in the tray — don't quit when windows are closed
app.on('window-all-closed', () => {
  // intentionally empty — quit only via tray menu or quit button
})

module.exports = { sendEmotion }
