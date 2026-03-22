// Screen watch polling loop
// Captures every 2s, diffs frames at reduced scale, fires onTrigger when meaningful change detected

const DIFF_WIDTH  = 320
const DIFF_HEIGHT = 180
const PIXEL_DELTA = 25

// ── GAME MODE ──────────────────────────────────────────────────────────────────
let DESK_CONFIG = { pollMs: 2000, diffThreshold: 0.12, cooldownMs: 28000 }
const GAME_CONFIG = { pollMs: 1000, diffThreshold: 0.04, cooldownMs: 6000, forceTriggerMs: 18000 }

// Sensitivity → diffThreshold mapping
const SENSITIVITY_MAP = { low: 0.18, medium: 0.12, high: 0.07 }
// Reaction frequency → cooldownMs mapping
const FREQUENCY_MAP   = { relaxed: 45000, normal: 28000, frequent: 15000 }

/** Apply user-configured desktop settings (called on mount from ScreenWatch component) */
export function setDeskConfig({ reactionFrequency, screenSensitivity } = {}) {
  if (reactionFrequency && FREQUENCY_MAP[reactionFrequency])
    DESK_CONFIG = { ...DESK_CONFIG, cooldownMs: FREQUENCY_MAP[reactionFrequency] }
  if (screenSensitivity && SENSITIVITY_MAP[screenSensitivity])
    DESK_CONFIG = { ...DESK_CONFIG, diffThreshold: SENSITIVITY_MAP[screenSensitivity] }
  // If currently in desk mode and running, restart with new config
  if (cfg !== GAME_CONFIG && intervalId != null && _onTrigger) {
    cfg = DESK_CONFIG
    clearInterval(intervalId)
    intervalId = setInterval(() => tick(_onTrigger), cfg.pollMs)
  } else if (cfg !== GAME_CONFIG) {
    cfg = DESK_CONFIG
  }
}
let cfg = DESK_CONFIG

// Rolling buffer of recent frame dataURLs — populated only in game mode
const FRAME_BUFFER_SIZE = 3
let frameBuffer = []
export function getFrameBuffer() { return frameBuffer.slice() }

// Forced reaction timer — fires regardless of diff (catches slow games like chess)
let forceIntervalId   = null
let lastTriggerTime   = 0

export function setGameMode(on) {
  cfg = on ? GAME_CONFIG : DESK_CONFIG
  if (!on) {
    frameBuffer = []
    if (forceIntervalId != null) { clearInterval(forceIntervalId); forceIntervalId = null }
  }
  if (intervalId != null && _onTrigger) {
    clearInterval(intervalId)
    cooldownUntil = 0
    intervalId = setInterval(() => tick(_onTrigger), cfg.pollMs)
    if (on) startForceTimer(_onTrigger)
  }
}

function startForceTimer(onTrigger) {
  if (forceIntervalId != null) clearInterval(forceIntervalId)
  forceIntervalId = setInterval(async () => {
    if (busy || paused) return
    const now = Date.now()
    if (now - lastTriggerTime < cfg.forceTriggerMs) return
    const dataURL = await window.tetoAPI.captureScreen().catch(() => null)
    if (!dataURL) return
    lastTriggerTime = now
    cooldownUntil = now + cfg.cooldownMs
    onTrigger(dataURL).catch((e) => console.error('[screenWatch] force trigger error:', e))
  }, cfg.forceTriggerMs)
}
// ── END GAME MODE ──────────────────────────────────────────────────────────────

let intervalId    = null
let _onTrigger    = null
let lastPixels    = null
let cooldownUntil = 0
let busy          = false
let paused        = false

export function pauseScreenWatch()  { paused = true }
export function resumeScreenWatch() { paused = false }

// Draw a dataURL into a small canvas and return its pixel array
function toPixels(dataURL, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(ctx.getImageData(0, 0, w, h).data)
    }
    img.onerror = reject
    img.src = dataURL
  })
}

// Returns fraction of pixels that changed between two pixel arrays
function diffFraction(a, b, totalPixels) {
  let changed = 0
  for (let i = 0; i < a.length; i += 4) {
    if (
      Math.abs(a[i]   - b[i])   > PIXEL_DELTA ||
      Math.abs(a[i+1] - b[i+1]) > PIXEL_DELTA ||
      Math.abs(a[i+2] - b[i+2]) > PIXEL_DELTA
    ) changed++
  }
  return changed / totalPixels
}

async function tick(onTrigger) {
  if (busy || paused) return
  busy = true

  try {
    const dataURL = await window.tetoAPI.captureScreen()
    if (!dataURL) return

    const pixels = await toPixels(dataURL, DIFF_WIDTH, DIFF_HEIGHT)
    const now    = Date.now()

    // ── GAME MODE: collect frames for multi-frame context ─────────────────────
    if (cfg === GAME_CONFIG) {
      frameBuffer.push(dataURL)
      if (frameBuffer.length > FRAME_BUFFER_SIZE) frameBuffer.shift()
    }
    // ── END GAME MODE ──────────────────────────────────────────────────────────

    if (lastPixels) {
      const frac = diffFraction(lastPixels, pixels, DIFF_WIDTH * DIFF_HEIGHT)
      if (frac >= cfg.diffThreshold && now >= cooldownUntil) {
        cooldownUntil = now + cfg.cooldownMs
        lastTriggerTime = now  // ── GAME MODE: suppress force trigger right after a real one
        lastPixels = pixels
        // Fire without awaiting — don't block next tick
        onTrigger(dataURL).catch((e) => console.error('[screenWatch] trigger error:', e))
        return
      }
    }

    lastPixels = pixels
  } catch (err) {
    console.error('[screenWatch] tick error:', err)
  } finally {
    busy = false
  }
}

/**
 * Start polling. onTrigger(dataURL) is called when a meaningful change is detected.
 * Returns the first screenshot dataURL so callers can fire a startup reaction.
 */
export async function start(onTrigger) {
  stop() // clear any existing loop

  // Grab initial frame (don't diff against anything — just prime the buffer)
  const firstDataURL = await window.tetoAPI.captureScreen().catch(() => null)
  if (firstDataURL) {
    lastPixels = await toPixels(firstDataURL, DIFF_WIDTH, DIFF_HEIGHT).catch(() => null)
  }

  _onTrigger = onTrigger
  intervalId = setInterval(() => tick(onTrigger), cfg.pollMs)
  if (cfg === GAME_CONFIG) startForceTimer(onTrigger)  // ── GAME MODE

  return firstDataURL
}

/** Stop the polling loop */
export function stop() {
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
  _onTrigger    = null
  lastPixels    = null
  cooldownUntil = 0
  busy          = false
  frameBuffer   = []      // ── GAME MODE: clear on stop
  lastTriggerTime = 0
  if (forceIntervalId != null) {  // ── GAME MODE: kill force timer
    clearInterval(forceIntervalId)
    forceIntervalId = null
  }
}

/** Force a cooldown reset (e.g. after a manual reaction so screen watch doesn't pile on) */
export function resetCooldown() {
  cooldownUntil = Date.now() + cfg.cooldownMs
}
