import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import Lineup from './Lineup.jsx'
import Me from './Me.jsx'
import ClosetBoard from './ClosetBoard.jsx'
import PublicLineup from './PublicLineup.jsx'
import Admin from './Admin.jsx'
import { initAnalytics, track } from './lib/analytics.js'
import { recoverLocalLeads, startLeadFlush } from './lib/lead-queue.js'
import { bootPipeline } from './lib/pipeline-store.js'
import { adoptAccountKey } from './lib/account.js'
import { startTapFeel } from './lib/tap-feel.js'
import { startErrorReporting } from './lib/report-error.js'
import { isNativeApp } from './lib/native.js'

async function bootNativeShell() {
  if (!isNativeApp()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
  } catch {
    /* plugin optional at dev time */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}

bootNativeShell()

// A transfer link carries the account key in the fragment, which browsers keep
// out of referrers and server logs. Adopt it before anything reads the store.
function claimAccountFromUrl() {
  try {
    const match = (window.location.hash || '').match(/(?:^#|&)key=([^&]+)/)
    if (!match) return
    if (adoptAccountKey(decodeURIComponent(match[1]))) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  } catch {
    /* ignore */
  }
}

claimAccountFromUrl()
startErrorReporting()
startTapFeel()
initAnalytics()
recoverLocalLeads()
startLeadFlush()
bootPipeline()

// The home tab is the scanner itself now — one page that asks what she's
// thinking, instead of a page whose only job was to offer the same three
// choices. Her looks live on /me. Kept as a route because her yom link, the
// home-screen icon and every restore email point at it.
function LooksHome() {
  const { search } = useLocation()
  return <Navigate to={`/scan${search}`} replace />
}

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
  if (isNativeApp()) return null
  if (
    pathname === '/beta' ||
    pathname === '/scan' ||
    pathname === '/create' ||
    pathname === '/join' ||
    pathname === '/looks' ||
    pathname === '/lineup' ||
    pathname === '/me' ||
    pathname === '/profile' ||
    pathname === '/closet' ||
    pathname === '/everyone' ||
    pathname === '/admin' ||
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
        <Route path="/looks" element={<LooksHome />} />
        <Route path="/lineup" element={<Lineup />} />
        <Route path="/me" element={<Me />} />
        <Route path="/profile" element={<Me />} />
        <Route path="/closet" element={<ClosetBoard />} />
        <Route path="/everyone" element={<ClosetBoard />} />
        <Route path="/create" element={<Create />} />
        <Route path="/s/:shareId" element={<SharePage />} />
        <Route path="/l/:lineupId" element={<PublicLineup />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
