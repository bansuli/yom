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
import Join from './Join.jsx'
import Looks from './Looks.jsx'
import Lineup from './Lineup.jsx'
import ClosetBoard from './ClosetBoard.jsx'
import PublicLineup from './PublicLineup.jsx'
import { initAnalytics, track } from './lib/analytics.js'
import { recoverLocalLeads, startLeadFlush } from './lib/lead-queue.js'

initAnalytics()
recoverLocalLeads()
startLeadFlush()

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
    pathname === '/join' ||
    pathname === '/looks' ||
    pathname === '/lineup' ||
    pathname === '/closet' ||
    pathname === '/everyone' ||
    pathname.startsWith('/survey') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/l/')
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
        <Route path="/join" element={<Join />} />
        <Route path="/looks" element={<Looks />} />
        <Route path="/lineup" element={<Lineup />} />
        <Route path="/closet" element={<ClosetBoard />} />
        <Route path="/everyone" element={<ClosetBoard />} />
        <Route path="/create" element={<Create />} />
        <Route path="/s/:shareId" element={<SharePage />} />
        <Route path="/l/:lineupId" element={<PublicLineup />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
