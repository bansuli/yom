/* Exact narrative copy for the hardcoded Reformation flow */
window.YOM_DEMO = {
  events: [
    {
      id: "sofia-wedding",
      label: "Sofia's wedding",
      when: "Sat, Mar 16",
      source: "from your calendar",
    },
    {
      id: "nyc-trip",
      label: "NYC weekend",
      when: "Apr 4–6",
      source: "from your calendar",
    },
  ],
  tips: {
    welcome: {
      title: "i’ll stay out of the way",
      body: "shop normally — if I notice something useful, I’ll pop up.",
    },
    similar: {
      title: "you have something really similar",
      body: "same silhouette — worth seeing side by side before you buy another.",
      closetKey: "similar",
    },
    material: {
      title: "people aren’t loving the material",
      body: "recurring review complaint: fabric pills / feels thinner than expected.",
    },
    green: {
      title: "green is your color",
      body: "you’ve kept every green piece you’ve bought.",
      closetKey: "green",
    },
    delivery: {
      title: "this arrives 3–4 days before the wedding",
      body: "enough time before Sofia’s wedding if you move now.",
    },
    checking: {
      title: "checking this…",
      body: "searching reviews for fit, fabric, and keep/return patterns.",
    },
    check: {
      title: "reviews are really good",
      body: "a lot of people say it’s really long.",
      resolve:
        "Reformation offers alterations — and based on timing, there’s enough time to alter it and still have it before the wedding. length is a problem, but not a problem for you.",
    },
    afterDress: {
      title: "dress is in",
      body: "still shopping for Sofia’s wedding? add a budget anytime and I’ll help you stay in it.",
    },
    budgetOn: {
      title: "watching your budget",
      body: "everything stays visible — I’ll just flag what would put you over.",
    },
    overBudget: {
      title: "this would put you over",
      body: "still here if you want it — just flagging it against your budget.",
    },
    pairing: {
      title: "this would be perfect with your new Jaded London shorts",
      body: "already in your closet — easy outfit.",
      closetKey: "shorts",
    },
    pairingCheck: {
      title: "reviews are strong",
      body: "nothing concerning turned up.",
    },
    shoes: {
      title: "this shape isn’t really you",
      body: "you don’t own shoes with this shape — the ones you consistently buy and wear have a rounder toe. here are closer options:",
    },
    skipShoes: {
      title: "fair",
      body: "you don’t need them. when you’re ready, open your bag for a final keep check.",
    },
    done: {
      title: "go for it",
      body: "started with no plan — leaving with pieces you’re likely to keep.",
    },
  },
  closet: {
    similar: {
      title: "your Reformation Maya Set",
      note: "same silhouette, softer wash",
      file: "closet-similar.jpg",
    },
    green: {
      title: "your kept greens",
      note: "3 green pieces · 0 returns",
      file: "closet-green.jpg",
    },
    shorts: {
      title: "Jaded London shorts",
      note: "bought last week · still in closet",
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
};
