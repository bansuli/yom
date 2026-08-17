import { one, rest, sbAdmin } from "./supabase.js";
import { upsertLead } from "./leads.js";

function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function createShare(input = {}) {
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
  if (input.sender_user_id && /^[0-9a-f-]{36}$/i.test(String(input.sender_user_id))) {
    row.sender_user_id = input.sender_user_id;
  }

  const inserted = await sbAdmin(rest("shares"), { method: "POST", body: row });
  if (!inserted.ok) return { ok: false, error: "could not create share." };
  const share = one(inserted.data);
  if (!share?.id) return { ok: false, error: "could not create share." };

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

  return { ok: true, share };
}

export async function getShare(shareId, { recordOpen = false, openerAnonId } = {}) {
  const id = String(shareId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "bad share id." };

  const found = await sbAdmin(rest("shares", `id=eq.${id}&select=*`));
  const share = one(found.data);
  if (!share) return { ok: false, error: "share not found." };

  if (recordOpen) {
    await sbAdmin(rest("shares", `id=eq.${id}`), {
      method: "PATCH",
      body: { opens_count: (Number(share.opens_count) || 0) + 1 },
    });
    share.opens_count = (Number(share.opens_count) || 0) + 1;
  }

  const votes = await sbAdmin(
    rest("share_votes", `share_id=eq.${id}&select=vote,reason,created_at&order=created_at.desc&limit=40`)
  );
  const voteRows = Array.isArray(votes.data) ? votes.data : [];

  return {
    ok: true,
    share,
    votes: voteRows,
    opener_anon_id: openerAnonId || null,
  };
}

export async function voteOnShare(input = {}) {
  const share_id = String(input.share_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(share_id)) return { ok: false, error: "bad share id." };

  const vote = String(input.vote || "").toLowerCase();
  if (!["buy", "skip", "save", "yes", "no"].includes(vote)) {
    return { ok: false, error: "vote must be buy, skip, or save." };
  }

  const normalized = vote === "yes" ? "buy" : vote === "no" ? "skip" : vote;
  const row = {
    share_id,
    vote: normalized,
    reason: input.reason ? String(input.reason).slice(0, 280) : null,
    voter_anon_id: input.voter_anon_id ? String(input.voter_anon_id).slice(0, 80) : null,
  };
  const email = cleanEmail(input.voter_email);
  if (isEmail(email)) row.voter_email = email;

  const inserted = await sbAdmin(rest("share_votes"), { method: "POST", body: row });
  if (!inserted.ok) return { ok: false, error: "could not save vote." };

  const shareRes = await sbAdmin(rest("shares", `id=eq.${share_id}&select=votes_count,sender_user_id,sender_email,campaign,source`));
  const share = one(shareRes.data);
  if (share?.id || share_id) {
    await sbAdmin(rest("shares", `id=eq.${share_id}`), {
      method: "PATCH",
      body: { votes_count: (Number(share?.votes_count) || 0) + 1 },
    });
  }

  if (isEmail(email)) {
    await upsertLead({
      email,
      anon_id: row.voter_anon_id,
      channel: "share_vote",
      path: `/s/${share_id}`,
      source: share?.source,
      campaign: share?.campaign,
      referrer_user_id: share?.sender_user_id || undefined,
      metadata: { share_id, vote: normalized },
    });
  }

  return { ok: true, vote: one(inserted.data) || row, referrer_user_id: share?.sender_user_id || null };
}

export async function saveScanCheck(input = {}) {
  const row = {
    anon_id: input.anon_id ? String(input.anon_id).slice(0, 80) : null,
    email: isEmail(cleanEmail(input.email)) ? cleanEmail(input.email) : null,
    product: input.product && typeof input.product === "object" ? input.product : {},
    verdict: input.verdict && typeof input.verdict === "object" ? input.verdict : {},
    decision: input.decision ? String(input.decision).slice(0, 40) : null,
    input_method: input.input_method ? String(input.input_method).slice(0, 40) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    source: input.source ? String(input.source).slice(0, 80) : null,
    surface: input.surface ? String(input.surface).slice(0, 32) : null,
  };
  if (input.user_id && /^[0-9a-f-]{36}$/i.test(String(input.user_id))) row.user_id = input.user_id;
  if (input.share_id && /^[0-9a-f-]{36}$/i.test(String(input.share_id))) row.share_id = input.share_id;

  const inserted = await sbAdmin(rest("scan_checks"), { method: "POST", body: row });
  if (!inserted.ok) return { ok: false, error: "could not save check." };
  return { ok: true, check: one(inserted.data) };
}
