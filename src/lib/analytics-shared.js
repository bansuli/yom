/**
 * Shared Cohort 1 acquisition defaults + property helpers.
 * Used by web (Vite) and mirrored conceptually in the extension.
 */

export const ONBOARDING_VERSION = "cohort1_survey_v1";

export const COHORT1_DEFAULTS = {
  source: "reformation_sample_sale",
  campaign: "reformation_monday",
  activation_date: "2026-08-17",
};

export const ANON_KEY = "yom_anon_id";
export const ACQUISITION_KEY = "yom_acquisition";

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `yom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseAcquisitionFromSearch(search = "") {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const utm_source = params.get("utm_source") || "";
  const utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const ref = params.get("ref") || params.get("referrer_user_id") || "";
  const qr = params.get("qr") === "1" || params.get("qr") === "true";
  const source =
    params.get("source") || utm_source || (qr ? COHORT1_DEFAULTS.source : "") || COHORT1_DEFAULTS.source;
  const campaign =
    params.get("campaign") || utm_campaign || COHORT1_DEFAULTS.campaign;
  return {
    source,
    campaign,
    activation_date: params.get("activation_date") || COHORT1_DEFAULTS.activation_date,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    referrer_user_id: ref || null,
    qr,
    first_touch_at: new Date().toISOString(),
  };
}

export function mergeAcquisition(existing = {}, incoming = {}) {
  const base = { ...COHORT1_DEFAULTS, ...existing };
  const next = { ...base };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v == null || v === "") continue;
    if (k === "first_touch_at" && base.first_touch_at) continue;
    if ((k === "source" || k === "campaign") && existing?.[k] && existing[k] !== COHORT1_DEFAULTS[k]) {
      continue;
    }
    next[k] = v;
  }
  if (!next.source) next.source = COHORT1_DEFAULTS.source;
  if (!next.campaign) next.campaign = COHORT1_DEFAULTS.campaign;
  if (!next.activation_date) next.activation_date = COHORT1_DEFAULTS.activation_date;
  return next;
}

export function commonProps(acquisition = {}, surface = "web", userId = null) {
  const acq = mergeAcquisition({}, acquisition);
  return {
    source: acq.source,
    campaign: acq.campaign,
    activation_date: acq.activation_date,
    utm_source: acq.utm_source || undefined,
    utm_medium: acq.utm_medium || undefined,
    utm_campaign: acq.utm_campaign || undefined,
    shopping_context: acq.shopping_context || undefined,
    recruitment_round: acq.recruitment_round || undefined,
    referrer_user_id: acq.referrer_user_id || undefined,
    onboarding_version: ONBOARDING_VERSION,
    surface,
    ...(userId ? { user_id: userId } : {}),
  };
}

export function acquisitionForSignup(acquisition = {}, surface = "web") {
  const acq = mergeAcquisition({}, acquisition);
  return {
    acquisition_source: acq.source,
    acquisition_campaign: acq.campaign,
    activation_date: acq.activation_date,
    utm_source: acq.utm_source || null,
    utm_medium: acq.utm_medium || null,
    utm_campaign: acq.utm_campaign || null,
    shopping_context: acq.shopping_context || null,
    recruitment_round: acq.recruitment_round || null,
    referrer_user_id: acq.referrer_user_id || null,
    first_surface: surface,
    onboarding_version: ONBOARDING_VERSION,
  };
}
