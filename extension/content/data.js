/* yom memory + session copy. Sofia's wedding is the authored cinematic example. */
window.YOM_DEMO = {
  events: [
    {
      id: "sofia-wedding",
      label: "Sofia's wedding",
      when: "Sat, Mar 16",
      source: "from your calendar",
      kind: "wedding",
      story: "wedding",
      plp: {
        title: "right for the wedding",
        body: "silhouette and colour both fit Sofia’s day.",
        stamp: "for the wedding",
      },
      delivery: {
        title: "arrives in 3–4 days",
        body: "way before the wedding.",
      },
      check: {
        title: "reviews are really good",
        body: "a lot of people say it’s really long.",
        resolve:
          "lucky for you, Reformation offers alterations. and based on timing, there’s enough time to alter it and still have it before the event.",
      },
    },
    {
      id: "nyc-trip",
      label: "NYC weekend",
      when: "Apr 4–6",
      source: "from your calendar",
      kind: "trip",
      plp: {
        title: "works for a city weekend",
        body: "easy to wear walking around",
        stamp: "for NYC",
      },
      delivery: {
        title: "lands before Apr 4",
        body: "usual Reformation timing — you’ll have it before the weekend.",
      },
      check: {
        title: "travels well",
        body: "reviews mention the fabric holds up and doesn’t need much fuss.",
        resolve: "nothing in the reviews that would be a problem for a short trip.",
      },
    },
  ],
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
      title: "reviews are really good",
      body: "a lot of people say it’s hemmed weirdly. add it when you’re ready.",
      resolve: "Reformation offers alterations — length comes up a lot, and it’s fixable.",
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
      title: "green is your color",
      body: "you’ve kept every green piece you’ve bought.",
      stamp: "your color",
      closetKey: "green",
    },
    forWhat: {
      title: "green is your color",
      body: "is this for something coming up, or still just browsing?",
      stamp: "your color",
      closetKey: "green",
    },
    pairing: {
      title: "perfect with your Jaded London shorts",
      body: "already in your closet; easy outfit.",
      stamp: "with your shorts",
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
    checking: {
      title: "checking this…",
      body: "reviews, fit, fabric, and whether people actually keep it.",
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
