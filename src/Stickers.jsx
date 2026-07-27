/* Risograph / screen-print fashion icons — distressed fills, limited palette */

const PINK = '#E83A8A'
const RED = '#E31C23'
const OLIVE = '#6B7A3A'
const YELLOW = '#F0C41C'
const INK = '#1A1510'

function HalftoneDefs({ id, color, size = 3 }) {
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
      <circle cx={size / 2} cy={size / 2} r={size * 0.28} fill={color} />
    </pattern>
  )
}

/** Hot pink graphic tee */
export function TeePink({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-pink" color={PINK} size={2.8} />
      </defs>
      <path
        d="M28 28 L18 38 L28 48 L28 102 L72 102 L72 48 L82 38 L72 28
           Q60 18 50 22 Q40 18 28 28 Z"
        fill={PINK}
        opacity="0.92"
      />
      <path
        d="M28 28 L18 38 L28 48 L28 102 L72 102 L72 48 L82 38 L72 28
           Q60 18 50 22 Q40 18 28 28 Z"
        fill="url(#ht-pink)"
        opacity="0.45"
      />
      <path d="M40 22 Q50 28 60 22" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="50" cy="58" r="14" fill="white" opacity="0.85" />
      <path
        d="M50 48 L53 55 L61 55 L54 60 L57 68 L50 63 L43 68 L46 60 L39 55 L47 55 Z"
        fill={PINK}
      />
    </svg>
  )
}

