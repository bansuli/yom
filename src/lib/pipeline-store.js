import { getAnonId } from "./analytics.js";
import { LINEUP_DAYS, guessDayForRound, pieceSlotFor } from "./contexts.js";
import { loadJoinEmail, loadJoinProfile } from "./join-store.js";
import { yomLineup } from "./yom-api.js";
import { thumbFrom } from "./image.js";

const LOOKS_KEY = "yom_pipeline_looks";
const LINEUP_KEY = "yom_pipeline_lineup";
const PUBLIC_KEY = "yom_pipeline_public";
const SYNC_KEY = "yom_pipeline_synced";

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `look_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function loadLooks() {
  const list = read(LOOKS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveLooks(looks) {
  write(LOOKS_KEY, Array.isArray(looks) ? looks.slice(0, 80) : []);
}

function asPieces(value) {
  if (!value) return [];
  if (typeof value === "string") return [{ lookId: value, slot: "look" }];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { lookId: item, slot: "look" };
      const lookId = String(item?.lookId || item?.id || "").trim();
      if (!lookId) return null;
      return { lookId, slot: String(item.slot || "look").trim() || "look" };
    })
    .filter(Boolean);
}

export function loadLineupMap() {
  const map = read(LINEUP_KEY, {});
  if (!map || typeof map !== "object") return {};
  const next = {};
  for (const [dayId, value] of Object.entries(map)) {
    next[dayId] = asPieces(value);
  }
  return next;
}

export function saveLineupMap(map) {
  write(LINEUP_KEY, map && typeof map === "object" ? map : {});
}

export function piecesForDay(dayId, map = loadLineupMap()) {
  return asPieces(map[dayId]);
}

export function lookInLineup(lookId, map = loadLineupMap()) {
  const id = String(lookId || "");
  if (!id) return false;
  return Object.values(map).some((pieces) => asPieces(pieces).some((piece) => piece.lookId === id));
}

export function defaultPublicState() {
  const profile = loadJoinProfile();
  const name = String(profile.name || "").trim();
  const parts = name.split(/\s+/);
  return {
    id: "",
    is_public: false,
    sisterhood: false,
    display_name: parts[0] || name || "",
    last_name: parts.slice(1).join(" "),
    show_last_name: true,
    show_ratings: true,
    updated_at: 0,
  };
}

export function loadPublicState() {
  const saved = read(PUBLIC_KEY, null);
  return { ...defaultPublicState(), ...(saved && typeof saved === "object" ? saved : {}) };
}

export function savePublicState(patch = {}) {
  const next = { ...loadPublicState(), ...patch, updated_at: Date.now() };
  write(PUBLIC_KEY, next);
  return next;
}

function compactPreview(src) {
  const s = String(src || "");
  if (!s.startsWith("data:image/")) return s.slice(0, 2000);
  return s.length <= 700_000 ? s : "";
}

export function lookFromScan({
  preview = "",
  sourceUrl = "",
  inputMethod = "photo",
  product = {},
  verdict = {},
  note = "",
} = {}) {
  const roundId = String(verdict.round || loadJoinProfile().round || "").trim();
  const day = guessDayForRound(roundId);
  const title =
    String(verdict.round_label || day?.label || product.name || product.guess || note || "new look")
      .trim()
      .toLowerCase();
  const scoreRaw = Number(verdict.score);
  return {
    id: newId(),
    title,
    preview: compactPreview(preview),
    sourceUrl: String(sourceUrl || "").slice(0, 500),
    inputMethod: String(inputMethod || "photo"),
    roundId: roundId || day?.round || "",
    dayId: day?.id || "",
    slot: pieceSlotFor({ product, title, note }),
    score: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(10, scoreRaw)) : null,
    product: {
      name: product.name || "",
      brand: product.brand || "",
      category: product.category || "",
      color: product.color || "",
      price: product.price ?? null,
    },
    verdict: {
      title: verdict.title || "",
      body: verdict.body || "",
      kind: verdict.kind || "",
      why: verdict.why_it_works || verdict.why || "",
      change: verdict.change || verdict.resolve || "",
      spotting: verdict.spotting || "",
      berkeley: verdict.berkeley || verdict.spotting || "",
    },
    inCloset: false,
    at: Date.now(),
  };
}

export function upsertLook(look) {
  if (!look?.id) return look;
  const prev = loadLooks().filter((item) => item.id !== look.id);
  saveLooks([look, ...prev]);
  return look;
}

export function getLook(id) {
  return loadLooks().find((item) => item.id === id) || null;
}

export function markLookInCloset(id, inCloset = true) {
  const looks = loadLooks().map((item) => (item.id === id ? { ...item, inCloset } : item));
  saveLooks(looks);
  return looks.find((item) => item.id === id) || null;
}

export function closetLooks() {
  return loadLooks().filter((item) => item.inCloset);
}

export function assignLookToDay(dayId, lookId, slot) {
  const day = LINEUP_DAYS.find((d) => d.id === dayId);
  if (!day) return loadLineupMap();
  const look = lookId ? getLook(lookId) : null;
  const slotId = slot || look?.slot || pieceSlotFor(look || {}) || "look";
  const map = { ...loadLineupMap() };
  const others = piecesForDay(day.id, map).filter((piece) => piece.lookId !== lookId);
  const kept = others.filter((piece) => piece.slot !== slotId);
  map[day.id] = lookId ? [...kept, { lookId, slot: slotId }] : kept;
  saveLineupMap(map);
  if (look) upsertLook({ ...look, dayId: day.id, roundId: look.roundId || day.round, slot: slotId });
  return map;
}

export function removePieceFromDay(dayId, lookId) {
  const map = { ...loadLineupMap() };
  map[dayId] = piecesForDay(dayId, map).filter((piece) => piece.lookId !== lookId);
  saveLineupMap(map);
  return map;
}

export function lineupSlots() {
  const looks = loadLooks();
  const map = loadLineupMap();
  return LINEUP_DAYS.map((day) => {
    const pieces = piecesForDay(day.id, map)
      .map((piece) => ({
        ...piece,
        look: looks.find((item) => item.id === piece.lookId) || null,
      }))
      .filter((piece) => piece.look);
    return { ...day, pieces, look: pieces[0]?.look || null, lookId: pieces[0]?.lookId || "" };
  });
}

export function addLookToLineup(look, dayId, slot) {
  const day = LINEUP_DAYS.find((d) => d.id === dayId) || guessDayForRound(dayId || look.dayId || look.roundId);
  if (!day || !look) return look;
  const slotId = slot || look.slot || pieceSlotFor(look);
  const saved = upsertLook({
    ...look,
    dayId: day.id,
    roundId: look.roundId || day.round,
    slot: slotId,
    inCloset: true,
  });
  assignLookToDay(day.id, saved.id, slotId);
  return saved;
}

/** api/lineup.js stores image_url up to this; anything longer arrives truncated. */
const UPLOAD_MAX = 180_000;
const THUMB_STEPS = [
  [720, 0.55],
  [520, 0.5],
  [360, 0.45],
];

function uploadPreview(look) {
  const preview = String(look.preview || "");
  if (!preview.startsWith("data:image/")) return preview;
  if (preview.length <= UPLOAD_MAX) return preview;
  const thumb = String(look.thumb || "");
  return thumb && thumb.length <= UPLOAD_MAX ? thumb : "";
}

/**
 * A scan preview is ~1400px at q0.82, which base64s past what the server keeps,
 * so it used to upload as "" and every other device saw a grey card. Render a
 * small copy for the looks that need one. Idempotent, so it doubles as a
 * backfill for looks saved before this existed.
 */
export async function ensureThumbs() {
  if (typeof window === "undefined") return { ok: false, made: 0 };
  const needs = loadLooks().filter((look) => {
    const preview = String(look.preview || "");
    return preview.startsWith("data:image/") && preview.length > UPLOAD_MAX && !look.thumb;
  });
  if (!needs.length) return { ok: true, made: 0 };

  const made = new Map();
  for (const look of needs) {
    // A busy photo still base64s big at 720px, so step down until one fits
    // rather than giving up and shipping a grey card.
    for (const [maxEdge, quality] of THUMB_STEPS) {
      const thumb = await thumbFrom(look.preview, maxEdge, quality);
      if (!thumb) break;
      if (thumb.length <= UPLOAD_MAX) {
        made.set(look.id, thumb);
        break;
      }
    }
  }
  if (!made.size) return { ok: true, made: 0 };

  // Re-read rather than reuse the list above: thumbs take a moment to render and
  // she may have saved or removed a look while they did.
  saveLooks(loadLooks().map((look) => (made.has(look.id) ? { ...look, thumb: made.get(look.id) } : look)));
  return { ok: true, made: made.size };
}

export function pipelinePayload() {
  return {
    anon_id: getAnonId(),
    email: loadJoinEmail() || loadJoinProfile().email || "",
    name: loadJoinProfile().name || "",
    looks: loadLooks().map((look) => ({ ...look, preview: uploadPreview(look) })),
    lineup: loadLineupMap(),
    public: loadPublicState(),
  };
}

/** Thumbnail first, then send — used everywhere the payload goes to the server. */
export async function syncPipeline() {
  await ensureThumbs();
  return yomLineup(pipelinePayload());
}

/**
 * Looks and lineups only reach the server when a pnm acts — adds a look, or
 * toggles sharing. A phone that built its lineup while the store was down
 * therefore holds looks the server has never seen, and a lineup she already
 * chose to make public stays invisible to everyone else. Push once per tab so
 * returning phones heal themselves. Publishing is unchanged: the board still
 * shows only lineups whose public toggle is on.
 */
export function syncPipelineOnce() {
  if (typeof window === "undefined") return { ok: false, skipped: true };
  try {
    if (sessionStorage.getItem(SYNC_KEY) === "1") return { ok: true, skipped: true };
  } catch {
    /* private mode — sync anyway, it is one call */
  }

  const looks = loadLooks();
  const pub = loadPublicState();
  if (!looks.length && !pub.is_public) return { ok: true, skipped: true };

  try {
    sessionStorage.setItem(SYNC_KEY, "1");
  } catch {
    /* ignore */
  }

  syncPipeline()
    .then((res) => {
      if (res?.ok && res.lineup_id && !pub.id) savePublicState({ id: res.lineup_id });
    })
    .catch(() => {
      /* offline or blocked — next tab tries again */
    });
  return { ok: true, count: looks.length };
}
