/* Fashion collage stickers — SVG illustrations matching the scrapbook refs */

export function GooglyEyes({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 70" fill="none" aria-hidden="true">
      <ellipse cx="35" cy="35" rx="28" ry="30" fill="#fff" stroke="#111" strokeWidth="2.5" />
      <circle cx="42" cy="38" r="11" fill="#111" />
      <circle cx="46" cy="34" r="3.5" fill="#fff" />
      <ellipse cx="85" cy="35" rx="28" ry="30" fill="#fff" stroke="#111" strokeWidth="2.5" />
      <circle cx="92" cy="40" r="11" fill="#111" />
      <circle cx="96" cy="36" r="3.5" fill="#fff" />
    </svg>
  )
}

export function FlamingHeart({ className }) {
  return (
    <svg className={className} viewBox="0 0 90 100" fill="none" aria-hidden="true">
      <path d="M45 18 C38 2 18 0 12 18 C4 42 28 58 45 78 C62 58 86 42 78 18 C72 0 52 2 45 18Z" fill="#E22" stroke="#111" strokeWidth="2" />
      <path d="M22 8 C18 -2 8 2 12 14" fill="#F90" stroke="#111" strokeWidth="1.5" />
      <path d="M45 2 C42 -6 34 0 38 12" fill="#FC0" stroke="#111" strokeWidth="1.5" />
      <path d="M68 8 C72 -2 82 2 78 14" fill="#F90" stroke="#111" strokeWidth="1.5" />
      <path d="M32 0 C30 -8 22 -2 26 10" fill="#E22" stroke="#111" strokeWidth="1.2" />
      <path d="M58 0 C60 -8 68 -2 64 10" fill="#FC0" stroke="#111" strokeWidth="1.2" />
    </svg>
  )
}

let ufoId = 0

export function FashionUFO({ className }) {
  const beamId = `beam-${++ufoId}`
  return (
    <svg className={className} viewBox="0 0 140 130" fill="none" aria-hidden="true">
      <ellipse cx="70" cy="95" rx="22" ry="8" fill="#C8F060" opacity="0.55" />
      <path d={`M48 55 L55 95 L85 95 L92 55`} fill={`url(#${beamId})`} opacity="0.75" />
      <defs>
        <linearGradient id={beamId} x1="70" y1="55" x2="70" y2="95">
          <stop stopColor="#E8FF70" stopOpacity="0.9" />
          <stop offset="1" stopColor="#C8F060" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* mini hanger being abducted */}
      <path d="M70 88 Q70 82 76 82" stroke="#111" strokeWidth="1.5" fill="none" />
      <line x1="70" y1="82" x2="70" y2="78" stroke="#111" strokeWidth="1.5" />
      <path d="M58 88 Q70 98 82 88" stroke="#111" strokeWidth="1.8" fill="none" />
      <ellipse cx="70" cy="42" rx="48" ry="14" fill="#3DBA4C" stroke="#111" strokeWidth="2" />
      <ellipse cx="70" cy="34" rx="22" ry="16" fill="#5FD46A" stroke="#111" strokeWidth="2" />
      <circle cx="62" cy="32" r="3" fill="#111" />
      <circle cx="70" cy="30" r="3" fill="#111" />
      <circle cx="78" cy="32" r="3" fill="#111" />
      <ellipse cx="70" cy="48" rx="38" ry="5" fill="#2A9A38" opacity="0.5" />
    </svg>
  )
}

