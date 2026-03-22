// Claude Sonnet — direct chat with Teto
// Maintains conversation history externally; caller passes it in and gets updated version back

import { TETO_SYSTEM_PROMPT } from '../prompts/teto.js'

const MODEL = 'claude-sonnet-4-6'
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

function parseTetoResponse(raw) {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  try {
    const obj = JSON.parse(text)
    if (obj?.text && obj?.emotion) return obj
  } catch {}
  const match = text.match(/\{[\s\S]*?"emotion"[\s\S]*?"text"[\s\S]*?\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj?.text && obj?.emotion) return obj
    } catch {}
  }
  // Last resort: treat the whole raw text as Teto's spoken line
  return { emotion: 'idle', text: raw.trim() }
}

/**
 * Send a user message to Claude and get Teto's response.
 * @param {Array<{role:string, content:string}>} history - Prior messages
 * @param {string} userMessage - What the user typed
 * @param {string|null} screenshotDataURL - Current screen capture (optional)
 * @returns {Promise<{emotion: string, text: string, history: Array}>}
 */
export async function chat(history, userMessage, screenshotDataURL = null) {
  const { ANTHROPIC_API_KEY } = await getEnv()
  if (!ANTHROPIC_API_KEY) {
    console.error('[claude] ANTHROPIC_API_KEY not set')
    return { emotion: 'annoyed', text: '[flat] something went wrong with my brain.', history }
  }

  // Build current user message — include screenshot if available
  let userContent
  if (screenshotDataURL) {
    const comma = screenshotDataURL.indexOf(',')
    const mediaType = screenshotDataURL.slice(5, comma).replace(';base64', '')
    const base64 = screenshotDataURL.slice(comma + 1)
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: userMessage }
    ]
  } else {
    userContent = userMessage
  }

  const messages = [
    ...history,
    { role: 'user', content: userContent }
  ]

  try {
    const res = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 250,
        system: TETO_SYSTEM_PROMPT,
        messages
      })
    }, 12000)

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      console.error(`[claude] ${res.status}:`, msg)
      return { emotion: 'annoyed', text: '[sighing] something broke.', history }
    }

    const json = await res.json()
    const raw = json?.content?.[0]?.text ?? ''
    const parsed = parseTetoResponse(raw)

    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: raw }
    ]

    return { ...parsed, history: updatedHistory }
  } catch (err) {
    console.error('[claude] fetch error:', err)
    return { emotion: 'annoyed', text: '[flat] network error or something.', history }
  }
}
