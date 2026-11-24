import '@fontsource/carlito/400.css'
import '@fontsource/carlito/700.css'
import '@fontsource/rubik/hebrew-400.css'
import '@fontsource/rubik/hebrew-500.css'
import '@fontsource/rubik/hebrew-600.css'
import '@fontsource/rubik/hebrew-700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startVersionCheck } from './app/versionCheck.ts'
import App from './App.tsx'
import './index.css'

startVersionCheck()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
