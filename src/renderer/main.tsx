import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App'
import { installGlobalErrorHooks } from './utils/global-error-hooks'

installGlobalErrorHooks()

createRoot(document.getElementById('root')!).render(<App />)

document.getElementById('loading-screen')?.remove()
