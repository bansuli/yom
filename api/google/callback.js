import {
  exchangeCode,
  fetchGoogleUser,
  googleConfigured,
  verifyState,
  GOOGLE_SCOPES,
} from "../../lib/google.js";
import { syncCalendar, syncGmail, upsertGoogleAccount } from "../../lib/google-store.js";

function appBase() {
  return (process.env.APP_BASE_URL || "https://youryom.com").replace(/\/$/, "");
}

/**
 * GET /api/google/callback?code=&state=
 * Google redirects here. Stores tokens, runs first sync, redirects to returnTo.
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
  if (err) {
    res.writeHead(302, { Location: `${appBase()}/beta?google=denied` });
    res.end();
    return;
  }

  const code = req.query?.code;
  const state = verifyState(req.query?.state);
  if (!code || !state?.userId) {
    res.writeHead(302, { Location: `${appBase()}/beta?google=bad_state` });
    res.end();
    return;
  }

  const returnTo = String(state.returnTo || "/beta").startsWith("/")
    ? state.returnTo
    : "/beta";

  try {
    const tokens = await exchangeCode(code);
    const user = await fetchGoogleUser(tokens.access_token);
    const expiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const saved = await upsertGoogleAccount(state.userId, {
      google_sub: user.id || user.sub || null,
      email: user.email || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expiry: expiry,
      scopes: tokens.scope || GOOGLE_SCOPES,
    });

    const account = {
      user_id: state.userId,
      google_sub: saved?.google_sub || user.id,
      email: saved?.email || user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || saved?.refresh_token,
      token_expiry: expiry,
      scopes: tokens.scope || GOOGLE_SCOPES,
    };

    try {
      await syncCalendar(state.userId, account);
    } catch (e) {
      console.warn("google calendar sync", e?.message || e);
    }
    try {
      await syncGmail(state.userId, account);
    } catch (e) {
      console.warn("google gmail sync", e?.message || e);
    }

    res.writeHead(302, { Location: `${appBase()}${returnTo}?google=connected` });
    res.end();
  } catch (e) {
    console.warn("google callback", e?.message || e);
    res.writeHead(302, {
      Location: `${appBase()}${returnTo}?google=error&msg=${encodeURIComponent(e?.message || "failed")}`,
    });
    res.end();
  }
}
