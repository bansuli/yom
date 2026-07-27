import { useState, useRef, useEffect } from 'react'
import './App.css'
import './Survey.css'
import closet1 from './assets/closet-1.webp'
import closet2 from './assets/closet-2.webp'
import closet3 from './assets/closet-3.webp'
import closet4 from './assets/closet-4.jpg'
import closet5 from './assets/closet-5.webp'

const modules = import.meta.glob('./assets/outfit-*.{jpg,webp,png}', { eager: true })
const OUTFITS = Object.values(modules).map(m => m.default)
const CLOSET_ITEMS = [closet1, closet2, closet3, closet4, closet5]

const TRAITS = [
  "i buy things i never wear",
  "i always think i have nothing to wear",
  "i panic before trips & events",
  "i spend forever deciding what to buy",
]

const PRE_BUY = [
  "i ask my friends",
  "i scroll pinterest or tiktok",
  "i compare 20 websites",
  "i just wing it",
]

const FAKE_CALENDAR_EVENTS = [
  { date: 'jul 31', label: 'dinner reservation — nobu', type: 'dinner' },
  { date: 'aug 3–7', label: 'trip to miami', type: 'trip' },
  { date: 'aug 15', label: 'job interview', type: 'interview' },
  { date: 'sep 6', label: "kayla's wedding — black tie", type: 'wedding' },
  { date: 'sep 22', label: 'zara order arriving', type: 'delivery' },
]

const ANALYZE_LINES = [
  'reading your answers…',
  'mapping your taste profile…',
  'cross-referencing your outfits…',
  'done.',
]

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle' },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'pinterest.com/yourprofile' },
  { key: 'ltk', label: 'LTK', placeholder: 'liketoknow.it/yourprofile' },
  { key: 'shopmy', label: 'ShopMy', placeholder: 'shopmy.us/yourname' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@yourhandle' },
]

function getStyleArchetype(yesCount, noCount) {
  const total = yesCount + noCount
  const ratio = total > 0 ? yesCount / total : 0.5
  if (ratio >= 0.68) return {
    name: 'the bold collector',
    tag: 'maximalist energy',
    desc: 'you say yes to almost everything — texture, color, risk. you dress for attention, even when you say you don\'t.',
    yesRate: Math.round(ratio * 100),
  }
  if (ratio >= 0.42) return {
    name: 'the curated eye',
    tag: 'selective taste',
    desc: 'your yeses are deliberate and your nos are firm. you have a specific vision — you just don\'t always know how to execute it.',
    yesRate: Math.round(ratio * 100),
  }
  return {
    name: 'the selective edit',
    tag: 'minimalist instinct',
    desc: 'almost nothing gets a yes from you. that\'s not a limitation — that\'s taste. you\'re harder to dress, and more rewarding when it clicks.',
    yesRate: Math.round(ratio * 100),
  }
}

const TRAIT_INSIGHTS = {
  "i buy things i never wear": {
    label: 'shopping habit',
    badge: 'impulse buyer',
    insight: 'you shop with your eyes, not your wardrobe. the thrill of a new piece tends to outweigh whether it actually fits your life — or your other clothes.',
  },
  "i always think i have nothing to wear": {
    label: 'shopping habit',
    badge: 'wardrobe blind spot',
    insight: 'your closet probably has more than you think. the problem isn\'t quantity — it\'s that you can\'t see the combinations. you need a system, not more shopping.',
  },
  "i panic before trips & events": {
    label: 'shopping habit',
    badge: 'occasion dresser',
    insight: 'your day-to-day wardrobe runs on autopilot, but anything with a dress code sends you into a last-minute spiral. the fix is planning, not panic-buying.',
  },
  "i spend forever deciding what to buy": {
    label: 'shopping habit',
    badge: 'analysis paralysis',
    insight: 'you care deeply about getting it right and still walk away second-guessing. you don\'t need more research — you need a framework to trust what you already know.',
  },
}