/** Yellow star tee */
export function TeeYellow({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-yel" color={YELLOW} size={3.2} />
      </defs>
      <path
        d="M30 30 L20 42 L30 50 L30 100 L70 100 L70 50 L80 42 L70 30
           Q58 20 50 24 Q42 20 30 30 Z"
        fill={YELLOW}
        opacity="0.95"
      />
      <path
        d="M30 30 L20 42 L30 50 L30 100 L70 100 L70 50 L80 42 L70 30
           Q58 20 50 24 Q42 20 30 30 Z"
        fill="url(#ht-yel)"
        opacity="0.4"
      />
      <path
        d="M50 44 L54 54 L65 54 L56 61 L60 72 L50 65 L40 72 L44 61 L35 54 L46 54 Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  )
}

/** Red/white plaid short-sleeve shirt */
export function PlaidShirt({ className }) {
  return (
    <svg className={className} viewBox="0 0 110 115" fill="none" aria-hidden="true">
      <defs>
        <pattern id="plaid" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="white" />
          <rect width="10" height="3" fill={RED} opacity="0.85" />
          <rect x="3" width="3" height="10" fill={RED} opacity="0.7" />
          <rect width="10" height="1.2" y="4" fill={INK} opacity="0.15" />
        </pattern>
        <HalftoneDefs id="ht-plaid" color={RED} size={2.5} />
      </defs>
      <path
        d="M32 28 L14 40 L26 52 L26 105 L84 105 L84 52 L96 40 L78 28
           Q64 14 55 20 L50 32 L45 20 Q36 14 32 28 Z"
        fill="url(#plaid)"
      />
      <path
        d="M32 28 L14 40 L26 52 L26 105 L84 105 L84 52 L96 40 L78 28
           Q64 14 55 20 L50 32 L45 20 Q36 14 32 28 Z"
        fill="url(#ht-plaid)"
        opacity="0.25"
      />
      <path d="M45 20 L50 32 L55 20" stroke={RED} strokeWidth="2" fill="none" />
      <circle cx="50" cy="48" r="2.5" fill={RED} />
      <circle cx="50" cy="60" r="2.5" fill={RED} />
      <circle cx="50" cy="72" r="2.5" fill={RED} />
    </svg>
  )
}

/** Red racing / track jacket */
export function TrackJacket({ className }) {
  return (
    <svg className={className} viewBox="0 0 110 120" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-jack" color={RED} size={2.6} />
      </defs>
      <path
        d="M30 32 L12 44 L24 56 L24 110 L86 110 L86 56 L98 44 L80 32
           Q66 18 55 24 L50 38 L45 24 Q34 18 30 32 Z"
        fill={RED}
        opacity="0.92"
      />
      <path
        d="M30 32 L12 44 L24 56 L24 110 L86 110 L86 56 L98 44 L80 32
           Q66 18 55 24 L50 38 L45 24 Q34 18 30 32 Z"
        fill="url(#ht-jack)"
        opacity="0.35"
      />
      <path d="M24 56 L24 110" stroke="white" strokeWidth="5" opacity="0.85" />
      <path d="M86 56 L86 110" stroke="white" strokeWidth="5" opacity="0.85" />
      <path d="M24 70 L86 70" stroke="white" strokeWidth="2" opacity="0.5" />
      <path
        d="M50 38 L50 110"
        stroke="white"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.6"
      />
    </svg>
  )
}

/** Olive wide-leg trousers */
export function Trousers({ className }) {
  return (
    <svg className={className} viewBox="0 0 90 140" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-olive" color={OLIVE} size={3} />
      </defs>
      <path
        d="M22 8 L68 8 L72 20 L70 130 L48 130 L45 55 L42 130 L20 130 L18 20 Z"
        fill={OLIVE}
        opacity="0.9"
      />
      <path
        d="M22 8 L68 8 L72 20 L70 130 L48 130 L45 55 L42 130 L20 130 L18 20 Z"
        fill="url(#ht-olive)"
        opacity="0.4"
      />
      <path d="M22 8 L45 22 L68 8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M45 22 L45 55" stroke="white" strokeWidth="1.2" opacity="0.4" />
      <rect x="38" y="10" width="14" height="8" rx="1" fill={INK} opacity="0.25" />
    </svg>
  )
}

/** Red mini skirt */
export function MiniSkirt({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 80" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-skirt" color={RED} size={2.8} />
      </defs>
      <path d="M28 12 L72 12 L88 72 L12 72 Z" fill={RED} opacity="0.92" />
      <path d="M28 12 L72 12 L88 72 L12 72 Z" fill="url(#ht-skirt)" opacity="0.4" />
      <path d="M28 12 L72 12" stroke="white" strokeWidth="3" opacity="0.7" />
      <path d="M35 30 L65 30" stroke="white" strokeWidth="1.2" opacity="0.35" />
      <path d="M30 48 L70 48" stroke="white" strokeWidth="1.2" opacity="0.3" />
      <circle cx="50" cy="18" r="2.5" fill="white" opacity="0.8" />
    </svg>
  )
}

/** Olive high-top sneaker */
export function Sneaker({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 80" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-shoe" color={OLIVE} size={2.5} />
      </defs>
      <path
        d="M18 48 Q18 28 38 22 L55 18 L62 8 L78 10 L82 28 L108 42 L110 58 L20 62 Q14 58 18 48 Z"
        fill={OLIVE}
        opacity="0.92"
      />
      <path
        d="M18 48 Q18 28 38 22 L55 18 L62 8 L78 10 L82 28 L108 42 L110 58 L20 62 Q14 58 18 48 Z"
        fill="url(#ht-shoe)"
        opacity="0.35"
      />
      <path d="M20 58 L108 54 L110 62 L18 64 Z" fill="white" opacity="0.9" />
      <ellipse cx="95" cy="48" rx="14" ry="10" fill="white" opacity="0.85" />
      <path
        d="M58 22 L72 26 M56 28 L74 32 M54 34 L76 38"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M62 8 L62 20" stroke="white" strokeWidth="2" />
    </svg>
  )
}

/** Hot pink shoulder bag */
export function PinkBag({ className }) {
  return (
    <svg className={className} viewBox="0 0 90 100" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-bag" color={PINK} size={2.8} />
      </defs>
      <path
        d="M28 8 Q45 2 62 8"
        stroke={PINK}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M28 8 L22 38 M62 8 L68 38" stroke={PINK} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="14" y="36" width="62" height="52" rx="6" fill={PINK} opacity="0.92" />
      <rect x="14" y="36" width="62" height="52" rx="6" fill="url(#ht-bag)" opacity="0.4" />
      <rect x="36" y="48" width="18" height="12" rx="2" fill="white" opacity="0.75" />
      <path d="M20 36 H70" stroke="white" strokeWidth="2" opacity="0.4" />
    </svg>
  )
}

/** Square-face watch with olive strap */
export function Watch({ className }) {
  return (
    <svg className={className} viewBox="0 0 50 90" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-watch" color={OLIVE} size={2.4} />
      </defs>
      <rect x="14" y="2" width="22" height="28" rx="3" fill={OLIVE} opacity="0.9" />
      <rect x="14" y="60" width="22" height="28" rx="3" fill={OLIVE} opacity="0.9" />
      <rect x="14" y="2" width="22" height="28" rx="3" fill="url(#ht-watch)" opacity="0.35" />
      <rect x="14" y="60" width="22" height="28" rx="3" fill="url(#ht-watch)" opacity="0.35" />
      <rect x="8" y="28" width="34" height="34" rx="4" fill={INK} opacity="0.85" />
      <rect x="12" y="32" width="26" height="26" rx="2" fill="#F5F0E6" />
      <circle cx="25" cy="45" r="2" fill={INK} />
      <path
        d="M25 45 L25 38 M25 45 L32 48"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Yellow striped sock */
export function Sock({ className }) {
  return (
    <svg className={className} viewBox="0 0 60 100" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-sock" color={YELLOW} size={2.6} />
      </defs>
      <path
        d="M18 4 H42 V55 Q42 62 50 68 L56 78 Q58 88 48 92 L22 92 Q12 88 14 78 L18 68 Q22 62 22 55 Z"
        fill={YELLOW}
        opacity="0.95"
      />
      <path
        d="M18 4 H42 V55 Q42 62 50 68 L56 78 Q58 88 48 92 L22 92 Q12 88 14 78 L18 68 Q22 62 22 55 Z"
        fill="url(#ht-sock)"
        opacity="0.35"
      />
      <path d="M18 18 H42 M18 28 H42 M18 38 H42" stroke="white" strokeWidth="4" opacity="0.85" />
    </svg>
  )
}

/** Pink-rim glasses */
export function Glasses({ className }) {
  return (
    <svg className={className} viewBox="0 0 110 40" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-glass" color={PINK} size={2.2} />
      </defs>
      <rect
        x="8"
        y="8"
        width="38"
        height="26"
        rx="8"
        stroke={PINK}
        strokeWidth="4"
        fill="url(#ht-glass)"
        fillOpacity="0.25"
      />
      <rect
        x="64"
        y="8"
        width="38"
        height="26"
        rx="8"
        stroke={PINK}
        strokeWidth="4"
        fill="url(#ht-glass)"
        fillOpacity="0.25"
      />
      <path
        d="M46 18 Q55 12 64 18"
        stroke={PINK}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M8 16 L2 12 M102 16 L108 12" stroke={PINK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Beaded necklace */
export function Necklace({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 70" fill="none" aria-hidden="true">
      <path
        d="M10 8 Q40 55 70 8"
        stroke={INK}
        strokeWidth="2"
        fill="none"
        strokeDasharray="0.5 6"
        strokeLinecap="round"
      />
      {[
        [18, 22],
        [26, 34],
        [40, 42],
        [54, 34],
        [62, 22],
        [32, 28],
        [48, 28],
        [40, 32],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 4 : 2.8}
          fill={i % 2 ? PINK : OLIVE}
          opacity="0.9"
        />
      ))}
    </svg>
  )
}

export function IllustBrowse({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-ib" color={PINK} size={3} />
      </defs>
      <g transform="translate(30,5)">
        <path
          d="M28 28 L18 38 L28 48 L28 102 L72 102 L72 48 L82 38 L72 28 Q60 18 50 22 Q40 18 28 28 Z"
          fill={PINK}
          opacity="0.9"
        />
        <path
          d="M28 28 L18 38 L28 48 L28 102 L72 102 L72 48 L82 38 L72 28 Q60 18 50 22 Q40 18 28 28 Z"
          fill="url(#ht-ib)"
          opacity="0.35"
        />
        <circle cx="50" cy="58" r="12" fill="white" opacity="0.85" />
        <path
          d="M50 48 L53 55 L60 55 L54 59 L57 66 L50 62 L43 66 L46 59 L40 55 L47 55 Z"
          fill={PINK}
        />
      </g>
    </svg>
  )
}

export function IllustFit({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <defs>
        <HalftoneDefs id="ht-if" color={OLIVE} size={3} />
      </defs>
      <g transform="translate(45, -5) scale(0.85)">
        <path
          d="M22 8 L68 8 L72 20 L70 130 L48 130 L45 55 L42 130 L20 130 L18 20 Z"
          fill={OLIVE}
          opacity="0.9"
        />
        <path
          d="M22 8 L68 8 L72 20 L70 130 L48 130 L45 55 L42 130 L20 130 L18 20 Z"
          fill="url(#ht-if)"
          opacity="0.35"
        />
        <path d="M22 8 L45 22 L68 8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
      </g>
      <path
        d="M30 40 Q20 50 28 60"
        stroke={RED}
        strokeWidth="2"
        fill="none"
        strokeDasharray="4 3"
      />
      <path
        d="M130 40 Q140 50 132 60"
        stroke={RED}
        strokeWidth="2"
        fill="none"
        strokeDasharray="4 3"
      />
    </svg>
  )
}

export function IllustShip({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <rect x="35" y="35" width="70" height="50" rx="4" fill={YELLOW} opacity="0.9" />
      <path d="M35 50 H105" stroke={INK} strokeWidth="1.5" opacity="0.3" />
      <path d="M60 35 L70 22 L80 35" fill={RED} />
      <circle cx="55" cy="95" r="10" fill={INK} />
      <circle cx="55" cy="95" r="5" fill="#F7F0E8" />
      <circle cx="95" cy="95" r="10" fill={INK} />
      <circle cx="95" cy="95" r="5" fill="#F7F0E8" />
      <path d="M105 50 L135 50 L145 72 L105 72 Z" fill={OLIVE} opacity="0.9" />
      <g transform="translate(48,55) scale(0.35)">
        <path
          d="M28 28 L18 38 L28 48 L28 90 L72 90 L72 48 L82 38 L72 28 Q60 18 50 22 Q40 18 28 28 Z"
          fill={PINK}
        />
      </g>
    </svg>
  )
}

export function IllustWear({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <circle cx="80" cy="28" r="16" fill="#E8C4A8" />
      <path d="M55 110 L62 52 Q80 44 98 52 L105 110" fill={RED} opacity="0.92" />
      <path d="M62 68 Q80 82 98 68" fill={PINK} opacity="0.85" />
      <circle cx="74" cy="28" r="2" fill={INK} />
      <circle cx="86" cy="28" r="2" fill={INK} />
      <rect x="58" y="18" width="44" height="8" rx="2" fill={OLIVE} opacity="0.8" />
    </svg>
  )
}
