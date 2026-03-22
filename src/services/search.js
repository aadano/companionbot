// Tavily web search — optional feature, no-ops gracefully if key is absent

const TAVILY_URL = 'https://api.tavily.com/search'

let envCache = null
async function getEnv() {
  if (!envCache) envCache = await window.tetoAPI.getEnv()
  return envCache
}

export async function hasTavilyKey() {
  const { TAVILY_API_KEY } = await getEnv()
  return !!TAVILY_API_KEY
}

/**
 * Search the web for a query. Returns a compact context string, or null if
 * no key is configured or the search fails.
 */
export async function searchWeb(query) {
  const { TAVILY_API_KEY } = await getEnv()
  if (!TAVILY_API_KEY) return null

  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      })
    })

    if (!res.ok) {
      console.warn('[search] Tavily error:', res.status)
      return null
    }

    const data = await res.json()
    const parts = []
    if (data.answer) parts.push(`Summary: ${data.answer}`)
    for (const r of (data.results || []).slice(0, 3)) {
      const snippet = (r.content || '').slice(0, 250)
      if (snippet) parts.push(`• ${r.title}: ${snippet}`)
    }
    return parts.length ? parts.join('\n') : null
  } catch (err) {
    console.warn('[search] fetch error:', err)
    return null
  }
}
