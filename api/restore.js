import { json, preflight, readJson } from "../lib/http.js";
import { emailConfigured, sendEmail } from "../lib/email.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

function cleanEmail(v) {
  return String(v || "").trim().toLowerCase().slice(0, 180);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function appBase() {
  return (process.env.APP_BASE_URL || "https://youryom.com").replace(/\/$/, "");
}

function body(name, link) {
  const hi = name ? `hi ${name},` : "hi,";
  return {
    text: `${hi}

here's your yom. open this on the phone you want it on:

${link}

your looks, your lineup and your rounds are all there. the link is just for you — don't forward it.

— yom`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#111">
  <p>${hi}</p>
  <p>here's your yom. open this on the phone you want it on:</p>
  <p><a href="${link}" style="display:inline-block;padding:11px 18px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">open my yom →</a></p>
  <p style="color:#6a6a6a;font-size:13px">your looks, your lineup and your rounds are all there. the link is just for you — don't forward it.</p>
  <p style="color:#6a6a6a;font-size:13px">— yom</p>
</div>`,
  };
}

/**
 * "I got a new phone." Her looks live under an account key her old browser
 * held, so the only safe way to hand it over is to the address already on the
 * account. Typing an email proves nothing; receiving the mail does.
 *
 * Always answers the same way, whether or not there is an account, so this
 * cannot be used to find out who has a yom.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
    return;
  }

  const email = cleanEmail(readJson(req).email);
  const sent = { ok: true, sent: true };
  if (!isEmail(email)) {
    json(res, 400, { ok: false, error: "need a real email." });
    return;
  }
  if (!supabaseConfigured() || !emailConfigured()) {
    json(res, 503, { ok: false, error: "restore isn’t set up yet." });
    return;
  }

  const found = await sbAdmin(
    rest(
      "lineups",
      `email=eq.${encodeURIComponent(email)}&account_key=not.is.null&select=account_key,display_name&order=updated_at.desc&limit=1`
    )
  );
  const row = Array.isArray(found.data) ? found.data[0] : null;
  if (!row?.account_key) {
    json(res, 200, sent);
    return;
  }

  const link = `${appBase()}/looks#key=${encodeURIComponent(row.account_key)}`;
  const mail = body(String(row.display_name || "").trim().toLowerCase(), link);
  await sendEmail({ to: email, subject: "your yom", ...mail });
  json(res, 200, sent);
}
