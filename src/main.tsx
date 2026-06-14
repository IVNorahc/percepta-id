import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Polices auto-hébergées (sous-ensemble latin) — Inter (corps) + Plus Jakarta Sans (titres)
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import PwaManager from './components/PwaManager.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <PwaManager />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
