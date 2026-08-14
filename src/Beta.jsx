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
import closetBlazer from "./assets/closet-blazer.jpg";
import closetJeans from "./assets/closet-jeans.jpg";
import closetTote from "./assets/closet-tote.jpg";
import closetSweater from "./assets/closet-sweater.jpg";
import closetDress from "./assets/closet-dress.jpg";
import memoryMarlene from "./assets/memory-marlene.jpg";
import memoryContour from "./assets/memory-contour.jpg";
import memoryTrousers from "./assets/memory-trousers.jpg";
import "./Beta.css";

const DEMO_THUMBS = {
  blazer: closetBlazer,
  jeans: closetJeans,
  tote: closetTote,
  sweater: closetSweater,
  dress: closetDress,
  marlene: memoryMarlene,
  contour: memoryContour,
  trousers: memoryTrousers,
  pant: closetJeans,
  mule: closetTote,
};

const TRAIT_TAG = {
  impulse: "impulse",
  nothing: "nothing to wear",
  panic: "event panic",
  decide: "slow decide",
};
const PREBUY_TAG = {
  friends: "asks friends",
  feed: "feed-led",
  research: "compares",
  wing: "wings it",
};

function purchaseImage(p) {
  return p?.image_url || DEMO_THUMBS[p?.image] || "";
}

function styleTags(profile) {
  const tags = [];
  const seen = new Set();
  const add = (t) => {
    const v = String(t || "")
      .replace(/^i /, "")
      .trim();
    if (!v || v.length > 22 || seen.has(v.toLowerCase())) return;
    seen.add(v.toLowerCase());
    tags.push(v);
  };
  (profile?.tags || []).forEach(add);
  add(profile?.keepLean);
  add(TRAIT_TAG[profile?.trait]);
  add(PREBUY_TAG[profile?.preBuy]);
  (profile?.style || []).forEach((line) => {
    if (String(line).length <= 22) add(line);
  });
  return tags.slice(0, 5);
}

function GmailLogo() {
  return (
    <svg className="beta-glogo" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4CAF50" d="M45 16.2 40 18.95 35 23.7 35 40h7c1.7 0 3-1.3 3-3V16.2z" />
      <path fill="#1E88E5" d="M3 16.2 6.6 17.9 13 23.25V40H6c-1.7 0-3-1.3-3-3V16.2z" />
      <polygon fill="#E53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.25 24,31.5 35,23.25 36,17" />
      <path fill="#C62828" d="M3 12.3V16.2l10 7.05V11.2L9.9 8.7C9.1 8.2 8.2 8 7.3 8 4.6 8 3 9.6 3 12.3z" />
      <path fill="#FBC02D" d="M45 12.3V16.2l-10 7.05V11.2l3.1-2.5C38.9 8.2 39.8 8 40.7 8 43.4 8 45 9.6 45 12.3z" />
    </svg>
  );
}

function CalendarLogo() {
  return (
    <svg className="beta-glogo" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="8" width="40" height="36" rx="6" fill="#fff" stroke="#1A73E8" strokeWidth="2" />
      <rect x="4" y="8" width="40" height="12" rx="6" fill="#1A73E8" />
      <rect x="4" y="14" width="40" height="6" fill="#1A73E8" />
      <text x="24" y="38" textAnchor="middle" fill="#1A73E8" fontSize="16" fontWeight="700" fontFamily="Arial, sans-serif">
        31
      </text>
    </svg>
  );
}

function formatWhen(value) {
  if (!value) return "";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return String(value);
  return new Date(t).toLocaleDateString();
}

