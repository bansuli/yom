import { json, preflight, readJson } from "../lib/http.js";
import { adminIdentity, isAdminEmail } from "../lib/admin-auth.js";
import { emailConfigured, sendEmail, sendEmailBatch } from "../lib/email.js";
import { campaignIds, renderCampaign } from "../lib/campaigns.js";
import { one, rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

/**
 * Write to everyone at once.
 *
 * The least reversible thing here, so it is built to be hard to do by accident:
 * nothing is sent unless the request says send, the same girl is never sent the
 * same campaign twice, and a preview — who would get it, and exactly what they
 * would read — is the default answer.
 */

const INTERNAL = /@youryom\.com$|^test@|@example\.com$/i;

function isReal(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || INTERNAL.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Everyone who joined, with the key that opens her own lineup. */
async function audience() {
  const [leadsRes, lineupsRes] = await Promise.all([
    sbAdmin(rest("leads", "select=email,name,created_at&order=created_at.asc&limit=2000")),
    sbAdmin(rest("lineups", "select=email,account_key,display_name&limit=2000")),
  ]);
  const keyed = new Map();
  for (const row of Array.isArray(lineupsRes.data) ? lineupsRes.data : []) {
    const email = String(row.email || "").trim().toLowerCase();
    if (email && row.account_key && !keyed.has(email)) keyed.set(email, row);
  }
  const seen = new Map();
  for (const row of Array.isArray(leadsRes.data) ? leadsRes.data : []) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!isReal(email) || seen.has(email)) continue;
    const mine = keyed.get(email);
    seen.set(email, {
      email,
      name: row.name || mine?.display_name || "",
      account_key: mine?.account_key || "",
    });
  }
  return [...seen.values()];
}

async function alreadySent(campaign) {
  const res = await sbAdmin(
    rest("sent_emails", `campaign=eq.${encodeURIComponent(campaign)}&select=email&limit=2000`)
  );
  // No table yet means nobody has been written to, which is safe to assume: the
  // worst case is a preview that overstates who is still to hear from us.
  return new Set((Array.isArray(res.data) ? res.data : []).map((r) => String(r.email).toLowerCase()));
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
    return;
  }

  const who = await adminIdentity(req);
  if (!who) {
    json(res, 401, { ok: false, error: "not allowed" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "database is not configured" });
    return;
  }

  const body = readJson(req);
  const campaign = String(body.campaign || "");
  if (!campaignIds().includes(campaign)) {
    json(res, 400, { ok: false, error: `unknown campaign. have: ${campaignIds().join(", ")}` });
    return;
  }

  const people = await audience();
  const sentTo = await alreadySent(campaign);
  const pending = people.filter((p) => !sentTo.has(p.email));

  // One to yourself first. Nobody should send a hundred emails having never
  // seen one arrive.
  const testTo = String(body.test_to || "").trim().toLowerCase();
  if (testTo) {
    if (!isAdminEmail(testTo)) {
      json(res, 400, { ok: false, error: "test sends go to a founder address only" });
      return;
    }
    if (!emailConfigured()) {
      json(res, 503, { ok: false, error: "email is not configured — set RESEND_API_KEY" });
      return;
    }
    const sample = renderCampaign(campaign, { name: "hadley", account_key: "" });
    const out = await sendEmail({ to: testTo, ...sample });
    json(res, out.ok ? 200 : 502, { ok: out.ok, test_to: testTo, error: out.error });
    return;
  }

  const preview = renderCampaign(campaign, pending[0] || { name: "hadley", account_key: "" });
  if (body.send !== true) {
    json(res, 200, {
      ok: true,
      preview: true,
      campaign,
      email_ready: emailConfigured(),
      recipients: pending.length,
      already_sent: sentTo.size,
      to: pending.slice(0, 60).map((p) => p.email),
      with_a_way_back_in: pending.filter((p) => p.account_key).length,
      subject: preview?.subject || "",
      text: preview?.text || "",
    });
    return;
  }

  if (!emailConfigured()) {
    json(res, 503, { ok: false, error: "email is not configured — set RESEND_API_KEY" });
    return;
  }
  if (!pending.length) {
    json(res, 200, { ok: true, sent: 0, note: "everyone has already had this one" });
    return;
  }

  // Batched: sending one at a time takes longer than the function is allowed to
  // run, and a half-sent campaign is worse than an unsent one.
  let sent = 0;
  const failures = [];
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const out = await sendEmailBatch(
      chunk.map((person) => ({ to: person.email, ...renderCampaign(campaign, person) }))
    );
    if (!out.ok) {
      failures.push(out.error || "batch failed");
      continue;
    }
    sent += out.sent || chunk.length;
    // Written after the send, so a failure never marks anyone as written to.
    await sbAdmin(rest("sent_emails", "on_conflict=campaign,email"), {
      method: "POST",
      prefer: "resolution=ignore-duplicates",
      body: chunk.map((person) => ({ campaign, email: person.email, sent_by: who })),
    });
  }

  json(res, failures.length && !sent ? 502 : 200, {
    ok: Boolean(sent),
    campaign,
    sent,
    of: pending.length,
    by: who,
    errors: failures,
  });
}
