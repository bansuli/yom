import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BETA_USERS, PROFILES, findBetaUser } from "./profiles.js";
import {
  clearBetaSession,
  loadBetaSession,
  saveBetaSession,
  yomLogin,
  yomMe,
  yomSignup,
} from "./lib/yom-api.js";
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

  useEffect(() => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
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
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const call = signup ? yomSignup : yomLogin;
    const res = await call(email, password, email.split("@")[0]);
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
    saveBetaSession({
      email: res.user?.email || email,
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      user: res.user,
      profile: res.profile,
    });
    setAuthed({ user: res.user, profile: res.profile });
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
  const hasCloset = Boolean(profile?.purchases?.length || profile?.read || profile?.headline);

  return (
    <div className="beta-page">
      <div className="beta-bg" />
      <Link to="/" className="beta-back">
        ← yom
      </Link>
      <div className="beta-profile">
        <p className="beta-from">
          {/read from/i.test(profile?.from || "") || !profile?.from || profile.from === "beta"
            ? "member from apr 2026"
            : profile.from}
        </p>
        <h1>{profile?.name || authed.user?.name || authed.user?.email?.split("@")[0]}</h1>
        <div className="beta-switch">
          <span className="beta-signed">{authed.user?.email || profile?.email}</span>
          <button type="button" className="beta-out" onClick={out}>
            log out
          </button>
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
                <h2>past purchases</h2>
                <div className="beta-kept">
                  {profile.purchases.map((p) => (
                    <div className="beta-kept-row" key={p.item}>
                      <strong>
                        {p.when} · {p.item}
                      </strong>
                      <span>{p.note}</span>
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
                    <div className="beta-kept-row" key={s.item || s.name}>
                      <strong>{s.item || s.name}</strong>
                      <span>{s.note}</span>
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
