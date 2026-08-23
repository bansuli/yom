import { json, preflight } from "../lib/http.js";
import { getAuthUser, rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";
import { adminEmails } from "./admin-login.js";

/**
 * One place that answers "how many people does yom actually have", read
 * straight from the database rather than from a spreadsheet that can fail
 * quietly. Everything here is derived — nothing is written — so it can be
 * refreshed as often as it takes to trust the number.
 */

/**
 * Either a founder logged in with her own email, or the shared secret — which
 * exists so the numbers were reachable the night this was built, and can be
 * dropped by unsetting YOM_ADMIN_SECRET once both accounts exist.
 */
async function authed(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) {
    const who = await getAuthUser(token);
    const email = String(who.data?.email || "").trim().toLowerCase();
    if (who.ok && email && adminEmails().includes(email)) return email;
  }
  const secret = process.env.YOM_ADMIN_SECRET || "";
  if (secret && String(req.headers["x-yom-admin"] || "") === secret) return "secret";
  return "";
}

function parseCsv(req) {
  try {
    return new URL(req.url, "http://localhost").searchParams.get("csv") || "";
  } catch {
    return "";
  }
}

function rows(res) {
  return Array.isArray(res?.data) ? res.data : [];
}

function dayKey(value) {
  const at = value ? new Date(value) : null;
  return at && !Number.isNaN(at.valueOf()) ? at.toISOString().slice(0, 10) : "";
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  const who = await authed(req);
  if (!who) {
    json(res, 401, { ok: false, error: "nope." });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "supabase is not configured" });
    return;
  }

  const [leadsRes, visitorsRes, lineupsRes, looksRes] = await Promise.all([
    sbAdmin(rest("leads", "select=*&order=created_at.desc&limit=1000")),
    sbAdmin(rest("scan_visitors", "select=*&order=created_at.desc&limit=2000")),
    sbAdmin(rest("lineups", "select=*&limit=1000")),
    sbAdmin(rest("pipeline_looks", "select=id,email,anon_id,account_key,in_closet,created_at&limit=2000")),
  ]);

  const leads = rows(leadsRes);
  const visitors = rows(visitorsRes);
  const lineups = rows(lineupsRes);
  const looks = rows(looksRes);

  // One row per person. Email is the handle she gave us; anon ids are the
  // browsers she used, and are what tie a visit to a lead to a lineup.
  const people = new Map();
  const touch = (email) => {
    const key = String(email || "").trim().toLowerCase();
    if (!key) return null;
    if (!people.has(key)) {
      people.set(key, {
        email: key,
        name: "",
        source: "",
        campaign: "",
        first_seen: "",
        last_seen: "",
        anon_ids: [],
        checks: 0,
        looks: 0,
        in_lineup: 0,
        is_public: false,
      });
    }
    return people.get(key);
  };

  for (const lead of leads) {
    const p = touch(lead.email);
    if (!p) continue;
    p.name = p.name || lead.name || "";
    p.source = p.source || lead.source || "";
    p.campaign = p.campaign || lead.campaign || "";
    p.first_seen = p.first_seen && p.first_seen < lead.created_at ? p.first_seen : lead.created_at || p.first_seen;
    if (lead.anon_id && !p.anon_ids.includes(lead.anon_id)) p.anon_ids.push(lead.anon_id);
  }

  for (const v of visitors) {
    const p = touch(v.email);
    if (!p) continue;
    p.source = p.source || v.source || "";
    p.campaign = p.campaign || v.campaign || "";
    p.checks += Number(v.checks_count) || 0;
    if (v.anon_id && !p.anon_ids.includes(v.anon_id)) p.anon_ids.push(v.anon_id);
    if (!p.first_seen || (v.created_at && v.created_at < p.first_seen)) p.first_seen = v.created_at || p.first_seen;
    if (!p.last_seen || (v.last_seen_at && v.last_seen_at > p.last_seen)) p.last_seen = v.last_seen_at || p.last_seen;
  }

  const byAnon = new Map();
  for (const p of people.values()) for (const id of p.anon_ids) byAnon.set(id, p);

  for (const look of looks) {
    const p = touch(look.email) || byAnon.get(look.anon_id);
    if (!p) continue;
    p.looks += 1;
    if (look.in_closet) p.in_lineup += 1;
  }

  for (const row of lineups) {
    const p = touch(row.email) || byAnon.get(row.anon_id);
    if (!p) continue;
    if (row.is_public) p.is_public = true;
  }

  const list = [...people.values()].sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen)));
  const today = new Date().toISOString().slice(0, 10);
  const byCampaign = {};
  for (const p of list) {
    const key = p.campaign || "unattributed";
    byCampaign[key] = (byCampaign[key] || 0) + 1;
  }

  // Visitors with no email are the top of the funnel: she opened yom and left.
  const anonOnly = visitors.filter((v) => !v.email);
  const anonToday = new Set(anonOnly.filter((v) => dayKey(v.created_at) === today).map((v) => v.anon_id));

  if (String(parseCsv(req)) === "1") {
    const head = "email,name,source,campaign,first_seen,looks,in_lineup,public";
    const body = list
      .map((p) =>
        [p.email, p.name, p.source, p.campaign, p.first_seen, p.looks, p.in_lineup, p.is_public ? "yes" : ""]
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="yom-people.csv"`);
    res.end(`${head}\n${body}\n`);
    return;
  }

  json(res, 200, {
    ok: true,
    totals: {
      people: list.length,
      people_today: list.filter((p) => dayKey(p.first_seen) === today).length,
      with_looks: list.filter((p) => p.looks > 0).length,
      with_lineup: list.filter((p) => p.in_lineup > 0).length,
      public_lineups: list.filter((p) => p.is_public).length,
      visitors_no_email_today: anonToday.size,
      looks_total: looks.length,
    },
    by_campaign: byCampaign,
    people: list.slice(0, 500),
  });
}
