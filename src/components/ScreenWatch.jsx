// Invisible component — runs the screen watch loop
// Mounts once, polls for screen changes, fires Gemini, feeds tetoSpeak

import { useEffect, useRef } from 'react'
import { useTeto } from '../App.jsx'
import { start, stop, resetCooldown, setGameMode as applyGameMode, setDeskConfig, getFrameBuffer } from '../services/screenWatch.js'
import { reactToScreen } from '../services/vision.js'  // swap back to '../services/gemini.js' to revert

const MAX_HISTORY = 10

function stripTags(t) {
  return t.replace(/\[.*?\]/g, '').replace(/\n+/g, ' ').trim()
}

export default function ScreenWatch() {
  const { tetoSpeak, tetoInterrupt, appendLog, talking, setWatchState, gameMode } = useTeto()
  const talkingRef  = useRef(talking)
  const gameModeRef = useRef(gameMode)  // ── GAME MODE: ref so handleTrigger never goes stale
  const historyRef  = useRef([])
  const pendingRef  = useRef(false)  // prevent concurrent vision requests

  useEffect(() => { talkingRef.current  = talking  }, [talking])
  useEffect(() => { gameModeRef.current = gameMode }, [gameMode])  // ── GAME MODE

  // ── GAME MODE: sync toggle to the polling service ──────────────────────────
  useEffect(() => { applyGameMode(gameMode) }, [gameMode])
  // ── END GAME MODE ───────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    async function handleTrigger(dataURL) {
      if (!mounted || talkingRef.current || pendingRef.current) return
      pendingRef.current = true
      setWatchState('thinking')
      try {
        // ── GAME MODE: pass frame buffer for multi-frame context ──────────────
        const frames = gameModeRef.current ? getFrameBuffer() : []
        // ── END GAME MODE ──────────────────────────────────────────────────────
        const result = await reactToScreen(dataURL, historyRef.current, gameModeRef.current, frames)
        if (!mounted || !result || result.emotion === 'silent' || !result.text) return
        historyRef.current = [...historyRef.current, stripTags(result.text)].slice(-MAX_HISTORY)
        appendLog({ role: 'teto', text: stripTags(result.text) })
        tetoInterrupt()
        tetoSpeak(result.text, result.emotion)
        resetCooldown()
      } finally {
        pendingRef.current = false
        if (mounted) setWatchState('watching')
      }
    }

    async function init() {
      // Apply user-configured desktop settings before starting
      const env = await window.tetoAPI.getEnv()
      if (!env.SCREEN_WATCH_ENABLED) {
        setWatchState('off')
        return
      }
      setDeskConfig({ reactionFrequency: env.REACTION_FREQUENCY, screenSensitivity: env.SCREEN_SENSITIVITY })

      setWatchState('thinking')
      const firstFrame = await start(handleTrigger)

      if (firstFrame && mounted) {
        const result = await reactToScreen(firstFrame, [], gameModeRef.current)
        if (result && result.emotion !== 'silent' && result.text && mounted) {
          historyRef.current = [stripTags(result.text)]
          appendLog({ role: 'teto', text: stripTags(result.text) })
          tetoSpeak(result.text, result.emotion)
        }
      }
      if (mounted) setWatchState('watching')
    }

    init().catch((e) => {
      console.error('[ScreenWatch] init error:', e)
      if (mounted) setWatchState('watching')
    })

    return () => {
      mounted = false
      stop()
      setWatchState('off')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
