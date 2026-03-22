import React, { useState, useEffect, useMemo } from 'react'
import '../styles/Avatar.css'

// ── Sprite map ────────────────────────────────────────────────────────────────
// Values can be a single filename string or an array — arrays are picked randomly.
// Unmapped combos fall back through the chain: emotion_talking → emotion → idle.
const SPRITE_MAP = {
  // base emotions
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
  'horror':      'OIP%20(7).webp',
  // talking variants
  'idle_talking':     'deadpan.png',
  'happy_talking':    'beaming-orhappytalk.png',
  'smug_talking':     'smug-lowcortisol.png',
  'annoyed_talking':  ['annoyed1.png', 'annoyed2.png', 'annoyed3.png', 'neutral-serious-holdingbaguette.png'],
  'furious_talking':  'furious.png',
}

// Resolve a sprite map entry to a single filename, picking randomly from arrays
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

export default function Avatar({ emotion = 'idle', talking = false }) {
  const [failedSrcs, setFailedSrcs] = useState(new Set())

  // Reset failed set whenever emotion or talking changes
  useEffect(() => {
    setFailedSrcs(new Set())
  }, [emotion, talking])

  // Memoised so the random pick is stable for the duration of each emotion+talking state.
  // Re-picks only when emotion or talking changes, not on every re-render.
  const candidates = useMemo(() => buildCandidates(emotion, talking), [emotion, talking])

  const src = candidates.find((c) => !failedSrcs.has(c))

  const handleError = (e) => {
    const failed = e.currentTarget.src.replace(window.location.origin, '')
    setFailedSrcs((prev) => new Set(prev).add(failed))
  }

  const animClass = talking ? 'talking' : emotion

  return (
    <div className={`avatar avatar--${animClass}`}>
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
    </div>
  )
}
