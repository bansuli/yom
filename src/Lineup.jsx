import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import YomNav, { PnmPeople } from "./components/YomNav.jsx";
import { LINEUP_DAYS, LINEUP_PIECES, pieceLabel } from "./lib/contexts.js";
import { loadJoinProfile, unlockIfTest } from "./lib/join-store.js";
import {
  addLookToLineup,
  closetLooks,
  lineupSlots,
  loadLooks,
  loadPublicState,
  lookImage,
  syncPipeline,
  removePieceFromDay,
  savePublicState,
} from "./lib/pipeline-store.js";
import "./Pipeline.css";

export default function Lineup() {
  const navigate = useNavigate();
  const profile = loadJoinProfile();
  const [slots, setSlots] = useState(() => lineupSlots());
  const [pub, setPub] = useState(() => loadPublicState());
  const [modal, setModal] = useState("");
  const [assignDay, setAssignDay] = useState("");
  const [assignSlot, setAssignSlot] = useState("top");
  const [busy, setBusy] = useState(false);
  const closet = useMemo(() => closetLooks(), [slots]);
  const ready = unlockIfTest();

  useEffect(() => {
    if (!ready) navigate("/join", { replace: true });
  }, [ready, navigate]);

  if (!ready) return null;

  const refresh = () => setSlots(lineupSlots());

  const persist = async (nextPublic) => {
    const saved = savePublicState(nextPublic);
    setPub(saved);
    const res = await syncPipeline();
    if (res?.ok && res.lineup_id) savePublicState({ ...saved, id: res.lineup_id });
    return res;
  };

  const makePublic = async () => {
    if (!pub.display_name.trim()) return;
    setBusy(true);
    const parts = pub.display_name.trim().split(/\s+/);
    await persist({
      ...pub,
      display_name: parts[0] || pub.display_name,
      last_name: parts.slice(1).join(" ") || pub.last_name,
      is_public: true,
      sisterhood: true,
    });
    setBusy(false);
    setModal("");
    setPub(loadPublicState());
    navigate("/looks#looks");
  };

  const isPublic = Boolean(pub.is_public);

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

      <h1 className="pnm-title pnm-wear">
        your recruitment
        <em>lineup.</em>
      </h1>

      <div className="pnm-timeline">
        {slots.map((day) => (
          <article key={day.id} className={`pnm-day${day.pieces?.length ? " has-look" : ""}`}>
            <div className="pnm-day-date">
              <b>{day.weekday}</b>
              <span>{day.dateNum}</span>
            </div>
            <div className="pnm-day-card is-pieces">
              <div>
                <div className="pnm-piece-row">
                  {day.pieces?.length ? (
                    day.pieces.map((piece) => (
                      <figure key={`${piece.lookId}-${piece.slot}`} className="pnm-piece">
                        {lookImage(piece.look) ? (
                          <img src={lookImage(piece.look)} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="pnm-thumb empty hanger" aria-hidden="true" />
                        )}
                        <figcaption>{pieceLabel(piece.slot)}</figcaption>
                        <button
                          type="button"
                          className="pnm-piece-x"
                          aria-label={`remove ${pieceLabel(piece.slot)}`}
                          onClick={() => {
                            removePieceFromDay(day.id, piece.lookId);
                            refresh();
                            // Tell the server straight away, or it stays on the
                            // board until she happens to do something else.
                            syncPipeline();
                          }}
                        >
                          ×
                        </button>
                      </figure>
                    ))
                  ) : (
                    <div className="pnm-thumb empty hanger" aria-hidden="true" />
                  )}
                </div>
                <h3>{day.label}</h3>
                {day.pieces?.length ? (
                  <p>
                    {day.pieces.length} piece{day.pieces.length === 1 ? "" : "s"}
                  </p>
                ) : (
                  <p>no pieces yet</p>
                )}
              </div>
              <button
                type="button"
                className="pnm-edit-look"
                onClick={() => {
                  setAssignDay(day.id);
                  setAssignSlot("top");
                  setModal("assign");
                }}
              >
                + add a piece
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* The ask, once. Once she has said yes, sharing is a setting on her
          profile rather than a pitch she has to scroll past every visit. */}
      {isPublic ? null : (
        <section className="pnm-status">
          <div className="pnm-status-row">
            <PnmPeople />
            <div className="pnm-status-copy">
              <h2>wondering what everyone else is wearing?</h2>
              <p>share your lineup to see what other girls at Berkeley are putting together.</p>
            </div>
          </div>
          <button type="button" className="pnm-cta" onClick={() => setModal("public")}>
            make my lineup public →
          </button>
          <p className="pnm-lock">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11" stroke="currentColor" strokeWidth="1.8" />
              <rect x="6" y="11" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            your lineup stays private unless you choose to share it.
          </p>
        </section>
      )}

      {modal === "public" && (
        <div className="pnm-modal-scrim" onClick={() => setModal("")}>
          <div className="pnm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pnm-modal-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <circle cx="9" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="15.5" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M5 18c.8-2.5 2.4-3.8 4.8-3.8S13.8 15.5 14.6 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M13.4 18c.5-1.8 1.7-2.9 3.4-2.9 1.7 0 2.9 1.1 3.4 2.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="pnm-title" style={{ marginTop: 0, fontSize: "1.55rem" }}>
              share your lineup?
            </h2>
            <p className="pnm-sub">
              other girls going through Berkeley recruitment will be able to see your first name and the looks you add
              to your lineup.
            </p>
            <label className="pnm-field" htmlFor="lineup-name" style={{ textAlign: "left" }}>
              your name
            </label>
            <input
              id="lineup-name"
              className="pnm-input"
              value={pub.display_name}
              onChange={(e) => setPub({ ...pub, display_name: e.target.value })}
              placeholder={profile.name || "name"}
            />
            <div className="pnm-toggle">
              <span>show my yom ratings</span>
              <button
                type="button"
                className={`pnm-switch${pub.show_ratings !== false ? " on" : ""}`}
                aria-pressed={pub.show_ratings !== false}
                onClick={() => setPub({ ...pub, show_ratings: pub.show_ratings === false })}
              />
            </div>
            <button type="button" className="pnm-cta" disabled={busy} onClick={makePublic}>
              {busy ? "sharing…" : "make my lineup public →"}
            </button>
            <p className="pnm-sub" style={{ margin: "0.75rem 0 0" }}>
              you can switch this off anytime from your profile.
            </p>
          </div>
        </div>
      )}

      {modal === "assign" && (
        <div className="pnm-modal-scrim" onClick={() => setModal("")}>
          <div className="pnm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pnm-title" style={{ marginTop: 0, fontSize: "1.45rem" }}>
              add a piece
            </h2>
            <p className="pnm-sub">{LINEUP_DAYS.find((d) => d.id === assignDay)?.label}</p>
            <div className="pnm-chips">
              {LINEUP_PIECES.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  className={`pnm-chip${assignSlot === piece.id ? " on" : ""}`}
                  onClick={() => setAssignSlot(piece.id)}
                >
                  {piece.label}
                </button>
              ))}
            </div>
            {closet.length === 0 && loadLooks().length === 0 ? (
              <p className="pnm-sub">show yom a piece first.</p>
            ) : (
              <div className="pnm-pick">
                {(closet.length ? closet : loadLooks()).map((look) => (
                  <button
                    key={look.id}
                    type="button"
                    onClick={() => {
                      addLookToLineup(look, assignDay, assignSlot);
                      refresh();
                      setModal("");
                    }}
                  >
                    {look.title || look.product?.name || "look"}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="pnm-cta"
              onClick={() => navigate(`/scan?day=${assignDay}`)}
            >
              show yom a new piece →
            </button>
            <button type="button" className="pnm-ghost" onClick={() => setModal("")}>
              never mind
            </button>
          </div>
        </div>
      )}

      <YomNav active="lineup" />
    </div>
  );
}
