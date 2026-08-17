import { getAnonId, getSurface, loadAcquisition } from "./analytics.js";
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

/** Fire-and-forget email → leads + auto allowlist */
export async function captureLead({ email, name, channel, ...rest }) {
  if (!email) return { ok: false };
  return yomCaptureLead(leadPayload({ email, name, channel, ...rest }));
}

/** Record /scan visitor; optional email */
export async function recordScanVisit(extra = {}) {
  return yomScanVisit(leadPayload({ path: "/scan", channel: "scan", ...extra }));
}
