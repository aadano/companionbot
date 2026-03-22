import React, { useState, useEffect } from 'react'
import Avatar from './components/Avatar'
import './styles/App.css'

export default function App() {
  const [expression, setExpression] = useState('idle')

  useEffect(() => {
    window.tetoAPI.onSetExpression((expr) => setExpression(expr))
    return () => window.tetoAPI.removeExpressionListener()
  }, [])

  return (
    <div className="app">
      <Avatar expression={expression} />
    </div>
  )
}
