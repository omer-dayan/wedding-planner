import '@fontsource/frank-ruhl-libre/700.css'
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/500.css'
import '@fontsource/heebo/700.css'
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
