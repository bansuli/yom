import { upsertLead, storeConfigured } from "./leads.js";
import {
  sheetAppendScanCheck,
  sheetAppendShare,
  sheetAppendVote,
  sheetConfigured,
  sheetGetShare,
} from "./sheet-store.js";
import { one, rest, sbAdmin, supabaseConfigured } from "./supabase.js";

function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function newShareId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createShare(input = {}) {
  if (!storeConfigured()) return { ok: false, error: "user store is not configured" };

  const product = input.product && typeof input.product === "object" ? input.product : {};
  const verdict = input.verdict && typeof input.verdict === "object" ? input.verdict : {};
  const row = {
    sender_anon_id: input.sender_anon_id ? String(input.sender_anon_id).slice(0, 80) : null,
    sender_email: isEmail(cleanEmail(input.sender_email)) ? cleanEmail(input.sender_email) : null,
    product,
    verdict,
    decision: input.decision ? String(input.decision).slice(0, 40) : null,
    preview_note: input.preview_note ? String(input.preview_note).slice(0, 240) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    source: input.source ? String(input.source).slice(0, 80) : null,
  };
  if (input.id && /^[0-9a-f-]{36}$/i.test(String(input.id))) {
    row.id = String(input.id);
  }
  if (input.sender_user_id && /^[0-9a-f-]{36}$/i.test(String(input.sender_user_id))) {
    row.sender_user_id = input.sender_user_id;
  }

  let share = null;

  if (supabaseConfigured()) {
    const inserted = await sbAdmin(rest("shares"), { method: "POST", body: row });
    if (inserted.ok) share = one(inserted.data);
  }

  if (!share?.id) {
    const share_id = row.id || newShareId();
    share = { id: share_id, ...row, opens_count: 0, votes_count: 0 };
    if (sheetConfigured()) {
      const imageData =
        typeof input.image === "string" && input.image.startsWith("data:image/")
          ? input.image.length <= 1_800_000
            ? input.image
            : ""
          : "";
      const sheet = await sheetAppendShare({
        at: new Date().toISOString(),
        share_id,
        sender_email: row.sender_email,
        sender_anon_id: row.sender_anon_id,
        sender_user_id: row.sender_user_id || "",
        decision: row.decision,
        campaign: row.campaign,
        source: row.source,
        image_data: imageData || undefined,
        product_json: JSON.stringify(product),
        verdict_json: JSON.stringify(verdict),
        opens_count: 0,
        votes_count: 0,
      });
      if (!sheet.ok && !supabaseConfigured()) {
        return { ok: false, error: "could not create share." };
      }
    } else if (!supabaseConfigured()) {
      return { ok: false, error: "could not create share." };
    }
  } else if (sheetConfigured()) {
    const imageData =
      typeof input.image === "string" && input.image.startsWith("data:image/")
        ? input.image.length <= 1_800_000
          ? input.image
          : ""
        : "";
    await sheetAppendShare({
      at: new Date().toISOString(),
      share_id: share.id,
      sender_email: row.sender_email,
      sender_anon_id: row.sender_anon_id,
      sender_user_id: row.sender_user_id || "",
      decision: row.decision,
      campaign: row.campaign,
      source: row.source,
      image_data: imageData || undefined,
      product_json: JSON.stringify(product),
      verdict_json: JSON.stringify(verdict),
      opens_count: 0,
      votes_count: 0,
    });
  }

  if (row.sender_email) {
    await upsertLead({
      email: row.sender_email,
      anon_id: row.sender_anon_id,
      channel: "share_sender",
      path: "/scan",
      source: row.source,
      campaign: row.campaign,
    });
  }

  // Prefer Drive URL from sheet response if present; else keep client thumb for creator preview
  if (typeof input.image === "string" && input.image.startsWith("data:image/")) {
    share.image_url = share.image_url || null;
    share.image_data = input.image;
  }

  return { ok: true, share };
}

export async function getShare(shareId, { recordOpen = false, openerAnonId } = {}) {
  const id = String(shareId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "bad share id." };

  if (supabaseConfigured()) {
    const found = await sbAdmin(rest("shares", `id=eq.${id}&select=*`));
    const share = one(found.data);
    if (share) {
      if (recordOpen) {
        await sbAdmin(rest("shares", `id=eq.${id}`), {
          method: "PATCH",
          body: { opens_count: (Number(share.opens_count) || 0) + 1 },
        });
        share.opens_count = (Number(share.opens_count) || 0) + 1;
      }
      const votes = await sbAdmin(
        rest(
          "share_votes",
          `share_id=eq.${id}&select=vote,reason,voter_name,voter_email,created_at&order=created_at.desc&limit=40`
        )
      );
      return {
        ok: true,
        share,
        votes: Array.isArray(votes.data) ? votes.data : [],
        opener_anon_id: openerAnonId || null,
      };
    }
  }

  if (sheetConfigured()) {
    const sheet = await sheetGetShare(id);
    if (sheet.ok && sheet.data?.share) {
      const row = sheet.data.share;
      return {
        ok: true,
        share: {
          id: row.share_id || id,
          sender_email: row.sender_email,
          sender_anon_id: row.sender_anon_id,
          sender_user_id: row.sender_user_id || null,
          product: row.product || {},
          verdict: row.verdict || {},
          decision: row.decision,
          preview_note: row.preview_note || null,
          campaign: row.campaign,
          source: row.source,
          image_url: row.image_url || null,
          opens_count: row.opens_count,
          votes_count: row.votes_count,
        },
        votes: sheet.data.votes || [],
        opener_anon_id: openerAnonId || null,
      };
    }
  }

  return { ok: false, error: "share not found." };
}