const PRE_BUY_INSIGHTS = {
  "i ask my friends": {
    label: 'decision style',
    badge: 'social validator',
    insight: 'you trust people over algorithms. your style decisions are collaborative — which makes you influenced, but also well-edited when the right people are in your corner.',
  },
  "i scroll pinterest or tiktok": {
    label: 'decision style',
    badge: 'feed shopper',
    insight: 'you\'re visually driven and trend-aware. you shop what you see, which means your style is current — but sometimes borrowed instead of truly yours.',
  },
  "i compare 20 websites": {
    label: 'decision style',
    badge: 'methodical researcher',
    insight: 'every purchase earns its place. you almost never have regrets — but you lose hours in the process and sometimes talk yourself out of things you actually wanted.',
  },
  "i just wing it": {
    label: 'decision style',
    badge: 'instinct-led',
    insight: 'you\'re spontaneous and confident. sometimes it\'s exactly right. sometimes it sits in your closet with tags on. there\'s no middle ground with you.',
  },
}

function getClosetInsight(freqs) {
  const avg = freqs.reduce((a, b) => a + b, 0) / freqs.length
  if (avg >= 2.5) return 'you actually wear what you own. that\'s rare — your instincts are working and your wardrobe is functional.'
  if (avg >= 1.5) return 'you wear some of it regularly. the rest is just making your closet feel full without being useful to you.'
  return 'most of what you own isn\'t getting worn. that\'s not a shopping problem — that\'s a clarity problem. you need to see what you have before you buy anything else.'
}

const IconThumbUp = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
)

const IconThumbDown = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
)

const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconLink = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const IconPen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const IconPhoto = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconSkip = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 4 15 12 5 20 5 4"/>
    <line x1="19" y1="5" x2="19" y2="19"/>
  </svg>
)

