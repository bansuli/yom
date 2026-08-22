import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import YomNav from "./components/YomNav.jsx";
import { EVERYONE_FILTERS, LINEUP_DAYS, wearLabel } from "./lib/contexts.js";
import { closetLooks, loadPublicState } from "./lib/pipeline-store.js";
import { unlockIfTest } from "./lib/join-store.js";
import { yomEveryone } from "./lib/yom-api.js";
import "./Pipeline.css";

function localFeed() {
  const pub = loadPublicState();
  if (!pub.is_public) return [];
  const name = (pub.display_name || "you").split(/\s+/)[0];
  return closetLooks().map((look) => ({
    id: look.id,
    name,
    title: look.title,
    day_id: look.dayId,
    round_id: look.roundId,
    score: pub.show_ratings === false ? null : look.score,
    image_url: look.preview || "",
    chip: LINEUP_DAYS.find((day) => day.id === look.dayId)?.chip || wearLabel(look.roundId),
  }));
}

export default function ClosetBoard() {
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const [feed, setFeed] = useState(() => localFeed());
  const ready = unlockIfTest();

  useEffect(() => {
    if (!ready) navigate("/join", { replace: true });
  }, [ready, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await yomEveryone();
      if (cancelled) return;
      const remote = res?.ok && Array.isArray(res.looks) ? res.looks : [];
      const mine = localFeed();
      const seen = new Set(remote.map((look) => look.id));
      setFeed([...remote, ...mine.filter((look) => !seen.has(look.id))]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => feed.filter((look) => cat === "all" || look.day_id === cat || look.round_id === cat),
    [feed, cat]
  );

  if (!ready) return null;

  return (
    <div className="pnm-page is-app">
      <header className="pnm-brand-row">
        <Link to="/looks" className="pnm-brand" aria-label="yom">
          yom
        </Link>
      </header>

      <div className="pnm-cats" role="tablist" aria-label="rounds">
        {EVERYONE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cat === item.id ? "on" : ""}
            onClick={() => setCat(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="pnm-sub">nobody’s shared a lineup yet. yours will show here once you make it public.</p>
      ) : (
        <div className="pnm-grid">
          {filtered.map((look) => (
            <figure key={look.id} className="pnm-card">
              {look.image_url ? <img src={look.image_url} alt="" referrerPolicy="no-referrer" /> : <div className="pnm-thumb empty" />}
              <figcaption>
                {look.name || look.title || "look"}
                <span className="pnm-day-score">
                  <i />
                  {look.chip || wearLabel(look.round_id || look.day_id)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <YomNav active="everyone" />
    </div>
  );
}
