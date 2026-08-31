import { bearer, json, preflight } from "../../lib/http.js";
import { listGmailSignals, listUpcomingEvents } from "../../lib/google-store.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/**
 * GET /api/google/events
 * Returns upcoming calendar events + recent gmail shopping signals for yom context.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "Sign-in is not configured yet." });
    return;
  }

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }
  const account = await accountFromToken(token);
  if (!account?.profile?.id) {
    json(res, 401, { ok: false, error: "session expired." });
    return;
  }

  const [events, signals] = await Promise.all([
    listUpcomingEvents(account.profile.id, { limit: 20 }),
    listGmailSignals(account.profile.id, { limit: 20 }),
  ]);

  json(res, 200, {
    ok: true,
    events: events.map((e) => ({
      id: e.id,
      label: e.title,
      when: e.starts_at,
      kind: e.kind,
      location: e.location,
      link: e.html_link,
    })),
    gmail: signals.map((s) => ({
      id: s.id,
      subject: s.subject,
      from: s.from_addr,
      snippet: s.snippet,
      when: s.sent_at,
      kind: s.signal_kind,
      brand: s.brand,
      item: s.item_name || "",
      size: s.size || "",
    })),
  });
}
