import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { captureAcquisitionFromUrl, saveAcquisition, track } from "./lib/analytics.js";
import "./Scan.css";
import "./Share.css";

/**
 * Create-your-yom entry: capture referral from share links, then send to survey.
 */
export default function Create() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const acq = captureAcquisitionFromUrl(window.location.search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    const shareId = params.get("share_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    track("yom_creation_started", {
      path: "/create",
      share_id: shareId || undefined,
      referrer_user_id: ref || acq.referrer_user_id || undefined,
    });
    if (shareId) track("referred_signup_started", { share_id: shareId });
  }, [params]);

  return (
    <div className="share-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">create your yom in a minute.</p>
      </header>

      <section className="share-card">
        <h1>we’ll remember how you shop.</h1>
        <p className="scan-body">
          answer a few questions, drop your email, then scan pieces in-store or online. everything lands on one profile.
        </p>
      </section>

      <div className="share-done" style={{ marginTop: "1.25rem" }}>
        <button
          type="button"
          className="scan-shutter share-cta"
          onClick={() => navigate(`/survey${window.location.search || ""}`)}
        >
          start creating →
        </button>
        <Link className="scan-secondary share-cta-secondary" to={`/beta${window.location.search || ""}`}>
          already have an email on the list? make an account
        </Link>
        <Link className="scan-secondary share-cta-secondary" to={`/scan${window.location.search || ""}`}>
          skip to scan
        </Link>
      </div>
    </div>
  );
}
