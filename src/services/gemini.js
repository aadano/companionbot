// Gemini Flash Vision — reads a screenshot and generates a Teto reaction
// Returns: { emotion: string, text: string } | null

import { TETO_SYSTEM_PROMPT } from '../prompts/teto.js'

const MODEL = 'gemini-2.5-flash'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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
  const header = dataURL.slice(0, comma)
  const base64 = dataURL.slice(comma + 1)
  const match = header.match(/data:([^;]+)/)
  return { base64, mimeType: match ? match[1] : 'image/png' }
}

function sanitizeJsonLiteral(s) {
  // Replace literal newlines/tabs inside JSON string values so JSON.parse doesn't choke
  let out = ''
  let inString = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"' && (i === 0 || s[i - 1] !== '\\')) {
      inString = !inString
      out += ch
    } else if (inString && ch === '\n') {
      out += '\\n'
    } else if (inString && ch === '\r') {
      out += '\\r'
    } else if (inString && ch === '\t') {
      out += '\\t'
    } else {
      out += ch
    }
  }
  return out
}

function parseTetoResponse(raw) {
  const text = sanitizeJsonLiteral(raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, ''))
  try {
    const obj = JSON.parse(text)
    if (obj?.text && obj?.emotion) return obj
  } catch {}
  // Handle any key order
  const match = text.match(/\{[\s\S]*?\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj?.text && obj?.emotion) return obj
    } catch {}
  }
  console.warn('[gemini] could not parse response:', raw)
  return null
}

// Gemini 2.5 thinking parts have thought:true — skip them, read actual response
function extractResponseText(parts = []) {
  const responsePart = parts.find((p) => !p.thought && p.text != null)
  return responsePart?.text ?? null
}

export async function reactToScreen(dataURL, recentReactions = [], gameMode = false, frameBuffer = []) {
  const { GEMINI_API_KEY } = await getEnv()
  if (!GEMINI_API_KEY) {
    console.error('[gemini] GEMINI_API_KEY not set')
    return null
  }

  const { base64, mimeType } = parseDataURL(dataURL)

  const contextNote = recentReactions.length > 0
    ? `\nYour last ${recentReactions.length} reaction(s) — each new reaction must take a completely different angle, topic, and emotion from all of these:\n${recentReactions.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : ''

  // ── GAME MODE ────────────────────────────────────────────────────────────────
  const useMultiFrame = gameMode && frameBuffer.length > 1

  const gameModeNote = gameMode
    ? `\nGame mode: the user is playing a game.\n\nOverride the silent rule — always react. Even a calm moment has texture worth commenting on.\n\nDo NOT default to annoyed or sarcastic. That is the lazy answer. You are emotionally present — the gameplay actually lands on you. Use the real emotion the situation calls for:\n- tiny slip → annoyed\n- actual blunder, obvious mistake, wasted opportunity → furious\n- hopelessly losing, quietly falling apart → sad or pensive\n- catastrophic self-destruction → mortified\n- somehow did something right → smug (reluctantly)\nIf you keep picking annoyed, you are doing it wrong.\n\nFor chess specifically: read the board — material count, who controls the center, whether they're in check, clock if visible, whether a move looks like a mistake. A bad trade or hanging piece is worth being furious about.\n\nVary your angle every reaction. Never comment on the same thing twice in a row.${useMultiFrame ? ' You are seeing ' + frameBuffer.length + ' sequential screenshots — react to what changed.' : ''}`
    : ''
  // ── END GAME MODE ─────────────────────────────────────────────────────────────

  // ── GAME MODE: multi-frame image parts ────────────────────────────────────────
  const imageParts = useMultiFrame
    ? frameBuffer.map((url) => {
        const { base64: b, mimeType: m } = parseDataURL(url)
        return { inline_data: { mime_type: m, data: b } }
      })
    : [{ inline_data: { mime_type: mimeType, data: base64 } }]
  // ── END GAME MODE ──────────────────────────────────────────────────────────────

  const userText = `What's on screen? React as Teto. Output ONLY raw JSON: {"emotion":"...","text":"..."}${gameModeNote}${contextNote}`

  const body = {
    system_instruction: { parts: [{ text: TETO_SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [
        ...imageParts,
        { text: userText }
      ]
    }],
    generationConfig: {
      temperature: gameMode ? 0.92 : 0.85,  // ── GAME MODE: slightly more varied
      maxOutputTokens: 150,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }  // disable thinking — faster + cleaner output
    }
  }

  const url = `${API_BASE}/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 12000)

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      console.error(`[gemini] ${res.status}:`, msg)
      return null
    }

    const json = await res.json()
    const parts = json?.candidates?.[0]?.content?.parts ?? []
    const raw = extractResponseText(parts)

    if (!raw) {
      console.warn('[gemini] no response part found', JSON.stringify(json?.candidates?.[0]))
      return null
    }

    return parseTetoResponse(raw)
  } catch (err) {
    console.error('[gemini] fetch error:', err)
    return null
  }
}
