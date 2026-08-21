import { useEffect, useState } from "react";
import {
  claimGoogleGrant,
  formatEventWhen,
  loadGoogleState,
  startGoogleConnect,
} from "../lib/google-session.js";
import { loadBetaSession, yomGoogleDisconnect, yomGoogleSync } from "../lib/yom-api.js";

export default function GoogleConnect({ returnTo = "/looks", compact = false }) {
  const [google, setGoogle] = useState({ loading: true, events: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("google");
    const grant = params.get("grant");
    let cancelled = false;

    const boot = async () => {
      if (grant) {
        await claimGoogleGrant(grant);
      }
      if (flag || grant) {
        const url = new URL(window.location.href);
        url.searchParams.delete("google");
        url.searchParams.delete("grant");
        url.searchParams.delete("msg");
        window.history.replaceState({}, "", url.pathname + url.search);
        if (flag === "denied") setErr("google connect was cancelled.");
        if (flag === "error") setErr(params.get("msg") || "google connect failed.");
      }
      const state = await loadGoogleState();
      if (!cancelled) setGoogle({ loading: false, ...state });
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setErr("");
    const res = await startGoogleConnect(returnTo);
    if (!res.ok) {
      setBusy(false);
      setErr(res.error);
    }
  };

  const sync = async () => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
    setBusy(true);
    setErr("");
    const res = await yomGoogleSync(stored.access_token);
    if (!res.ok) {
      setBusy(false);
      setErr(res.error || res.calendar?.error || res.gmail?.error || "sync failed.");
      return;
    }
    const state = await loadGoogleState(stored.access_token);
    setGoogle({ loading: false, ...state });
    setBusy(false);
  };

  const disconnect = async () => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
    setBusy(true);
    await yomGoogleDisconnect(stored.access_token);
    setGoogle({ loading: false, connected: false, ready: true, events: [], gmail: [] });
    setBusy(false);
  };

  const coming = (google.events || []).slice(0, compact ? 3 : 6);

  if (google.loading) {
    return <p className="google-connect-meta">checking calendar…</p>;
  }

  return (
    <div className={`google-connect${compact ? " is-compact" : ""}`}>
      {err ? <p className="scan-err">{err}</p> : null}
      {!google.connected ? (
        <>
          <p className="google-connect-copy">
            connect gmail + calendar so yom can style you for what’s actually coming up — and remember what you already ordered.
          </p>
          <button type="button" className="scan-secondary google-connect-btn" onClick={connect} disabled={busy || google.ready === false}>
            {busy ? "opening google…" : google.ready === false ? "google isn’t set up on the server yet" : "connect gmail & calendar"}
          </button>
          <p className="google-connect-meta">
            {google.ready === false
              ? "needs GOOGLE_CLIENT_* and SUPABASE_* on vercel. no beta login required."
              : "no beta login — google can create your yom."}
          </p>
        </>
      ) : (
        <>
          <p className="google-connect-meta">
            {google.email ? `connected · ${google.email}` : "gmail + calendar connected"}
          </p>
          {coming.length ? (
            <ul className="google-connect-events">
              {coming.map((ev) => (
                <li key={ev.id || ev.label}>
                  <strong>{ev.label}</strong>
                  <span>
                    {formatEventWhen(ev.when)}
                    {ev.kind && ev.kind !== "generic" ? ` · ${ev.kind}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="google-connect-meta">no upcoming events in the next couple of months.</p>
          )}
          <div className="google-connect-actions">
            <button type="button" className="scan-secondary" onClick={sync} disabled={busy}>
              {busy ? "syncing…" : "sync now"}
            </button>
            <button type="button" className="scan-secondary" onClick={disconnect} disabled={busy}>
              disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
