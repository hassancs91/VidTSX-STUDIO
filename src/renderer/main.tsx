import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App'
import { installGlobalErrorHooks } from './utils/global-error-hooks'
import { installSpike0Harness } from './spike0-harness'

installGlobalErrorHooks()
installSpike0Harness()

createRoot(document.getElementById('root')!).render(<App />)

document.getElementById('loading-screen')?.remove()
