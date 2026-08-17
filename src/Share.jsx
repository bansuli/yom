import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  captureAcquisitionFromUrl,
  getAnonId,
  getSurface,
  saveAcquisition,
  track,
} from "./lib/analytics.js";
import { captureLead } from "./lib/capture-lead.js";
import "./Scan.css";
import "./Share.css";

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

export default function SharePage() {
  const { shareId } = useParams();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [votes, setVotes] = useState([]);
  const [err, setErr] = useState("");
  const [vote, setVote] = useState(null);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const createHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("ref", share?.sender_user_id || share?.sender_anon_id || "");
    if (shareId) q.set("share_id", shareId);
    q.set("campaign", share?.campaign || "reformation_monday");
    return `/create?${q.toString()}`;
  }, [share, shareId]);

  useEffect(() => {
    captureAcquisitionFromUrl();
    if (shareId) {
      saveAcquisition({
        referrer_user_id: params.get("ref") || undefined,
      });
    }
    track("share_opened", { share_id: shareId, surface: getSurface() });

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/share?id=${encodeURIComponent(shareId)}&anon_id=${encodeURIComponent(getAnonId() || "")}`
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setErr(data.error || "this share link expired or isn’t ready.");
          setLoading(false);
          return;
        }
        setShare(data.share);
        setVotes(data.votes || []);
        if (data.share?.sender_user_id) {
          saveAcquisition({ referrer_user_id: data.share.sender_user_id });
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setErr("couldn’t load this share.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId, params]);

  const submitVote = async (choice) => {
    if (done || busy) return;
    setVote(choice);
    setBusy(true);
    setErr("");
    track("vote_submitted", {
      share_id: shareId,
      vote: choice,
      surface: getSurface(),
      sender_user_id: share?.sender_user_id,
    });
    if (reason.trim()) {
      track("vote_reason_submitted", { share_id: shareId, vote: choice, reason: reason.trim() });
    }

    if (isValidEmail(email)) {
      await captureLead({
        email,
        channel: "share_vote",
        path: `/s/${shareId}`,
        referrer_user_id: share?.sender_user_id || undefined,
        metadata: { share_id: shareId, vote: choice },
      });
      track("referred_signup_started", { share_id: shareId });
    }

    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "vote",
        share_id: shareId,
        vote: choice,
        reason: reason.trim() || undefined,
        voter_anon_id: getAnonId(),
        voter_email: isValidEmail(email) ? email.trim() : undefined,
      }),
    }).then((r) => r.json().catch(() => ({})));

    setBusy(false);
    if (!res.ok && !res.fallback) {
      setErr(res.error || "could not save your vote.");
      return;
    }
    setDone(true);
    setVotes((prev) => [{ vote: choice, reason: reason.trim() || null, created_at: new Date().toISOString() }, ...prev]);
  };

  const product = share?.product || {};
  const verdict = share?.verdict || {};

  return (
    <div className="share-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">a friend wants your take.</p>
      </header>

      {loading && <p className="share-muted">loading…</p>}
      {err && <p className="scan-err">{err}</p>}

      {!loading && share && (
        <>
          <section className="share-card">
            <p className="scan-meta">
              {[product.brand, product.name].filter(Boolean).join(" · ") || "a piece"}
              {product.price != null ? ` · $${product.price}` : ""}
            </p>
            <h1>{verdict.title || "what do you think?"}</h1>
            {verdict.body && <p className="scan-body">{verdict.body}</p>}
            {share.decision && <p className="share-muted">they’re leaning: {share.decision}</p>}
          </section>

          {!done ? (
            <section className="share-vote">
              <p className="share-ask">would you get it?</p>
              <div className="scan-decisions">
                {["buy", "skip", "save"].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={vote === choice ? "picked" : ""}
                    disabled={busy}
                    onClick={() => submitVote(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <input
                className="scan-email-input"
                placeholder="why? (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <input
                type="email"
                className="scan-email-input yom-mask"
                placeholder="your email (so we save this)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </section>
          ) : (
            <section className="share-done">
              <p>got it{vote ? ` — ${vote}` : ""}.</p>
              <Link className="scan-shutter share-cta" to={createHref}>
                create your yom →
              </Link>
              <Link className="scan-secondary share-cta-secondary" to="/scan">
                scan something yourself
              </Link>
            </section>
          )}

          {votes.length > 0 && (
            <section className="share-tally">
              <p className="share-muted">
                {share.opens_count || 0} opens · {Math.max(share.votes_count || 0, votes.length)} votes
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
