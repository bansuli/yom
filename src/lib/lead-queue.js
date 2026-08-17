import { getAnonId, getSurface, loadAcquisition } from "./analytics.js";
import { loadJoinEmail, loadJoinProfile } from "./join-store.js";
import { yomCaptureLead } from "./yom-api.js";

const QUEUE_KEY = "yom_lead_queue";
const SYNCED_KEY = "yom_leads_synced";
const HOUR_MS = 60 * 60 * 1000;
const DEBOUNCE_MS = 2500;
const RETRY_MS = [4000, 12000, 30000, 60000];

let started = false;
let flushing = false;
let debounceTimer = 0;
let retryTimer = 0;
let retryAttempt = 0;
let memoryQueue = [];

function loadSynced() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((e) => String(e).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

function saveSynced(set) {
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* quota */
  }
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) {
      memoryQueue = parsed;
      return parsed;
    }
  } catch {
    /* use memory */
  }
  return memoryQueue;
}

function save(items) {
  memoryQueue = Array.isArray(items) ? items : [];
  try {
    if (!memoryQueue.length) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue));
  } catch {
    /* memory still holds it for this session; join email rehydrates later */
  }
}

function payloadFrom(extra = {}) {
  const acq = loadAcquisition();
  return {
    anon_id: getAnonId(),
    surface: getSurface(),
    source: acq.source,
    campaign: acq.campaign,
    utm_source: acq.utm_source || undefined,
    utm_medium: acq.utm_medium || undefined,
    utm_campaign: acq.utm_campaign || undefined,
    referrer_user_id: acq.referrer_user_id || undefined,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...extra,
    email: String(extra.email || "").trim().toLowerCase(),
    queued_at: extra.queued_at || Date.now(),
  };
}

function unmarkSynced(email) {
  const synced = loadSynced();
  synced.delete(email);
  saveSynced(synced);
}

function markSynced(emails) {
  const synced = loadSynced();
  emails.forEach((email) => synced.add(String(email).toLowerCase()));
  saveSynced(synced);
}

function scheduleRetry() {
  if (retryTimer || typeof window === "undefined") return;
  const wait = RETRY_MS[Math.min(retryAttempt, RETRY_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = 0;
    void flushLeadQueue();
  }, wait);
}

function scheduleDebouncedFlush() {
  if (typeof window === "undefined") return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = 0;
    void flushLeadQueue();
  }, DEBOUNCE_MS);
}

/** Pull join email/profile back into the queue if it never got an ok from the server. */
function rehydrateFromJoin() {
  const email = String(loadJoinEmail() || "").trim().toLowerCase();
  if (!email || loadSynced().has(email)) return;
  if (load().some((row) => String(row.email).toLowerCase() === email)) return;
  const profile = loadJoinProfile();
  const trait = profile.trait || "";
  save([
    ...load(),
    payloadFrom({
      email,
      name: profile.name || undefined,
      channel: trait ? "join_create" : "join",
      path: "/join",
      metadata: trait ? { trait, recovered: true } : { recovered: true },
    }),
  ]);
}

/** Save email on-device. No network on the tap. */
export function queueLead(extra = {}) {
  if (!extra?.email) return;
  const payload = payloadFrom(extra);
  unmarkSynced(payload.email);
  const next = load().filter((row) => String(row.email).toLowerCase() !== payload.email);
  next.push(payload);
  save(next);
  startLeadFlush();
  scheduleDebouncedFlush();
}

export function startLeadFlush() {
  if (started || typeof window === "undefined") return;
  started = true;
  rehydrateFromJoin();
  window.addEventListener("pagehide", () => {
    void flushLeadQueue({ unload: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushLeadQueue({ unload: true });
    else void flushLeadQueue();
  });
  window.addEventListener("online", () => {
    retryAttempt = 0;
    void flushLeadQueue();
  });
  void flushLeadQueue();
  window.setInterval(() => {
    rehydrateFromJoin();
    void flushLeadQueue();
  }, HOUR_MS);
}

/**
 * Send queued emails as one POST.
 * Queue is only cleared after the server returns ok — never on beacon alone.
 */
export async function flushLeadQueue({ unload = false } = {}) {
  rehydrateFromJoin();
  const items = load();
  if (!items.length) return { ok: true, empty: true };
  if (flushing && !unload) return { ok: true, busy: true };

  const body = JSON.stringify({ leads: items });

  if (unload && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      navigator.sendBeacon("/api/leads", new Blob([body], { type: "application/json" }));
    } catch {
      /* still try fetch keepalive below */
    }
  }

  flushing = true;
  try {
    const res = await yomCaptureLead({ leads: items });
    if (res?.ok) {
      const flushed = new Set(items.map((row) => String(row.email).toLowerCase()));
      markSynced(flushed);
      save(load().filter((row) => !flushed.has(String(row.email).toLowerCase())));
      retryAttempt = 0;
      return res;
    }
    scheduleRetry();
    return res;
  } catch {
    scheduleRetry();
    return { ok: false };
  } finally {
    flushing = false;
  }
}
