import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { defaultAvatarColor } from "../../lib/avatar.js";
import { loadBetaSession } from "../lib/yom-api.js";
import "./AccountMenu.css";

/**
 * The account corner: your avatar when there is a session, nothing when there
 * is not.
 *
 * It goes straight to the profile. Signing out, the avatar, the answers and
 * deleting the account all live there now, so a dropdown in between would only
 * be a list of links to one page.
 */
export default function AccountMenu({ inline = false }) {
  const { pathname } = useLocation();
  const [session, setSession] = useState(() => loadBetaSession());

  // Written by the sign-in page and by the Google claim, so re-read it on each
  // route change rather than only on mount.
  useEffect(() => {
    setSession(loadBetaSession());
  }, [pathname]);

  const profile = session?.profile || null;
  const user = session?.user || null;
  if (!session?.access_token || !(profile || user)) return null;

  const name = profile?.name || user?.name || "";
  const email = profile?.email || user?.email || "";
  const color = profile?.avatarColor || defaultAvatarColor(user?.id || email);
  const photo = profile?.avatarUrl || "";

  return (
    <Link
      to="/me"
      className={`acct-avatar${inline ? " acct-inline" : ""}`}
      style={photo ? { backgroundImage: `url(${photo})` } : { background: color }}
      aria-label={name ? `Your profile, ${name}` : "Your profile"}
    />
  );
}
