import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import YomNav from "./components/YomNav.jsx";
import { wearLabel } from "./lib/contexts.js";
import { clearJoinLocal, loadJoinEmail, loadJoinProfile, unlockIfTest } from "./lib/join-store.js";
import { clearAccountKey, getAccountKey } from "./lib/account.js";
import {
  clearPipelineLocal,
  deleteLook,
  lineupSlots,
  loadLooks,
  loadPublicState,
  lookImage,
  lookInLineup,
  syncPipeline,
} from "./lib/pipeline-store.js";
import "./Pipeline.css";
import "./Me.css";

function initialOf(name, email) {
  const source = String(name || email || "").trim();
  return source ? source[0].toUpperCase() : "y";
}

/** Pieces actually sitting in her week, ignoring any whose look has gone. */
function countPlaced() {
  return lineupSlots().reduce((total, day) => total + (day.pieces?.length || 0), 0);
}

function whenText(at) {
  const ms = Number(at || 0);
  if (!ms) return "";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Her yom, as a person rather than a browser: who she is signed in as, what she
 * has shown yom, where each piece sits in her week, and the two things she could
 * not do anywhere before — take a look back down, and move her account.
 */
export default function Me() {
  const navigate = useNavigate();
  const ready = unlockIfTest();
  const [looks, setLooks] = useState(() => loadLooks());
  // Only the count: her week itself lives on /lineup, and one of them has to
  // be the place she edits it.
  const [placed, setPlaced] = useState(() => countPlaced());
  const [pub, setPub] = useState(() => loadPublicState());
  const [pending, setPending] = useState("");
  const [modal, setModal] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) navigate("/join", { replace: true });
  }, [ready, navigate]);

  if (!ready) return null;

  const profile = loadJoinProfile();
  const email = loadJoinEmail() || profile.email || "";
  const name = String(profile.name || pub.display_name || "").trim();
  const link = `${window.location.origin}/looks#key=${encodeURIComponent(getAccountKey())}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("copied. open it on your other phone.");
    } catch {
      setCopied(link);
    }
  };

  const removeLook = async (id) => {
    setBusy(true);
    setLooks(deleteLook(id));
    setPlaced(countPlaced());
    setPending("");
    // Straight to the server: a look she deleted should not sit on the everyone
    // board waiting for her to do something else.
    await syncPipeline();
    setPub(loadPublicState());
    setBusy(false);
  };

  // Only the key opens this account, so signing out without it strands her.
  const signOut = () => {
    clearPipelineLocal();
    clearJoinLocal();
    clearAccountKey();
    navigate("/join?fresh=1", { replace: true });
  };

  return (
    <div className="pnm-page is-app">
      <header className="pnm-brand-row">
        <Link to="/looks" className="pnm-back">
          ← back
        </Link>
        <Link to="/looks" className="pnm-brand">
          yom
        </Link>
      </header>

      <section className="me-card">
        <div className="me-id">
          <span className="me-avatar" aria-hidden="true">
            {initialOf(name, email)}
          </span>
          <div className="me-who">
            <h1>{name || "your yom"}</h1>
            <p className="me-email">{email || "no email on this device"}</p>
            <p className="me-signed">
              <i aria-hidden="true" />
              signed in on this device
            </p>
          </div>
        </div>
        <dl className="me-stats">
          <div>
            <dt>looks</dt>
            <dd>{looks.length}</dd>
          </div>
          <div>
            <dt>in your lineup</dt>
            <dd>{placed}</dd>
          </div>
          <div>
            <dt>everyone board</dt>
            <dd>{pub.is_public ? "public" : "private"}</dd>
          </div>
        </dl>
      </section>

      <div className="pnm-section-head" id="looks">
        <h2>
          everything you’ve shown yom
          {looks.length ? <span className="pnm-count">{looks.length}</span> : null}
        </h2>
      </div>

      {looks.length === 0 ? (
        <p className="pnm-sub">nothing yet. show yom a piece and it lands here.</p>
      ) : (
        <ul className="me-looks">
          {looks.map((look) => {
            const saved = lookInLineup(look.id);
            return (
              <li key={look.id}>
                {lookImage(look) ? (
                  <img src={lookImage(look)} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="pnm-thumb empty" />
                )}
                <div className="me-look-copy">
                  <h3>{look.title || wearLabel(look.roundId) || look.product?.name || "look"}</h3>
                  <p className="me-look-meta">
                    {look.score != null ? <span>{Number(look.score).toFixed(1)}/10</span> : null}
                    {saved ? <span>in your lineup</span> : <span>not in your lineup</span>}
                    {whenText(look.at) ? <span>{whenText(look.at)}</span> : null}
                  </p>
                </div>
                {pending === look.id ? (
                  <div className="me-confirm">
                    <button type="button" disabled={busy} onClick={() => removeLook(look.id)}>
                      {busy ? "removing…" : "delete"}
                    </button>
                    <button type="button" className="is-ghost" onClick={() => setPending("")}>
                      keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="me-remove"
                    aria-label="remove this look"
                    onClick={() => setPending(look.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="pnm-section-head">
        <h2>your account</h2>
      </div>

      <section className="me-account">
        <button type="button" className="me-row" onClick={copyLink}>
          <b>use my yom on another device</b>
          <span>copies a link that carries this account</span>
        </button>
        {copied && <p className="pnm-sub pnm-moved">{copied}</p>}
        <Link to="/lineup" className="me-row">
          <b>{pub.is_public ? "sharing is on" : "sharing is off"}</b>
          <span>
            {pub.is_public
              ? "other girls can see your first name and your lineup"
              : "nobody can see your lineup on the everyone board"}
          </span>
        </Link>
        <button type="button" className="me-row is-quiet" onClick={() => setModal("out")}>
          <b>log out on this device</b>
          <span>copy your link first — it is how you get back in</span>
        </button>
      </section>

      {modal === "out" && (
        <div className="pnm-modal-scrim" onClick={() => setModal("")}>
          <div className="pnm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pnm-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
              log out?
            </h2>
            <p className="pnm-sub">
              your looks and your lineup stay on your account. this phone just stops holding it — and the only way back
              in is your yom link, so copy it before you go.
            </p>
            <button type="button" className="pnm-cta" onClick={copyLink}>
              copy my yom link →
            </button>
            {copied && <p className="pnm-sub pnm-moved">{copied}</p>}
            <button type="button" className="pnm-ghost" onClick={signOut}>
              log out anyway
            </button>
            <button type="button" className="pnm-ghost" onClick={() => setModal("")}>
              never mind
            </button>
          </div>
        </div>
      )}

      <YomNav active="me" />
    </div>
  );
}
