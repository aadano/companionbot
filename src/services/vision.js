// Claude Haiku Vision — screen reaction service
// Drop-in replacement for gemini.js: same reactToScreen() signature
// To activate: change the import in ScreenWatch.jsx from './gemini' to './vision'
//
// Why Claude over Gemini:
//   - reliable JSON output (no sanitizeJsonLiteral needed)
//   - follows complex system prompts without echoing examples
//   - better emotion range adherence
//   - same speed profile as Gemini Flash for short responses

import { TETO_SYSTEM_PROMPT } from '../prompts/teto.js'

const MODEL   = 'claude-haiku-4-5-20251001'
const API_URL = 'https://api.anthropic.com/v1/messages'

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

function parseDataURL(dataURL) {
  const comma = dataURL.indexOf(',')
  const base64 = dataURL.slice(comma + 1)
  const match = dataURL.slice(0, comma).match(/data:([^;]+)/)
  return { base64, mediaType: match ? match[1] : 'image/png' }
}

function parseTetoResponse(raw) {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  try {
    const obj = JSON.parse(text)
    if (obj?.text && obj?.emotion) return obj
  } catch {}
  const match = text.match(/\{[\s\S]*?\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj?.text && obj?.emotion) return obj
    } catch {}
  }
  console.warn('[vision] could not parse response:', raw)
  return null
}

export async function reactToScreen(dataURL, recentReactions = [], gameMode = false, frameBuffer = []) {
  const { ANTHROPIC_API_KEY } = await getEnv()
  if (!ANTHROPIC_API_KEY) {
    console.error('[vision] ANTHROPIC_API_KEY not set')
    return null
  }

  const { GAME_INTENSITY } = await getEnv()

  const contextNote = recentReactions.length > 0
    ? `\nYour last ${recentReactions.length} reaction(s) — each new reaction must take a completely different angle, topic, and emotion from all of these:\n${recentReactions.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : ''

  // ── GAME MODE ────────────────────────────────────────────────────────────────
  const useMultiFrame = gameMode && frameBuffer.length > 1

  const gameModeNote = gameMode
    ? `\nGame mode: the user is playing a game. Keep reactions to 1 sentence max — no padding. Always react — no silent.${GAME_INTENSITY === 'ruthless' ? ' Ruthless mode: be more blunt and dramatic about failures, but stay in good fun — no hostility.' : GAME_INTENSITY === 'chill' ? ' Chill mode: keep it very relaxed and encouraging.' : ''}\n\nYou're a friend watching over their shoulder who genuinely wants them to win. Stay warm and on their side throughout — never hostile, never cruel. React to what's happening with real feeling: get excited when things go well, wince sympathetically at mistakes, tease lightly when something was avoidable. The teasing should feel like a friend, not an enemy.\n\nEmotion scale:\n- going well, big win → happy, surprised\n- doing well, feeling yourself → smug\n- small mistake, avoidable error → oops or annoyed (light, not mean)\n- rough patch, things falling apart → concerned or mortified (sympathetic)\n- hopelessly losing → sad (gentle, not mocking)\n\nVary your angle every reaction — different observation, different tone.${useMultiFrame ? ' You are seeing ' + frameBuffer.length + ' sequential screenshots — react to what changed.' : ''}`
    : ''
  // ── END GAME MODE ─────────────────────────────────────────────────────────────

  // ── GAME MODE: multi-frame image blocks ───────────────────────────────────────
  const imageBlocks = useMultiFrame
    ? frameBuffer.map((url) => {
        const { base64: b, mediaType: m } = parseDataURL(url)
        return { type: 'image', source: { type: 'base64', media_type: m, data: b } }
      })
    : (() => {
        const { base64, mediaType } = parseDataURL(dataURL)
        return [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }]
      })()
  // ── END GAME MODE ──────────────────────────────────────────────────────────────

  const userText = `What's on screen? React as Teto. Output ONLY raw JSON: {"emotion":"...","text":"..."}${gameModeNote}${contextNote}`

  // ── GAME MODE: intensity → temperature ───────────────────────────────────────
  const intensityTemp = { chill: 0.7, standard: 0.92, ruthless: 1.0 }
  const temperature = gameMode
    ? (intensityTemp[GAME_INTENSITY] ?? 0.92)
    : 0.85
  // ── END GAME MODE ──────────────────────────────────────────────────────────

  const body = {
    model: MODEL,
    max_tokens: gameMode ? 80 : 150,  // ── GAME MODE: shorter = faster generation + faster TTS
    temperature,
    system: TETO_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: userText }
      ]
    }]
  }

  try {
    const res = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }, 12000)

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      console.error(`[vision] ${res.status}:`, msg)
      return null
    }

    const json = await res.json()
    const raw = json?.content?.[0]?.text ?? null

    if (!raw) {
      console.warn('[vision] empty response', JSON.stringify(json))
      return null
    }

    return parseTetoResponse(raw)
  } catch (err) {
    console.error('[vision] fetch error:', err)
    return null
  }
}