export default function Survey() {
  const [index, setIndex] = useState(0)
  const [exiting, setExiting] = useState(null)
  const [step, setStep] = useState(new URLSearchParams(window.location.search).get('step') || 'outfits')
  const [yesCount, setYesCount] = useState(0)
  const [noCount, setNoCount] = useState(0)
  const [selectedTrait, setSelectedTrait] = useState(null)
  const [selectedPreBuy, setSelectedPreBuy] = useState(null)
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [q4mode, setQ4mode] = useState(null)
  const [q4draft, setQ4draft] = useState('')
  const [q4items, setQ4items] = useState([])
  const [q6mode, setQ6mode] = useState(null)
  const [q6draft, setQ6draft] = useState('')
  const [q6items, setQ6items] = useState([])
  const [q7freqs, setQ7freqs] = useState(CLOSET_ITEMS.map(() => 1))
  const [socialLinks, setSocialLinks] = useState({})
  const [activePlatform, setActivePlatform] = useState(null)
  const [socialDraft, setSocialDraft] = useState('')
  const [calPhase, setCalPhase] = useState(0)
  const [calEventsShown, setCalEventsShown] = useState(0)
  const [analyzePhase, setAnalyzePhase] = useState(0)
  const fileRef = useRef(null)
  const fileRef6 = useRef(null)

  useEffect(() => {
    if (step !== 'cal-loading') return
    setCalPhase(0)
    setCalEventsShown(0)
    const t1 = setTimeout(() => setCalPhase(1), 1000)
    const eventTimers = [1600, 2200, 2800, 3400, 4000].map((d, i) =>
      setTimeout(() => setCalEventsShown(i + 1), d)
    )
    const t2 = setTimeout(() => setCalPhase(2), 4400)
    return () => { clearTimeout(t1); clearTimeout(t2); eventTimers.forEach(clearTimeout) }
  }, [step])

  useEffect(() => {
    if (calPhase !== 3) return
    const t = setTimeout(() => setStep('social'), 2800)
    return () => clearTimeout(t)
  }, [calPhase])

  useEffect(() => {
    if (step !== 'analyzing') return
    setAnalyzePhase(0)
    const t1 = setTimeout(() => setAnalyzePhase(1), 900)
    const t2 = setTimeout(() => setAnalyzePhase(2), 1800)
    const t3 = setTimeout(() => setAnalyzePhase(3), 2600)
    const t4 = setTimeout(() => setStep('results'), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [step])

  function vote(dir) {
    if (dir === 'up') setYesCount(c => c + 1)
    else setNoCount(c => c + 1)
    setExiting(dir)
    setTimeout(() => {
      setExiting(null)
      setIndex(i => {
        const next = i + 1
        if (next >= OUTFITS.length) setStep('q2')
        return next
      })
    }, 300)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setQ4items(prev => [...prev, { type: 'photo', value: url }])
    e.target.value = ''
    setQ4mode('photo-preview-list')
  }

  function submitDraft(andDone = false) {
    if (!q4draft.trim()) return
    const newItems = [...q4items, { type: q4mode, value: q4draft.trim() }]
    setQ4items(newItems)
    setQ4draft('')
    if (andDone) { setQ4mode(null); setStep('q6') }
    else setQ4mode(null)
  }

  function finishQ4() {
    if (q4draft.trim()) {
      setQ4items(prev => [...prev, { type: q4mode, value: q4draft.trim() }])
      setQ4draft('')
    }
    setQ4mode(null)
    setStep('q6')
  }

  function handleFile6(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setQ6items(prev => [...prev, { type: 'photo', value: url }])
    e.target.value = ''
    setQ6mode('photo-preview-list')
  }

  function submitDraft6(andDone = false) {
    if (!q6draft.trim()) return
    setQ6items(prev => [...prev, { type: q6mode, value: q6draft.trim() }])
    setQ6draft('')
    if (andDone) { setQ6mode(null); setStep('q5') }
    else setQ6mode(null)
  }

  function finishQ6() {
    if (q6draft.trim()) {
      setQ6items(prev => [...prev, { type: q6mode, value: q6draft.trim() }])
      setQ6draft('')
    }
    setQ6mode(null)
    setStep('q5')
  }

  function saveSocialLink() {
    if (!socialDraft.trim() || !activePlatform) return
    setSocialLinks(prev => ({ ...prev, [activePlatform]: socialDraft.trim() }))
    setSocialDraft('')
    setActivePlatform(null)
  }

  const archetype = getStyleArchetype(yesCount, noCount)
  const traitInsight = TRAIT_INSIGHTS[selectedTrait]
  const preBuyInsight = PRE_BUY_INSIGHTS[selectedPreBuy]
  const closetInsight = getClosetInsight(q7freqs)
  const linkedPlatforms = Object.keys(socialLinks)

  return (
    <div className="page">
      <section className="survey-hero">
        {step === 'outfits' ? (
          <>
            <p className="survey-q">would you steal this fit?</p>
            <p className="survey-counter">{index + 1} / {OUTFITS.length}</p>
            <div className={`outfit-card ${exiting === 'down' ? 'exit-down' : ''} ${exiting === 'up' ? 'exit-up' : ''}`}>
              <img src={OUTFITS[index]} alt="" draggable={false} />
            </div>
            <div className="vote-row">
              <button className="vote-btn vote-no" onClick={() => vote('down')} aria-label="no"><IconThumbDown /></button>
              <button className="vote-btn vote-yes" onClick={() => vote('up')} aria-label="yes"><IconThumbUp /></button>
            </div>
          </>
        ) : step === 'q2' ? (
          <>
            <p className="survey-q traits-q">which one sounds the most like you?</p>
            <div className="trait-grid">
              {TRAITS.map(trait => (
                <button key={trait} className="trait-card" onClick={() => { setSelectedTrait(trait); setStep('q3') }}>{trait}</button>
              ))}
            </div>
          </>
        ) : step === 'q3' ? (
          <>
            <p className="survey-q traits-q">what usually happens before you buy something?</p>
            <div className="trait-grid">
              {PRE_BUY.map(option => (
                <button key={option} className="trait-card" onClick={() => { setSelectedPreBuy(option); setStep('q4') }}>{option}</button>
              ))}
            </div>
          </>
        ) : step === 'q5' ? (
          <>
            <p className="survey-q traits-q">let's meet your closet.</p>
            <p className="q5-sub">teach me what you already own, and i'll figure out what goes together, what's missing, and what you'll actually wear.</p>
            <div className="q4-options">
              <button className="q4-btn" onClick={() => setStep('q7')}><span className="q4-icon"><IconMail /></span> import purchase history</button>
              <button className="q4-btn" onClick={() => setStep('scan')}><span className="q4-icon"><IconPhoto /></span> scan closet</button>
              <button className="q4-btn q4-btn-ghost" onClick={() => setStep('calendar')}><span className="q4-icon"><IconSkip /></span> do it later</button>
            </div>
          </>
        ) : step === 'q6' ? (
          <>
            <p className="survey-q traits-q">which purchase do you regret the most?</p>

            {q6items.length > 0 && (
              <div className="q4-items">
                {q6items.map((item, i) => (
                  <div key={i} className="q4-chip">
                    {item.type === 'photo'
                      ? <img src={item.value} alt="" className="q4-chip-img" />
                      : <span>{item.value}</span>
                    }
                    <button className="q4-chip-remove" onClick={() => setQ6items(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}

            {!q6mode && (
              <div className="q4-options">
                <input ref={fileRef6} type="file" accept="image/*" className="q4-file-input" onChange={handleFile6} />
                <button className="q4-btn" onClick={() => fileRef6.current.click()}>
                  <span className="q4-icon"><IconUpload /></span> upload a photo
                </button>
                <button className="q4-btn" onClick={() => setQ6mode('link')}>
                  <span className="q4-icon"><IconLink /></span> insert a link
                </button>
                <button className="q4-btn" onClick={() => setQ6mode('describe')}>
                  <span className="q4-icon"><IconPen /></span> describe it
                </button>
              </div>
            )}

            {(q6mode === 'link' || q6mode === 'describe') && (
              <div className="q4-input-wrap">
                {q6mode === 'link' ? (
                  <input
                    className="q4-text-input"
                    type="url"
                    placeholder="paste a link..."
                    value={q6draft}
                    onChange={e => setQ6draft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && finishQ6()}
                    autoFocus
                  />
                ) : (
                  <textarea
                    className="q4-text-input q4-textarea"
                    placeholder="tell us about it..."
                    value={q6draft}
                    onChange={e => setQ6draft(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="q4-input-actions">
                  <button className="trait-card q4-back" onClick={() => { setQ6mode(null); setQ6draft('') }}>← back</button>
                  {q6draft.trim() && (
                    <>
                      <button className="trait-card q4-add" onClick={() => submitDraft6(false)}>add +</button>
                      <button className="trait-card q4-done" onClick={finishQ6}>done →</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {q6mode === 'photo-preview-list' && (
              <div className="q4-input-actions">
                <button className="trait-card q4-back" onClick={() => setQ6mode(null)}>add another</button>
                <button className="trait-card q4-done" onClick={() => { setQ6mode(null); setStep('q5') }}>done →</button>
              </div>
            )}

            {!q6mode && (
              <div className="social-footer-actions">
                {q6items.length > 0 && (
                  <button className="trait-card q4-done" onClick={() => setStep('q5')}>done →</button>
                )}
                <button className="social-skip-btn" onClick={() => setStep('q5')}>
                  {q6items.length > 0 ? 'skip the rest' : 'skip →'}
                </button>
              </div>
            )}
          </>
        ) : step === 'scan' ? (
          <>
            <p className="survey-q traits-q">scan your closet.</p>
            <p className="q5-sub">point your camera at your clothes, one by one. we'll pick them up automatically.</p>
            <div className="scan-viewfinder">
              <div className="scan-corner tl"/><div className="scan-corner tr"/>
              <div className="scan-corner bl"/><div className="scan-corner br"/>
              <p className="scan-hint">scanner coming soon</p>
            </div>
            <button className="trait-card q4-done" onClick={() => setStep('q7')}>done scanning →</button>
          </>
        ) : step === 'q7' ? (
          <>
            <p className="survey-q traits-q">how often do you wear these?</p>
            <div className="q7-list">
              {CLOSET_ITEMS.map((src, i) => (
                <div key={i} className="q7-item">
                  <div className="q7-img-wrap">
                    <img src={src} alt="" draggable={false} />
                  </div>
                  <div className="freq-slider-wrap">
                    <p className="freq-label">{['never worn it', 'rarely', 'sometimes', 'wear it constantly'][q7freqs[i]]}</p>
                    <input
                      className="freq-slider"
                      type="range"
                      min={0} max={3} step={1}
                      value={q7freqs[i]}
                      onChange={e => setQ7freqs(prev => prev.map((v, j) => j === i ? Number(e.target.value) : v))}
                    />
                    <div className="freq-ends">
                      <span>never</span>
                      <span>constantly</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="trait-card q4-done" onClick={() => setStep('calendar')}>done →</button>
          </>
        ) : step === 'calendar' ? (
          <div className="cal-page">
            <p className="cal-kicker">one last thing</p>
            <h2 className="cal-big-headline">show me<br/>your calendar.</h2>
            <div className="cal-reason-list">
              <p className="cal-reason-item">trips</p>
              <p className="cal-reason-item">dinners</p>
              <p className="cal-reason-item">weddings</p>
              <p className="cal-reason-item">interviews</p>
              <p className="cal-reason-item">weather</p>
              <p className="cal-reason-item">delivery dates</p>
            </div>
            <p className="cal-reason-footer">i'll have an outfit ready for all of it.</p>
            <button className="cal-connect-btn" onClick={() => setStep('cal-loading')}>
              connect google calendar
            </button>
          </div>
        ) : step === 'cal-loading' ? (
          <div className="cal-loading-wrap">
            {calPhase === 0 && (
              <p className="cal-loading-status">connecting to google calendar<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span></p>
            )}
            {calPhase >= 1 && (
              <>
                <p className="cal-loading-status">here's what i see coming up</p>
                <div className="cal-events-list">
                  {FAKE_CALENDAR_EVENTS.slice(0, calEventsShown).map((ev, i) => (
                    <div key={i} className={`cal-event-row cal-event-type-${ev.type}`} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="cal-event-info">
                        <span className="cal-event-label">{ev.label}</span>
                        <span className="cal-event-date">{ev.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {calPhase === 2 && (
              <button className="trait-card q4-done cal-continue-btn" onClick={() => setCalPhase(3)}>
                start planning →
              </button>
            )}
            {calPhase === 3 && (
              <div className="cal-bg-notice">
                <p className="cal-bg-title">running in the background.</p>
                <p className="cal-bg-sub">we'll send you outfit recommendations as your events get closer.</p>
              </div>
            )}
          </div>
        ) : step === 'analyzing' ? (
          <div className="analyzing-wrap">
            <div className="analyzing-lines">
              {ANALYZE_LINES.slice(0, analyzePhase + 1).map((line, i) => (
                <p
                  key={i}
                  className={`analyzing-line ${i === analyzePhase ? 'analyzing-line-active' : 'analyzing-line-done'}`}
                >
                  {line}
                  {i === analyzePhase && i < ANALYZE_LINES.length - 1 && (
                    <span className="loading-dots"><span>.</span><span>.</span><span>.</span></span>
                  )}
                </p>
              ))}
            </div>
          </div>
        ) : step === 'social' ? (
          <>
            <p className="survey-q traits-q">link your inspiration.</p>
            <p className="q5-sub">share where you shop and discover style — yom will use this to understand your taste even better.</p>

            <div className="social-platforms">
              {SOCIAL_PLATFORMS.map(p => (
                <button
                  key={p.key}
                  className={`social-platform-btn ${socialLinks[p.key] ? 'social-platform-saved' : ''} ${activePlatform === p.key ? 'social-platform-active' : ''}`}
                  onClick={() => {
                    if (activePlatform === p.key) {
                      setActivePlatform(null)
                      setSocialDraft('')
                    } else {
                      setActivePlatform(p.key)
                      setSocialDraft(socialLinks[p.key] || '')
                    }
                  }}
                >
                  {p.label}
                  {socialLinks[p.key] && <span className="social-saved-dot" />}
                </button>
              ))}
            </div>

            {activePlatform && (
              <div className="q4-input-wrap">
                <input
                  className="q4-text-input"
                  type="text"
                  placeholder={SOCIAL_PLATFORMS.find(p => p.key === activePlatform)?.placeholder}
                  value={socialDraft}
                  onChange={e => setSocialDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveSocialLink() }}
                  autoFocus
                />
                <div className="q4-input-actions">
                  <button className="trait-card q4-back" onClick={() => { setActivePlatform(null); setSocialDraft('') }}>← back</button>
                  {socialDraft.trim() && (
                    <button className="trait-card q4-done" onClick={saveSocialLink}>save →</button>
                  )}
                </div>
              </div>
            )}

            {!activePlatform && (
              <div className="social-footer-actions">
                {linkedPlatforms.length > 0 && (
                  <button className="trait-card q4-done" onClick={() => setStep('analyzing')}>see my profile →</button>
                )}
                <button className="social-skip-btn" onClick={() => setStep('analyzing')}>
                  {linkedPlatforms.length > 0 ? 'skip the rest' : 'skip this →'}
                </button>
              </div>
            )}
          </>
        ) : step === 'results' ? (
          <div className="results-wrap">
            <p className="results-kicker">what yom learned about you</p>

            <div className="results-archetype">
              <span className="results-archetype-tag">{archetype.tag}</span>
              <h1 className="results-archetype-name">{archetype.name}</h1>
              <p className="results-archetype-desc">{archetype.desc}</p>
            </div>

            <div className="results-stat-row">
              <div className="results-stat">
                <span className="results-stat-num">{archetype.yesRate}%</span>
                <span className="results-stat-label">outfits you'd steal</span>
              </div>
              <div className="results-stat-divider" />
              <div className="results-stat">
                <span className="results-stat-num">{OUTFITS.length}</span>
                <span className="results-stat-label">looks reviewed</span>
              </div>
              {linkedPlatforms.length > 0 && (
                <>
                  <div className="results-stat-divider" />
                  <div className="results-stat">
                    <span className="results-stat-num">{linkedPlatforms.length}</span>
                    <span className="results-stat-label">source{linkedPlatforms.length > 1 ? 's' : ''} linked</span>
                  </div>
                </>
              )}
            </div>

            <div className="insight-cards">
              {traitInsight && (
                <div className="insight-card">
                  <span className="insight-card-label">{traitInsight.label}</span>
                  <span className="insight-card-badge">{traitInsight.badge}</span>
                  <p className="insight-card-body">{traitInsight.insight}</p>
                </div>
              )}
              {preBuyInsight && (
                <div className="insight-card">
                  <span className="insight-card-label">{preBuyInsight.label}</span>
                  <span className="insight-card-badge">{preBuyInsight.badge}</span>
                  <p className="insight-card-body">{preBuyInsight.insight}</p>
                </div>
              )}
              <div className="insight-card insight-card-closet">
                <span className="insight-card-label">wardrobe reality</span>
                <p className="insight-card-body">{closetInsight}</p>
              </div>
            </div>

            <p className="results-footer-note">
              your profile lives here. you can always edit it, ask for a new quiz, or reset everything if your style changes.
            </p>

          </div>
        ) : (
          <>
            <p className="survey-q traits-q">what's the best purchase you've ever made?</p>

            {q4items.length > 0 && (
              <div className="q4-items">
                {q4items.map((item, i) => (
                  <div key={i} className="q4-chip">
                    {item.type === 'photo'
                      ? <img src={item.value} alt="" className="q4-chip-img" />
                      : <span>{item.value}</span>
                    }
                    <button className="q4-chip-remove" onClick={() => setQ4items(prev => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}

            {!q4mode && (
              <div className="q4-options">
                <input ref={fileRef} type="file" accept="image/*" className="q4-file-input" onChange={handleFile} />
                <button className="q4-btn" onClick={() => fileRef.current.click()}>
                  <span className="q4-icon"><IconUpload /></span> upload a photo
                </button>
                <button className="q4-btn" onClick={() => setQ4mode('link')}>
                  <span className="q4-icon"><IconLink /></span> insert a link
                </button>
                <button className="q4-btn" onClick={() => setQ4mode('describe')}>
                  <span className="q4-icon"><IconPen /></span> describe it
                </button>
              </div>
            )}

            {(q4mode === 'link' || q4mode === 'describe') && (
              <div className="q4-input-wrap">
                {q4mode === 'link' ? (
                  <input
                    className="q4-text-input"
                    type="url"
                    placeholder="paste a link..."
                    value={q4draft}
                    onChange={e => setQ4draft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && finishQ4()}
                    autoFocus
                  />
                ) : (
                  <textarea
                    className="q4-text-input q4-textarea"
                    placeholder="tell us about it..."
                    value={q4draft}
                    onChange={e => setQ4draft(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="q4-input-actions">
                  <button className="trait-card q4-back" onClick={() => { setQ4mode(null); setQ4draft('') }}>← back</button>
                  {q4draft.trim() && (
                    <>
                      <button className="trait-card q4-add" onClick={() => submitDraft(false)}>add +</button>
                      <button className="trait-card q4-done" onClick={finishQ4}>done →</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {q4mode === 'photo-preview-list' && (
              <div className="q4-input-actions">
                <button className="trait-card q4-back" onClick={() => setQ4mode(null)}>add another</button>
                <button className="trait-card q4-done" onClick={() => { setQ4mode(null); setStep('q6') }}>done →</button>
              </div>
            )}

            {!q4mode && (
              <div className="social-footer-actions">
                {q4items.length > 0 && (
                  <button className="trait-card q4-done" onClick={() => setStep('q6')}>done →</button>
                )}
                <button className="social-skip-btn" onClick={() => setStep('q6')}>
                  {q4items.length > 0 ? 'skip the rest' : 'skip →'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