export function Dice({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 70" fill="none" aria-hidden="true">
      <g transform="translate(2,8) rotate(-12)">
        <rect x="0" y="0" width="42" height="42" rx="6" fill="#fff" stroke="#111" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill="#111" />
        <circle cx="30" cy="12" r="3.5" fill="#111" />
        <circle cx="12" cy="30" r="3.5" fill="#111" />
        <circle cx="30" cy="30" r="3.5" fill="#111" />
        <circle cx="21" cy="21" r="3.5" fill="#111" />
        <circle cx="12" cy="21" r="3.5" fill="#111" />
        <circle cx="30" cy="21" r="3.5" fill="#111" />
      </g>
      <g transform="translate(48,18) rotate(8)">
        <rect x="0" y="0" width="42" height="42" rx="6" fill="#fff" stroke="#111" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill="#111" />
        <circle cx="30" cy="30" r="3.5" fill="#111" />
        <circle cx="21" cy="21" r="3.5" fill="#111" />
      </g>
    </svg>
  )
}

export function LuckPatch({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M50 6 L62 28 L88 32 L70 52 L74 78 L50 66 L26 78 L30 52 L12 32 L38 28 Z"
        fill="#2EAA45"
        stroke="#111"
        strokeWidth="2.5"
      />
      <path
        d="M50 16 L58 32 L76 35 L62 48 L65 66 L50 58 L35 66 L38 48 L24 35 L42 32 Z"
        fill="none"
        stroke="#1A7A2E"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
      <text x="50" y="48" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fontWeight="700" fill="#fff">
        777
      </text>
      <text x="50" y="64" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontStyle="italic" fill="#fff">
        Luck
      </text>
    </svg>
  )
}

export function Ladybugs({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <path d="M18 8 Q22 2 20 10" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M28 6 Q32 0 30 9" stroke="#111" strokeWidth="1.5" fill="none" />
      <ellipse cx="22" cy="22" rx="12" ry="10" fill="#E22" stroke="#111" strokeWidth="1.5" />
      <ellipse cx="16" cy="18" rx="5" ry="4.5" fill="#111" />
      <circle cx="20" cy="24" r="2" fill="#111" />
      <circle cx="28" cy="20" r="2" fill="#111" />
      <circle cx="26" cy="28" r="1.8" fill="#111" />
      <path d="M48 12 Q52 4 50 14" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M58 10 Q64 2 60 13" stroke="#111" strokeWidth="1.5" fill="none" />
      <ellipse cx="54" cy="28" rx="13" ry="11" fill="#E22" stroke="#111" strokeWidth="1.5" />
      <ellipse cx="47" cy="24" rx="5.5" ry="5" fill="#111" />
      <circle cx="52" cy="30" r="2" fill="#111" />
      <circle cx="60" cy="26" r="2" fill="#111" />
      <circle cx="58" cy="34" r="1.8" fill="#111" />
      {/* musical notes */}
      <circle cx="38" cy="6" r="2.5" fill="#111" />
      <line x1="40.5" y1="6" x2="40.5" y2="-2" stroke="#111" strokeWidth="1.5" />
      <circle cx="70" cy="8" r="2.5" fill="#111" />
      <line x1="72.5" y1="8" x2="72.5" y2="0" stroke="#111" strokeWidth="1.5" />
    </svg>
  )
}

