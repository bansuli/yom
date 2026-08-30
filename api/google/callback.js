import {
  exchangeCode,
  fetchGoogleUser,
  googleConfigured,
  safeOrigin,
  safeReturnTo,
  signState,
  verifyState,
  GOOGLE_SCOPES,
} from "../../lib/google.js";
import { syncCalendar, syncGmail, upsertGoogleAccount, getGoogleAccount } from "../../lib/google-store.js";
import { findOrCreateUserFromGoogle } from "../../lib/scan-account.js";
import { supabaseConfigured } from "../../lib/supabase.js";

function appBase(state) {
  return safeOrigin(state?.origin) || (process.env.APP_BASE_URL || "https://youryom.com").replace(/\/$/, "");
}

/**
 * GET /api/google/callback?code=&state=
 * Google redirects here. Stores tokens, runs first sync, redirects to returnTo.
 * Guest connects get a short-lived `grant` to claim a yom session.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).send("GET only");
    return;
  }
  if (!googleConfigured()) {
    res.status(503).send("google oauth is not configured");
    return;
  }

  const err = req.query?.error;
  const state = verifyState(req.query?.state);
  const returnTo = safeReturnTo(state?.returnTo || "/looks");
  const base = appBase(state);

  if (err) {
    res.writeHead(302, { Location: `${base}${returnTo}?google=denied` });
    res.end();
    return;
  }

  const code = req.query?.code;
  if (!code || !state) {
    res.writeHead(302, { Location: `${base}${returnTo}?google=bad_state` });
    res.end();
    return;
  }

  if (!supabaseConfigured()) {
    res.writeHead(302, {
      Location: `${base}${returnTo}?google=error&msg=${encodeURIComponent("google needs supabase env on the server to keep calendar/gmail tokens.")}`,
    });
    res.end();
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    const googleUser = await fetchGoogleUser(tokens.access_token);
    const expiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    let userId = state.userId || null;
    let guest = Boolean(state.guest) && !userId;
    if (!userId) {
      const created = await findOrCreateUserFromGoogle(googleUser, { first_surface: "google" });
      userId = created.id;
      guest = true;
    }

    const existing = await getGoogleAccount(userId);
    const saved = await upsertGoogleAccount(userId, {
      google_sub: googleUser.id || googleUser.sub || null,
      email: googleUser.email || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expiry: expiry,
      scopes: tokens.scope || GOOGLE_SCOPES,
    });

    const account = {
      user_id: userId,
      google_sub: saved?.google_sub || googleUser.id,
      email: saved?.email || googleUser.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || saved?.refresh_token,
      token_expiry: expiry,
      scopes: tokens.scope || GOOGLE_SCOPES,
    };

    // A sign-in was never granted calendar or mail, so there is nothing to
    // pull and asking would only log a confusing permission error.
    if (!state.signin) {
      try {
        await syncCalendar(userId, account);
      } catch (e) {
        console.warn("google calendar sync", e?.message || e);
      }
      try {
        await syncGmail(userId, account);
      } catch (e) {
        console.warn("google gmail sync", e?.message || e);
      }
    }

    const qs = new URLSearchParams({ google: "connected" });
    if (guest) {
      qs.set("grant", signState({ userId, kind: "session_grant" }, 120));
    }
    res.writeHead(302, { Location: `${base}${returnTo}?${qs}` });
    res.end();
  } catch (e) {
    console.warn("google callback", e?.message || e);
    res.writeHead(302, {
      Location: `${base}${returnTo}?google=error&msg=${encodeURIComponent(e?.message || "failed")}`,
    });
    res.end();
  }
}
