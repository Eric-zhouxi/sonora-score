import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import StudioApp from './StudioApp'
import './dark.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
)
