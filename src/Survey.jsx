import { useState, useRef, useEffect } from 'react'
import './App.css'
import './Survey.css'
import { saveSurvey, surveyPayload } from './lib/survey-store.js'
const modules = import.meta.glob('./assets/outfit-*.{jpg,webp,png}', { eager: true })
const OUTFITS = Object.values(modules).map(m => m.default).slice(0, 6)

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

const TRAITS = [
  "i buy things i never wear",
  "i always think i have nothing to wear",
  "i panic before trips & events",
  "i spend forever deciding what to buy",
]

const BRAND_SEARCHES = [
  { keywords: ['zara'], name: 'Zara', url: q => `https://www.zara.com/us/en/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['h&m', 'hm '], name: 'H&M', url: q => `https://www2.hm.com/en_us/search-results.html?q=${encodeURIComponent(q)}` },
  { keywords: ['uniqlo'], name: 'Uniqlo', url: q => `https://www.uniqlo.com/us/en/search?q=${encodeURIComponent(q)}` },
  { keywords: ['mango'], name: 'Mango', url: q => `https://shop.mango.com/us/women/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['cos ', 'cos\b'], name: 'COS', url: q => `https://www.cos.com/en_usd/search.html?q=${encodeURIComponent(q)}` },
  { keywords: ['arket'], name: 'Arket', url: q => `https://www.arket.com/en_usd/search?q=${encodeURIComponent(q)}` },
  { keywords: ['urban outfitters', 'urbanoutfitters'], name: 'Urban Outfitters', url: q => `https://www.urbanoutfitters.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['free people'], name: 'Free People', url: q => `https://www.freepeople.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['anthropologie'], name: 'Anthropologie', url: q => `https://www.anthropologie.com/search?query=${encodeURIComponent(q)}` },
  { keywords: ['aritzia'], name: 'Aritzia', url: q => `https://www.aritzia.com/en/search?q=${encodeURIComponent(q)}` },
  { keywords: ['reformation'], name: 'Reformation', url: q => `https://www.thereformation.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['everlane'], name: 'Everlane', url: q => `https://www.everlane.com/search?query=${encodeURIComponent(q)}` },
  { keywords: ['nike'], name: 'Nike', url: q => `https://www.nike.com/w?q=${encodeURIComponent(q)}&vst=${encodeURIComponent(q)}` },
  { keywords: ['adidas'], name: 'Adidas', url: q => `https://www.adidas.com/us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['new balance'], name: 'New Balance', url: q => `https://www.newbalance.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['converse'], name: 'Converse', url: q => `https://www.converse.com/shop/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['vans'], name: 'Vans', url: q => `https://www.vans.com/en-us/search#q=${encodeURIComponent(q)}` },
  { keywords: ['asos'], name: 'ASOS', url: q => `https://www.asos.com/search/?q=${encodeURIComponent(q)}` },
  { keywords: ['depop'], name: 'Depop', url: q => `https://www.depop.com/search/?q=${encodeURIComponent(q)}` },
  { keywords: ['vinted'], name: 'Vinted', url: q => `https://www.vinted.com/catalog?search_text=${encodeURIComponent(q)}` },
  { keywords: ['grailed'], name: 'Grailed', url: q => `https://www.grailed.com/search?query=${encodeURIComponent(q)}` },
  { keywords: ['ebay'], name: 'eBay', url: q => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { keywords: ['farfetch'], name: 'Farfetch', url: q => `https://www.farfetch.com/shopping/women/search/items.aspx?q=${encodeURIComponent(q)}` },
  { keywords: ['ssense'], name: 'SSENSE', url: q => `https://www.ssense.com/en-us/women/search?q=${encodeURIComponent(q)}` },
  { keywords: ['net-a-porter', 'net a porter'], name: 'Net-a-Porter', url: q => `https://www.net-a-porter.com/en-us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['shein'], name: 'Shein', url: q => `https://us.shein.com/search.html?q=${encodeURIComponent(q)}` },
  { keywords: ['pretty little thing', 'plt'], name: 'PrettyLittleThing', url: q => `https://www.prettylittlething.us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['boohoo'], name: 'Boohoo', url: q => `https://www.boohoo.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['pull&bear', 'pull and bear', 'pull & bear'], name: 'Pull&Bear', url: q => `https://www.pullandbear.com/us/en/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['bershka'], name: 'Bershka', url: q => `https://www.bershka.com/us/en/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['massimo dutti'], name: 'Massimo Dutti', url: q => `https://www.massimodutti.com/us/en/search?searchTerm=${encodeURIComponent(q)}` },
  { keywords: ['gap'], name: 'Gap', url: q => `https://www.gap.com/browse/search.do?searchText=${encodeURIComponent(q)}` },
  { keywords: ['banana republic'], name: 'Banana Republic', url: q => `https://bananarepublic.gap.com/browse/search.do?searchText=${encodeURIComponent(q)}` },
  { keywords: ['j.crew', 'jcrew', 'j crew'], name: 'J.Crew', url: q => `https://www.jcrew.com/r/search?q=${encodeURIComponent(q)}` },
  { keywords: ["levi's", 'levis', 'levi '], name: "Levi's", url: q => `https://www.levi.com/US/en_US/search?q=${encodeURIComponent(q)}` },
  { keywords: ['gymshark'], name: 'Gymshark', url: q => `https://www.gymshark.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['lululemon'], name: 'Lululemon', url: q => `https://www.lululemon.com/en-us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['patagonia'], name: 'Patagonia', url: q => `https://www.patagonia.com/search/?q=${encodeURIComponent(q)}` },
  { keywords: ['north face', 'the north face'], name: 'The North Face', url: q => `https://www.thenorthface.com/en-us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['acne studios', 'acne'], name: 'Acne Studios', url: q => `https://www.acnestudios.com/en/search?q=${encodeURIComponent(q)}` },
  { keywords: ['carhartt'], name: 'Carhartt WIP', url: q => `https://www.carhartt-wip.com/en/search/?text=${encodeURIComponent(q)}` },
  { keywords: ['jaded london'], name: 'Jaded London', url: q => `https://jadedlondon.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['represent'], name: 'Represent', url: q => `https://representclothing.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['stone island'], name: 'Stone Island', url: q => `https://www.stoneisland.com/us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['stussy', 'stüssy'], name: 'Stüssy', url: q => `https://www.stussy.com/pages/search?q=${encodeURIComponent(q)}` },
  { keywords: ['palace'], name: 'Palace', url: q => `https://shop.palaceskateboards.com/pages/search?q=${encodeURIComponent(q)}` },
  { keywords: ['supreme'], name: 'Supreme', url: q => `https://www.supremenewyork.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['ralph lauren', 'polo ralph'], name: 'Ralph Lauren', url: q => `https://www.ralphlauren.com/searchresults?q=${encodeURIComponent(q)}` },
  { keywords: ['ganni'], name: 'Ganni', url: q => `https://www.ganni.com/en-gb/search?q=${encodeURIComponent(q)}` },
  { keywords: ['toteme'], name: 'Toteme', url: q => `https://www.toteme-studio.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['jacquemus'], name: 'Jacquemus', url: q => `https://jacquemus.com/pages/search?q=${encodeURIComponent(q)}` },
  { keywords: ['nanushka'], name: 'Nanushka', url: q => `https://www.nanushka.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['sandro'], name: 'Sandro', url: q => `https://us.sandro-paris.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['maje'], name: 'Maje', url: q => `https://us.maje.com/search?q=${encodeURIComponent(q)}` },
  { keywords: ['ami paris', 'ami '], name: 'AMI Paris', url: q => `https://www.amiparis.com/en-us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['isabel marant'], name: 'Isabel Marant', url: q => `https://www.isabelmarant.com/en/search?q=${encodeURIComponent(q)}` },
  { keywords: ['maison margiela', 'margiela'], name: 'Maison Margiela', url: q => `https://www.maisonmargiela.com/us/maison-margiela/search/?q=${encodeURIComponent(q)}` },
  { keywords: ['bottega veneta', 'bottega'], name: 'Bottega Veneta', url: q => `https://www.bottegaveneta.com/en-us/search/${encodeURIComponent(q)}` },
  { keywords: ['gucci'], name: 'Gucci', url: q => `https://www.gucci.com/us/en/search/?q=${encodeURIComponent(q)}` },
  { keywords: ['prada'], name: 'Prada', url: q => `https://www.prada.com/us/en/search.html?query=${encodeURIComponent(q)}` },
  { keywords: ['balenciaga'], name: 'Balenciaga', url: q => `https://www.balenciaga.com/en-us/search-results/${encodeURIComponent(q)}` },
  { keywords: ['off-white', 'off white'], name: 'Off-White', url: q => `https://www.off---white.com/en-us/search?q=${encodeURIComponent(q)}` },
  { keywords: ['rick owens'], name: 'Rick Owens', url: q => `https://www.rickowens.eu/en/US/search?q=${encodeURIComponent(q)}` },
]

const SECONDHAND_SITES = [
  { name: 'Depop', url: q => `https://www.depop.com/search/?q=${encodeURIComponent(q)}` },
  { name: 'Vinted', url: q => `https://www.vinted.com/catalog?search_text=${encodeURIComponent(q)}` },
]

const GENERAL_SITES = [
  { name: 'ASOS', url: q => `https://www.asos.com/search/?q=${encodeURIComponent(q)}` },
  { name: 'Depop', url: q => `https://www.depop.com/search/?q=${encodeURIComponent(q)}` },
  { name: 'Vinted', url: q => `https://www.vinted.com/catalog?search_text=${encodeURIComponent(q)}` },
  { name: 'eBay', url: q => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { name: 'Farfetch', url: q => `https://www.farfetch.com/shopping/women/search/items.aspx?q=${encodeURIComponent(q)}` },
]

const SECONDHAND_NAMES = new Set(['Depop', 'Vinted', 'Grailed', 'eBay'])

function getSearchRows(query) {
  const q = query.toLowerCase()
  const seen = new Set()
  const matches = []
  for (const brand of BRAND_SEARCHES) {
    if (brand.keywords.some(k => q.includes(k)) && !seen.has(brand.name)) {
      matches.push(brand)
      seen.add(brand.name)
    }
  }
  if (matches.length === 0) return GENERAL_SITES
  const hasSecondhand = matches.some(b => SECONDHAND_NAMES.has(b.name))
  if (!hasSecondhand) {
    return [...matches, ...SECONDHAND_SITES.filter(s => !seen.has(s.name))].slice(0, 5)
  }
  return matches.slice(0, 5)
}

function looksLikeUrl(str) {
  return /^https?:\/\//i.test(str.trim()) || /^www\./i.test(str.trim())
}

const FASHION_TERMS = [
  'jaded london', 'jaded london studded jeans', 'jaded london cargo pants', 'jaded london denim',
  'acne studios', 'acne studios straight jeans', 'acne studios leather jacket',
  'carhartt wip', 'carhartt wip jacket', 'carhartt wip cargo pants',
  'stüssy', 'stüssy hoodie', 'stüssy crewneck', 'stüssy t-shirt',
  'palace skateboards', 'supreme hoodie', 'supreme box logo',
  'stone island', 'bottega veneta', 'bottega veneta intrecciato bag',
  'jacquemus le bambino', 'jacquemus la bomba', 'jacquemus le chiquito',
  'ganni', 'ganni butterfly dress', 'ganni denim', 'ganni boots',
  'nanushka', 'toteme', 'toteme trench coat', 'toteme wide leg trousers',
  'a.p.c.', 'a.p.c. petit new standard jeans', 'lemaire', 'maison margiela',
  'maison margiela tabi', 'maison margiela 5ac bag', 'rick owens',
  'ami paris', 'isabel marant', 'isabel marant étoile', 'sandro paris',
  'maje', 'reformation', 'reformation dress', 'aritzia', 'cos',
  'arket', 'everlane', 'uniqlo', 'levi\'s 501', 'levi\'s wide leg',
  'agolde 90s pinch waist', 'frame le high straight', 'citizens of humanity',
  'free people', 'brandy melville', 'urban outfitters',
  'adidas samba', 'adidas gazelle', 'adidas campus', 'adidas spezial',
  'nike air force 1', 'nike dunk low', 'nike air max', 'new balance 574',
  'new balance 530', 'asics gel-lyte', 'veja campo', 'veja v-10',
  'cargo pants', 'wide leg jeans', 'barrel leg jeans', 'straight leg jeans',
  'low rise jeans', 'high waist jeans', 'flare jeans', 'bootcut jeans',
  'denim skirt', 'midi skirt', 'mini skirt', 'maxi skirt', 'pleated skirt',
  'satin skirt', 'leather skirt', 'wrap skirt', 'bias cut skirt',
  'oversized blazer', 'double breasted blazer', 'pinstripe blazer',
  'trench coat', 'leather trench', 'leather jacket', 'moto jacket',
  'bomber jacket', 'varsity jacket', 'denim jacket', 'shearling jacket',
  'puffer jacket', 'quilted jacket', 'waxed jacket',
  'cable knit sweater', 'oversized knit', 'quarter zip pullover',
  'zip up hoodie', 'crewneck sweatshirt', 'graphic tee', 'boxy tee',
  'cropped cardigan', 'longline cardigan', 'corset top', 'off shoulder top',
  'bodysuit', 'ribbed tank', 'camisole', 'satin camisole',
  'slip dress', 'midi dress', 'mini dress', 'wrap dress', 'smocked dress',
  'ruched dress', 'linen dress', 'knit dress', 'shirt dress',
  'tailored trousers', 'wide leg trousers', 'linen trousers', 'pinstripe trousers',
  'platform boots', 'chelsea boots', 'ankle boots', 'knee high boots',
  'mary janes', 'ballet flats', 'loafers', 'mules', 'kitten heels',
  'strappy heels', 'block heels', 'chunky sandals', 'dad sneakers',
  'shoulder bag', 'tote bag', 'mini bag', 'crossbody bag', 'bucket bag',
  'baguette bag', 'underarm bag', 'hobo bag', 'clutch bag',
  'vintage levi\'s', 'vintage band tee', 'vintage polo ralph lauren',
  'y2k cargo pants', 'y2k mini skirt', 'y2k denim', 'y2k low rise',
  'oversized shirt', 'linen shirt', 'satin shirt', 'broderie shirt',
  'studded belt', 'leather belt', 'chain belt', 'corset belt',
  'gold hoops', 'silver hoops', 'pearl necklace', 'chain necklace',
  'claw clip', 'hair bows', 'bucket hat', 'baseball cap', 'beret',
]

function getLocalSuggestions(query) {
  const q = query.toLowerCase().trim()
  if (!q || q.length < 2) return []
  const starts = FASHION_TERMS.filter(t => t.startsWith(q))
  const contains = FASHION_TERMS.filter(t => !t.startsWith(q) && t.includes(q))
  return [...starts, ...contains].slice(0, 6)
}

async function fetchSuggestions(query) {
  return getLocalSuggestions(query)
}

async function fetchLinkPreview(rawUrl, setPreview, setLoading) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  setLoading(true)
  setPreview(null)
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    if (data.status === 'success') {
      setPreview({ url, title: data.data.title || url, image: data.data.image?.url || null })
    } else {
      setPreview({ url, title: url, image: null })
    }
  } catch {
    setPreview({ url, title: url, image: null })
  }
  setLoading(false)
}

const PRE_BUY = [
  "i ask my friends",
  "i scroll pinterest or tiktok",
  "i compare 20 websites",
  "i just wing it",
]


const ANALYZE_LINES = [
  'reading your answers…',
  'mapping your taste profile…',
  'cross-referencing your outfits…',
  'done.',
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

function getPersonalRead(trait, preBuy, archetype) {
  if (trait === "i buy things i never wear") {
    if (preBuy === "i just wing it")
      return "you shop on feeling and then wonder why nothing feels right. you're not impulsive — you're optimistic. you believe every new thing will be the thing that pulls your wardrobe together. it won't. but you'll buy it anyway."
    if (preBuy === "i scroll pinterest or tiktok")
      return "the algorithm has been dressing you, and it doesn't know your body, your life, or what you already own. you're not buying bad things — you're buying the right things for someone else's wardrobe."
    if (preBuy === "i compare 20 websites")
      return "you do all the research and still end up with things you don't wear. that's because research tells you if something is good — it can't tell you if it's right for you. you've been optimising the wrong variable."
    if (preBuy === "i ask my friends")
      return "your friends have their own bodies, their own wardrobes, and their own taste — none of which is yours. you outsource the decision because you don't fully trust your own eye yet. but your instinct got you this far. it's worth backing."
  }
  if (trait === "i always think i have nothing to wear") {
    if (preBuy === "i scroll pinterest or tiktok")
      return "you've been consuming so much curated content that your own closet looks like a disappointment by comparison. you're not comparing your wardrobe to other wardrobes — you're comparing it to an algorithm's highlight reel. of course it feels like nothing."
    if (preBuy === "i compare 20 websites")
      return "you know exactly what's available everywhere, and somehow still feel like you own nothing. the problem isn't supply — it's that you've never properly mapped what you have. you keep buying to fill a gap you haven't actually identified."
    if (preBuy === "i just wing it")
      return "you buy fast, forget faster, and rediscover things in your closet like you're meeting them for the first time. your wardrobe is bigger than it feels. you just need a system to see it."
    if (preBuy === "i ask my friends")
      return "you don't trust what you own until someone else validates it. the problem is your friends aren't there every morning. you've trained yourself to need external confirmation for something that should feel intuitive."
  }
  if (trait === "i panic before trips & events") {
    if (preBuy === "i compare 20 websites")
      return "you plan everything except the part where your closet needs to actually work in real time. you research purchases for weeks and still end up at the store the night before a flight. your preparation is thorough and completely theoretical."
    if (preBuy === "i scroll pinterest or tiktok")
      return "you save looks constantly and have boards full of inspo that's never translated into actual clothes in your actual closet. when the event comes, all of that is useless. you've been curating a fantasy wardrobe, not building a real one."
    if (preBuy === "i just wing it")
      return "you live in total denial until the deadline, then throw money at the problem. the wild part is it usually works. you are accidentally great at last-minute decisions and have never properly credited yourself for it."
    if (preBuy === "i ask my friends")
      return "the group chat goes into overdrive before every trip and you usually leave looking good. you've built a styling system that runs entirely on other people's energy. it works — but it's exhausting everyone, including you."
  }
  if (trait === "i spend forever deciding what to buy") {
    if (preBuy === "i compare 20 websites")
      return "you are the most overprepared person in any room. you know the options better than the salesperson and still walk away unsure. the issue isn't information — you have too much of it. you need fewer choices, not more data."
    if (preBuy === "i ask my friends")
      return "you need a second opinion on everything — not because you have bad taste, but because you've never fully trusted that your own instinct is worth backing. the irony: you probably have better taste than most of the people you're asking."
    if (preBuy === "i scroll pinterest or tiktok")
      return "you use the feed to confirm what you already want. if you see it there, it feels valid. if you don't, you spiral. your taste is completely real — it's the confidence that needs work. you already know what you like."
    if (preBuy === "i just wing it")
      return "you overthink it for days, walk into the store, and immediately buy the first thing you touched. you are structured chaos in human form — and the interesting part is your instinct is usually right. the weeks of deliberation were just background noise."
  }
  return "you have a specific vision of what you want and a complicated relationship with actually getting it. the good news: you already know the problem. you just haven't built the system to solve it yet."
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

const IconPhoto = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
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
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [q4mode, setQ4mode] = useState(null)
  const [q4draft, setQ4draft] = useState('')
  const [q4item, setQ4item] = useState(null)
  const [q4whySelected, setQ4whySelected] = useState([])
  const [q6mode, setQ6mode] = useState(null)
  const [q6draft, setQ6draft] = useState('')
  const [q6item, setQ6item] = useState(null)
  const [q6whySelected, setQ6whySelected] = useState([])
  const [analyzePhase, setAnalyzePhase] = useState(0)
  const [openCards, setOpenCards] = useState({})
  const [q4linkPreview, setQ4linkPreview] = useState(null)
  const [q4linkLoading, setQ4linkLoading] = useState(false)
  const [q4suggestions, setQ4suggestions] = useState([])
  const [q4searched, setQ4searched] = useState(false)
  const [q6linkPreview, setQ6linkPreview] = useState(null)
  const [q6linkLoading, setQ6linkLoading] = useState(false)
  const [q6suggestions, setQ6suggestions] = useState([])
  const [q6searched, setQ6searched] = useState(false)
  const fileRef = useRef(null)
  const fileRefCam = useRef(null)
  const fileRef6 = useRef(null)
  const fileRef6Cam = useRef(null)
  const linkDebounceRef = useRef(null)
  const link6DebounceRef = useRef(null)
  const suggTimerRef = useRef(null)
  const sugg6TimerRef = useRef(null)

  useEffect(() => {
    if (step !== 'analyzing') return
    setAnalyzePhase(0)
    const t1 = setTimeout(() => setAnalyzePhase(1), 900)
    const t2 = setTimeout(() => setAnalyzePhase(2), 1800)
    const t3 = setTimeout(() => setAnalyzePhase(3), 2600)
    const t4 = setTimeout(() => setStep('results'), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [step])

  useEffect(() => {
    if (step !== 'teaser' && step !== 'analyzing' && step !== 'results' && step !== 'email') return
    saveSurvey(surveyPayload({
      userName,
      email,
      selectedTrait,
      selectedPreBuy,
      q4item,
      q4whySelected,
      q6item,
      q6whySelected,
      read: getPersonalRead(selectedTrait, selectedPreBuy),
      headline: TRAIT_INSIGHTS[selectedTrait]?.badge || '',
    }))
  }, [step, userName, email, selectedTrait, selectedPreBuy, q4item, q4whySelected, q6item, q6whySelected])

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
    setQ4item({ type: 'photo', value: url })
    setQ4mode(null)
    e.target.value = ''
  }

  function onQ4LinkChange(val) {
    setQ4draft(val)
    setQ4linkPreview(null)
    setQ4searched(false)
    clearTimeout(linkDebounceRef.current)
    clearTimeout(suggTimerRef.current)
    if (looksLikeUrl(val)) {
      setQ4suggestions([])
      linkDebounceRef.current = setTimeout(() => fetchLinkPreview(val, setQ4linkPreview, setQ4linkLoading), 700)
    } else {
      suggTimerRef.current = setTimeout(() => fetchSuggestions(val).then(setQ4suggestions), 300)
    }
  }

  function pickQ4Suggestion(s) {
    setQ4draft(s)
    setQ4suggestions([])
    setQ4searched(false)
  }

  function submitQ4Search() {
    if (!q4draft.trim() || looksLikeUrl(q4draft)) return
    setQ4suggestions([])
    setQ4searched(true)
  }

  function confirmQ4Preview() {
    setQ4item({ type: 'link-preview', value: q4linkPreview })
    setQ4draft('')
    setQ4linkPreview(null)
    setQ4suggestions([])
    setQ4searched(false)
    setQ4mode(null)
  }

  function onQ6LinkChange(val) {
    setQ6draft(val)
    setQ6linkPreview(null)
    setQ6searched(false)
    clearTimeout(link6DebounceRef.current)
    clearTimeout(sugg6TimerRef.current)
    if (looksLikeUrl(val)) {
      setQ6suggestions([])
      link6DebounceRef.current = setTimeout(() => fetchLinkPreview(val, setQ6linkPreview, setQ6linkLoading), 700)
    } else {
      sugg6TimerRef.current = setTimeout(() => fetchSuggestions(val).then(setQ6suggestions), 300)
    }
  }

  function pickQ6Suggestion(s) {
    setQ6draft(s)
    setQ6suggestions([])
    setQ6searched(false)
  }

  function submitQ6Search() {
    if (!q6draft.trim() || looksLikeUrl(q6draft)) return
    setQ6suggestions([])
    setQ6searched(true)
  }

  function confirmQ6Preview() {
    setQ6item({ type: 'link-preview', value: q6linkPreview })
    setQ6draft('')
    setQ6linkPreview(null)
    setQ6suggestions([])
    setQ6searched(false)
    setQ6mode(null)
  }

  function finishQ4() {
    if (!q4draft.trim()) return
    setQ4item({ type: 'describe', value: q4draft.trim() })
    setQ4draft('')
    setQ4mode(null)
  }

  function handleFile6(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setQ6item({ type: 'photo', value: url })
    setQ6mode(null)
    e.target.value = ''
  }

  function finishQ6() {
    if (!q6draft.trim()) return
    setQ6item({ type: 'describe', value: q6draft.trim() })
    setQ6draft('')
    setQ6mode(null)
  }

  const archetype = getStyleArchetype(yesCount, noCount)
  const traitInsight = TRAIT_INSIGHTS[selectedTrait]
  const preBuyInsight = PRE_BUY_INSIGHTS[selectedPreBuy]
  const firstName = userName.trim() ? userName.trim().split(' ')[0] : 'you'
  const toggleCard = (id) => setOpenCards(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="page">
      <section className={`survey-hero${step === 'results' ? ' results-mode' : ''}`}>
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
        ) : step === 'q6why' ? (
          <>
            <p className="survey-q traits-q">tell me why?</p>
            <ul className="why-list">
              {['fit was wrong', 'material was bad', "doesn't work well with what i have", 'too damaged / defective', 'just looked different than online', 'not worth the price'].map(opt => (
                <li key={opt}>
                  <button
                    className={`why-option${q6whySelected.includes(opt) ? ' why-option--selected' : ''}`}
                    onClick={() => setQ6whySelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}
                  >
                    <span className="why-check">{q6whySelected.includes(opt) ? '✓' : ''}</span>
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
            <div className="social-footer-actions">
              <button className="trait-card q4-done" onClick={() => setStep('name')}>done →</button>
            </div>
          </>
        ) : step === 'q4why' ? (
          <>
            <p className="survey-q traits-q">tell me why?</p>
            <ul className="why-list">
              {['fit was perfect', 'great quality', 'i always wear it', "it's unique", 'rare item', 'attention grabbing statement piece', 'the perfect basic'].map(opt => (
                <li key={opt}>
                  <button
                    className={`why-option${q4whySelected.includes(opt) ? ' why-option--selected' : ''}`}
                    onClick={() => setQ4whySelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}
                  >
                    <span className="why-check">{q4whySelected.includes(opt) ? '✓' : ''}</span>
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
            <div className="social-footer-actions">
              <button className="trait-card q4-done" onClick={() => setStep('q6')}>done →</button>
            </div>
          </>
        ) : step === 'q6' ? (
          <>
            <p className="survey-q traits-q">which purchase do you regret the most?</p>

            {q6item ? (
              <div className="q4-saved-wrap">
                {q6item.type === 'photo' && <img src={q6item.value} alt="" className="q4-saved-img" />}
                {q6item.type === 'link-preview' && (
                  <div className="q4-saved-link">
                    {q6item.value.image && <img src={q6item.value.image} alt="" className="q4-saved-img" />}
                    <p className="q4-saved-title">{q6item.value.title}</p>
                  </div>
                )}
                {q6item.type === 'describe' && <p className="q4-saved-desc">"{q6item.value}"</p>}
                <div className="q4-input-actions">
                  <button className="trait-card q4-back" onClick={() => { setQ6item(null); setQ6mode(null); setQ6draft(''); setQ6linkPreview(null) }}>← back</button>
                  <button className="trait-card q4-done" onClick={() => setStep('q6why')}>next →</button>
                </div>
              </div>
            ) : (
              <>
                {!q6mode && (
                  <div className="q4-options">
                    <input ref={fileRef6} type="file" accept="image/*" className="q4-file-input" onChange={handleFile6} />
                    <input ref={fileRef6Cam} type="file" accept="image/*" capture="environment" className="q4-file-input" onChange={handleFile6} />
                    <button className="q4-btn" onClick={() => setQ6mode('photo')}>
                      <span className="q4-icon"><IconPhoto /></span> photo
                    </button>
                    <button className="q4-btn" onClick={() => setQ6mode('link')}>
                      <span className="q4-icon"><IconLink /></span> link
                    </button>
                    <button className="q4-btn" onClick={() => setQ6mode('describe')}>
                      <span className="q4-icon"><IconPen /></span> describe it
                    </button>
                  </div>
                )}

                {q6mode === 'photo' && (
                  <div className="q4-options">
                    <button className="q4-btn" onClick={() => fileRef6Cam.current.click()}>
                      <span className="q4-icon"><IconCamera /></span> take a photo
                    </button>
                    <button className="q4-btn" onClick={() => fileRef6.current.click()}>
                      <span className="q4-icon"><IconUpload /></span> from library
                    </button>
                    <button className="photo-back-btn" onClick={() => setQ6mode(null)}>← back</button>
                  </div>
                )}

                {(q6mode === 'link' || q6mode === 'describe') && (
                  <div className="q4-input-wrap">
                    {q6mode === 'link' ? (
                      <>
                        <input
                          className="q4-text-input link-search-input"
                          type="url"
                          placeholder="paste a link..."
                          value={q6draft}
                          onChange={e => onQ6LinkChange(e.target.value)}
                          autoFocus
                        />
                        {q6linkLoading && <p className="link-loading">looking it up…</p>}
                        {q6linkPreview && (
                          <div className="link-preview-card">
                            {q6linkPreview.image && <img src={q6linkPreview.image} alt="" className="link-preview-img" />}
                            <div className="link-preview-info">
                              <p className="link-preview-title">{q6linkPreview.title}</p>
                            </div>
                            <button className="trait-card q4-done" onClick={confirmQ6Preview}>save</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <textarea
                          className="q4-text-input q4-textarea"
                          placeholder="tell us about it..."
                          value={q6draft}
                          onChange={e => setQ6draft(e.target.value)}
                          autoFocus
                        />
                        {q6draft.trim() && (
                          <button className="trait-card q4-done" onClick={finishQ6}>save</button>
                        )}
                      </>
                    )}
                    <div className="q4-input-actions">
                      <button className="trait-card q4-back" onClick={() => { setQ6mode(null); setQ6draft(''); setQ6linkPreview(null); setQ6suggestions([]); setQ6searched(false) }}>← back</button>
                    </div>
                  </div>
                )}

              </>
            )}
          </>
        ) : step === 'name' ? (
          <>
            <p className="survey-q traits-q">what's your name?</p>
            <div className="q4-input-wrap">
              <input
                className="q4-text-input"
                type="text"
                placeholder="your name..."
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && userName.trim()) setStep('email') }}
                autoFocus
              />
              {userName.trim() && (
                <button className="trait-card q4-done" onClick={() => setStep('email')}>next →</button>
              )}
            </div>
          </>
        ) : step === 'email' ? (
          <>
            <p className="survey-q traits-q">and your email{userName.trim() ? `, ${userName.trim().split(' ')[0]}` : ''}?</p>
            <div className="q4-input-wrap">
              <input
                className="q4-text-input"
                type="email"
                placeholder="your email..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && isValidEmail(email)) setStep('teaser') }}
                autoFocus
              />
              {isValidEmail(email) && (
                <button className="trait-card q4-done" onClick={() => setStep('teaser')}>join the waitlist →</button>
              )}
            </div>
            <p className="email-beta-note">we're still in beta. join the list and you'll be the first to know when yom is ready for you.</p>
          </>
        ) : step === 'teaser' ? (
          <div className="teaser-wrap">
            <p className="survey-q traits-q">want to know what yom figured out about you?</p>
            <div className="teaser-btns">
              <button className="trait-card" onClick={() => setStep('analyzing')}>yes, obviously</button>
              <button className="trait-card" onClick={() => setStep('analyzing')}>sure, why not</button>
            </div>
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
        ) : step === 'results' ? (
          <div className="results-wrap">

            <div className="results-archetype-section">
              <h2 className="results-archetype-name">{archetype.name}</h2>
              <p className="results-archetype-desc">{archetype.desc}</p>
            </div>

            <div className="insight-cards">
              {traitInsight && (
                <div className="insight-card">
                  <span className="insight-card-badge">{traitInsight.badge}</span>
                  <p className="insight-card-body">{traitInsight.insight}</p>
                </div>
              )}
              {preBuyInsight && (
                <div className="insight-card">
                  <span className="insight-card-badge">{preBuyInsight.badge}</span>
                  <p className="insight-card-body">{preBuyInsight.insight}</p>
                </div>
              )}
            </div>

            <div className="results-signoff">
              <p className="results-signoff-main">see you when we launch.</p>
              <p className="results-signoff-sub">we'll remember all of this — create your account so it lives on your yom.</p>
              <a href="/beta" className="results-home-link">keep this on your yom →</a>
            </div>

          </div>
        ) : (
          <>
            <p className="survey-q traits-q">what's the best purchase you've ever made?</p>

            {q4item ? (
              <div className="q4-saved-wrap">
                {q4item.type === 'photo' && <img src={q4item.value} alt="" className="q4-saved-img" />}
                {q4item.type === 'link-preview' && (
                  <div className="q4-saved-link">
                    {q4item.value.image && <img src={q4item.value.image} alt="" className="q4-saved-img" />}
                    <p className="q4-saved-title">{q4item.value.title}</p>
                  </div>
                )}
                {q4item.type === 'describe' && <p className="q4-saved-desc">"{q4item.value}"</p>}
                <div className="q4-input-actions">
                  <button className="trait-card q4-back" onClick={() => { setQ4item(null); setQ4mode(null); setQ4draft(''); setQ4linkPreview(null) }}>← back</button>
                  <button className="trait-card q4-done" onClick={() => setStep('q4why')}>next →</button>
                </div>
              </div>
            ) : (
              <>
                {!q4mode && (
                  <div className="q4-options">
                    <input ref={fileRef} type="file" accept="image/*" className="q4-file-input" onChange={handleFile} />
                    <input ref={fileRefCam} type="file" accept="image/*" capture="environment" className="q4-file-input" onChange={handleFile} />
                    <button className="q4-btn" onClick={() => setQ4mode('photo')}>
                      <span className="q4-icon"><IconPhoto /></span> photo
                    </button>
                    <button className="q4-btn" onClick={() => setQ4mode('link')}>
                      <span className="q4-icon"><IconLink /></span> link
                    </button>
                    <button className="q4-btn" onClick={() => setQ4mode('describe')}>
                      <span className="q4-icon"><IconPen /></span> describe it
                    </button>
                  </div>
                )}

                {q4mode === 'photo' && (
                  <div className="q4-options">
                    <button className="q4-btn" onClick={() => fileRefCam.current.click()}>
                      <span className="q4-icon"><IconCamera /></span> take a photo
                    </button>
                    <button className="q4-btn" onClick={() => fileRef.current.click()}>
                      <span className="q4-icon"><IconUpload /></span> from library
                    </button>
                    <button className="photo-back-btn" onClick={() => setQ4mode(null)}>← back</button>
                  </div>
                )}

                {(q4mode === 'link' || q4mode === 'describe') && (
                  <div className="q4-input-wrap">
                    {q4mode === 'link' ? (
                      <>
                        <input
                          className="q4-text-input link-search-input"
                          type="url"
                          placeholder="paste a link..."
                          value={q4draft}
                          onChange={e => onQ4LinkChange(e.target.value)}
                          autoFocus
                        />
                        {q4linkLoading && <p className="link-loading">looking it up…</p>}
                        {q4linkPreview && (
                          <div className="link-preview-card">
                            {q4linkPreview.image && <img src={q4linkPreview.image} alt="" className="link-preview-img" />}
                            <div className="link-preview-info">
                              <p className="link-preview-title">{q4linkPreview.title}</p>
                            </div>
                            <button className="trait-card q4-done" onClick={confirmQ4Preview}>save</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <textarea
                          className="q4-text-input q4-textarea"
                          placeholder="tell us about it..."
                          value={q4draft}
                          onChange={e => setQ4draft(e.target.value)}
                          autoFocus
                        />
                        {q4draft.trim() && (
                          <button className="trait-card q4-done" onClick={finishQ4}>save</button>
                        )}
                      </>
                    )}
                    <div className="q4-input-actions">
                      <button className="trait-card q4-back" onClick={() => { setQ4mode(null); setQ4draft(''); setQ4linkPreview(null); setQ4suggestions([]); setQ4searched(false) }}>← back</button>
                    </div>
                  </div>
                )}

              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
