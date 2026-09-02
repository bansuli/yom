import { one, rest, sbAdmin, supabaseConfigured } from "./supabase.js";

const DEFAULT_TTL_DAYS = Math.max(1, Number(process.env.TIKTOK_CACHE_DAYS) || 7);

function ttlMs() {
  return DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Load cached TikTok evidence.
 * - undefined → cache miss (run research)
 * - null → negative cache (researched, nothing verified; skip until expiry)
 * - object → verified evidence payload
 */
export async function loadTikTokEvidence(fingerprint) {
  if (!fingerprint || !supabaseConfigured()) return undefined;
  const res = await sbAdmin(
    rest("product_tiktok_evidence", `fingerprint=eq.${encodeURIComponent(fingerprint)}&select=*`)
  );
  if (!res.ok) return undefined;
  const row = one(res.data);
  if (!row?.fingerprint) return undefined;
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) return undefined;
  if (!row.evidence) return null;
  return row.evidence;
}

export async function saveTikTokEvidence({
  fingerprint,
  product = {},
  sourceUrl = "",
  evidence = null,
  queries = [],
} = {}) {
  if (!fingerprint || !supabaseConfigured()) return false;
  const expires_at = new Date(Date.now() + ttlMs()).toISOString();
  const row = {
    fingerprint,
    brand: product.brand || null,
    name: product.name || product.guess || null,
    color: product.color || null,
    source_url: sourceUrl || null,
    image_url: product.image || null,
    evidence,
    video_count: Number(evidence?.video_count) || 0,
    consensus: evidence?.consensus || null,
    fit: evidence?.fit || null,
    queries_used: (queries.length ? queries : evidence?.queries_used || []).slice(0, 12),
    researched_at: new Date().toISOString(),
    expires_at,
  };
  const res = await sbAdmin(rest("product_tiktok_evidence", "on_conflict=fingerprint"), {
    method: "POST",
    body: row,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return res.ok;
}
