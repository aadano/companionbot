const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tetoAPI', {
  // ── Screen capture (Phase 3) ───────────────────────────────────────────────
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // ── API keys (available in renderer without exposing Node) ────────────────
  getEnv: () => ipcRenderer.invoke('get-env'),

  // ── Emotion updates: main → renderer ─────────────────────────────────────
  // Payload: { emotion?: string, talking?: boolean }
  // Emotions: 'idle' | 'happy' | 'annoyed' | 'surprised' | 'smug' | 'sad'
  onSetEmotion: (callback) =>
    ipcRenderer.on('set-emotion', (_event, payload) => callback(payload)),

  removeEmotionListener: () =>
    ipcRenderer.removeAllListeners('set-emotion'),

  // ── Chat history window ───────────────────────────────────────────────────
  openChatHistory: () => ipcRenderer.invoke('open-chat-history'),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings:     ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:    (data)   => ipcRenderer.invoke('save-settings', data),
  reloadRenderer:  ()       => ipcRenderer.invoke('reload-renderer'),
  openSettings:    ()       => ipcRenderer.invoke('open-settings'),
  applyAppearance:    (data) => ipcRenderer.invoke('apply-appearance', data),
  onSetUiOpacity:     (cb)  => ipcRenderer.on('set-ui-opacity', (_, v) => cb(v)),
  removeUiOpacityListener:  () => ipcRenderer.removeAllListeners('set-ui-opacity'),
  onToggleMute:       (cb)  => ipcRenderer.on('toggle-mute', cb),
  removeToggleMuteListener: () => ipcRenderer.removeAllListeners('toggle-mute'),
  quit:               ()    => ipcRenderer.invoke('quit-app'),
  syncMuteState:      (m)   => ipcRenderer.invoke('sync-mute-state', m),
})
