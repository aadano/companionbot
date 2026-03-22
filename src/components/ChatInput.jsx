import React, { useState, useRef, useEffect } from 'react'
import { useTeto } from '../App.jsx'
import { chat } from '../services/claude.js'
import { resetCooldown, pauseScreenWatch, resumeScreenWatch } from '../services/screenWatch.js'
import { hasTavilyKey, searchWeb } from '../services/search.js'
import { startRecording, stopRecording, transcribe } from '../services/voice.js'
import '../styles/ChatInput.css'

const SCREEN_KEYWORDS = /\b(look|see|screen|this|that|here|these|those|read|solve|check|show|what('?s| is| are)( on| this| that| here)?|can you (see|look|read|help)|help me (with|solve|read|understand)|do you see|what do you think of (this|that))\b/i
const SEARCH_TRIGGER  = /\b(look\s+up|search\s+(for\s+)?|google|find\s+out(\s+about)?|what'?s\s+the\s+(latest|news)\s+(on|about)|tell\s+me\s+about)\b/i

function needsScreenContext(text) {
  return SCREEN_KEYWORDS.test(text)
}

function stripTags(t) {
  return t.replace(/\[.*?\]/g, '').replace(/\n+/g, ' ').trim()
}

export default function ChatInput() {
  const { tetoSpeak, tetoInterrupt, tetoFlash, appendLog } = useTeto()
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [errorMsg, setErrorMsg]       = useState('')

  const historyRef      = useRef([])
  const isRecordingRef  = useRef(false)
  const loadingRef      = useRef(false)
  const sentHistoryRef  = useRef([])   // messages the user has sent (for up-arrow)
  const histIdxRef      = useRef(-1)   // -1 = not browsing; 0 = most recent
  const savedInputRef   = useRef('')   // stashes current input before browsing

  function setRecording(val) {
    isRecordingRef.current = val
    setIsRecording(val)
  }
  function setLoadingSync(val) {
    loadingRef.current = val
    setLoading(val)
  }

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) stopRecording()
    }
  }, [])

  async function send(overrideText) {
    const text = (overrideText ?? input).trim()
    if (!text || loadingRef.current) return

    if (/scariest face/i.test(text)) {
      if (!overrideText) { setInput(''); histIdxRef.current = -1 }
      tetoFlash('horror', 2500)
      return
    }

    if (/\byawn\b/i.test(text)) {
      if (!overrideText) { setInput(''); histIdxRef.current = -1 }
      tetoFlash('yawn', 3000)
      return
    }

    resumeScreenWatch()
    setErrorMsg('')

    // ── Web search (optional — only if Tavily key is configured) ───────────────
    let searchContext = null
    if (SEARCH_TRIGGER.test(text) && await hasTavilyKey()) {
      tetoSpeak("[short pause] let me look that up...", 'pensive')
      searchContext = await searchWeb(text).catch(() => null)
    }
    // ── End web search ─────────────────────────────────────────────────────────

    if (!overrideText) {
      // Push to sent history (keep last 50), reset browse index
      sentHistoryRef.current = [...sentHistoryRef.current, text].slice(-50)
      histIdxRef.current = -1
      savedInputRef.current = ''
      setInput('')
    }

    setLoadingSync(true)
    appendLog({ role: 'user', text })

    try {
      const screenshot = needsScreenContext(text)
        ? await window.tetoAPI.captureScreen().catch(() => null)
        : null

      const augmented = searchContext ? `${text}\n\n[Web search results for context — use these to answer accurately, but respond as Teto, not as a search engine:]\n${searchContext}` : text
      const result = await chat(historyRef.current, augmented, screenshot)
      historyRef.current = result.history
      const tetoText = stripTags(result.text)
      appendLog({ role: 'teto', text: tetoText })
      resetCooldown()
      tetoSpeak(result.text, result.emotion)
    } catch (err) {
      console.error('[ChatInput] error:', err)
      setErrorMsg('something went wrong')
      setTimeout(() => setErrorMsg(''), 3000)
    } finally {
      setLoadingSync(false)
    }
  }

  // ── Push-to-talk ────────────────────────────────────────────────────────────

  async function startPTT() {
    if (isRecordingRef.current || loadingRef.current) return
    tetoInterrupt()
    try {
      await startRecording()
      setRecording(true)
    } catch (err) {
      console.error('[ChatInput] mic access failed:', err)
      setErrorMsg('mic access denied')
      setTimeout(() => setErrorMsg(''), 3000)
    }
  }

  async function stopPTT() {
    if (!isRecordingRef.current) return
    setRecording(false)
    const blob = await stopRecording()
    if (!blob) return
    try {
      const env  = await window.tetoAPI.getEnv()
      const text = await transcribe(blob, env.OPENAI_API_KEY)
      if (text) send(text)
    } catch (err) {
      console.error('[ChatInput] transcription failed:', err)
      setErrorMsg('voice input failed')
      setTimeout(() => setErrorMsg(''), 3000)
    }
  }

  // Global listeners — mouse release catches drags off the button; Ctrl+Space chord
  useEffect(() => {
    function onMouseUp()  { stopPTT() }
    function onKeyDown(e) {
      if (e.ctrlKey && e.code === 'Space' && !isRecordingRef.current) {
        e.preventDefault()
        startPTT()
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space' && isRecordingRef.current) stopPTT()
    }
    document.addEventListener('mouseup',  onMouseUp)
    document.addEventListener('keydown',  onKeyDown)
    document.addEventListener('keyup',    onKeyUp)
    return () => {
      document.removeEventListener('mouseup',  onMouseUp)
      document.removeEventListener('keydown',  onKeyDown)
      document.removeEventListener('keyup',    onKeyUp)
    }
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function onKeyDown(e) {
    // Up-arrow: browse backwards through sent history
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const hist = sentHistoryRef.current
      if (hist.length === 0) return
      e.preventDefault()
      if (histIdxRef.current === -1) savedInputRef.current = input
      const newIdx = Math.min(histIdxRef.current + 1, hist.length - 1)
      histIdxRef.current = newIdx
      setInput(hist[hist.length - 1 - newIdx])
      return
    }
    // Down-arrow: browse forwards (back toward current draft)
    if (e.key === 'ArrowDown' && histIdxRef.current !== -1) {
      e.preventDefault()
      const newIdx = histIdxRef.current - 1
      histIdxRef.current = newIdx
      setInput(newIdx === -1 ? savedInputRef.current : sentHistoryRef.current[sentHistoryRef.current.length - 1 - newIdx])
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function openHistory() {
    window.tetoAPI.openChatHistory()
  }

  const placeholder = errorMsg
    ? errorMsg
    : loading      ? 'thinking...'
    : isRecording  ? 'recording...'
    : 'say something...'

  return (
    <div className="chat-input">
      <div className="chat-input__row">
        <button
          className="chat-input__history"
          onClick={openHistory}
          aria-label="Chat history"
          title="Chat history"
        >
          ☰
        </button>
        <input
          className={`chat-input__field${errorMsg ? ' chat-input__field--error' : ''}`}
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => { setInput(e.target.value); histIdxRef.current = -1 }}
          onKeyDown={onKeyDown}
          onFocus={pauseScreenWatch}
          onBlur={resumeScreenWatch}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className={`chat-input__mic chat-input__mic--${isRecording ? 'recording' : 'idle'}`}
          onMouseDown={(e) => { e.preventDefault(); startPTT() }}
          aria-label={isRecording ? 'Recording… release to send' : 'Hold to speak (or Ctrl+Space)'}
          title={isRecording ? 'Release to send' : 'Hold to speak (or hold Ctrl+Space)'}
        >
          🎤
        </button>
        <button
          className="chat-input__send"
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          ›
        </button>
      </div>
    </div>
  )
}
