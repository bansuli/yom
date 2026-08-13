import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Survey from './Survey.jsx'
import About from './About.jsx'
import HowItWorks from './HowItWorks.jsx'
import Beta from './Beta.jsx'

function BetaCorner() {
  const { pathname } = useLocation()
  if (pathname === '/beta' || pathname.startsWith('/survey')) return null
  return (
    <Link to="/beta" className="beta-corner">
      beta login
    </Link>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <BetaCorner />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/beta" element={<Beta />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
