import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('tetoAPI', {
  // ── Screen capture (Phase 3) ───────────────────────────────────────────────
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // ── Env vars (keys available in renderer without exposing Node) ───────────
  getEnv: () => ipcRenderer.invoke('get-env'),

  // ── Audio state → main (Phase 2) ─────────────────────────────────────────
  notifyAudioStarted: () => ipcRenderer.send('audio-started'),
  notifyAudioEnded: () => ipcRenderer.send('audio-ended'),

  // ── Expression updates: main → renderer (Phase 2/3) ──────────────────────
  onSetExpression: (callback) =>
    ipcRenderer.on('set-expression', (_event, expression) => callback(expression)),

  removeExpressionListener: () =>
    ipcRenderer.removeAllListeners('set-expression')
})
