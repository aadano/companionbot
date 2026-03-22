import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import Avatar from './components/Avatar.jsx'
import ScreenWatch from './components/ScreenWatch.jsx'
import ChatInput from './components/ChatInput.jsx'
import HatGallery from './components/HatGallery.jsx'
import { HATS } from './hats.js'
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
  const [showHatGallery, setShowHatGallery] = useState(false)
  const [hat, setHat]                 = useState(() => localStorage.getItem('teto_hat') || null)
  const [uiOpacity, setUiOpacity]     = useState(1)
  const captionLingerRef              = useRef(null)
  const emotionResetRef               = useRef(null)
  const lastTalkRef                   = useRef(Date.now())
  const yawnTimerRef                  = useRef(null)
  const talkingForYawnRef             = useRef(false)
  const mutedForYawnRef               = useRef(false)

  useEffect(() => {
    window.tetoAPI.onSetEmotion(({ emotion: e, talking: t } = {}) => {
      if (e != null) setEmotion(e)
      if (t != null) setTalking(t)
    })
    return () => window.tetoAPI.removeEmotionListener()
  }, [])

  // Keep refs in sync for yawn timer (avoids stale closures)
  useEffect(() => { talkingForYawnRef.current = talking }, [talking])
  useEffect(() => { mutedForYawnRef.current   = muted   }, [muted])
  useEffect(() => { if (talking) lastTalkRef.current = Date.now() }, [talking])

  // Idle yawn — fires once every 15–20 min of silence, only when truly idle
  useEffect(() => {
    function schedule() {
      if (yawnTimerRef.current) clearTimeout(yawnTimerRef.current)
      const delay = (15 + Math.random() * 5) * 60 * 1000
      yawnTimerRef.current = setTimeout(() => {
        const silentMs = Date.now() - lastTalkRef.current
        if (silentMs > 14 * 60 * 1000 && !talkingForYawnRef.current && !mutedForYawnRef.current) {
          tetoFlash('yawn', 3000)
        }
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(yawnTimerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Return to idle after lingering in a non-idle emotion
  useEffect(() => {
    if (emotionResetRef.current) clearTimeout(emotionResetRef.current)
    if (emotion !== 'idle' && !talking) {
      const delay = emotion === 'yawn' ? 3000 : 12000
      emotionResetRef.current = setTimeout(() => setEmotion('idle'), delay)
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
      const next = !m
      if (next) {
        if (captionLingerRef.current) clearTimeout(captionLingerRef.current)
        clearQueue()
        setTalking(false)
        setCaption('')
        setCaptionFading(false)
      }
      window.tetoAPI.syncMuteState(next)
      return next
    })
  }, [])

  // Global hotkey: Ctrl+Shift+M → toggle mute (must be after toggleMute is defined)
  useEffect(() => {
    window.tetoAPI.onToggleMute(toggleMute)
    return () => window.tetoAPI.removeToggleMuteListener()
  }, [toggleMute])

  return (
    <TetoContext.Provider value={{ tetoSpeak, tetoInterrupt, tetoFlash, appendLog, emotion, talking, muted, toggleMute, setWatchState, gameMode, toggleGameMode }}>
      <div className={`app${showControls ? ' app--controls' : ''}`} style={{ '--ui-opacity': uiOpacity }}>
        <div className="app__avatar">
          <Avatar
            emotion={emotion} talking={talking}
            hat={hat}
            hatTop={HATS.find(h => h.file === hat)?.top ?? 0}
            hatWidth={HATS.find(h => h.file === hat)?.width ?? 160}
          />

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
              className={`hat-btn${hat ? ' hat-btn--active' : ''}${showHatGallery ? ' hat-btn--open' : ''}`}
              onClick={() => setShowHatGallery(s => !s)}
              title="Accessories"
            >🎩</button>
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
            {showControls && (showHatGallery
              ? <HatGallery hat={hat} setHat={setHat} onClose={() => setShowHatGallery(false)} />
              : <ChatInput />
            )}
          </div>
        )}
      </div>

      <ScreenWatch />
    </TetoContext.Provider>
  )
}
