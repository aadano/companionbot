import React, { useState, useEffect } from 'react'
import './styles/SettingsWindow.css'

const API_KEY_FIELDS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key',    placeholder: 'sk-ant-...',       hint: 'Required — powers Teto\'s brain. Get one at console.anthropic.com → API Keys.' },
  { key: 'OPENAI_API_KEY',    label: 'OpenAI API Key',       placeholder: 'sk-...',           hint: 'Optional — enables voice input (Whisper). Get one at platform.openai.com → API Keys.' },
  { key: 'FISH_API_KEY',      label: 'Fish Audio Key',       placeholder: '',                 hint: 'Optional — enables Teto\'s voice. Get one at fish.audio → Dashboard.' },
  { key: 'FISH_REFERENCE_ID', label: 'Fish Reference ID',    placeholder: 'voice model id',   hint: 'Optional — the voice model ID from your Fish Audio dashboard.' },
  { key: 'GEMINI_API_KEY',    label: 'Gemini API Key',       placeholder: 'AIza...',          hint: 'Optional — fallback AI model. Get one at aistudio.google.com → Get API Key.' },
]

function Toggle({ checked, onChange }) {
  return (
    <label className="sw__toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="sw__toggle-track" />
      <span className="sw__toggle-thumb" />
    </label>
  )
}

function Pills({ options, value, onChange }) {
  return (
    <div className="sw__pills">
      {options.map(o => (
        <button
          key={o.value}
          className={`sw__pill${value === o.value ? ' sw__pill--active' : ''}`}
          onClick={() => onChange(o.value)}
        >{o.label}</button>
      ))}
    </div>
  )
}

export default function SettingsWindow() {
  const [cfg, setCfg]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    window.tetoAPI.getSettings().then(s => setCfg(s || {}))
  }, [])

  function set(key, val) {
    setCfg(c => ({ ...c, [key]: val }))
    // Apply appearance changes live
    if (key === 'windowOpacity') window.tetoAPI.applyAppearance({ opacity: val })
    if (key === 'alwaysOnTop')   window.tetoAPI.applyAppearance({ alwaysOnTop: val })
  }

  async function handleSave() {
    setSaving(true)
    await window.tetoAPI.saveSettings(cfg)
    setSaved(true)
    setSaving(false)
    setTimeout(() => {
      window.tetoAPI.reloadRenderer()
      window.close()
    }, 900)
  }

  if (!cfg) return null

  return (
    <div className="sw">
      <div className="sw__bar">
        <span className="sw__title">⚙ Teto Settings</span>
        <button className="sw__close" onClick={() => window.close()}>✕</button>
      </div>

      <div className="sw__body">

        {/* ── First-run welcome banner ───────────────────────────────────── */}
        {!cfg.ANTHROPIC_API_KEY && (
          <div className="sw__welcome">
            <p className="sw__welcome-title">First time? Start here.</p>
            <p className="sw__welcome-body">
              Teto needs an Anthropic API key to work. Everything else is optional — Fish Audio gives her a voice, OpenAI enables voice input, and Gemini is a fallback brain.
            </p>
          </div>
        )}

        {/* ── API Keys ──────────────────────────────────────────────────── */}
        <div>
          <p className="sw__section-label">API Keys</p>
          <div className="sw__fields">
            {API_KEY_FIELDS.map(({ key, label, placeholder, hint }) => (
              <div className="sw__field" key={key}>
                <label className="sw__label">{label}</label>
                <input
                  className="sw__input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={placeholder}
                  value={cfg[key] || ''}
                  onChange={e => set(key, e.target.value)}
                />
                <span className="sw__hint">{hint}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Personality ───────────────────────────────────────────────── */}
        <div>
          <p className="sw__section-label">Personality</p>
          <div className="sw__fields">
            <div className="sw__field">
              <label className="sw__label">Reaction rate — how often she comments on your screen</label>
              <Pills
                value={cfg.reactionFrequency || 'normal'}
                onChange={v => set('reactionFrequency', v)}
                options={[
                  { value: 'relaxed',  label: 'Relaxed' },
                  { value: 'normal',   label: 'Normal' },
                  { value: 'frequent', label: 'Frequent' },
                ]}
              />
            </div>
            <div className="sw__field">
              <label className="sw__label">Game mode intensity</label>
              <Pills
                value={cfg.gameIntensity || 'standard'}
                onChange={v => set('gameIntensity', v)}
                options={[
                  { value: 'chill',    label: 'Chill' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'ruthless', label: 'Ruthless' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* ── Screen Watch ──────────────────────────────────────────────── */}
        <div>
          <p className="sw__section-label">Screen Watch</p>
          <div className="sw__fields">
            <div className="sw__toggle-row">
              <span className="sw__toggle-label">Watch screen for reactions</span>
              <Toggle
                checked={cfg.screenWatchEnabled !== false}
                onChange={v => set('screenWatchEnabled', v)}
              />
            </div>
            <div className="sw__field">
              <label className="sw__label">Sensitivity — how much motion triggers a reaction</label>
              <Pills
                value={cfg.screenSensitivity || 'medium'}
                onChange={v => set('screenSensitivity', v)}
                options={[
                  { value: 'low',    label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high',   label: 'High' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* ── System ────────────────────────────────────────────────────── */}
        <div>
          <p className="sw__section-label">System</p>
          <div className="sw__fields">
            <div className="sw__toggle-row">
              <span className="sw__toggle-label">Launch on startup</span>
              <Toggle
                checked={cfg.loginItemStartup === true}
                onChange={v => set('loginItemStartup', v)}
              />
            </div>
          </div>
        </div>

        {/* ── Appearance ────────────────────────────────────────────────── */}
        <div>
          <p className="sw__section-label">Appearance</p>
          <div className="sw__fields">
            <div className="sw__field">
              <label className="sw__label">Window opacity</label>
              <div className="sw__slider-row">
                <input
                  className="sw__slider"
                  type="range"
                  min={0.2} max={1} step={0.05}
                  value={cfg.windowOpacity ?? 1}
                  onChange={e => set('windowOpacity', parseFloat(e.target.value))}
                />
                <span className="sw__slider-value">{Math.round((cfg.windowOpacity ?? 1) * 100)}%</span>
              </div>
            </div>
            <div className="sw__toggle-row">
              <span className="sw__toggle-label">Always on top</span>
              <Toggle
                checked={cfg.alwaysOnTop !== false}
                onChange={v => set('alwaysOnTop', v)}
              />
            </div>
          </div>
        </div>

      </div>

      <div className="sw__footer">
        <button
          className={`sw__save${saved ? ' sw__save--saved' : ''}`}
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saved ? 'saved — reloading…' : saving ? 'saving…' : 'Save & Apply'}
        </button>
      </div>
    </div>
  )
}
