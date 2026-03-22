import React, { useState, useEffect } from 'react'
import '../styles/Settings.css'

const FIELDS = [
  {
    section: 'AI',
    items: [
      { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
      { key: 'GEMINI_API_KEY',    label: 'Gemini API Key',    placeholder: 'AIza... (optional)' },
      { key: 'OPENAI_API_KEY',    label: 'OpenAI API Key',    placeholder: 'sk-... (for voice input)' },
    ]
  },
  {
    section: 'Voice',
    items: [
      { key: 'FISH_API_KEY',      label: 'Fish Audio Key',    placeholder: '' },
      { key: 'FISH_REFERENCE_ID', label: 'Fish Reference ID', placeholder: 'voice model id' },
    ]
  },
]

export default function Settings({ onClose }) {
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    window.tetoAPI.getSettings().then(s => setValues(s || {}))
  }, [])

  function onChange(key, val) {
    setValues(v => ({ ...v, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    await window.tetoAPI.saveSettings(values)
    setSaved(true)
    setSaving(false)
    // Brief pause so user sees confirmation, then reload flushes all envCaches
    setTimeout(() => window.tetoAPI.reloadRenderer(), 900)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="settings-body">
          {FIELDS.map(({ section, items }) => (
            <React.Fragment key={section}>
              <p className="settings-section">{section}</p>
              {items.map(({ key, label, placeholder }) => (
                <div className="settings-field" key={key}>
                  <label className="settings-label">{label}</label>
                  <input
                    className="settings-input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    value={values[key] || ''}
                    onChange={e => onChange(key, e.target.value)}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="settings-footer">
          <button
            className={`settings-save${saved ? ' settings-save--saved' : ''}`}
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saved ? 'saved — reloading…' : saving ? 'saving…' : 'Save & Reload'}
          </button>
        </div>

      </div>
    </div>
  )
}
