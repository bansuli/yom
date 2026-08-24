import { getAnonId, getSurface, loadAcquisition } from "./analytics.js";
import { queueLead } from "./lead-queue.js";
import { yomCaptureLead, yomScanVisit } from "./yom-api.js";

export function leadPayload(extra = {}) {
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
  };
}

/** Capture email → sheet. On failure, keep it in the on-device retry queue. */
export async function captureLead({ email, name, channel, ...rest }) {
  if (!email) return { ok: false };
  const payload = leadPayload({ email, name, channel, ...rest });
  const res = await yomCaptureLead(payload);
  if (res?.ok) return res;
  // Never drop an email because the network blipped — join/scan already queue;
  // waitlist + survey used to fire-and-forget.
  queueLead(payload);
  return { ok: false, queued: true, error: res?.error || "queued for retry" };
}

/** Record /scan visitor; optional email */
export async function recordScanVisit(extra = {}) {
  const payload = leadPayload({ path: "/scan", channel: "scan", ...extra });
  // This fires as the page loads, when a phone is most likely to be between
  // networks — walking into a building is enough to lose it. Try again before
  // giving up, and only call it a fault if the second one dies too.
  const first = await yomScanVisit(payload, { quiet: true });
  if (!first?.fallback) return first;
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return yomScanVisit(payload);
}
