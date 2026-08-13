/** Hardcoded beta login + spring 2026 closet reads. Add emails to BETA_USERS to let people in. */

export const BETA_PASSWORD = "yombeta";

export const BETA_USERS = [
  { email: "mal@youryom.com", name: "mal", profileId: "mal" },
  { email: "ban@youryom.com", name: "ban", profileId: "ban" },
];

export function findBetaUser(email, password) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const p = String(password || "").trim();
  if (!e || !p) return { error: "email and password, please." };
  const user = BETA_USERS.find((u) => u.email.toLowerCase() === e);
  if (!user) return { error: "that email isn't on the beta list." };
  const expected = user.password || BETA_PASSWORD;
  if (p !== expected) return { error: "wrong password." };
  return { user };
}

export const PROFILES = {
  mal: {
    id: "mal",
    name: "mal",
    trait: "decide",
    preBuy: "friends",
    keepLean: "black",
    from: "member from apr 2026",
    headline: "knows the options. still asks the group chat.",
    read: "you know the options better than the salesperson and still walk away unsure. you need fewer choices, not more data. you default to black because it always works — that's also how pieces disappear.",
    sizes: [
      { label: "dresses / tops", value: "US 6" },
      { label: "denim", value: "28" },
      { label: "shoes", value: "EU 39" },
    ],
    style: [
      "black and tailoring first",
      "shops gifts harder than clothes for herself",
      "hates 'true to size' — always wants the real fit note",
      "returns pointed anything, keeps the clean line",
    ],
    purchases: [
      { when: "apr 2026", item: "COS column pant in black", note: "kept · weekly rotation" },
      { when: "may 2026", item: "Reformation Gavin blazer", note: "kept · the jacket that actually gets worn" },
      { when: "jun 2026", item: "gift: Aeyde sandals for a friend", note: "not for her · she returned a pointed mule the same month" },
    ],
    saved: [
      { item: "The Row Park tote", note: "saved apr 19 · still thinking" },
      { item: "perfect white tee", note: "saved jun 3 · yom flagged it, she parked it" },
    ],
    memory:
      "this is mal. US 6, denim 28, EU 39. black and tailoring. she spends forever deciding and asks friends. spring 2026: COS column pant (apr, kept), Reformation Gavin blazer (may, kept), bought a gift in june and returned a pointed mule. do not treat her like ban. do not say green is her color.",
  },
  ban: {
    id: "ban",
    name: "ban",
    trait: "nothing",
    preBuy: "research",
    keepLean: "green",
    from: "member from apr 2026",
    headline: "nothing to wear. closet says otherwise.",
    read: "you know what's available everywhere and still feel like you own nothing. the gap isn't supply — you've never mapped what you already have. you keep coming back to green.",
    sizes: [
      { label: "dresses / tops", value: "US 4" },
      { label: "denim", value: "26" },
      { label: "shoes", value: "EU 37 · rounder toe only" },
    ],
    style: [
      "green is the through-line, not a trend",
      "compares everything, still panics before trips and events",
      "same silhouette as the Maya Set keeps showing up in the browse",
      "pointed shoes never make it out of the box",
    ],
    purchases: [
      { when: "apr 2026", item: "Reformation Maya Set", note: "kept · the silhouette she still shops" },
      { when: "may 2026", item: "three green pieces (Reformation + other)", note: "0 returns · her color" },
      { when: "jun 2026", item: "Jaded London shorts", note: "kept · still in rotation" },
    ],
    saved: [
      { item: "green midi for sofia's wedding", note: "saved jun 12 · not bought yet" },
      { item: "rounder-toe Aeyde Delfina", note: "saved may 28 · closer to what she wears" },
    ],
    memory:
      "this is ban. US 4, denim 26, EU 37 rounder-toe only. she always thinks she has nothing to wear even though the closet is real: Reformation Maya Set (apr), every green piece (may, 0 returns), Jaded London shorts (jun). she compares everything and still panics before trips and events. do not say green is her color unless the piece is actually green.",
  },
};
