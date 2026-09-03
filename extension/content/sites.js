/* Apparel shops only — clothing brands (big + small), fashion resale, fashion PDPs on big marketplaces.
   Not beauty, home, grocery, electronics, or random sites. */
window.YOM_SITES = (() => {
  /* Never run here — email, social, news, SaaS, banks, tools. */
  const SKIP = [
    "google.com",
    "gmail.com",
    "github.com",
    "stackoverflow.com",
    "stackexchange.com",
    "notion.so",
    "notion.site",
    "slack.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "chatgpt.com",
    "openai.com",
    "anthropic.com",
    "claude.ai",
    "cursor.com",
    "youryom.com",
    "vercel.app",
    "vercel.com",
    "netlify.app",
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
    "wikipedia.org",
    "medium.com",
    "substack.com",
    "nytimes.com",
    "washingtonpost.com",
    "cnn.com",
    "bbc.com",
    "bbc.co.uk",
    "theguardian.com",
    "netflix.com",
    "spotify.com",
    "discord.com",
    "twitch.tv",
    "figma.com",
    "linear.app",
    "atlassian.com",
    "atlassian.net",
    "jira.com",
    "trello.com",
    "asana.com",
    "hubspot.com",
    "salesforce.com",
    "canva.com",
    "adobe.com",
    "npmjs.com",
    "pypi.org",
    "huggingface.co",
    "twilio.com",
    "cloudflare.com",
    "aws.amazon.com",
    "console.aws.amazon.com",
    "azure.com",
    "digitalocean.com",
    "heroku.com",
    "gitlab.com",
    "bitbucket.org",
    "producthunt.com",
    "crunchbase.com",
    "glassdoor.com",
    "indeed.com",
    "lever.co",
    "greenhouse.io",
    "calendly.com",
    "typeform.com",
    "airtable.com",
    "miro.com",
    "loom.com",
    "grammarly.com",
    "duolingo.com",
    "khanacademy.org",
    "coursera.org",
    "udemy.com",
    "archive.org",
    "mozilla.org",
    "w3.org",
    "mdn.dev",
    "developer.mozilla.org",
  ];

  /* Beauty, home, pharmacy, electronics — retail but not clothing. */
  const NON_APPAREL_RETAIL = [
    "sephora.com",
    "ulta.com",
    "dermstore.com",
    "cultbeauty.com",
    "cultbeauty.co.uk",
    "spacenk.com",
    "bluemercury.com",
    "beautylish.com",
    "lookfantastic.com",
    "glossier.com",
    "fentybeauty.com",
    "rarebeauty.com",
    "colourpop.com",
    "morphe.com",
    "maccosmetics.com",
    "clinique.com",
    "esteelauder.com",
    "lancome-usa.com",
    "lancome.com",
    "charlottetilbury.com",
    "rysemakeup.com",
    "theordinary.com",
    "deciem.com",
    "drunkelephant.com",
    "tatcha.com",
    "kiehls.com",
    "loccitane.com",
    "bathandbodyworks.com",
    "thebodyshop.com",
    "aesop.com",
    "functionofbeauty.com",
    "ipsy.com",
    "boxycharm.com",
    "cvs.com",
    "walgreens.com",
    "riteaid.com",
    "boots.com",
    "sallybeauty.com",
    "ikea.com",
    "wayfair.com",
    "westelm.com",
    "crateandbarrel.com",
    "potterybarn.com",
    "cb2.com",
    "williams-sonoma.com",
    "restorationhardware.com",
    "rh.com",
    "article.com",
    "furniture.com",
    "bestbuy.com",
    "bhphotovideo.com",
    "newegg.com",
    "homedepot.com",
    "lowes.com",
    "chewy.com",
    "petco.com",
    "petsmart.com",
    "instacart.com",
    "wholefoodsmarket.com",
    "kroger.com",
    "costco.com",
    "samsclub.com",
  ];

  /* Known clothing / fashion retailers — in scope on shop/PDP pages without extra copy sniffing. */
  const FASHION_RETAIL = [
    "thereformation.com",
    "everlane.com",
    "aritzia.com",
    "zara.com",
    "hm.com",
    "uniqlo.com",
    "gap.com",
    "oldnavy.com",
    "bananarepublic.com",
    "jcrew.com",
    "madewell.com",
    "nordstrom.com",
    "nordstromrack.com",
    "saksfifthavenue.com",
    "saksoff5th.com",
    "neimanmarcus.com",
    "bloomingdales.com",
    "macys.com",
    "net-a-porter.com",
    "mrporter.com",
    "ssense.com",
    "farfetch.com",
    "matchesfashion.com",
    "mytheresa.com",
    "luisaviaroma.com",
    "endclothing.com",
    "nike.com",
    "adidas.com",
    "adidas.co.uk",
    "lululemon.com",
    "alo.com",
    "aloyoga.com",
    "skims.com",
    "cos.com",
    "arket.com",
    "stories.com",
    "andotherstories.com",
    "ganni.com",
    "toteme.com",
    "sezane.com",
    "doen.com",
    "agolde.com",
    "revolve.com",
    "shopbop.com",
    "anthropologie.com",
    "freepeople.com",
    "urbanoutfitters.com",
    "princesspolly.com",
    "ohpolly.com",
    "prettylittlething.com",
    "asos.com",
    "shein.com",
    "fashionnova.com",
    "abercrombie.com",
    "ae.com",
    "americaneagle.com",
    "levis.com",
    "levi.com",
    "patagonia.com",
    "thenorthface.com",
    "allsaints.com",
    "reiss.com",
    "whistles.com",
    "reiss.com",
    "mango.com",
    "massimodutti.com",
    "bershka.com",
    "pullandbear.com",
    "tommy.com",
    "calvinklein.us",
    "calvinklein.com",
    "ralphlauren.com",
    "guess.com",
    "express.com",
    "loft.com",
    "annaylor.com",
    "reformation.com",
    "shop.lululemon.com",
    "vuori.com",
    "outdoorvoices.com",
    "girlfriend.com",
    "girlfriendcollective.com",
    "everlane.com",
    "quince.com",
    "buckmason.com",
    "taylorstitch.com",
    "jadedldn.com",
    "jadedlondon.com",
    "ohpolly.com",
    "meshki.com",
    "beginningboutique.com",
    "showpo.com",
    "reformation.com",
    "self-portrait-studio.com",
    "simkhai.com",
    "staud.clothing",
    "cultgaia.com",
    "rouje.com",
    "ba-sh.com",
    "sandro-paris.com",
    "maje.com",
    "apc.fr",
    "apc-us.com",
    "acne.com",
    "acnestudios.com",
    "kith.com",
    "palace.com",
    "supreme.com",
    "stussy.com",
    "carhartt.com",
    "dickies.com",
    "wrangler.com",
    "lee.com",
    "dockers.com",
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

  /* General marketplaces — only when this page is clearly apparel. */
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

  /* Strong apparel — garments / shoes, not vague “fashion”. */
  const STRONG_APPAREL =
    /\b(dress|dresses|jeans|denim|blouse|skirt|skirts|trousers|pants|coat|coats|jacket|jackets|sweater|sweaters|cardigan|blazer|hoodie|romper|jumpsuit|heels|sneakers|boots|sandals|lingerie|swimwear|bodysuit|camisole|leggings|outerwear|knitwear|womenswear|menswear|ready[- ]to[- ]wear|midi dress|maxi dress|mini dress|tee|t-shirt|top|tops|shirt|shirts|short|shorts|bra|bras|underwear|sock|socks|loafer|loafers|mule|mules|pump|pumps|flat|flats|sneaker|boot|sandal)\b/i;

  const CLOTHING_HINT =
    /\b(dress|dresses|clothing|apparel|fashion|ready[- ]to[- ]wear|womenswear|menswear|shoes|heels|sneakers|denim|jeans|blouse|skirt|skirts|outerwear|knitwear|lingerie|swimwear|handbag|handbags|tote bag|boutique|lookbook|preloved|pre[- ]owned|secondhand|streetwear|sneaker|boots|sandals|coat|coats|jacket|jackets|sweater|sweaters|cardigan|trousers|leggings|activewear|athleisure|romper|jumpsuit|midi dress|maxi dress|mini dress|blazer|hoodie|camisole|bodysuit|women'?s clothing|men'?s clothing)\b/i;

  const FASHION_PATH =
    /\/(fashion|clothing|apparel|womens?-clothing|mens?-clothing|dresses|shoes|handbags|activewear|streetwear|vintage-?fashion|boutique|ready-to-wear|rtw|womenswear|menswear)\b/i;

  /* If these dominate and there is no strong garment signal, stay off. */
  const NON_APPAREL_HINT =
    /\b(makeup|make-up|skincare|skin[- ]care|fragrance|perfume|cologne|lipstick|foundation|mascara|serum|moisturizer|moisturiser|cleanser|toner|concealer|blush|eyeshadow|cosmetics|beauty|hair[- ]care|shampoo|conditioner|nail polish|nail care|bath bomb|candle|candles|furniture|sofa|couch|mattress|bedding|duvet|electronics|laptop|headphones|grocery|supplement|vitamins?|pet food|dog food|cat food)\b/i;

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
    if (NON_APPAREL_RETAIL.some((s) => endsWithHost(h, s))) return true;
    if (h === "localhost" || h === "127.0.0.1") return true;
    return false;
  }

  function isFashionResale(hostname) {
    return FASHION_RESALE.some((s) => endsWithHost(hostname, s));
  }

  function isFashionRetail(hostname) {
    return FASHION_RETAIL.some((s) => endsWithHost(hostname, s));
  }

  function isBroadMarketplace(hostname) {
    return BROAD_MARKETPLACE.some((s) => endsWithHost(hostname, s));
  }

  function meta(prop) {
    return (
      document.querySelector?.(`meta[property="${prop}"]`)?.content ||
      document.querySelector?.(`meta[name="${prop}"]`)?.content ||
      ""
    );
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
    ]
      .filter(Boolean)
      .join(" ");
  }

  function pageLooksLikeClothing(extra = "") {
    const blob = `${pageBlob()} ${extra}`;
    if (NON_APPAREL_HINT.test(blob) && !STRONG_APPAREL.test(blob)) return false;
    if (STRONG_APPAREL.test(blob)) return true;
    if (CLOTHING_HINT.test(blob)) return true;
    if (FASHION_PATH.test(location.pathname)) return true;
    return false;
  }

  return {
    SKIP,
    NON_APPAREL_RETAIL,
    FASHION_RETAIL,
    FASHION_RESALE,
    BROAD_MARKETPLACE,
    isSkippedHost,
    isFashionResale,
    isFashionRetail,
    isBroadMarketplace,
    pageLooksLikeClothing,
    endsWithHost,
    hostOf,
  };
})();
