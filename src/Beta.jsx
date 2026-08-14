import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BETA_USERS, PROFILES, findBetaUser } from "./profiles.js";
import {
  clearBetaSession,
  loadBetaSession,
  saveBetaSession,
  yomCloset,
  yomGoogleDisconnect,
  yomGoogleEvents,
  yomGoogleStart,
  yomGoogleStatus,
  yomGoogleSync,
  yomLogin,
  yomMe,
  yomSignup,
} from "./lib/yom-api.js";
import { clearSurvey, loadSurvey } from "./lib/survey-store.js";
import "./Beta.css";

function localAccount(email) {
  const row = BETA_USERS.find((u) => u.email === email);
  if (!row) return null;
  const hardcoded = row.profileId ? PROFILES[row.profileId] : null;
  return {
    user: { email: row.email, name: row.name, id: row.profileId || row.email },
    profile: hardcoded
      ? {
          ...hardcoded,
          email: row.email,
          userId: hardcoded.id,
        }
      : {
          name: row.name,
          email: row.email,
          from: "member from apr 2026",
        },
    local: true,
  };
}

function fromStored(stored) {
  if (!stored) return null;
  if (stored.access_token && stored.profile) {
    return {
      user: stored.user || { email: stored.email, name: stored.profile.name, id: stored.profile.id },
      profile: stored.profile,
    };
  }
  return localAccount(stored.email);
}

