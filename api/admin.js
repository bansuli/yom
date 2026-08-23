import { json, preflight } from "../lib/http.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";
import { adminIdentity } from "../lib/admin-auth.js";

/**
 * One place that answers "how many people does yom actually have", read
 * straight from the database rather than from a spreadsheet that can fail
 * quietly. Everything here is derived — nothing is written — so it can be
 * refreshed as often as it takes to trust the number.
 */

/**
 * You and mal use yom constantly, so your rows would sit at the top of every
 * count forever. Filtered rather than deleted — testing keeps recreating them,
 * and the data is still worth having.
 */
function isInternal(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return true;
  if (value.endsWith("@youryom.com")) return true;
  if (/^test@|@example\.com$|@randomemail\.com$/.test(value)) return true;
  return String(process.env.YOM_INTERNAL_EMAILS || "bansuleimann@gmail.com,bsuleiman.22@acsamman.edu.jo,bsuleiman.26@berkeley.edu")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(value);
}

function query(req, key) {
  try {
    return new URL(req.url, "http://localhost").searchParams.get(key) || "";
  } catch {
    return "";
  }
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

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  const who = await adminIdentity(req);
  if (!who) {
    json(res, 401, { ok: false, error: "nope." });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "supabase is not configured" });
    return;
  }

  const [leadsRes, visitorsRes, lineupsRes, looksRes, errorsRes] = await Promise.all([
    sbAdmin(rest("leads", "select=*&order=created_at.desc&limit=1000")),
    sbAdmin(rest("scan_visitors", "select=*&order=created_at.desc&limit=2000")),
    sbAdmin(rest("lineups", "select=*&limit=1000")),
    sbAdmin(
      rest(
        "pipeline_looks",
        "select=id,email,anon_id,account_key,title,source_url,input_method,round_id,day_id,score,product,verdict,in_closet,created_at&order=created_at.desc&limit=2000"
      )
    ),
    sbAdmin(rest("app_errors", "select=*&order=at.desc&limit=200")),
  ]);

  const leads = rows(leadsRes);
  const visitors = rows(visitorsRes);
  const lineups = rows(lineupsRes);
  const looks = rows(looksRes);
  // The table may not exist yet; a missing error log must not break the page.
  const errors = rows(errorsRes);

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
        scans: [],
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
    const p = (look.email ? people.get(String(look.email).trim().toLowerCase()) : null) || byAnon.get(look.anon_id);
    if (!p) continue;
    p.looks += 1;
    if (look.in_closet) p.in_lineup += 1;
    if (p.scans.length < 40) {
      p.scans.push({
        id: look.id,
        at: look.created_at,
        title: look.title || "",
        brand: look.product?.brand || "",
        piece: look.product?.name || look.product?.category || "",
        input: look.input_method || "",
        round: look.round_id || "",
        day: look.day_id || "",
        score: look.score == null ? null : Number(look.score),
        verdict: String(look.verdict?.title || "").slice(0, 120),
        source_url: look.source_url || "",
        in_lineup: Boolean(look.in_closet),
      });
    }
  }

  for (const row of lineups) {
    const p = (row.email ? people.get(String(row.email).trim().toLowerCase()) : null) || byAnon.get(row.anon_id);
    if (!p) continue;
    if (row.is_public) p.is_public = true;
    // Her name reaches us on the lead row, which is exactly what the sheet was
    // dropping — so fall back to the one she typed into her lineup.
    if (!p.name && row.display_name) p.name = String(row.display_name).trim();
  }

  const everyone = [...people.values()].sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen)));
  const showInternal = query(req, "internal") === "1";
  const internal = everyone.filter((p) => isInternal(p.email));
  const list = showInternal ? everyone : everyone.filter((p) => !isInternal(p.email));

  // A calendar "today" is a trap: the server runs in utc, so at 9pm in
  // california today already means "since 5pm". Windows are measured back from
  // now instead, which means the same thing everywhere.
  const WINDOWS = { "24h": 864e5, "7d": 6048e5, all: 0 };
  const windowKey = WINDOWS[query(req, "window")] === undefined ? "all" : query(req, "window");
  const span = WINDOWS[windowKey];
  const since = span ? Date.now() - span : 0;
  const inWindow = (value) => {
    if (!since) return true;
    const at = value ? new Date(value).valueOf() : 0;
    return Boolean(at) && at >= since;
  };

  const keyOf = (p) => p.email;
  const peopleIn = list.filter((p) => inWindow(p.first_seen) || inWindow(p.last_seen));
  const peopleInKeys = new Set(peopleIn.map(keyOf));

  // Every step counts the same population over the same window, or the chart
  // compares two different things and reads as nonsense.
  const visitorsIn = visitors.filter((v) => inWindow(v.created_at) || inWindow(v.last_seen_at));
  const trackedAnons = new Set(visitorsIn.map((v) => v.anon_id).filter(Boolean));
  // Someone backfilled from the sheet has no visitor row, so count her once here
  // rather than letting the funnel show more emails than opens.
  const untracked = peopleIn.filter((p) => !(p.anon_ids || []).some((id) => trackedAnons.has(id))).length;
  const opened = trackedAnons.size + untracked;

  const looksIn = looks.filter(
    (look) => inWindow(look.created_at) && (showInternal || !isInternal(look.email))
  );
  const scannedKeys = new Set();
  const lineupKeys = new Set();
  for (const look of looksIn) {
    const p = (look.email ? people.get(String(look.email).trim().toLowerCase()) : null) || byAnon.get(look.anon_id);
    if (!p || !peopleInKeys.has(keyOf(p))) continue;
    scannedKeys.add(keyOf(p));
    if (look.in_closet) lineupKeys.add(keyOf(p));
  }
  const sharedCount = peopleIn.filter((p) => p.is_public).length;

  const funnel = [
    { step: "Opened yom", people: opened },
    { step: "Gave an email", people: peopleIn.length },
    { step: "Scanned a look", people: scannedKeys.size },
    { step: "Built a lineup", people: lineupKeys.size },
    { step: "Shared it", people: sharedCount },
  ];

  const stuck = {
    no_scan: peopleIn.filter((p) => p.looks === 0).map((p) => p.email),
    scanned_no_lineup: peopleIn.filter((p) => p.looks > 0 && p.in_lineup === 0).map((p) => p.email),
    lineup_not_shared: peopleIn.filter((p) => p.in_lineup > 0 && !p.is_public).map((p) => p.email),
  };

  const byCampaign = {};
  for (const p of list) {
    const key = p.campaign || "unattributed";
    byCampaign[key] = (byCampaign[key] || 0) + 1;
  }

  const mine = looks.filter((look) => showInternal || !isInternal(look.email));
  const byInput = {};
  const byRound = {};
  let scored = 0;
  let scoreSum = 0;
  for (const look of mine) {
    const input = look.input_method || "unknown";
    byInput[input] = (byInput[input] || 0) + 1;
    const round = look.round_id || "unassigned";
    byRound[round] = (byRound[round] || 0) + 1;
    if (look.score != null) {
      scored += 1;
      scoreSum += Number(look.score) || 0;
    }
  }

  const activity = mine.slice(0, 60).map((look) => ({
    at: look.created_at,
    email: look.email || "",
    title: look.title || "",
    brand: look.product?.brand || "",
    input: look.input_method || "",
    round: look.round_id || "",
    score: look.score == null ? null : Number(look.score),
    in_lineup: Boolean(look.in_closet),
  }));

  // The same fault fifty times is one issue, not fifty rows. Group by what
  // broke, and treat a group as resolved only while nothing newer has happened
  // since it was ticked off.
  const groups = new Map();
  for (const e of errors) {
    const kind = e.kind || "unknown";
    const message = e.message || "";
    const key = `${kind}::${message}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        kind,
        message,
        status: e.status ?? null,
        path: e.path || "",
        count: 0,
        people: new Set(),
        first_at: e.at,
        last_at: e.at,
        resolved_at: null,
        resolved_by: "",
      });
    }
    const g = groups.get(key);
    g.count += 1;
    if (e.email) g.people.add(e.email);
    if (e.at && e.at < g.first_at) g.first_at = e.at;
    if (e.at && e.at > g.last_at) g.last_at = e.at;
    if (e.resolved_at && (!g.resolved_at || e.resolved_at > g.resolved_at)) {
      g.resolved_at = e.resolved_at;
      g.resolved_by = e.resolved_by || "";
    }
    if (!e.resolved_at) g.unresolved = true;
  }

  const issues = [...groups.values()]
    .map((g) => ({
      key: g.key,
      kind: g.kind,
      message: g.message,
      status: g.status,
      path: g.path,
      count: g.count,
      people: g.people.size,
      first_at: g.first_at,
      last_at: g.last_at,
      resolved: !g.unresolved && Boolean(g.resolved_at),
      resolved_by: g.resolved_by,
      resolved_at: g.resolved_at,
    }))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || String(b.last_at).localeCompare(String(a.last_at)));

  const errorsByKind = {};
  for (const g of issues) {
    if (g.resolved) continue;
    errorsByKind[g.kind] = (errorsByKind[g.kind] || 0) + g.count;
  }

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
    window: windowKey,
    funnel,
    stuck,
    activity,
    issues,
    errors_by_kind: errorsByKind,
    errors_recent: issues.filter((g) => !g.resolved && inWindow(g.last_at)).length,
    error_log_missing: !Array.isArray(errorsRes?.data),
    by_input: byInput,
    by_round: byRound,
    avg_score: scored ? Math.round((scoreSum / scored) * 10) / 10 : null,
    totals: {
      people: list.length,
      people_in_window: peopleIn.length,
      opened_no_email: Math.max(0, opened - peopleIn.length),
      with_looks: list.filter((p) => p.looks > 0).length,
      with_lineup: list.filter((p) => p.in_lineup > 0).length,
      public_lineups: list.filter((p) => p.is_public).length,
      looks_total: mine.length,
      internal_hidden: showInternal ? 0 : internal.length,
    },
    by_campaign: byCampaign,
    people: list.slice(0, 500),
  });
}
