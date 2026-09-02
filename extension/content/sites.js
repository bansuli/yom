/* Where yom should not run, and special rules for big marketplaces vs resale apps. */
window.YOM_SITES = (() => {
  /* Never run here — email, social, dev tools, banks. */
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
    "paypal.com",
    "stripe.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "citi.com",
    "capitalone.com",
    "apple.com",
    "microsoft.com",
    "dropbox.com",
    "zoom.us",
    "meet.google.com",
    "docs.google.com",
    "drive.google.com",
    "calendar.google.com",
    "mail.google.com",
  ];

  /* Fashion-first resale — whole site is in scope. */
  const FASHION_RESALE = [
    "depop.com",
    "vinted.com",
    "vinted.fr",
    "vinted.de",
    "vinted.it",
    "vinted.es",
    "vinted.pl",
    "vinted.nl",
    "vinted.be",
    "vinted.lt",
    "vinted.cz",
    "poshmark.com",
    "mercari.com",
    "grailed.com",
    "thredup.com",
    "vestiairecollective.com",
    "therealreal.com",
    "stockx.com",
    "goat.com",
    "kidizen.com",
    "tradesy.com",
    "shopgoodwill.com",
    "buffaloexchange.com",
    "curtsyapp.com",
    "sellpy.com",
    "rebelle.com",
    "hardlyeverwornit.com",
    "videdressing.com",
    "yoox.com",
    "theoutnet.com",
  ];

  /* General marketplaces — only when the page is clearly fashion. */
  const BROAD_MARKETPLACE = [
    "amazon.com",
    "amazon.co.uk",
    "amazon.de",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
    "amazon.ca",
    "amazon.com.au",
    "amazon.co.jp",
    "ebay.com",
    "ebay.co.uk",
    "ebay.de",
    "ebay.fr",
    "walmart.com",
    "target.com",
    "etsy.com",
  ];

  const CLOTHING_HINT =
    /\b(dress|dresses|clothing|apparel|fashion|ready-to-wear|womenswear|menswear|shoes|heels|sneakers|denim|jeans|blouse|skirt|outerwear|knitwear|lingerie|swimwear|handbag|tote|boutique|lookbook|vintage|preloved|pre-owned|secondhand|resale|streetwear|sneaker|boots|sandals|coat|jacket|sweater|cardigan|trousers|leggings|activewear|athleisure)\b/i;

  const FASHION_PATH =
    /\/(fashion|clothing|apparel|womens?-clothing|mens?-clothing|dresses|shoes|handbags|jewelry|activewear|streetwear|vintage|boutique|collections?|shop|dp|gp\/product|itm|p|listing|products?|item)\b/i;

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

  function isSkippedHost(hostname) {
    const h = hostOf(hostname);
    if (!h) return true;
    if (SKIP.some((s) => endsWithHost(h, s))) return true;
    if (h === "localhost" || h === "127.0.0.1") return true;
    return false;
  }

  function isFashionResale(hostname) {
    return FASHION_RESALE.some((s) => endsWithHost(hostname, s));
  }

  function isBroadMarketplace(hostname) {
    return BROAD_MARKETPLACE.some((s) => endsWithHost(hostname, s));
  }

  function pageBlob() {
    return [
      document.title,
      meta("og:site_name"),
      meta("og:title"),
      meta("description"),
      meta("og:description"),
      document.querySelector("h1")?.textContent || "",
      location.pathname,
      location.hostname,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function pageLooksLikeClothing(extra = "") {
    const blob = `${pageBlob()} ${extra}`;
    if (CLOTHING_HINT.test(blob)) return true;
    if (FASHION_PATH.test(location.pathname)) return true;
    return false;
  }

  function meta(prop) {
    return (
      document.querySelector?.(`meta[property="${prop}"]`)?.content ||
      document.querySelector?.(`meta[name="${prop}"]`)?.content ||
      ""
    );
  }

  return {
    SKIP,
    FASHION_RESALE,
    BROAD_MARKETPLACE,
    isSkippedHost,
    isFashionResale,
    isBroadMarketplace,
    pageLooksLikeClothing,
    endsWithHost,
    hostOf,
  };
})();
