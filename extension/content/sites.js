/* Fashion / clothing shop allowlist for yom */
window.YOM_SITES = (() => {
  // Hosts where yom is allowed to run (subdomains included via endsWith).
  const ALLOW = [
    "thereformation.com",
    "aritzia.com",
    "zara.com",
    "hm.com",
    "asos.com",
    "nordstrom.com",
    "nordstromrack.com",
    "ssense.com",
    "net-a-porter.com",
    "farfetch.com",
    "shopbop.com",
    "revolve.com",
    "freepeople.com",
    "anthropologie.com",
    "urbanoutfitters.com",
    "everlane.com",
    "madewell.com",
    "gap.com",
    "oldnavy.com",
    "bananarepublic.com",
    "uniqlo.com",
    "mango.com",
    "cos.com",
    "stories.com",
    "andotherstories.com",
    "arket.com",
    "toteme.com",
    "ganni.com",
    "acne.com",
    "acnestudios.com",
    "matchesfashion.com",
    "mytheresa.com",
    "saksfifthavenue.com",
    "saks.com",
    "bloomingdales.com",
    "macys.com",
    "neimanmarcus.com",
    "bergdorfgoodman.com",
    "lululemon.com",
    "alo.com",
    "skims.com",
    "skims.com",
    "princesspolly.com",
    "ohpolly.com",
    "edikted.com",
    "peppermayo.com",
    "jadedldn.com",
    "jadedlondon.com",
    "prettylittlething.com",
    "fashionnova.com",
    "shein.com",
    "abercrombie.com",
    "hollisterco.com",
    "american-eagle.com",
    "ae.com",
    "pacsun.com",
    "forever21.com",
    "express.com",
    "loft.com",
    "annaylor.com",
    "jcrew.com",
    "ralphlauren.com",
    "tommy.com",
    "calvinklein.us",
    "calvinklein.com",
    "nike.com",
    "adidas.com",
    "adidas.co.uk",
    "shop.lululemon.com",
    "sephora.com", // beauty adjacent — keep off? user said clothes. skip sephora.
  ].filter((h) => h !== "sephora.com");

  const SKIP = [
    "google.com",
    "gmail.com",
    "github.com",
    "stackoverflow.com",
    "notion.so",
    "slack.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "chatgpt.com",
    "openai.com",
    "cursor.com",
    "youryom.com",
    "vercel.app",
    "reddit.com",
    "tiktok.com",
    "amazon.com", // too broad / not clothes-first
    "ebay.com",
    "walmart.com",
    "target.com",
    "etsy.com",
  ];

  const CLOTHING_HINT =
    /\b(dress|dresses|clothing|apparel|fashion|ready-to-wear|womenswear|menswear|shoes|heels|sneakers|denim|jeans|blouse|skirt|outerwear|knitwear|lingerie|swimwear|handbag|tote)\b/i;

  function hostOf(hostname) {
    return String(hostname || "")
      .toLowerCase()
      .replace(/^www\./, "");
  }

  function endsWithHost(hostname, base) {
    const h = hostOf(hostname);
    const b = hostOf(base);
    return h === b || h.endsWith(`.${b}`);
  }

  function isAllowedHost(hostname) {
    const h = hostOf(hostname);
    if (!h) return false;
    if (SKIP.some((s) => endsWithHost(h, s))) return false;
    return ALLOW.some((a) => endsWithHost(h, a));
  }

  function isSkippedHost(hostname) {
    return SKIP.some((s) => endsWithHost(hostname, s));
  }

  function pageLooksLikeClothing() {
    const blob = [
      document.title,
      meta("og:site_name"),
      meta("og:title"),
      meta("description"),
      meta("og:description"),
      location.pathname,
      location.hostname,
    ]
      .filter(Boolean)
      .join(" ");
    if (CLOTHING_HINT.test(blob)) return true;
    if (/\/(clothing|dresses|shoes|apparel|womens?|mens?|collections?)\b/i.test(location.pathname)) {
      return true;
    }
    return false;
  }

  function meta(prop) {
    return (
      document.querySelector?.(`meta[property="${prop}"]`)?.content ||
      document.querySelector?.(`meta[name="${prop}"]`)?.content ||
      ""
    );
  }

  /** Manifest match patterns for Chrome content_scripts */
  function manifestMatches() {
    const set = new Set();
    ALLOW.forEach((h) => {
      set.add(`*://*.${h}/*`);
      set.add(`*://${h}/*`);
    });
    return [...set];
  }

  return {
    ALLOW,
    SKIP,
    isAllowedHost,
    isSkippedHost,
    pageLooksLikeClothing,
    manifestMatches,
    endsWithHost,
    hostOf,
  };
})();
