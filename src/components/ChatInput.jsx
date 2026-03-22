import React, { useState, useRef, useEffect } from 'react'
import { useTeto } from '../App.jsx'
import { chat } from '../services/claude.js'
import { resetCooldown, pauseScreenWatch, resumeScreenWatch } from '../services/screenWatch.js'
import { startRecording, stopRecording, transcribe } from '../services/voice.js'
import '../styles/ChatInput.css'

const SCREEN_KEYWORDS = /\b(look|see|screen|this|that|here|these|those|read|solve|check|show|what('?s| is| are)( on| this| that| here)?|can you (see|look|read|help)|help me (with|solve|read|understand)|do you see|what do you think of (this|that))\b/i

function needsScreenContext(text) {
  return SCREEN_KEYWORDS.test(text)
}

function stripTags(t) {
  return t.replace(/\[.*?\]/g, '').replace(/\n+/g, ' ').trim()
}

export default function ChatInput() {
  const { tetoSpeak, tetoInterrupt, tetoFlash, appendLog } = useTeto()
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const historyRef    = useRef([])
  const isRecordingRef = useRef(false)  // ref copy so event handlers never see stale state
  const loadingRef     = useRef(false)

  // Keep refs in sync with state
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
      // Release mic if component unmounts mid-recording
      if (isRecordingRef.current) stopRecording()
    }
  }, [])

  async function send(overrideText) {
    const text = (overrideText ?? input).trim()
    if (!text || loadingRef.current) return

    if (/scariest face/i.test(text)) {
      if (!overrideText) setInput('')
      tetoFlash('horror', 2500)
      return
    }

    resumeScreenWatch()
    if (!overrideText) setInput('')
    setLoadingSync(true)
    appendLog({ role: 'user', text })

    try {
      const screenshot = needsScreenContext(text)
        ? await window.tetoAPI.captureScreen().catch(() => null)
        : null

      const result = await chat(historyRef.current, text, screenshot)
      historyRef.current = result.history
      const tetoText = stripTags(result.text)
      appendLog({ role: 'teto', text: tetoText })
      resetCooldown()
      tetoSpeak(result.text, result.emotion)
    } catch (err) {
      console.error('[ChatInput] error:', err)
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
    }
  }

  async function stopPTT() {
    if (!isRecordingRef.current) return  // idempotent
    setRecording(false)
    const blob = await stopRecording()
    if (!blob) return
    try {
      const env  = await window.tetoAPI.getEnv()
      const text = await transcribe(blob, env.OPENAI_API_KEY)
      if (text) send(text)
    } catch (err) {
      console.error('[ChatInput] transcription failed:', err)
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
  }, [])  // empty deps — handlers use refs, so they never go stale

  // ── Handlers ────────────────────────────────────────────────────────────────

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function openHistory() {
    window.tetoAPI.openChatHistory()
  }

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
          className="chat-input__field"
          type="text"
          placeholder={loading ? 'thinking...' : isRecording ? 'recording...' : 'say something...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
