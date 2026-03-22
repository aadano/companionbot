import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import HistoryWindow from './components/HistoryWindow'
import SettingsWindow from './SettingsWindow'
import './styles/global.css'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

let Root
if (view === 'history')  Root = <HistoryWindow />
else if (view === 'settings') Root = <SettingsWindow />
else Root = <App />

ReactDOM.createRoot(document.getElementById('root')).render(Root)
