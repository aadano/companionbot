import React, { useState, useEffect, useMemo } from 'react'
import '../styles/Avatar.css'

// ── Sprite map ────────────────────────────────────────────────────────────────
const SPRITE_MAP = {
  'idle':        'idle.png',
  'happy':       'wink.png',
  'smug':        'tsundere.png',
  'annoyed':     ['annoyed1.png', 'annoyed2.png', 'annoyed3.png', 'neutral-serious.png'],
  'furious':     'furious.png',
  'surprised':   'surprisedafraid-fearlvl2.png',
  'concerned':   'concerned-fearlvl1.png',
  'mortified':   'mortified-fearlvl3.png',
  'curious':     'curious.png',
  'sad':         'sobbingwaaaa-sadlvl3.png',
  'sleepy':      'sleepydrowsy.png',
  'oops':        'oops.png',
  'dizzy':       'dizzy.png',
  'cozy':        'breakfastteto.png',
  'hurt':        'emotionallyhurt-tears.png',
  'pensive':     'pensive-holdinglaptop.png',
  'horror':      'whatsapp-invincible.gif',
  'yawn':        'teto-yawn.gif',
  // talking variants
  'idle_talking':     'deadpan.png',
  'pensive_talking':  'pensive-holdinglaptop.png',
  'happy_talking':    'beaming-orhappytalk.png',
  'smug_talking':     'smug-lowcortisol.png',
  'annoyed_talking':  ['annoyed1.png', 'annoyed2.png', 'annoyed3.png', 'neutral-serious-holdingbaguette.png'],
  'furious_talking':  'furious.png',
}

function pickEntry(entry) {
  if (!entry) return null
  if (Array.isArray(entry)) return entry[Math.floor(Math.random() * entry.length)]
  return entry
}

function buildCandidates(emotion, talking) {
  const resolve = (key, fallbackName) => {
    const picked = pickEntry(SPRITE_MAP[key])
    return picked ? `/sprites/${picked}` : `/sprites/${fallbackName}`
  }
  if (talking) {
    return [
      resolve(`${emotion}_talking`, `${emotion}_talking.png`),
      resolve(emotion, `${emotion}.png`),
      resolve('idle', 'idle.png'),
    ]
  }
  return [
    resolve(emotion, `${emotion}.png`),
    resolve('idle', 'idle.png'),
  ]
}

export default function Avatar({ emotion = 'idle', talking = false, hat = null, hatTop = 0, hatWidth = 160 }) {
  const [failedSrcs, setFailedSrcs] = useState(new Set())

  useEffect(() => { setFailedSrcs(new Set()) }, [emotion, talking])

  const candidates = useMemo(() => buildCandidates(emotion, talking), [emotion, talking])
  const src = candidates.find((c) => !failedSrcs.has(c))

  const handleError = (e) => {
    const failed = e.currentTarget.src.replace(window.location.origin, '')
    setFailedSrcs((prev) => new Set(prev).add(failed))
  }

  const animClass = talking ? 'talking' : emotion

  return (
    <div className={`avatar avatar--${animClass}`}>
      {/* .avatar__animated is the single element that receives all CSS animations.
          Both the sprite and the hat live inside it, so they always move together —
          no phase-sync issues since neither child animates independently. */}
      <div className="avatar__animated">
        {src ? (
          <img
            key={src}
            src={src}
            alt={`Teto ${emotion}${talking ? ' talking' : ''}`}
            onError={handleError}
            draggable={false}
          />
        ) : (
          <div className="avatar__placeholder">
            <span className="avatar__placeholder-label">
              {emotion}{talking ? ' · talking' : ''}
            </span>
          </div>
        )}
        {hat && (
          <div className="avatar__hat-wrap" style={{ top: hatTop }}>
            <img
              src={`/sprites/${hat}`}
              style={{ width: hatWidth }}
              draggable={false}
              alt=""
            />
          </div>
        )}
      </div>
    </div>
  )
}