function Thumb({ src, alt, className = "" }) {
  if (src) return <img className={`beta-thumb ${className}`.trim()} src={src} alt={alt || ""} />;
  const letter = (alt || "?").replace(/^the /i, "").charAt(0).toUpperCase();
  return (
    <span className={`beta-thumb beta-thumb-fallback ${className}`.trim()} aria-hidden="true">
      {letter}
    </span>
  );
}

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
  const name = profile?.name || authed.user?.name || authed.user?.email?.split("@")[0] || "you";
  const purchases = profile?.purchases || [];
  const kept = purchases.filter((p) => p.kept !== false);
  const returned = purchases.filter((p) => p.kept === false);
  const tags = styleTags(profile);
  const memoryPref = purchases.filter((p) => ["marlene", "contour", "trousers"].includes(p.image));
  const memory = (memoryPref.length ? memoryPref : purchases).slice(0, 3);
  const closetThumbs = kept.filter((p) => !["marlene", "contour", "trousers"].includes(p.image)).slice(0, 5);
  const closetShow = closetThumbs.length ? closetThumbs : kept.slice(0, 5);
  const comingUp = googleEvents.length ? googleEvents : profile?.events || [];
  const learning = Boolean(purchases.length || google.connected || profile?.read);

  return (
    <div className="beta-page">
      <div className="beta-bg" />
      <Link to="/" className="beta-back">
        ← yom
      </Link>
      <div className="beta-profile">
        <div className="beta-head">
          <div>
            <h1>Hi, {name}.</h1>
            {profile?.headline ? <p className="beta-from">{profile.headline}</p> : null}
          </div>
          {learning ? (
            <span className="beta-learning">
              <i />
              learning from your shopping
            </span>
          ) : null}
        </div>
        <div className="beta-switch">
          <span className="beta-signed">{authed.user?.email || profile?.email}</span>
          <button type="button" className="beta-out" onClick={out}>
            log out
          </button>
        </div>

        <div className="beta-grid">
          <section className="beta-seg">
            <h2>fit profile</h2>
            {profile?.sizes?.length ? (
              <div className="beta-fit">
                {profile.sizes.map((s) => (
                  <div className="beta-fit-cell" key={s.label}>
                    <span>{s.label}</span>
                    <strong>{s.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="beta-empty">sizes land here as yom shops with you.</p>
            )}
          </section>

          <section className="beta-seg">
            <h2>style profile</h2>
            {tags.length ? (
              <div className="beta-tags">
                {tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            ) : null}
            {profile?.read ? <p className="beta-seg-copy">{profile.read}</p> : null}
            {!tags.length && !profile?.read ? (
              <p className="beta-empty">your through-line shows up as you keep and return pieces.</p>
            ) : null}
          </section>

          <section className="beta-seg">
            <h2>closet</h2>
            {kept.length ? (
              <>
                <div className="beta-thumbs">
                  {closetShow.map((p) => (
                    <Thumb key={`${p.item}-${p.when}`} src={purchaseImage(p)} alt={p.item} />
                  ))}
                </div>
                <p className="beta-meta">
                  {kept.length} {kept.length === 1 ? "item" : "items"}
                  {returned.length ? ` · ${returned.length} returned` : ""}
                </p>
              </>
            ) : (
              <p className="beta-empty">kept pieces show up here with photos as you buy.</p>
            )}
          </section>

          <section className="beta-seg beta-seg-wide">
            <h2>shopping memory</h2>
            {memory.length ? (
              <>
                <p className="beta-meta">
                  {purchases.length} {purchases.length === 1 ? "purchase" : "purchases"}
                  <span />
                  {returned.length} {returned.length === 1 ? "return" : "returns"}
                </p>
                <ul className="beta-memory">
                  {memory.map((p) => (
                    <li key={`${p.item}-${p.when}`}>
                      <Thumb src={purchaseImage(p)} alt={p.item} />
                      <div>
                        <em>{p.brand || p.site || "bought"}</em>
                        <strong>{p.item}</strong>
                        {p.kept === false && p.return_reason ? <small>{p.return_reason}</small> : null}
                      </div>
                      <span className={p.kept === false ? "beta-pill return" : "beta-pill keep"}>
                        {p.kept === false ? "returned" : "kept"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="beta-empty">purchases and returns become the record yom actually uses.</p>
            )}
          </section>

          <section className="beta-seg">
            <h2>connected</h2>
            <ul className="beta-connect">
              <li>
                <GmailLogo />
                <div>
                  <strong>Gmail</strong>
                  <span>{google.connected ? "connected" : google.loading ? "checking…" : "not connected"}</span>
                </div>
                {google.connected ? <b className="beta-ok" aria-label="connected" /> : null}
              </li>
              <li>
                <CalendarLogo />
                <div>
                  <strong>Calendar</strong>
                  <span>{google.connected ? "connected" : google.loading ? "checking…" : "not connected"}</span>
                </div>
                {google.connected ? <b className="beta-ok" aria-label="connected" /> : null}
              </li>
            </ul>
            {google.connected && comingUp.length ? (
              <ul className="beta-google-events">
                {comingUp.slice(0, 3).map((ev) => (
                  <li key={ev.id || ev.label}>
                    <strong>{ev.label}</strong>
                    <span>
                      {[ev.kind, formatWhen(ev.when)].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="beta-google-actions">
              {!google.connected ? (
                <button type="button" className="beta-go" onClick={connectGoogle} disabled={googleBusy || google.loading}>
                  {googleBusy ? "opening google…" : "connect google"}
                </button>
              ) : (
                <>
                  <button type="button" className="beta-go" onClick={syncGoogle} disabled={googleBusy}>
                    {googleBusy ? "syncing…" : "sync now"}
                  </button>
                  <button type="button" className="beta-out" onClick={disconnectGoogle} disabled={googleBusy}>
                    disconnect
                  </button>
                </>
              )}
            </div>
            {err ? <p className="beta-err">{err}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
