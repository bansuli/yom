import { json, preflight, readJson } from "../lib/http.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

function asText(v, max = 180) {
  return String(v || "").trim().slice(0, max);
}

function publicView(row, looks = []) {
  if (!row) return null;
  const name = row.display_name || "a pnm";
  const days = row.days && typeof row.days === "object" ? row.days : {};
  const showRatings = row.show_ratings !== false;
  const picks = looks
    .filter((look) => look.in_closet && (look.score == null || Number(look.score) >= 7))
    .slice(0, 8)
    .map((look) => ({
      id: look.id,
      title: look.title,
      day_id: look.day_id,
      round_id: look.round_id,
      score: showRatings ? look.score : null,
      image_url: look.image_url || "",
    }));
  return {
    id: row.id,
    name: asText(name, 80).toLowerCase(),
    sisterhood: Boolean(row.sisterhood),
    is_public: Boolean(row.is_public),
    days,
    picks,
  };
}

function clientLook(row) {
  return {
    id: row.id,
    title: row.title || "",
    preview: row.image_url || "",
    sourceUrl: row.source_url || "",
    inputMethod: row.input_method || "photo",
    roundId: row.round_id || "",
    dayId: row.day_id || "",
    score: row.score == null ? null : Number(row.score),
    product: row.product || {},
    verdict: row.verdict || {},
    inCloset: Boolean(row.in_closet),
  };
}

function parseQuery(req) {
  const q = req.query || {};
  let urlQ = {};
  try {
    urlQ = Object.fromEntries(new URL(req.url, "http://localhost").searchParams.entries());
  } catch {
    /* ignore */
  }
  return { ...urlQ, ...q };
}

