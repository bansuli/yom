import { loadJoinProfile, markYomReady, saveJoinEmail, saveJoinProfile } from "./join-store.js";
import {
  loadBetaSession,
  saveBetaSession,
  yomGoogleClaim,
  yomGoogleEvents,
  yomGoogleStart,
  yomGoogleStatus,
} from "./yom-api.js";
import { BERKELEY_FPR_CONTEXT_ID } from "./contexts.js";

export function formatEventWhen(value) {
  if (!value) return "";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return String(value);
  const d = new Date(t);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: d.getHours() || d.getMinutes() ? "numeric" : undefined,
    minute: d.getHours() || d.getMinutes() ? "2-digit" : undefined,
  });
}

export async function claimGoogleGrant(grant) {
  if (!grant) return null;
  const res = await yomGoogleClaim(grant);
  if (!res.ok || !res.access_token) return null;
  const stored = loadBetaSession() || {};
  saveBetaSession({
    ...stored,
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    user: res.user,
    profile: res.profile,
  });
  const email = String(res.profile?.email || res.user?.email || "").trim().toLowerCase();
  const name = String(res.profile?.name || res.user?.user_metadata?.name || "").trim();
  if (email) {
    const prev = loadJoinProfile();
    saveJoinEmail(email);
    saveJoinProfile({
      ...prev,
      email,
      name: name || prev.name || email.split("@")[0],
      context: prev.context || BERKELEY_FPR_CONTEXT_ID,
    });
    markYomReady();
  }
  return res;
}

export async function startGoogleConnect(returnTo = "/looks", intent = "") {
  const session = loadBetaSession();
  const res = await yomGoogleStart(session?.access_token, returnTo, intent);
  if (!res.ok || !res.url) {
    const raw = String(res.error || "");
    const error = /user store/i.test(raw)
      ? "google calendar + gmail need supabase env on the server (SUPABASE_URL + keys). that is not a login wall."
      : raw || "couldn’t start google connect.";
    return { ok: false, error };
  }
  window.location.href = res.url;
  return { ok: true };
}

export async function loadGoogleState(token = loadBetaSession()?.access_token) {
  const status = await yomGoogleStatus(token);
  if (status.fallback && !token) {
    return { connected: false, ready: status.googleOAuthReady !== false, events: [], gmail: [] };
  }
  if (status.fallback) return { connected: false, ready: false, events: [], gmail: [] };
  const connected = Boolean(status.connected);
  const events = connected && token ? await yomGoogleEvents(token) : { events: [], gmail: [] };
  return {
    connected,
    ready: status.googleOAuthReady !== false && status.storeReady !== false,
    email: status.email,
    calendar_synced_at: status.calendar_synced_at,
    gmail_synced_at: status.gmail_synced_at,
    events: events.events || [],
    gmail: events.gmail || [],
  };
}

export function occasionLabel(join = loadJoinProfile()) {
  return String(join.occasion || join.contextOther || "").trim();
}
