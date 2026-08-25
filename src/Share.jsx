import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  captureAcquisitionFromUrl,
  getAnonId,
  getSurface,
  saveAcquisition,
  track,
} from "./lib/analytics.js";
import { loadVoterName, saveVoterName } from "./lib/share-votes.js";
import { apiUrl } from "./lib/native.js";
import "./Scan.css";
import "./Share.css";

function senderFirst(share) {
  const note = String(share?.preview_note || share?.product?.sender_name || "").trim();
  if (note && !note.includes("@")) return note.split(/\s+/)[0].toLowerCase();
  const email = String(share?.sender_email || "");
  if (email.includes("@")) return email.split("@")[0].toLowerCase();
  return "a friend";
}

export default function SharePage() {
  const { shareId } = useParams();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [err, setErr] = useState("");
  const [voterName, setVoterName] = useState(() => loadVoterName());
  const [vote, setVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fomo, setFomo] = useState(false);

  const createHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("fresh", "1");
    q.set("ref", share?.sender_user_id || share?.sender_anon_id || "");
    if (shareId) q.set("share_id", shareId);
    q.set("campaign", share?.campaign || "stylist");
    return `/join?${q.toString()}`;
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
      const delays = [0, 400, 900, 1600];
      for (let i = 0; i < delays.length; i += 1) {
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        if (cancelled) return;
        try {
          const res = await fetch(
            apiUrl(
              `/api/share?id=${encodeURIComponent(shareId)}&anon_id=${encodeURIComponent(getAnonId() || "")}`
            )
          );
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.ok && data.ok) {
            setShare(data.share);
            if (data.share?.sender_user_id) {
              saveAcquisition({ referrer_user_id: data.share.sender_user_id });
            }
            setErr("");
            setLoading(false);
            return;
          }
          if (i === delays.length - 1) {
            setErr(data.error || "this share link expired or isn’t ready.");
            setLoading(false);
          }
        } catch {
          if (cancelled) return;
          if (i === delays.length - 1) {
            setErr("couldn’t load this share.");
            setLoading(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId, params]);

  const submitVote = async (choice) => {
    if (done || busy) return;
    const name = voterName.trim();
    if (!name) {
      setErr("what’s your name?");
      return;
    }
    setVote(choice);
    setBusy(true);
    setErr("");
    saveVoterName(name);
    track("vote_submitted", {
      share_id: shareId,
      vote: choice,
      surface: getSurface(),
      sender_user_id: share?.sender_user_id,
      voter_name: name,
    });

    const res = await fetch(apiUrl("/api/share"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "vote",
        share_id: shareId,
        vote: choice,
        voter_name: name,
        voter_anon_id: getAnonId(),
      }),
    }).then((r) => r.json().catch(() => ({})));

    setBusy(false);
    if (!res.ok && !res.fallback) {
      setErr(res.error || "could not save your vote.");
      return;
    }
    setDone(true);
  };

  const who = senderFirst(share);
  const imageSrc = share?.image_url || share?.product?.share_thumb || "";

  return (
    <div className="share-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">a friend’s piece</p>
      </header>

      {loading && <p className="share-muted">loading…</p>}
      {err && <p className="scan-err">{err}</p>}

      {!loading && share && (
        <>
          {imageSrc ? (
            <section className="share-photo-gate is-open">
              <div className="share-photo-frame share-photo-frame-simple">
                <img src={imageSrc} alt="" className="share-photo" draggable={false} />
              </div>
            </section>
          ) : null}

          {!done && (
            <section className="share-card">
              <h1>{who} wants your opinion</h1>
              <label className="join-label" htmlFor="share-voter-name">
                your name
              </label>
              <input
                id="share-voter-name"
                className="scan-email-input"
                placeholder="name"
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <div className="share-split">
                <button
                  type="button"
                  className={vote === "buy" ? "on" : ""}
                  disabled={busy}
                  onClick={() => submitVote("buy")}
                >
                  buy
                </button>
                <span className="share-split-mark" aria-hidden="true">
                  //
                </span>
                <button
                  type="button"
                  className={vote === "skip" ? "on" : ""}
                  disabled={busy}
                  onClick={() => submitVote("skip")}
                >
                  skip
                </button>
              </div>
            </section>
          )}

          {done && (
            <section className="share-done share-fomo">
              <h1>{who} is using yom to shop</h1>
              <div className="share-split">
                <Link
                  to={createHref}
                  onClick={() => track("share_gate_clicked", { share_id: shareId, channel: "join" })}
                >
                  create your own
                </Link>
                <span className="share-split-mark" aria-hidden="true">
                  //
                </span>
                <button
                  type="button"
                  className={fomo ? "on" : ""}
                  onClick={() => {
                    setFomo(true);
                    track("share_fomo_clicked", { share_id: shareId });
                  }}
                >
                  live with the fomo
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
