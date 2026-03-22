import React from 'react'
import { HATS } from '../hats.js'
import '../styles/HatGallery.css'

export default function HatGallery({ hat, setHat, onClose }) {
  function toggle(file) {
    const next = hat === file ? null : file
    setHat(next)
    if (next) localStorage.setItem('teto_hat', next)
    else localStorage.removeItem('teto_hat')
  }

  return (
    <div className="hat-gallery">
      <div className="hat-gallery__header">
        <span className="hat-gallery__title">Accessories</span>
        <button className="hat-gallery__close" onClick={onClose}>✕</button>
      </div>
      <div className="hat-gallery__grid">
        {HATS.map(({ id, name, file }) => (
          <button
            key={id}
            className={`hat-gallery__item${hat === file ? ' hat-gallery__item--active' : ''}`}
            onClick={() => toggle(file)}
            title={name}
          >
            <img src={`/sprites/${file}`} alt={name} draggable={false} />
            <span className="hat-gallery__label">{name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