export async function voteOnShare(input = {}) {
  if (!storeConfigured()) return { ok: false, error: "user store is not configured" };

  const share_id = String(input.share_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(share_id)) return { ok: false, error: "bad share id." };

  const vote = String(input.vote || "").toLowerCase();
  if (!["buy", "skip", "save", "yes", "no"].includes(vote)) {
    return { ok: false, error: "vote must be buy, skip, or save." };
  }

  const normalized = vote === "yes" ? "buy" : vote === "no" ? "skip" : vote;
  const voter_name = String(input.voter_name || "")
    .trim()
    .slice(0, 80);
  if (!voter_name) {
    return { ok: false, error: "need your name." };
  }
  const row = {
    share_id,
    vote: normalized,
    voter_name,
    reason: input.reason ? String(input.reason).slice(0, 280) : null,
    voter_anon_id: input.voter_anon_id ? String(input.voter_anon_id).slice(0, 80) : null,
  };
  const email = cleanEmail(input.voter_email);
  if (isEmail(email)) row.voter_email = email;

  let saved = row;
  let referrer_user_id = null;
  let source = null;
  let campaign = null;

  if (supabaseConfigured()) {
    const inserted = await sbAdmin(rest("share_votes"), { method: "POST", body: row });
    if (inserted.ok) saved = one(inserted.data) || row;
    const shareRes = await sbAdmin(
      rest("shares", `id=eq.${share_id}&select=votes_count,sender_user_id,sender_email,campaign,source`)
    );
    const share = one(shareRes.data);
    referrer_user_id = share?.sender_user_id || null;
    source = share?.source;
    campaign = share?.campaign;
    if (share_id) {
      await sbAdmin(rest("shares", `id=eq.${share_id}`), {
        method: "PATCH",
        body: { votes_count: (Number(share?.votes_count) || 0) + 1 },
      });
    }
  }

  if (sheetConfigured()) {
    await sheetAppendVote({
      at: new Date().toISOString(),
      share_id,
      vote: normalized,
      reason: row.reason,
      voter_name: row.voter_name,
      voter_email: row.voter_email || "",
      voter_anon_id: row.voter_anon_id || "",
    });
  }

  if (isEmail(email)) {
    await upsertLead({
      email,
      anon_id: row.voter_anon_id,
      channel: "share_vote",
      path: `/s/${share_id}`,
      source,
      campaign,
      referrer_user_id: referrer_user_id || undefined,
      metadata: { share_id, vote: normalized, voter_name },
    });
  }

  return { ok: true, vote: saved, referrer_user_id };
}

export async function saveScanCheck(input = {}) {
  if (!storeConfigured()) return { ok: false, error: "user store is not configured" };

  const product = input.product && typeof input.product === "object" ? input.product : {};
  const verdict = input.verdict && typeof input.verdict === "object" ? input.verdict : {};
  const row = {
    anon_id: input.anon_id ? String(input.anon_id).slice(0, 80) : null,
    email: isEmail(cleanEmail(input.email)) ? cleanEmail(input.email) : null,
    product,
    verdict,
    decision: input.decision ? String(input.decision).slice(0, 40) : null,
    input_method: input.input_method ? String(input.input_method).slice(0, 40) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    source: input.source ? String(input.source).slice(0, 80) : null,
    surface: input.surface ? String(input.surface).slice(0, 32) : null,
  };
  if (input.user_id && /^[0-9a-f-]{36}$/i.test(String(input.user_id))) row.user_id = input.user_id;
  if (input.share_id && /^[0-9a-f-]{36}$/i.test(String(input.share_id))) row.share_id = input.share_id;

  let check = null;
  if (supabaseConfigured()) {
    const inserted = await sbAdmin(rest("scan_checks"), { method: "POST", body: row });
    if (inserted.ok) check = one(inserted.data);
  }

  if (sheetConfigured()) {
    const imageData =
      typeof input.image === "string" && input.image.startsWith("data:image/")
        ? input.image.length <= 1_800_000
          ? input.image
          : ""
        : "";
    await sheetAppendScanCheck({
      at: new Date().toISOString(),
      anon_id: row.anon_id,
      email: row.email,
      product_name: product.name || "",
      brand: product.brand || "",
      price: product.price ?? "",
      decision: row.decision || "",
      input_method: row.input_method || "",
      verdict_title: verdict.title || "",
      campaign: row.campaign || "",
      source: row.source || "",
      surface: row.surface || "",
      image_data: imageData || undefined,
      product_json: JSON.stringify(product),
      verdict_json: JSON.stringify(verdict),
    });
  }

  if (!check && !sheetConfigured() && !supabaseConfigured()) {
    return { ok: false, error: "could not save check." };
  }

  return { ok: true, check: check || row };
}
