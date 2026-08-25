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

  // One person, in full, with the photos. Kept off the list payload on purpose:
  // a couple of hundred data-url images is megabytes nobody asked for.
  const only = query(req, "person").trim().toLowerCase();
  if (only) {
    const enc = encodeURIComponent(only);
    const [visitorRows, checkRows, lookRows, lineRows] = await Promise.all([
      sbAdmin(rest("scan_visitors", `email=eq.${enc}&select=anon_id,checks_count,created_at,last_seen_at,source,campaign`)),
      sbAdmin(
        rest(
          "scan_checks",
          `email=eq.${enc}&select=id,product,verdict,decision,input_method,image_url,created_at&order=created_at.desc&limit=60`
        )
      ),
      sbAdmin(
        rest(
          "pipeline_looks",
          `email=eq.${enc}&select=id,title,image_url,source_url,input_method,round_id,day_id,score,product,verdict,in_closet,created_at&order=created_at.desc&limit=80`
        )
      ),
      sbAdmin(rest("lineups", `email=eq.${enc}&select=*&limit=1`)),
    ]);

    const herLooks = rows(lookRows);
    const byId = new Map(herLooks.map((look) => [look.id, look]));
    const lineRow = rows(lineRows)[0] || null;
    const days = lineRow?.days && typeof lineRow.days === "object" ? lineRow.days : {};

    json(res, 200, {
      ok: true,
      person: {
        email: only,
        name: lineRow?.display_name || "",
        is_public: Boolean(lineRow?.is_public),
        visits: rows(visitorRows).length,
        checks: rows(visitorRows).reduce((n, v) => n + (Number(v.checks_count) || 0), 0),
        scans: rows(checkRows).map((check) => ({
          id: check.id,
          at: check.created_at,
          image: check.image_url || "",
          title: check.product?.name || check.verdict?.title || "a look",
          brand: check.product?.brand || "",
          category: check.product?.category || "",
          color: check.product?.color || "",
          price: check.product?.price ?? null,
          input: check.input_method || "",
          decision: check.decision || "",
          kept: check.decision === "save",
          score: check.verdict?.score == null ? null : Number(check.verdict.score),
          round: check.verdict?.round || "",
          verdict_title: String(check.verdict?.title || ""),
          verdict_body: String(check.verdict?.body || ""),
          why: String(check.verdict?.why_it_works || check.verdict?.why || ""),
          change: String(check.verdict?.change || check.verdict?.resolve || ""),
          berkeley: String(check.verdict?.berkeley || check.verdict?.spotting || ""),
        })),
        saved: herLooks.map((look) => ({
          id: look.id,
          at: look.created_at,
          image: look.image_url || "",
          title: look.title || "",
          brand: look.product?.brand || "",
          round: look.round_id || "",
          day: look.day_id || "",
          score: look.score == null ? null : Number(look.score),
          verdict_title: String(look.verdict?.title || ""),
          in_lineup: Boolean(look.in_closet),
        })),
        // Her lineup as she sees it: each day, each piece, with the photo.
        lineup: Object.entries(days).map(([day, pieces]) => ({
          day,
          pieces: (Array.isArray(pieces) ? pieces : [])
            .map((piece) => {
              const look = byId.get(piece?.lookId || piece);
              if (!look) return null;
              return {
                slot: piece?.slot || "look",
                title: look.title || "",
                image: look.image_url || "",
                score: look.score == null ? null : Number(look.score),
              };
            })
            .filter(Boolean),
        })),
      },
    });
    return;
  }

  const [leadsRes, visitorsRes, lineupsRes, looksRes, errorsRes, checksRes] = await Promise.all([
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
    // Every check she ran, not just the ones she kept. A scan she looked at and
    // walked away from is the most interesting row on this page.
    sbAdmin(
      rest(
        "scan_checks",
        "select=id,anon_id,email,product,verdict,decision,input_method,created_at&order=created_at.desc&limit=2000"
      )
    ),
  ]);

  const leads = rows(leadsRes);
  const visitors = rows(visitorsRes);
  const lineups = rows(lineupsRes);
  const looks = rows(looksRes);
  // The table may not exist yet; a missing error log must not break the page.
  const errors = rows(errorsRes);
  const checks = rows(checksRes);

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
        saved: [],
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

  // The account key is the third way a row names its owner, and the only one on
  // a device that never sent an email with a look. Seed it from the rows that
  // do carry a name, so the rest of that account's rows can be placed too.
  const byKey = new Map();
  const named = (row) =>
    (row.email ? people.get(String(row.email).trim().toLowerCase()) : null) || byAnon.get(row.anon_id) || null;
  for (const row of [...lineups, ...looks]) {
    const p = named(row);
    if (p && row.account_key) byKey.set(row.account_key, p);
  }
  const owner = (row) => named(row) || byKey.get(row.account_key) || null;

  for (const look of looks) {
    const p = owner(look);
    if (!p) continue;
    p.looks += 1;
    if (look.in_closet) p.in_lineup += 1;
    p.saved.push({
      id: look.id,
      at: look.created_at,
      title: look.title || "",
      brand: look.product?.brand || "",
      input: look.input_method || "",
      round: look.round_id || "",
      day: look.day_id || "",
      score: look.score == null ? null : Number(look.score),
      verdict_title: String(look.verdict?.title || ""),
      verdict_body: String(look.verdict?.body || ""),
      why: String(look.verdict?.why || ""),
      change: String(look.verdict?.change || ""),
      source_url: look.source_url || "",
      image_url: look.image_url || "",
      kept: Boolean(look.in_closet),
      from: "saved",
    });
  }

  for (const row of lineups) {
    const p = owner(row);
    if (!p) continue;
    if (row.is_public) p.is_public = true;
    // Her name reaches us on the lead row, which is exactly what the sheet was
    // dropping — so fall back to the one she typed into her lineup.
    if (!p.name && row.display_name) p.name = String(row.display_name).trim();
  }

  for (const check of checks) {
    const p =
      (check.email ? people.get(String(check.email).trim().toLowerCase()) : null) || byAnon.get(check.anon_id);
    if (!p) continue;
    const product = check.product || {};
    const verdict = check.verdict || {};
    p.scans.push({
      id: check.id,
      at: check.created_at,
      title: product.name || verdict.title || "a look",
      brand: product.brand || "",
      category: product.category || "",
      color: product.color || "",
      price: product.price ?? null,
      input: check.input_method || "",
      decision: check.decision || "",
      score: verdict.score == null ? null : Number(verdict.score),
      round: verdict.round || "",
      verdict_title: String(verdict.title || ""),
      verdict_body: String(verdict.body || "").slice(0, 400),
      why: String(verdict.why_it_works || verdict.why || "").slice(0, 300),
      change: String(verdict.change || verdict.resolve || "").slice(0, 300),
      berkeley: String(verdict.berkeley || verdict.spotting || "").slice(0, 300),
      kept: check.decision === "save",
      from: "check",
    });
  }

  // Checks are the full record; saved looks fill in anything from before that
  // table existed, so her history has no hole in the middle.
  for (const p of people.values()) {
    const seenAt = new Set(p.scans.map((row) => String(row.at).slice(0, 16) + row.title));
    for (const row of p.saved) {
      if (!seenAt.has(String(row.at).slice(0, 16) + row.title)) p.scans.push(row);
    }
    p.scans.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    p.scans = p.scans.slice(0, 200);
    p.saved_count = p.saved.length;
    delete p.saved;
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

  // A person is not a browser. One girl reaches yom from the instagram browser,
  // then safari, then the app she just put on her home screen — which on ios
  // keeps its own storage, and so gets its own id. Counting ids made every step
  // below look like a collapse against a number that was never people.
  //
  // So: everyone who gave an email counts once, however many browsers she used,
  // plus every browser we could not tie to a person — the ones who looked and
  // left, which is the drop worth reading.
  const strangers = new Set();
  for (const v of visitorsIn) {
    if (!v.anon_id) continue;
    const p = byAnon.get(v.anon_id);
    if (!p || !peopleInKeys.has(keyOf(p))) strangers.add(v.anon_id);
  }
  const opened = peopleIn.length + strangers.size;

  // The girls who opened yom and never gave an email are the whole of the first
  // drop, so the page they arrived on is the thing to look at. Guessing at where
  // the friction is beats nothing; knowing which page they left from beats
  // guessing.
  const leftFrom = {};
  const leftBy = {};
  for (const v of visitorsIn) {
    if (!v.anon_id || !strangers.has(v.anon_id)) continue;
    const page = String(v.path || "unknown").split("?")[0] || "unknown";
    leftFrom[page] = (leftFrom[page] || 0) + 1;
    const how = String(v.campaign || v.source || "direct");
    leftBy[how] = (leftBy[how] || 0) + 1;
  }

  const whose = (row) => owner(row);

  // A scan or a look carries an email only when the client happened to send
  // one — it belongs to whoever owns the browser it came from. Judging a row by
  // its own empty email column called every anonymous scan internal and threw
  // it away, which is why the funnel said nobody had scanned.
  const rowIsInternal = (row) => {
    const p = whose(row);
    return isInternal(p ? p.email : row.email);
  };

  const looksIn = looks.filter((look) => inWindow(look.created_at) && (showInternal || !rowIsInternal(look)));
  const checksIn = checks.filter((check) => inWindow(check.created_at) && (showInternal || !rowIsInternal(check)));

  const scannedKeys = new Set();
  const lineupKeys = new Set();
  const sharedKeys = new Set();
  for (const check of checksIn) {
    const p = whose(check);
    if (p && peopleInKeys.has(keyOf(p))) scannedKeys.add(keyOf(p));
  }
  for (const look of looksIn) {
    const p = whose(look);
    if (!p || !peopleInKeys.has(keyOf(p))) continue;
    // A saved look is a scan too, for anyone whose checks predate this table.
    scannedKeys.add(keyOf(p));
    if (look.in_closet) lineupKeys.add(keyOf(p));
  }
  // Her lineup is a row of its own, and it is the thing that actually decides
  // whether she has one — counting only kept looks missed a lineup whose looks
  // never made it into the table.
  for (const row of lineups) {
    if (!inWindow(row.updated_at || row.created_at)) continue;
    const p = whose(row);
    if (!p || !peopleInKeys.has(keyOf(p))) continue;
    if (row.days && Object.keys(row.days).length) lineupKeys.add(keyOf(p));
    if (row.is_public) sharedKeys.add(keyOf(p));
  }
  const sharedCount = sharedKeys.size;

  const steps = [
    ["Opened yom", opened],
    ["Gave an email", peopleIn.length],
    ["Scanned a look", scannedKeys.size],
    ["Built a lineup", lineupKeys.size],
    ["Shared it", sharedCount],
  ];
  const funnel = steps.map(([step, count], i) => {
    const prev = i ? steps[i - 1][1] : count;
    return {
      step,
      people: count,
      lost: i ? Math.max(0, prev - count) : 0,
      // Share of the step above that carried on, which is the number worth
      // reading; the raw drop alone says nothing about how bad it is.
      pct: i && prev ? Math.round((count / prev) * 100) : null,
    };
  });

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

  const mine = looks.filter((look) => showInternal || !rowIsInternal(look));
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

  const myChecks = checks.filter((check) => showInternal || !rowIsInternal(check));
  const activity = (myChecks.length ? myChecks : mine).slice(0, 80).map((row) =>
    row.product !== undefined
      ? {
          at: row.created_at,
          email: whose(row)?.email || row.email || "",
          title: row.product?.name || row.verdict?.title || "",
          brand: row.product?.brand || "",
          input: row.input_method || "",
          round: row.verdict?.round || "",
          score: row.verdict?.score == null ? null : Number(row.verdict.score),
          verdict: String(row.verdict?.title || "").slice(0, 90),
          in_lineup: row.decision === "save",
        }
      : {
          at: row.created_at,
          email: whose(row)?.email || row.email || "",
          title: row.title || "",
          brand: row.product?.brand || "",
          input: row.input_method || "",
          round: row.round_id || "",
          score: row.score == null ? null : Number(row.score),
          verdict: String(row.verdict?.title || "").slice(0, 90),
          in_lineup: Boolean(row.in_closet),
        }
  );

  // The same fault fifty times is one issue, not fifty rows. Group by what
  // broke, and treat a group as resolved only while nothing newer has happened
  // since it was ticked off.
  // Rows written before the key was scrubbed at the source still hold it, and
  // this page is where it would be read. Take it out on the way to the screen.
  const hideSecrets = (value) =>
    String(value || "").replace(/\b(key|token|secret|access_token)=[^&\s]+/gi, "$1=…");

  const groups = new Map();
  for (const raw of errors) {
    const e = { ...raw, message: hideSecrets(raw.message), path: hideSecrets(raw.path) };
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
    // Anyone the row can name. Before she gives an email that is her anon id,
    // and counting only emails made a fault look like it hit fewer people.
    if (e.email) g.people.add(e.email);
    else if (e.anon_id) g.people.add(`anon:${e.anon_id}`);
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
    // Opens can only count visits that were recorded. Anyone restored from the
    // sheet, or lost while scan-visit was dropping writes, has no visit row.
    opens_anonymous: strangers.size,
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
      looks_total: myChecks.length || mine.length,
      checks_missing: !Array.isArray(checksRes?.data),
      internal_hidden: showInternal ? 0 : internal.length,
    },
    by_campaign: byCampaign,
    left_from: leftFrom,
    left_by: leftBy,
    people: list.slice(0, 500),
  });
}
