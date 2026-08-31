import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AVATAR_COLORS, defaultAvatarColor } from "../../lib/avatar.js";
import {
  clearBetaSession,
  loadBetaSession,
  saveBetaSession,
  yomProfileUpdate,
} from "../lib/yom-api.js";
import { resetAnalytics } from "../lib/analytics.js";
import "./AccountMenu.css";

/**
 * The account corner: an avatar when there is a session, nothing when there is
 * not. Signing in is offered by the navbar, so it is not repeated here.
 */
export default function AccountMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => loadBetaSession());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  // The session is written by the sign-in page and by the Google claim, so
  // re-read it whenever the route changes rather than only on mount.
  useEffect(() => {
    setSession(loadBetaSession());
    setOpen(false);
    setEditing(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setEditing(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEditing(false);
      }
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

  const pickColor = useCallback(
    async (color) => {
      setBusy(true);
      const res = await yomProfileUpdate(session?.access_token, { avatarColor: color });
      setBusy(false);
      if (!res.ok) return;
      const next = { ...session, user: res.user, profile: res.profile };
      saveBetaSession(next);
      setSession(next);
      setEditing(false);
    },
    [session]
  );

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

  return (
    <div className="acct" ref={wrapRef}>
      <button
        type="button"
        className="acct-avatar"
        style={{ background: color }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name || email}`}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-head">
            <span className="acct-avatar acct-avatar-sm" style={{ background: color }} aria-hidden="true" />
            <span className="acct-who">
              <strong>{name || "Your account"}</strong>
              <span>{email || phone}</span>
            </span>
          </div>

          {editing ? (
            <div className="acct-colors" role="group" aria-label="Avatar colour">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`acct-swatch${c === color ? " on" : ""}`}
                  style={{ background: c }}
                  disabled={busy}
                  aria-label={`Use ${c}`}
                  aria-pressed={c === color}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
          ) : (
            <button type="button" className="acct-item" role="menuitem" onClick={() => setEditing(true)}>
              Change avatar colour
            </button>
          )}

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
