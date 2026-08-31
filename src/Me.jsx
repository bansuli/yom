import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccountPanel from "./components/AccountPanel.jsx";
import { loadBetaSession } from "./lib/yom-api.js";
import "./components/AccountPanel.css";

/**
 * Your account.
 *
 * This used to be the phone app's "you" tab — looks, lineup, the everyone
 * board, a device-transfer link — living inside a 420px shell. Those belong to
 * the scan flow and have their own routes; this page is the account.
 */
export default function Me() {
  const navigate = useNavigate();
  const [session] = useState(() => loadBetaSession());
  const signedIn = Boolean(session?.access_token && (session.profile || session.user));

  useEffect(() => {
    if (!signedIn) navigate("/signin", { replace: true });
  }, [signedIn, navigate]);

  if (!signedIn) return null;

  return (
    <div className="ap-page">
      <header className="ap-page-bar">
        <Link to="/" className="ap-page-back">
          &larr; Home
        </Link>
      </header>
      <AccountPanel />
    </div>
  );
}
