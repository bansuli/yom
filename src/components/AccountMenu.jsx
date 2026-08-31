import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { defaultAvatarColor } from "../../lib/avatar.js";
import {
  clearBetaSession,
  loadBetaSession,
} from "../lib/yom-api.js";
import { resetAnalytics } from "../lib/analytics.js";
import "./AccountMenu.css";

/**
 * The account corner: an avatar when there is a session, nothing when there is
 * not. Signing in is offered by the navbar, so it is not repeated here.
 */
export default function AccountMenu({ inline = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => loadBetaSession());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // The session is written by the sign-in page and by the Google claim, so
  // re-read it whenever the route changes rather than only on mount.
  useEffect(() => {
    setSession(loadBetaSession());
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const profile = session?.profile || null;
  const user = session?.user || null;
  const signedIn = Boolean(session?.access_token && (profile || user));

  const signOut = () => {
    clearBetaSession();
    resetAnalytics();
    setSession(null);
    setOpen(false);
    navigate("/");
  };

  // Nothing in the corner when signed out. The navbar already carries Sign in,
  // and two of the same link side by side is just clutter.
  if (!signedIn) return null;

  const name = profile?.name || user?.name || "";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || "";
  const color = profile?.avatarColor || defaultAvatarColor(user?.id || email);
  const photo = profile?.avatarUrl || "";

  return (
    <div className={`acct${inline ? " acct-inline" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="acct-avatar"
        style={photo ? { backgroundImage: `url(${photo})` } : { background: color }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name || email}`}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-head">
            <span
              className="acct-avatar acct-avatar-sm"
              style={photo ? { backgroundImage: `url(${photo})` } : { background: color }}
              aria-hidden="true"
            />
            <span className="acct-who">
              <strong>{name || "Your account"}</strong>
              <span>{email || phone}</span>
            </span>
          </div>

          <Link to="/me" className="acct-item" role="menuitem" onClick={() => setOpen(false)}>
            Your profile
          </Link>
          <button type="button" className="acct-item acct-out" role="menuitem" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
