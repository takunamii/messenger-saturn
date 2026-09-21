import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { socket } from './utils/socket'

// соединяем WS один раз, если уже залогинены
if (localStorage.getItem('token')) socket.connect()
// при логине/логауте в других вкладках — синхронизируем соединение
window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
        if (e.newValue) socket.connect()
        else socket.disconnect()
    }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
