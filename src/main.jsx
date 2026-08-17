import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Survey from './Survey.jsx'
import About from './About.jsx'
import HowItWorks from './HowItWorks.jsx'
import Beta from './Beta.jsx'
import Scan from './Scan.jsx'
import SharePage from './Share.jsx'
import Create from './Create.jsx'
import { initAnalytics, track } from './lib/analytics.js'

initAnalytics()

function PageHits() {
  const location = useLocation()
  useEffect(() => {
    track('page_viewed', {
      path: location.pathname,
      search: location.search || undefined,
      title: typeof document !== 'undefined' ? document.title : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    })
  }, [location.pathname, location.search])
  return null
}

function BetaCorner() {
  const { pathname } = useLocation()
  if (
    pathname === '/beta' ||
    pathname === '/scan' ||
    pathname === '/create' ||
    pathname.startsWith('/survey') ||
    pathname.startsWith('/s/')
  ) {
    return null
  }
  return (
    <Link to="/beta" className="beta-corner">
      beta login
    </Link>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PageHits />
      <BetaCorner />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/beta" element={<Beta />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/create" element={<Create />} />
        <Route path="/s/:shareId" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
