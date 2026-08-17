import { json, preflight, readJson } from "../lib/http.js";
import { createShare, getShare, saveScanCheck, voteOnShare } from "../lib/shares.js";
import { supabaseConfigured } from "../lib/supabase.js";

/**
 * /api/share
 * GET  ?id= → fetch share (+ record open)
 * POST { action: "create"|"vote"|"save_check", ... }
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured" });
    return;
  }

  if (req.method === "GET") {
    const id = req.query?.id;
    const opener = req.query?.anon_id;
    const result = await getShare(id, { recordOpen: true, openerAnonId: opener });
    if (!result.ok) {
      json(res, 404, result);
      return;
    }
    json(res, 200, result);
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "GET or POST only" });
    return;
  }

  const body = readJson(req);
  if (body.website || body.company) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const action = String(body.action || "create");

  if (action === "create") {
    const result = await createShare(body);
    if (!result.ok) {
      json(res, 400, result);
      return;
    }
    json(res, 200, {
      ok: true,
      share_id: result.share.id,
      share: result.share,
      url: `/s/${result.share.id}`,
    });
    return;
  }

  if (action === "vote") {
    const result = await voteOnShare(body);
    if (!result.ok) {
      json(res, 400, result);
      return;
    }
    json(res, 200, result);
    return;
  }

  if (action === "save_check") {
    const result = await saveScanCheck(body);
    if (!result.ok) {
      json(res, 400, result);
      return;
    }
    json(res, 200, result);
    return;
  }

  json(res, 400, { ok: false, error: "unknown action" });
}
