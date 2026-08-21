/**
 * Extension analytics — PostHog capture via background fetch (MV3-safe).
 * Content scripts send { type: "YOM_TRACK", event, properties }.
 */

import { POSTHOG_HOST, POSTHOG_KEY } from "../analytics-config.js";

const ANON_KEY = "yom_anon_id";
const ACQUISITION_KEY = "yom_acquisition";
const ALIASED_KEY = "yom_ph_aliased";

const COHORT1 = {
  source: "organic",
  campaign: "stylist",
  activation_date: "2026-08-19",
};

const ONBOARDING_VERSION = "cohort1_survey_v1";

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `yom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getAnonId() {
  const stored = await chrome.storage.local.get(ANON_KEY);
  if (stored[ANON_KEY]) return stored[ANON_KEY];
  const id = newId();
  await chrome.storage.local.set({ [ANON_KEY]: id });
  return id;
}

async function loadAcquisition() {
  const stored = await chrome.storage.local.get(ACQUISITION_KEY);
  return { ...COHORT1, ...(stored[ACQUISITION_KEY] || {}) };
}

async function saveAcquisition(patch) {
  const cur = await loadAcquisition();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ [ACQUISITION_KEY]: next });
  return next;
}

function hostBase() {
  return String(POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
}

async function postEvent(payload) {
  if (!POSTHOG_KEY) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${hostBase()}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok };
  } catch (e) {
    console.warn("[yom analytics]", e);
    return { ok: false };
  }
}

async function capture(event, properties = {}, { userId } = {}) {
  if (!POSTHOG_KEY || !event) return { ok: false, skipped: true };
  const acq = await loadAcquisition();
  const uid = userId || properties.user_id || null;
  const distinct_id = uid || (await getAnonId());
  return postEvent({
    api_key: POSTHOG_KEY,
    event,
    distinct_id,
    properties: {
      source: acq.source,
      campaign: acq.campaign,
      activation_date: acq.activation_date,
      utm_source: acq.utm_source || undefined,
      utm_medium: acq.utm_medium || undefined,
      utm_campaign: acq.utm_campaign || undefined,
      referrer_user_id: acq.referrer_user_id || undefined,
      onboarding_version: ONBOARDING_VERSION,
      surface: "extension",
      $lib: "yom-extension",
      ...properties,
      ...(uid ? { user_id: uid } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}

async function identify(userId, traits = {}) {
  if (!POSTHOG_KEY || !userId) return { ok: false };
  const anon = await getAnonId();
  const flagged = await chrome.storage.local.get(ALIASED_KEY);
  if (anon && anon !== userId && !flagged[ALIASED_KEY]) {
    await postEvent({
      api_key: POSTHOG_KEY,
      event: "$create_alias",
      distinct_id: userId,
      properties: {
        distinct_id: userId,
        alias: anon,
      },
    });
    await chrome.storage.local.set({ [ALIASED_KEY]: true });
  }
  const acq = await loadAcquisition();
  await postEvent({
    api_key: POSTHOG_KEY,
    event: "$identify",
    distinct_id: userId,
    properties: {
      $set: {
        email: traits.email,
        name: traits.name,
        acquisition_source: acq.source,
        acquisition_campaign: acq.campaign,
        activation_date: acq.activation_date,
        first_surface: "extension",
        onboarding_version: ONBOARDING_VERSION,
        ...traits,
      },
      user_id: userId,
      surface: "extension",
    },
  });
  return { ok: true };
}

export const extAnalytics = {
  capture,
  identify,
  getAnonId,
  loadAcquisition,
  saveAcquisition,
  ONBOARDING_VERSION,
};
