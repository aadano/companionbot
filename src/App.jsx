import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import Avatar from './components/Avatar.jsx'
import ScreenWatch from './components/ScreenWatch.jsx'
import ChatInput from './components/ChatInput.jsx'
import { speak, clearQueue } from './services/tts.js'
import './styles/App.css'

const CHAT_LOG_KEY = 'teto_chat_log'

function stripTags(text) {
  return text.replace(/\[.*?\]/g, '').replace(/\n+/g, ' ').trim()
}

function appendLog(entry) {
  try {
    const current = JSON.parse(localStorage.getItem(CHAT_LOG_KEY) || '[]')
    localStorage.setItem(CHAT_LOG_KEY, JSON.stringify([...current, entry]))
  } catch {}
}

export const TetoContext = createContext(null)
export const useTeto = () => useContext(TetoContext)

export default function App() {
  const [emotion, setEmotion]         = useState('idle')
  const [talking, setTalking]         = useState(false)
  const [caption, setCaption]         = useState('')
  const [captionFading, setCaptionFading] = useState(false)
  const [watchState, setWatchState]   = useState('off')
  const [muted, setMuted]             = useState(false)
  const [gameMode, setGameMode]       = useState(false)  // ── GAME MODE
  const [showControls, setShowControls] = useState(false)
  const [uiOpacity, setUiOpacity]     = useState(1)
  const captionLingerRef              = useRef(null)
  const emotionResetRef               = useRef(null)

  useEffect(() => {
    window.tetoAPI.onSetEmotion(({ emotion: e, talking: t } = {}) => {
      if (e != null) setEmotion(e)
      if (t != null) setTalking(t)
    })
    return () => window.tetoAPI.removeEmotionListener()
  }, [])

  // Return to idle after lingering in a non-idle emotion
  useEffect(() => {
    if (emotionResetRef.current) clearTimeout(emotionResetRef.current)
    if (emotion !== 'idle' && !talking) {
      emotionResetRef.current = setTimeout(() => setEmotion('idle'), 12000)
    }
    return () => clearTimeout(emotionResetRef.current)
  }, [emotion, talking])

  // Auto-open settings window if no API key is configured (first run)
  // Also load stored UI opacity
  useEffect(() => {
    window.tetoAPI.getEnv().then(env => {
      if (!env.ANTHROPIC_API_KEY) window.tetoAPI.openSettings()
      if (env.WINDOW_OPACITY != null) setUiOpacity(Math.min(1, Math.max(0.1, env.WINDOW_OPACITY)))
    })
  }, [])

  // Live opacity updates from settings slider
  useEffect(() => {
    window.tetoAPI.onSetUiOpacity(v => setUiOpacity(Math.min(1, Math.max(0.1, v))))
    return () => window.tetoAPI.removeUiOpacityListener()
  }, [])

  // Global hotkey: Ctrl+Shift+M → toggle mute
  useEffect(() => {
    window.tetoAPI.onToggleMute(toggleMute)
    return () => window.tetoAPI.removeToggleMuteListener()
  }, [toggleMute])

  const tetoSpeak = useCallback((text, targetEmotion = 'idle') => {
    if (muted) return
    const cleaned = stripTags(text)
    if (!cleaned) return
    if (captionLingerRef.current) clearTimeout(captionLingerRef.current)
    setCaptionFading(false)
    setEmotion(targetEmotion)
    setCaption(cleaned)
    speak(text, {
      onStart: () => setTalking(true),
      onEnd: () => {
        setTalking(false)
        setCaptionFading(true)
        captionLingerRef.current = setTimeout(() => {
          setCaption('')
          setCaptionFading(false)
        }, 2000)
      },
    })
  }, [muted])

  const tetoFlash = useCallback((flashEmotion, ms = 2500) => {
    setEmotion(flashEmotion)
    setTalking(false)
    setTimeout(() => setEmotion('idle'), ms)
  }, [])

  const tetoInterrupt = useCallback(() => {
    if (captionLingerRef.current) clearTimeout(captionLingerRef.current)
    clearQueue()
    setTalking(false)
    setCaption('')
    setCaptionFading(false)
  }, [])

  // ── GAME MODE ────────────────────────────────────────────────────────────────
  const toggleGameMode = useCallback(() => setGameMode(m => !m), [])
  // ── END GAME MODE ─────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (!m) {
        if (captionLingerRef.current) clearTimeout(captionLingerRef.current)
        clearQueue()
        setTalking(false)
        setCaption('')
        setCaptionFading(false)
      }
      return !m
    })
  }, [])

  return (
    <TetoContext.Provider value={{ tetoSpeak, tetoInterrupt, tetoFlash, appendLog, emotion, talking, muted, toggleMute, setWatchState, gameMode, toggleGameMode }}>
      <div className={`app${showControls ? ' app--controls' : ''}`} style={{ '--ui-opacity': uiOpacity }}>
        <div className="app__avatar">
          <Avatar emotion={emotion} talking={talking} />

          {/* Always-visible toggle — intentionally outside ui-opacity targeting */}
          <button
            className={`toggle-btn${showControls ? ' toggle-btn--open' : ''}`}
            onClick={() => setShowControls(s => !s)}
            title={showControls ? 'Hide controls' : 'Show controls'}
          >≡</button>

          {showControls && <>
            <div className={`watch-dot watch-dot--${watchState}`} title={watchState} />
            <button
              className={`mute-btn${muted ? ' mute-btn--active' : ''}`}
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {/* ── GAME MODE ── */}
            <button
              className={`game-btn${gameMode ? ' game-btn--active' : ''}`}
              onClick={toggleGameMode}
              title={gameMode ? 'Game mode ON — click to disable' : 'Enable game mode'}
            >🎮</button>
            {/* ── END GAME MODE ── */}
            <button
              className="gear-btn"
              onClick={() => window.tetoAPI.openSettings()}
              title="Settings"
            >⚙</button>
            <button
              className="quit-btn"
              onClick={() => window.tetoAPI.quit()}
              title="Quit"
            >✕</button>
          </>}
        </div>

        {(caption || showControls) && (
          <div className="app__overlay">
            {caption && (
              <div className={`caption${captionFading ? ' caption--fading' : ''}`}>
                <p className="caption__text">{caption}</p>
              </div>
            )}
            {showControls && <ChatInput />}
          </div>
        )}
      </div>

      <ScreenWatch />
    </TetoContext.Provider>
  )
}
