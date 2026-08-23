import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import YomNav from "./components/YomNav.jsx";
import AddToHomeScreen from "./components/AddToHomeScreen.jsx";
import { LINEUP_DAYS, pieceSlotFor, wearLabel } from "./lib/contexts.js";
import { addLookToLineup, loadLooks, lookImage, lookInLineup, loadLineupMap, syncPipeline } from "./lib/pipeline-store.js";
import { unlockIfTest } from "./lib/join-store.js";
import "./Pipeline.css";

function lookDayId(look) {
  if (LINEUP_DAYS.some((day) => day.id === look.dayId)) return look.dayId;
  return "";
}

export default function Looks() {
  const navigate = useNavigate();
  const [looks, setLooks] = useState(() => loadLooks());
  const [lineup, setLineup] = useState(() => loadLineupMap());
  const [placing, setPlacing] = useState(null);
  const ready = unlockIfTest();
  const list = useMemo(() => looks, [looks]);

  useEffect(() => {
    if (!ready) navigate("/join", { replace: true });
  }, [ready, navigate]);

  useEffect(() => {
    if (window.location.hash !== "#looks") return;
    window.requestAnimationFrame(() => {
      document.getElementById("looks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [ready]);

  if (!ready) return null;

  const inLineup = (look) => lookInLineup(look.id, lineup);

  const addToLineup = (look, dayId) => {
    const day = dayId || lookDayId(look);
    if (!day) {
      setPlacing({ lookId: look.id, slot: look.slot || pieceSlotFor(look) });
      return;
    }
    addLookToLineup(look, day, look.slot || pieceSlotFor(look));
    setLooks(loadLooks());
    setLineup(loadLineupMap());
    setPlacing(null);
    syncPipeline();
  };

  return (
    <div className="pnm-page is-app">
      <header className="pnm-brand-row">
        <Link to="/looks" className="pnm-brand">
          yom
        </Link>
      </header>

      <h1 className="pnm-title pnm-home-title">
        show yom what you’re <em>thinking.</em>
      </h1>

      <div className="pnm-actions">
        <button type="button" className="pnm-action" onClick={() => navigate("/scan?mode=photo")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="7" width="17" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 7.2 9.3 4.8h5.4L16 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <circle cx="12" cy="13.2" r="3.1" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          <strong>take a photo</strong>
          <span>use your camera</span>
        </button>
        <button type="button" className="pnm-action" onClick={() => navigate("/scan?mode=upload")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 15.5V6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M8.6 10 12 6.6 15.4 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 16.5v2.2A1.8 1.8 0 0 0 6.8 20.5h10.4a1.8 1.8 0 0 0 1.8-1.8v-2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <strong>upload a photo</strong>
          <span>from your gallery</span>
        </button>
        <button type="button" className="pnm-action" onClick={() => navigate("/scan?mode=link")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 14.2 8.8 15.4a3.2 3.2 0 0 1-4.5-4.5L7.6 7.6a3.2 3.2 0 0 1 4.5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M14 9.8l1.2-1.2a3.2 3.2 0 1 1 4.5 4.5l-3.3 3.3a3.2 3.2 0 0 1-4.5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <strong>paste a link</strong>
          <span>from any store</span>
        </button>
      </div>

      <div className="pnm-section-head" id="looks">
        <h2>
          your looks
          {list.length ? <span className="pnm-count">{list.length}</span> : null}
        </h2>
        <a href="#looks" className="pnm-viewall">
          view all &gt;
        </a>
      </div>

      {list.length === 0 ? (
        <p className="pnm-sub">nothing here yet. show yom an outfit.</p>
      ) : (
        <ul className="pnm-looks">
          {list.map((look) => {
            const saved = inLineup(look);
            return (
              <li key={look.id} className="pnm-look">
                {lookImage(look) ? (
                  <img src={lookImage(look)} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="pnm-thumb empty" />
                )}
                <div>
                  <h3>{look.title || wearLabel(look.roundId) || look.product?.name || "look"}</h3>
                  {look.score != null ? (
                    <p className="pnm-day-score">
                      <i />
                      {Number(look.score).toFixed(1)}/10
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`pnm-mini${saved ? " is-ghost" : ""}`}
                  onClick={() => {
                    if (saved) {
                      navigate("/lineup");
                      return;
                    }
                    addToLineup(look);
                  }}
                >
                  {saved ? "✓ in your lineup" : "add to lineup →"}
                </button>
                {placing?.lookId === look.id && !saved ? (
                  <div className="pnm-chips is-look">
                    {LINEUP_DAYS.map((day) => (
                      <button
                        key={day.id}
                        type="button"
                        className="pnm-chip"
                        onClick={() => addToLineup(look, day.id)}
                      >
                        {day.chip}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AddToHomeScreen when={looks.length > 0} />
      <YomNav active="y" />
    </div>
  );
}
