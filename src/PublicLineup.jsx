import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { yomGetLineup } from "./lib/yom-api.js";
import "./Pipeline.css";

export default function PublicLineup() {
  const { lineupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [lineup, setLineup] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await yomGetLineup(lineupId);
      if (cancelled) return;
      if (res?.ok && res.lineup) setLineup(res.lineup);
      else setErr(res?.error || "this lineup isn’t public.");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [lineupId]);

  return (
    <div className="pnm-page is-flush">
      <header>
        <Link to="/" className="pnm-brand">
          yom
        </Link>
        <p className="pnm-kicker">a recruitment lineup</p>
      </header>
      {loading && <p className="pnm-sub">loading…</p>}
      {err && <p className="scan-err">{err}</p>}
      {lineup && (
        <>
          <h1 className="pnm-title">{lineup.name}’s top picks.</h1>
          <p className="pnm-sub">houses stay private. these are the looks they’re most sure about.</p>
          <div className="pnm-grid">
            {(lineup.picks || []).map((pick) => (
              <figure key={pick.id} className="pnm-card">
                {pick.image_url ? <img src={pick.image_url} alt="" /> : <div className="pnm-thumb empty" />}
                <figcaption>
                  {pick.title || "look"}
                  {pick.round_id ? <span>{String(pick.round_id).replaceAll("_", " ")}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
          <Link to="/join?fresh=1" className="pnm-cta" style={{ marginTop: "1.2rem" }}>
            create your yom →
          </Link>
        </>
      )}
    </div>
  );
}
