import posthog from "posthog-js";
import {
  ACQUISITION_KEY,
  ANON_KEY,
  ONBOARDING_VERSION,
  acquisitionForSignup,
  commonProps,
  mergeAcquisition,
  newId,
  parseAcquisitionFromSearch,
} from "./analytics-shared.js";

let ready = false;
let identified = false;
let userId = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getSurface() {
  if (!isBrowser()) return "web";
  const w = window.innerWidth || 0;
  const ua = navigator.userAgent || "";
  if (w <= 768 || /iPhone|iPad|Android/i.test(ua)) return "mobile_web";
  return "web";
}

export function getAnonId() {
  if (!isBrowser()) return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return newId();
  }
}

export function loadAcquisition() {
  if (!isBrowser()) return mergeAcquisition({});
  try {
    const raw = localStorage.getItem(ACQUISITION_KEY);
    return mergeAcquisition(raw ? JSON.parse(raw) : {});
  } catch {
    return mergeAcquisition({});
  }
}

export function saveAcquisition(acq) {
  if (!isBrowser()) return acq;
  const next = mergeAcquisition(loadAcquisition(), acq);
  try {
    localStorage.setItem(ACQUISITION_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function captureAcquisitionFromUrl(search = window.location?.search || "") {
  const parsed = parseAcquisitionFromSearch(search);
  return saveAcquisition(parsed);
}

export function signupAcquisitionPayload() {
  return acquisitionForSignup(loadAcquisition(), getSurface());
}

export function initAnalytics() {
  if (!isBrowser() || ready) return;
  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  captureAcquisitionFromUrl();
  const anon = getAnonId();

  if (!key) {
    ready = true;
    if (import.meta.env.DEV) console.info("[yom analytics] no VITE_PUBLIC_POSTHOG_KEY — events no-op");
    return;
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    bootstrap: { distinctID: anon },
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: ".yom-mask, [data-yom-mask], input[type=password], input[type=email]",
      blockSelector: "input[type=file], .survey-photo, .q4-photo, .beta-thumb",
    },
  });
  posthog.register({
    ...commonProps(loadAcquisition(), getSurface()),
    onboarding_version: ONBOARDING_VERSION,
  });
  ready = true;
}

function props(extra = {}) {
  return {
    ...commonProps(loadAcquisition(), getSurface(), userId),
    ...extra,
  };
}

export function track(event, extra = {}) {
  if (!ready) initAnalytics();
  if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props(extra));
  } catch (e) {
    console.warn("[yom analytics]", e);
  }
}

export function identifyUser(supabaseUserId, traits = {}) {
  if (!supabaseUserId) return;
  if (!ready) initAnalytics();
  const anon = getAnonId();
  userId = supabaseUserId;
  if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
    identified = true;
    return;
  }
  try {
    if (anon && anon !== supabaseUserId) {
      posthog.alias(supabaseUserId, anon);
    }
    const acq = loadAcquisition();
    posthog.identify(supabaseUserId, {
      email: traits.email,
      name: traits.name,
      acquisition_source: acq.source,
      acquisition_campaign: acq.campaign,
      activation_date: acq.activation_date,
      utm_source: acq.utm_source || undefined,
      utm_medium: acq.utm_medium || undefined,
      utm_campaign: acq.utm_campaign || undefined,
      referrer_user_id: acq.referrer_user_id || undefined,
      first_surface: getSurface(),
      onboarding_version: ONBOARDING_VERSION,
      ...traits,
    });
    identified = true;
  } catch (e) {
    console.warn("[yom analytics] identify", e);
  }
}

export function resetAnalytics() {
  userId = null;
  identified = false;
  if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}

export { ONBOARDING_VERSION, identified };