export default function Beta() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [authed, setAuthed] = useState(() => fromStored(loadBetaSession()));
  const [google, setGoogle] = useState({ loading: true });
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") setErr("");
    if (g === "denied") setErr("google connect was cancelled.");
    if (g === "error") setErr(params.get("msg") || "google connect failed.");
    if (g) {
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      url.searchParams.delete("msg");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    const stored = loadBetaSession();
    if (!stored?.access_token) {
      setGoogle({ loading: false, connected: false });
      return;
    }
    let cancelled = false;
    yomMe(stored.access_token).then((res) => {
      if (cancelled) return;
      if (res.ok && res.profile) {
        saveBetaSession({ ...stored, user: res.user, profile: res.profile });
        setAuthed({ user: res.user, profile: res.profile });
        return;
      }
      if (res.status === 401) {
        clearBetaSession();
        setAuthed(null);
      }
    });
    yomGoogleStatus(stored.access_token).then((res) => {
      if (cancelled) return;
      if (res.fallback) {
        setGoogle({ loading: false, ready: false, connected: false });
        return;
      }
      setGoogle({
        loading: false,
        ready: res.googleOAuthReady !== false,
        connected: Boolean(res.connected),
        email: res.email,
        calendar_synced_at: res.calendar_synced_at,
        gmail_synced_at: res.gmail_synced_at,
      });
      if (res.connected) {
        yomGoogleEvents(stored.access_token).then((ev) => {
          if (!cancelled && ev.ok) setGoogleEvents(ev.events || []);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connectGoogle = async () => {
    const stored = loadBetaSession();
    if (!stored?.access_token) {
      setErr("log in first.");
      return;
    }
    setGoogleBusy(true);
    setErr("");
    const res = await yomGoogleStart(stored.access_token, "/beta");
    setGoogleBusy(false);
    if (!res.ok || !res.url) {
      setErr(res.error || "google oauth isn’t configured yet.");
      return;
    }
    window.location.href = res.url;
  };

  const syncGoogle = async () => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
    setGoogleBusy(true);
    setErr("");
    const res = await yomGoogleSync(stored.access_token);
    setGoogleBusy(false);
    if (!res.ok) {
      setErr(res.error || res.calendar?.error || res.gmail?.error || "sync failed.");
      return;
    }
    setGoogle({
      loading: false,
      ready: true,
      connected: true,
      email: res.email,
      calendar_synced_at: res.calendar_synced_at,
      gmail_synced_at: res.gmail_synced_at,
    });
    const ev = await yomGoogleEvents(stored.access_token);
    if (ev.ok) setGoogleEvents(ev.events || []);
  };

  const disconnectGoogle = async () => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
    setGoogleBusy(true);
    await yomGoogleDisconnect(stored.access_token);
    setGoogleBusy(false);
    setGoogle({ loading: false, ready: true, connected: false });
    setGoogleEvents([]);
  };

  const enter = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const survey = loadSurvey();
    const extra = survey
      ? {
          name: survey.name || email.split("@")[0],
          trait: survey.trait,
          preBuy: survey.preBuy,
          read: survey.read,
          headline: survey.headline,
          closet: survey.closet || [],
        }
      : {};
    const res = signup
      ? await yomSignup(email, password, extra.name || email.split("@")[0], extra)
      : await yomLogin(email, password);
    if (res.fallback) {
      if (signup) {
        setErr("live signup isn't on yet. use the demo login for now.");
        setBusy(false);
        return;
      }
      const result = findBetaUser(email, password);
      if (result.error) {
        setErr(result.error);
        setBusy(false);
        return;
      }
      saveBetaSession({ email: result.user.email });
      setAuthed(localAccount(result.user.email));
      setPassword("");
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setErr(res.error || (signup ? "could not create the account." : "could not log in."));
      setBusy(false);
      return;
    }
    if (!res.access_token) {
      setSignup(false);
      setErr("account created. log in.");
      setBusy(false);
      return;
    }
    let profile = res.profile;
    if (!signup && extra.closet?.length && !profile?.purchases?.length) {
      const flushed = await yomCloset(res.access_token, extra);
      if (flushed.ok && flushed.profile) profile = flushed.profile;
    }
    if (res.ok && extra.closet) clearSurvey();
    saveBetaSession({
      email: res.user?.email || email,
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      user: res.user,
      profile,
    });
    setAuthed({ user: res.user, profile });
    setPassword("");
    setBusy(false);
  };

  const out = () => {
    clearBetaSession();
    setAuthed(null);
    setEmail("");
    setPassword("");
    setErr("");
  };

  if (!authed) {
    return (
      <div className="beta-page">
        <div className="beta-bg" />
        <Link to="/" className="beta-back">
          ← yom
        </Link>
        <div className="beta-gate">
          <div className="beta-card">
            <p className="beta-eyebrow">beta</p>
            <h1>{signup ? "create account." : "log in."}</h1>
            <p>
              {signup
                ? "only emails on the beta list get in."
                : "if you’re on the beta list, this is your door."}
            </p>
            <form onSubmit={enter}>
              <input
                type="email"
                autoComplete="username"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button className="beta-go" type="submit" disabled={busy}>
                {busy ? "one sec…" : signup ? "create account" : "log in"}
              </button>
            </form>
            <button
              type="button"
              className="beta-toggle"
              onClick={() => {
                setSignup((v) => !v);
                setErr("");
              }}
            >
              {signup ? "already have an account? log in" : "not yet? create account"}
            </button>
            {err ? <p className="beta-err">{err}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  const profile = authed.profile;
  const hasCloset = Boolean(
    profile?.purchases?.length ||
      profile?.saved?.length ||
      profile?.outcomes?.length ||
      profile?.read ||
      profile?.headline
  );

  return (
    <div className="beta-page">
      <div className="beta-bg" />
      <Link to="/" className="beta-back">
        ← yom
      </Link>
      <div className="beta-profile">
        <h1>{profile?.name || authed.user?.name || authed.user?.email?.split("@")[0]}</h1>
        <div className="beta-switch">
          <span className="beta-signed">{authed.user?.email || profile?.email}</span>
          <button type="button" className="beta-out" onClick={out}>
            log out
          </button>
        </div>

        <div className="beta-block beta-google">
          <h2>google</h2>
          <p className="beta-shop">
            calendar for upcoming trips &amp; events. gmail for orders, returns, and sizing mail.
          </p>
          {google.loading ? (
            <p className="beta-shop">checking…</p>
          ) : !google.connected ? (
            <button type="button" className="beta-go" onClick={connectGoogle} disabled={googleBusy}>
              {googleBusy ? "opening google…" : "connect google"}
            </button>
          ) : (
            <>
              <p className="beta-shop">
                connected as {google.email || "google"}
                {google.calendar_synced_at
                  ? ` · calendar synced ${new Date(google.calendar_synced_at).toLocaleString()}`
                  : ""}
              </p>
              {googleEvents.length ? (
                <ul className="beta-google-events">
                  {googleEvents.slice(0, 6).map((ev) => (
                    <li key={ev.id}>
                      <strong>{ev.label}</strong>
                      <span>
                        {ev.kind}
                        {ev.when ? ` · ${new Date(ev.when).toLocaleDateString()}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="beta-shop">no upcoming events synced yet.</p>
              )}
              <div className="beta-google-actions">
                <button type="button" className="beta-go" onClick={syncGoogle} disabled={googleBusy}>
                  {googleBusy ? "syncing…" : "sync now"}
                </button>
                <button type="button" className="beta-out" onClick={disconnectGoogle} disabled={googleBusy}>
                  disconnect
                </button>
              </div>
            </>
          )}
          {err ? <p className="beta-err">{err}</p> : null}
        </div>

        {hasCloset ? (
          <>
            {(profile.headline || profile.read) && (
              <div className="beta-block">
                <h2>yom's read</h2>
                {profile.headline ? <p className="beta-read">{profile.headline}</p> : null}
                {profile.read ? <p className="beta-shop">{profile.read}</p> : null}
              </div>
            )}

            {profile.sizes?.length ? (
              <div className="beta-block">
                <h2>sizes</h2>
                <div className="beta-sizes">
                  {profile.sizes.map((s) => (
                    <div className="beta-size" key={s.label}>
                      <strong>{s.value}</strong>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.style?.length ? (
              <div className="beta-block">
                <h2>style</h2>
                <ul>
                  {profile.style.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile.purchases?.length ? (
              <div className="beta-block">
                <h2>closet</h2>
                <div className="beta-kept">
                  {profile.purchases.map((p) => (
                    <div className="beta-kept-row" key={`${p.item}-${p.when}`}>
                      <strong>
                        {p.when ? `${p.when} · ` : ""}
                        {p.item}
                      </strong>
                      <span>
                        {p.kept === false
                          ? `returned${p.return_reason ? ` · ${p.return_reason}` : ""}`
                          : [p.brand, p.kind, p.color, p.note].filter(Boolean).join(" · ") || "kept"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.saved?.length ? (
              <div className="beta-block">
                <h2>saved for later</h2>
                <div className="beta-kept">
                  {profile.saved.map((s) => (
                    <div className="beta-kept-row" key={s.href || s.item || s.name}>
                      <strong>{s.item || s.name}</strong>
                      <span>{s.note || s.site || "parked"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.events?.length ? (
              <div className="beta-block">
                <h2>coming up</h2>
                <div className="beta-kept">
                  {profile.events.map((ev) => (
                    <div className="beta-kept-row" key={ev.id || ev.label}>
                      <strong>{ev.label}</strong>
                      <span>{[ev.when, ev.kind].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.outcomes?.length ? (
              <div className="beta-block">
                <h2>recent decisions</h2>
                <div className="beta-kept">
                  {profile.outcomes.slice(0, 8).map((row) => (
                    <div className="beta-kept-row" key={row.id || `${row.action}-${row.product_key}`}>
                      <strong>{row.name || row.product_key}</strong>
                      <span>{[row.action, row.reason, row.site].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="beta-block">
            <h2>you’re in</h2>
            <p className="beta-read">yom is building your profile as you shop.</p>
            <p className="beta-shop">
              this page fills in as yom learns your sizes, the pieces you keep, and what you save. until then, use the
              extension — that’s where it actually sits with you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