function inFilter(values) {
  return values
    .map((value) => `"${String(value).replace(/"/g, "")}"`)
    .join(",");
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseConfigured()) {
    json(res, 200, { ok: true, fallback: true, looks: [] });
    return;
  }

  if (req.method === "GET") {
    const q = parseQuery(req);
    if (String(q.feed || "") === "1") {
      const pubs = await sbAdmin(rest("lineups", "is_public=eq.true&select=*&order=updated_at.desc&limit=40"));
      const rows = Array.isArray(pubs.data) ? pubs.data : [];
      const emails = [...new Set(rows.map((row) => row.email).filter(Boolean))];
      const anons = [...new Set(rows.map((row) => row.anon_id).filter(Boolean))];
      const clauses = [];
      if (emails.length) clauses.push(`email.in.(${inFilter(emails)})`);
      if (anons.length) clauses.push(`anon_id.in.(${inFilter(anons)})`);
      let looks = [];
      if (clauses.length) {
        const found = await sbAdmin(
          rest("pipeline_looks", `in_closet=eq.true&or=(${clauses.join(",")})&order=created_at.desc&limit=120`)
        );
        // Only looks a pnm put in her lineup are public. The query filters them;
        // this guards the board if that filter ever stops being applied.
        looks = (Array.isArray(found.data) ? found.data : []).filter((look) => look.in_closet);
      }
      const byEmail = new Map(rows.filter((row) => row.email).map((row) => [row.email, row]));
      const byAnon = new Map(rows.filter((row) => row.anon_id).map((row) => [row.anon_id, row]));
      json(res, 200, {
        ok: true,
        looks: looks
          .map((look) => {
            const row = byEmail.get(look.email) || byAnon.get(look.anon_id);
            if (!row) return null;
            return {
              id: look.id,
              name: asText(row.display_name, 40).toLowerCase() || "a pnm",
              title: look.title,
              day_id: look.day_id,
              round_id: look.round_id,
              score: row.show_ratings === false ? null : look.score,
              image_url: look.image_url || "",
            };
          })
          .filter(Boolean),
      });
      return;
    }
    if (String(q.mine || "") === "1") {
      const key = asText(q.key || "", 80);
      if (!key) {
        json(res, 400, { ok: false, error: "need an account key." });
        return;
      }
      const enc = encodeURIComponent(key);
      const [looksRes, lineRes] = await Promise.all([
        sbAdmin(rest("pipeline_looks", `account_key=eq.${enc}&order=created_at.desc&limit=120`)),
        sbAdmin(rest("lineups", `account_key=eq.${enc}&select=*&limit=1`)),
      ]);
      const row = Array.isArray(lineRes.data) ? lineRes.data[0] : null;
      json(res, 200, {
        ok: true,
        looks: (Array.isArray(looksRes.data) ? looksRes.data : []).map(clientLook),
        // Who the account belongs to. Holding the key already means holding the
        // account, and without this a transfer link lands on a device that has
        // her looks but no idea who she is — so it asks her to sign up again.
        account: { email: row?.email || "", name: row?.display_name || "" },
        lineup: row?.days && typeof row.days === "object" ? row.days : {},
        public: row
          ? {
              id: row.id,
              is_public: Boolean(row.is_public),
              sisterhood: Boolean(row.sisterhood),
              display_name: row.display_name || "",
              last_name: row.last_name || "",
              show_last_name: row.show_last_name !== false,
              show_ratings: row.show_ratings !== false,
            }
          : null,
      });
      return;
    }

    const id = asText(q.id || "", 36);
    if (!id) {
      json(res, 400, { ok: false, error: "need a lineup id." });
      return;
    }
    const found = await sbAdmin(rest("lineups", `id=eq.${encodeURIComponent(id)}&select=*`));
    const row = Array.isArray(found.data) ? found.data[0] : found.data;
    if (!found.ok || !row || !row.is_public) {
      json(res, 404, { ok: false, error: "this lineup isn’t public." });
      return;
    }
    const looks = await sbAdmin(
      rest("pipeline_looks", `email=eq.${encodeURIComponent(row.email || "")}&in_closet=eq.true&order=created_at.desc`)
    );
    json(res, 200, { ok: true, lineup: publicView(row, Array.isArray(looks.data) ? looks.data : []) });
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "GET or POST" });
    return;
  }

  const body = readJson(req);
  const email = asText(body.email, 180).toLowerCase();
  const anonId = asText(body.anon_id, 80);
  const accountKey = asText(body.account_key, 80);
  if (!email && !anonId) {
    json(res, 400, { ok: false, error: "need an email or anon id." });
    return;
  }

  // Deleting her last look leaves nothing to reconcile against, so she tells us
  // outright what is gone.
  const deletedIds = (Array.isArray(body.deleted_ids) ? body.deleted_ids : [])
    .filter((id) => /^[0-9a-f-]{36}$/i.test(String(id)))
    .slice(0, 200);
  if (accountKey && deletedIds.length) {
    await sbAdmin(
      rest(
        "pipeline_looks",
        `account_key=eq.${encodeURIComponent(accountKey)}&id=in.(${deletedIds.join(",")})`
      ),
      { method: "DELETE" }
    );
  }

  const looks = Array.isArray(body.looks) ? body.looks.slice(0, 40) : [];
  if (looks.length) {
    const rows = looks.map((look) => ({
      id: look.id && /^[0-9a-f-]{36}$/i.test(look.id) ? look.id : undefined,
      account_key: accountKey || null,
      anon_id: anonId || null,
      email: email || null,
      title: asText(look.title, 120),
      image_url: String(look.preview || "").startsWith("http")
        ? asText(look.preview, 2000)
        : asText(look.preview, 180000),
      source_url: asText(look.sourceUrl, 500),
      input_method: asText(look.inputMethod, 40),
      round_id: asText(look.roundId, 40),
      day_id: asText(look.dayId, 40),
      score: look.score == null || look.score === "" ? null : Number(look.score),
      product: look.product || {},
      verdict: look.verdict || {},
      in_closet: Boolean(look.inCloset),
    }));
    await sbAdmin(rest("pipeline_looks?on_conflict=id"), {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    });

    // Removing a look has to mean removing it. The payload is this account's
    // whole store, so anything of hers the client no longer has is gone. Only
    // when she sent looks — a device with an empty store is a device that has
    // not loaded yet, not a lineup she emptied.
    const keep = rows.map((row) => row.id).filter(Boolean);
    if (accountKey && keep.length === rows.length) {
      await sbAdmin(
        rest(
          "pipeline_looks",
          `account_key=eq.${encodeURIComponent(accountKey)}&id=not.in.(${keep.join(",")})`
        ),
        { method: "DELETE" }
      );
    }
  }

  const pub = body.public || {};
  const byKey = accountKey
    ? await sbAdmin(rest("lineups", `account_key=eq.${encodeURIComponent(accountKey)}&select=*&limit=1`))
    : null;
  let current = Array.isArray(byKey?.data) ? byKey.data[0] : null;
  if (!current) {
    // Rows written before accounts existed are matched the old way, then stamped
    // with the key so this device owns them from here on.
    const existingQ = email
      ? `email=eq.${encodeURIComponent(email)}`
      : `anon_id=eq.${encodeURIComponent(anonId)}`;
    const existing = await sbAdmin(rest("lineups", `${existingQ}&select=*&limit=1`));
    current = Array.isArray(existing.data) ? existing.data[0] : null;
  }
  const payload = {
    account_key: accountKey || current?.account_key || null,
    anon_id: anonId || current?.anon_id || null,
    email: email || current?.email || null,
    display_name: asText(pub.display_name || body.name, 80) || current?.display_name || null,
    last_name: asText(pub.last_name, 80),
    show_last_name: pub.show_last_name !== false,
    show_ratings: pub.show_ratings !== false,
    is_public: Boolean(pub.is_public),
    sisterhood: Boolean(pub.sisterhood || pub.is_public),
    days:
      body.lineup && typeof body.lineup === "object" && Object.keys(body.lineup).length
        ? body.lineup
        : current?.days || {},
    updated_at: new Date().toISOString(),
  };

  let row = current;
  if (current?.id) {
    const updated = await sbAdmin(rest("lineups", `id=eq.${current.id}`), { method: "PATCH", body: payload });
    row = Array.isArray(updated.data) ? updated.data[0] : updated.data || current;
  } else {
    const inserted = await sbAdmin(rest("lineups"), { method: "POST", body: payload });
    row = Array.isArray(inserted.data) ? inserted.data[0] : inserted.data;
  }

  json(res, 200, { ok: true, lineup_id: row?.id || null, lineup: publicView(row, looks) });
}
