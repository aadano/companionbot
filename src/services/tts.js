// Fish Audio S2 TTS service + audio queue
// Usage: speak(text, { onStart, onEnd })
//   onStart() → called when audio begins playing
//   onEnd()   → called when audio finishes (or errors)

const FISH_API_URL = 'https://api.fish.audio/v1/tts'

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

let envCache = null
async function getEnv() {
  if (!envCache) envCache = await window.tetoAPI.getEnv()
  return envCache
}

// ── Audio queue ───────────────────────────────────────────────────────────────

let isPlaying   = false
let currentAudio = null   // held here so it isn't GC'd and can be stopped
const queue = []

function processQueue() {
  if (isPlaying || queue.length === 0) return

  const { url, onStart, onEnd } = queue.shift()
  isPlaying = true

  const audio = new Audio(url)
  currentAudio = audio

  audio.onplay = () => { onStart?.() }

  const finish = () => {
    URL.revokeObjectURL(url)
    isPlaying    = false
    currentAudio = null
    onEnd?.()
    processQueue()
  }

  audio.onended = finish
  audio.onerror = (e) => {
    console.error('[tts] audio playback error', e)
    finish()
  }

  audio.play().catch((e) => {
    console.error('[tts] audio.play() rejected', e)
    finish()
  })
}

// ── Fish Audio synthesis ──────────────────────────────────────────────────────

async function synthesize(text) {
  const { FISH_API_KEY, FISH_REFERENCE_ID } = await getEnv()

  if (!FISH_API_KEY) throw new Error('[tts] FISH_API_KEY is not set')

  const body = {
    text,
    format: 'wav',   // mp3 requires proprietary codec not bundled with Electron
    model_id: 's2-pro',
  }
  if (FISH_REFERENCE_ID) body.reference_id = FISH_REFERENCE_ID

  const response = await fetchWithTimeout(FISH_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, 20000)

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText)
    throw new Error(`[tts] Fish Audio ${response.status}: ${msg}`)
  }

  const blob = await response.blob()
  console.log('[tts] synthesized', blob.size, 'bytes', blob.type)
  return URL.createObjectURL(blob)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synthesize text and queue it for playback.
 * @param {string} text - Text with optional S2 inline tags e.g. "[flat] whatever"
 * @param {{ onStart?: () => void, onEnd?: () => void }} callbacks
 */
export async function speak(text, { onStart, onEnd } = {}) {
  console.log('[tts] speak() called:', text.slice(0, 60))
  try {
    const url = await synthesize(text)
    queue.push({ url, onStart, onEnd })
    processQueue()
  } catch (err) {
    console.error('[tts] synthesis failed:', err)
    onEnd?.()
  }
}

/**
 * Stop current playback and clear the queue.
 * Safe to call at any time — resets isPlaying so future speak() calls work.
 */
export function clearQueue() {
  queue.length = 0
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio = null
  }
  isPlaying = false
}
