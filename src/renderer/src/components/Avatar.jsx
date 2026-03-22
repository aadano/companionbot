import React, { useState } from 'react'
import '../styles/Avatar.css'

// Drop your sprite PNGs into src/renderer/public/sprites/
// Expected filenames: idle.png, talking.png, reacting.png, surprised.png

export default function Avatar({ expression = 'idle' }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className={`avatar avatar--${expression}`}>
      {!imgFailed ? (
        <img
          key={expression}
          src={`/sprites/${expression}.png`}
          alt={`Teto ${expression}`}
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      ) : (
        <div className="avatar__placeholder">
          <span className="avatar__placeholder-label">{expression}</span>
        </div>
      )}
    </div>
  )
}
