/* yom memory + session copy. Calendar events load live when Google is connected. */
window.YOM_DEMO = {
  events: [],
  purposeFallback: {
    work: {
      kind: "work",
      plp: {
        title: "reads like work",
        body: "polished enough without looking like a costume.",
        stamp: "for work",
      },
      delivery: {
        title: "this usually arrives in 3–5 days",
        body: "in time if the work thing isn’t this week.",
      },
      check: {
        title: "reviews are solid",
        body: "fit notes are consistent. add it when you’re ready.",
      },
    },
    date: {
      kind: "date",
      plp: {
        title: "this has date written all over it",
        body: "more special than your everyday — not trying too hard.",
        stamp: "for a date",
      },
      delivery: {
        title: "this will typically arrive in 3–5 days",
        body: "fine unless the date is tomorrow.",
      },
      check: {
        title: "reviews are really good!",
        body: "people keep this one.",
      },
    },
    generic: {
      kind: "generic",
      plp: {
        title: "fits what you have coming up",
        body: "nothing here fights the occasion.",
        stamp: "for later",
      },
      delivery: {
        title: "this usually lands in 3–5 days",
        body: "in time if you order soon.",
      },
      check: {
        title: "reviews are strong",
        body: "nothing concerning turned up. add it when you’re ready.",
      },
    },
  },
  reviews: {
    long: {
      title: "reviews say it runs long",
      body: "a lot of people say it’s really long.",
      resolve:
        "if the shop offers alterations, length is fixable. otherwise check the hem against your height.",
    },
    strong: {
      title: "reviews are strong",
      body: "nothing concerning turned up. add it when you’re ready.",
    },
    mixed: {
      title: "mixed on the fabric",
      body: "a few people mention it feels thinner than expected. still loved overall.",
    },
  },
  tips: {
    welcome: {
      title: "i’ll stay out of the way",
      body: "shop normally — i’ll mark the page if something’s useful.",
    },
    similar: {
      title: "you have this silhouette",
      body: "same cut as a piece you already own.",
      stamp: "in your closet",
      closetKey: "similar",
    },
    material: {
      title: "people aren’t loving the material",
      body: "reviews keep mentioning pilling/thinner than expected.",
      stamp: "reviews",
    },
    green: {
      title: "is this a gap?",
      body: "only buy it if it does a job the closet doesn’t.",
      stamp: "your color",
      closetKey: "green",
    },
    forWhat: {
      title: "what’s it for?",
      body: "is this for something coming up, or still just browsing?",
      stamp: "your color",
      closetKey: "green",
    },
    pairing: {
      title: "already an outfit?",
      body: "name one thing you own that this goes with before you add it.",
      stamp: "how to wear",
      closetKey: "shorts",
    },
    pairingCheck: {
      title: "reviews are strong",
      body: "nothing concerning turned up.",
    },
    shoes: {
      title: "this shape isn’t really you",
      body: "you don’t own this toe shape — the shoes you keep are rounder. closer options on the page:",
    },
    skipShoes: {
      title: "fair",
      body: "you don’t need them.",
    },
    overBudget: {
      title: "this would put you over",
      body: "still here if you want it.",
      stamp: "over budget",
    },
    sos: {
      title: "hover a piece",
      body: "i’ll tell you size, reviews, buy or skip — right here next to me.",
    },
    stored: {
      title: "stored",
      body: "i’ll remember that.",
    },
    makesSense: {
      title: "got it",
      body: "i’ll keep reading you this way.",
    },
    saved: {
      title: "saved",
      body: "it’s on your list. come back when you’re ready.",
    },
    skipped: {
      title: "skipped",
      body: "won’t bring it up again this session.",
    },
    checking: {
      title: "checking this…",
      body: "size, reviews, shipping, and whether you'd regret it.",
    },
    afterAdd: {
      title: "got it",
      body: "i’ll keep this against what you told me.",
    },
    budgetAsk: {
      title: "cap the rest?",
      body: "optional. everything stays visible — i’ll just mark what would put you over.",
    },
    budgetOn: {
      title: "watching your budget",
      body: "over-budget pieces will quiet down on the page.",
    },
    done: {
      title: "go for it",
      body: "leaving with pieces that match what you actually want.",
    },
  },
  closet: {
    similar: {
      title: "a similar silhouette in your closet",
      note: "same job, different version",
      file: "closet-similar.jpg",
    },
    green: {
      title: "your kept greens",
      note: "3 green pieces · 0 returns",
      file: "closet-green.jpg",
    },
    shorts: {
      title: "a recent pair of shorts",
      note: "check you don’t already own this job",
      file: "closet-shorts.jpg",
    },
  },
  shoeAlts: [
    {
      brand: "Aeyde",
      name: "Delfina",
      why: "rounder toe · closer to what you wear",
      price: "$295",
    },
    {
      brand: "About Arianne",
      name: "Rita Sandal",
      why: "soft rounded tip · closer to your shape",
      price: "$185",
    },
    {
      brand: "Flattered",
      name: "Mia Heel",
      why: "matches the shoe shapes you keep",
      price: "$210",
    },
  ],
  keep: {
    dress: { score: 92, label: "likely keep" },
    pairing: { score: 88, label: "likely keep" },
    other: { score: 84, label: "likely keep" },
  },
  persona: {
    traits: [
      { id: "impulse", label: "i buy things i never wear" },
      { id: "nothing", label: "i always think i have nothing to wear" },
      { id: "panic", label: "i panic before trips & events" },
      { id: "decide", label: "i spend forever deciding" },
    ],
    preBuy: [
      { id: "friends", label: "i ask my friends" },
      { id: "feed", label: "i scroll tiktok / pinterest" },
      { id: "research", label: "i compare everything" },
      { id: "wing", label: "i just wing it" },
    ],
    keep: [
      { id: "green", label: "green" },
      { id: "black", label: "black" },
      { id: "neutrals", label: "neutrals" },
      { id: "color", label: "color, always" },
    ],
    demo: null, _retired_demo: {
      name: "ban",
      userId: "yom-ban",
      trait: "nothing",
      preBuy: "research",
      keepLean: "green",
      sizes: { us: "US 4", denim: "26", shoes: "EU 37" },
      memory:
        "this is ban. US 4, denim 26, EU 37 rounder-toe only. she always thinks she has nothing to wear even though the closet is real: Reformation Maya Set (apr 2026), every green piece she's bought (may, 0 returns — green is her color), Jaded London shorts (jun). she compares everything and still panics before trips and events. do not treat her like a generic shopper. do not say green is her color unless the piece is actually green.",
    },
    mal: {
      name: "mal",
      userId: "yom-mal",
      trait: "decide",
      preBuy: "friends",
      keepLean: "black",
      sizes: { us: "US 6", denim: "28", shoes: "EU 39" },
      memory:
        "this is mal. US 6, denim 28, EU 39. black and tailoring. she spends forever deciding and asks friends. spring 2026: COS column pant (apr, kept), Reformation Gavin blazer (may, kept), bought a gift in june and returned a pointed mule. do not treat her like ban. do not say green is her color.",
    },
    reads: {
      impulse: "you shop with your eyes. the thrill beats whether it actually fits your life.",
      nothing: "your closet is bigger than it feels. you need to see combinations, not more stuff.",
      panic: "everyday is autopilot. anything with a date on it sends you into a last-minute spiral.",
      decide: "you already know what you like. you don’t need more research — you need to trust it.",
      friends: "you outsource the last 10%. your taste is usually better than the people you ask.",
      feed: "the algorithm has been dressing you. it doesn’t know your body or what you already own.",
      research: "you optimise whether something is good. that still isn’t whether it’s right for you.",
      wing: "your instinct is often right. the overthinking is just background noise.",
      green: "you keep coming back to green. that’s the through-line, not a trend.",
      black: "you default to black because it always works. that’s also how pieces disappear.",
      neutrals: "you buy what won’t fight the rest. safe. sometimes too safe.",
      color: "you keep the loud ones. the beige never makes it out of the drawer.",
    },
    combos: {
      "impulse:wing":
        "you shop on feeling and then wonder why nothing feels right. you're not impulsive — you're optimistic. every new thing is supposed to pull the wardrobe together. it won't.",
      "impulse:feed":
        "the algorithm has been dressing you, and it doesn't know your body or what you already own. you're buying the right things for someone else's closet.",
      "impulse:research":
        "you do all the research and still end up with things you don't wear. research tells you if something is good. it can't tell you if it's right for you.",
      "impulse:friends":
        "your friends have their own bodies and taste. you outsource the last yes because you don't fully trust your eye yet. your instinct got you this far.",
      "nothing:feed":
        "you've been consuming so much curated content that your own closet looks like a disappointment. you're comparing it to an algorithm's highlight reel.",
      "nothing:research":
        "you know what's available everywhere and still feel like you own nothing. the gap isn't supply — you've never mapped what you already have.",
      "nothing:wing":
        "you buy fast, forget faster, and rediscover things like you're meeting them for the first time. the wardrobe is bigger than it feels.",
      "nothing:friends":
        "you don't trust what you own until someone else validates it. your friends aren't there every morning.",
      "panic:research":
        "you plan everything except the part where the closet has to work in real time. thorough, and completely theoretical, until the night before.",
      "panic:feed":
        "you save looks constantly and none of it is in the closet when the date hits. you've been curating a fantasy wardrobe.",
      "panic:wing":
        "you live in denial until the deadline, then throw money at it. the wild part is it usually works. credit the instinct.",
      "panic:friends":
        "the group chat goes into overdrive before every trip. the styling system runs on other people's energy.",
      "decide:research":
        "you know the options better than the salesperson and still walk away unsure. you need fewer choices, not more data.",
      "decide:friends":
        "you need a second opinion on everything — not because the taste is bad, because you haven't backed it. you probably have better taste than the people you ask.",
      "decide:feed":
        "you use the feed to confirm what you already want. if it isn't there, you spiral. the taste is real. the confidence needs work.",
      "decide:wing":
        "you overthink it for days, then buy the first thing you touch. the weeks of deliberation were background noise. the instinct was the point.",
    },
  },
};