export function Hanger({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 60" fill="none" aria-hidden="true">
      <path d="M40 8 Q40 2 46 2 Q52 2 52 8" stroke="#111" strokeWidth="2" fill="none" />
      <line x1="40" y1="8" x2="40" y2="18" stroke="#111" strokeWidth="2" />
      <path d="M8 48 L40 18 L72 48" stroke="#111" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <line x1="8" y1="48" x2="72" y2="48" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function Eye({ className }) {
  return (
    <svg className={className} viewBox="0 0 70 40" fill="none" aria-hidden="true">
      <ellipse cx="35" cy="20" rx="32" ry="18" fill="#fff" stroke="#111" strokeWidth="2" />
      <circle cx="35" cy="20" r="10" fill="#4A90D9" stroke="#111" strokeWidth="1.5" />
      <circle cx="35" cy="20" r="5" fill="#111" />
      <circle cx="38" cy="17" r="2" fill="#fff" />
    </svg>
  )
}

export function Spiral({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 20 C20 14 26 14 26 20 C26 28 12 28 12 20 C12 8 30 8 30 20 C30 34 6 34 6 20"
        stroke="#111"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Crescent({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M28 8 C18 10 12 20 16 30 C22 36 34 34 36 24 C28 28 20 22 22 14 C24 10 28 8 28 8Z"
        fill="#F5D76E"
        stroke="#111"
        strokeWidth="2"
      />
    </svg>
  )
}

export function HandPeace({ className }) {
  return (
    <svg className={className} viewBox="0 0 50 60" fill="none" aria-hidden="true">
      <path
        d="M18 58 V28 M18 28 V12 C18 8 22 8 22 12 V28 M22 28 V8 C22 4 26 4 26 8 V28 M26 28 V14 C26 10 30 10 30 14 V32 L34 36 V58"
        stroke="#111"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 40 H10 C6 40 6 48 10 48 H18" stroke="#111" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function Pencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 100" fill="none" aria-hidden="true">
      <rect x="6" y="8" width="12" height="70" fill="#3DBA4C" stroke="#111" strokeWidth="1.5" />
      <rect x="6" y="8" width="12" height="12" fill="#F5D76E" stroke="#111" strokeWidth="1.5" />
      <path d="M6 78 L12 96 L18 78 Z" fill="#F5C6A0" stroke="#111" strokeWidth="1.5" />
      <path d="M10 90 L12 96 L14 90 Z" fill="#111" />
    </svg>
  )
}

export function StickyNote({ className, color = '#C8F060', children }) {
  return (
    <div className={`sticky-note ${className || ''}`} style={{ background: color }}>
      {children}
    </div>
  )
}

/* Fergus-style step illustrations */
export function IllustBrowse({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <ellipse cx="80" cy="70" rx="50" ry="28" fill="#E8D5C4" stroke="#111" strokeWidth="2" />
      <path d="M50 55 Q80 30 110 55" stroke="#111" strokeWidth="2" fill="none" />
      <circle cx="65" cy="58" r="4" fill="#111" />
      <circle cx="95" cy="58" r="4" fill="#111" />
      <path d="M70 72 Q80 78 90 72" stroke="#111" strokeWidth="2" fill="none" />
      <rect x="55" y="20" width="50" height="28" rx="4" fill="#7EC8A0" stroke="#111" strokeWidth="2" />
      <line x1="62" y1="30" x2="98" y2="30" stroke="#111" strokeWidth="1.5" />
      <line x1="62" y1="38" x2="88" y2="38" stroke="#111" strokeWidth="1.5" />
      <circle cx="120" cy="40" r="14" fill="#F5A3B5" stroke="#111" strokeWidth="2" />
      <path d="M114 40 L120 46 L128 34" stroke="#111" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function IllustFit({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path d="M80 18 L80 28" stroke="#111" strokeWidth="2" />
      <circle cx="80" cy="14" r="5" fill="#F5D76E" stroke="#111" strokeWidth="1.5" />
      <path d="M50 100 L60 40 L80 28 L100 40 L110 100" fill="#D4A574" stroke="#111" strokeWidth="2" />
      <path d="M60 55 L50 70 M100 55 L110 70" stroke="#111" strokeWidth="2" />
      <path d="M55 48 Q40 45 35 55" stroke="#E22" strokeWidth="2" fill="none" strokeDasharray="3 2" />
      <path d="M105 48 Q120 45 125 55" stroke="#E22" strokeWidth="2" fill="none" strokeDasharray="3 2" />
      <text x="28" y="52" fontFamily="sans-serif" fontSize="10" fill="#111">S</text>
      <text x="128" y="52" fontFamily="sans-serif" fontSize="10" fill="#111">M</text>
    </svg>
  )
}

export function IllustShip({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <rect x="30" y="40" width="70" height="50" rx="4" fill="#fff" stroke="#111" strokeWidth="2" />
      <path d="M30 55 H100" stroke="#111" strokeWidth="1.5" />
      <path d="M55 40 L65 28 L75 40" fill="#E22" stroke="#111" strokeWidth="1.5" />
      <circle cx="50" cy="95" r="10" fill="#111" />
      <circle cx="50" cy="95" r="5" fill="#F7F0E8" />
      <circle cx="90" cy="95" r="10" fill="#111" />
      <circle cx="90" cy="95" r="5" fill="#F7F0E8" />
      <path d="M100 55 L130 55 L140 75 L100 75 Z" fill="#7EC8A0" stroke="#111" strokeWidth="2" />
      <rect x="45" y="62" width="20" height="16" rx="2" fill="#4A90D9" stroke="#111" strokeWidth="1.2" />
      <circle cx="78" cy="70" r="8" fill="#F5D76E" stroke="#111" strokeWidth="1.2" />
    </svg>
  )
}

export function IllustWear({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <circle cx="80" cy="28" r="16" fill="#F5C6A0" stroke="#111" strokeWidth="2" />
      <path d="M55 110 L62 55 Q80 48 98 55 L105 110" fill="#E22" stroke="#111" strokeWidth="2" />
      <path d="M62 70 Q80 85 98 70" fill="#F5A3B5" stroke="#111" strokeWidth="1.5" />
      <path d="M68 24 Q80 18 92 24" stroke="#111" strokeWidth="1.5" fill="none" />
      <circle cx="74" cy="28" r="2" fill="#111" />
      <circle cx="86" cy="28" r="2" fill="#111" />
      <path d="M76 34 Q80 37 84 34" stroke="#111" strokeWidth="1.5" fill="none" />
      <path d="M48 60 L55 70 M112 60 L105 70" stroke="#111" strokeWidth="2" />
    </svg>
  )
}

export function CrumpledPaper({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 90" fill="none" aria-hidden="true">
      <path
        d="M10 30 Q5 10 25 8 L90 5 Q115 8 110 30 L115 70 Q110 88 85 85 L25 88 Q5 85 10 60 Z"
        fill="#F5F2EC"
        stroke="#111"
        strokeWidth="1.5"
      />
      <path d="M30 20 Q50 35 40 55 Q60 45 70 60" stroke="#DDD" strokeWidth="1.2" fill="none" />
      <path d="M55 15 Q70 40 85 30 Q95 50 100 65" stroke="#E8E4DC" strokeWidth="1.2" fill="none" />
      <path d="M20 50 Q40 60 35 75" stroke="#E0DCD4" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function Scissors({ className }) {
  return (
    <svg className={className} viewBox="0 0 60 60" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="10" stroke="#111" strokeWidth="2" fill="#F5A3B5" />
      <circle cx="14" cy="46" r="10" stroke="#111" strokeWidth="2" fill="#F5A3B5" />
      <line x1="20" y1="20" x2="52" y2="48" stroke="#111" strokeWidth="2.5" />
      <line x1="20" y1="40" x2="52" y2="12" stroke="#111" strokeWidth="2.5" />
      <circle cx="22" cy="30" r="3" fill="#111" />
    </svg>
  )
}

export function ThreadSpool({ className }) {
  return (
    <svg className={className} viewBox="0 0 50 60" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="34" height="44" rx="3" fill="#4A90D9" stroke="#111" strokeWidth="2" />
      <line x1="8" y1="16" x2="42" y2="16" stroke="#111" strokeWidth="1.2" />
      <line x1="8" y1="24" x2="42" y2="24" stroke="#111" strokeWidth="1.2" />
      <line x1="8" y1="32" x2="42" y2="32" stroke="#111" strokeWidth="1.2" />
      <line x1="8" y1="40" x2="42" y2="40" stroke="#111" strokeWidth="1.2" />
      <rect x="12" y="4" width="26" height="6" rx="1" fill="#F5D76E" stroke="#111" strokeWidth="1.5" />
      <rect x="12" y="50" width="26" height="6" rx="1" fill="#F5D76E" stroke="#111" strokeWidth="1.5" />
    </svg>
  )
}
