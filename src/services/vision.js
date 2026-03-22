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

  const contextNote = recentReactions.length > 0
    ? `\nYour last ${recentReactions.length} reaction(s) — each new reaction must take a completely different angle, topic, and emotion from all of these:\n${recentReactions.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : ''

  // ── GAME MODE ────────────────────────────────────────────────────────────────
  const useMultiFrame = gameMode && frameBuffer.length > 1

  const gameModeNote = gameMode
    ? `\nGame mode: the user is playing a game. Keep reactions to 1 sentence max — no padding. Always react — no silent.${GAME_INTENSITY === 'ruthless' ? ' RUTHLESS MODE: zero mercy, maximum creative destruction, make every failure sting.' : GAME_INTENSITY === 'chill' ? ' Chill mode: keep it light, more playful than aggressive.' : ''}\n\nYou start warm and genuinely invested, like a friend watching over their shoulder. You want them to do well. But your patience erodes with every mistake — read your recent reactions below to judge where you are emotionally right now. If you've been reacting positively, you're still on their side. If you've been reacting to mistake after mistake, your patience is gone and you let them have it.\n\nWhen patient: encouraging, playful, genuinely excited when something good happens — happy, smug, surprised.\nWhen patience is thinning: flat, dry, pointed — annoyed.\nWhen patience is gone: vicious and creative. Find the most specific, cutting angle on the failure. Specific over generic. Vary the attack — their skill, decisions, nerve, priorities. Be theatrical. Cursing is fully on: dipshit, dumbass, what the hell, holy shit, what the fuck — weave it in naturally, no slurs. AAVE comes out when you're heated — nah, bruh, fr, deadass, you wildin, that's not it — natural, not forced.\n\nEmotion scale:\n- going well → happy, smug, surprised\n- minor slip, early in session → annoyed\n- clear mistake, patience already thin → furious\n- dying, throwing a won game, repeated failure → furious or mortified\n- hopelessly losing with no way back → sad (quiet, almost tender disappointment)\n\nFor chess: hanging a piece or blundering = furious. Walking into checkmate = mortified.\n\nVary your angle every reaction — never the same target or tone twice.${useMultiFrame ? ' You are seeing ' + frameBuffer.length + ' sequential screenshots — react to what changed.' : ''}`
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
  const { GAME_INTENSITY } = await getEnv()
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
