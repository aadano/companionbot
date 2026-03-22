import React, { useState, useEffect, useRef } from 'react'
import '../styles/HistoryWindow.css'

const STORAGE_KEY = 'teto_chat_log'

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export default function HistoryWindow() {
  const [log, setLog] = useState(loadLog)
  const bottomRef = useRef(null)

  // Listen for updates written by ChatInput in the main window
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY) setLog(loadLog())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  function close() {
    window.close()
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY)
    setLog([])
  }

  return (
    <div className="history-window">
      <div className="history-window__bar">
        <span className="history-window__title">Chat History</span>
        <button className="history-window__clear" onClick={clearHistory} aria-label="Clear history">clear</button>
        <button className="history-window__close" onClick={close} aria-label="Close">✕</button>
      </div>
      <div className="history-window__log">
        {log.length === 0
          ? <p className="history-window__empty">no messages yet</p>
          : log.map((entry, i) => (
            <div key={i} className={`history-entry history-entry--${entry.role}`}>
              <span className="history-entry__who">{entry.role === 'user' ? 'you' : 'teto'}</span>
              <span className="history-entry__text">{entry.text}</span>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
