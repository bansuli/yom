import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AVATAR_COLORS, defaultAvatarColor, initialsOf } from "../../lib/avatar.js";
import {
  clearBetaSession,
  loadBetaSession,
  saveBetaSession,
  yomAccountDelete,
  yomMe,
  yomProfileUpdate,
} from "../lib/yom-api.js";
import { resetAnalytics } from "../lib/analytics.js";
import "./AccountPanel.css";

const PROVIDER_LABEL = {
  google: "Google",
  phone: "a phone number",
  email: "email and password",
};

/** One editable line: label, value, and an inline field when you click Edit. */
function Field({ label, value, placeholder, multiline, onSave, max }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);

  const save = async () => {
    setBusy(true);
    const ok = await onSave(draft.trim());
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="ap-field">
      <span className="ap-label">{label}</span>
      {editing ? (
        <div className="ap-edit">
          {multiline ? (
            <textarea
              value={draft}
              maxLength={max}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={draft}
              maxLength={max}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
          )}
          <div className="ap-edit-row">
            <button type="button" className="ap-btn" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="ap-btn ap-btn-quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="ap-value">
          <span className={value ? "" : "ap-empty"}>{value || placeholder}</span>
          <button type="button" className="ap-edit-link" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The account, for someone who is signed in: who they are, what yom knows,
 * and the two things every account needs a way to do — change it, and leave.
 */
export default function AccountPanel() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => loadBetaSession());
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // The stored session is whatever the last page wrote. Re-fetch so the page
  // shows the account as it actually is, not as it was at sign-in.
  useEffect(() => {
    const stored = loadBetaSession();
    if (!stored?.access_token) return;
    let cancelled = false;
    yomMe(stored.access_token).then((res) => {
      if (cancelled || !res.ok || !res.profile) return;
      const next = { ...stored, user: res.user, profile: res.profile };
      saveBetaSession(next);
      setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = session?.profile || null;
  const user = session?.user || null;
  if (!session?.access_token || !(profile || user)) return null;

  const name = profile?.name || user?.name || "";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || "";
  const color = profile?.avatarColor || defaultAvatarColor(user?.id || email);
  const initials = initialsOf(name, email);
  const provider = PROVIDER_LABEL[profile?.provider] || "";

  const patch = async (body) => {
    setErr("");
    const res = await yomProfileUpdate(session.access_token, body);
    if (!res.ok) {
      setErr(res.error || "Couldn't save that.");
      return false;
    }
    const next = { ...session, user: res.user, profile: res.profile };
    saveBetaSession(next);
    setSession(next);
    return true;
  };

  const doDelete = async () => {
    setDeleting(true);
    setErr("");
    const res = await yomAccountDelete(session.access_token);
    setDeleting(false);
    if (!res.ok) {
      setErr(res.error || "Couldn't delete the account.");
      return;
    }
    clearBetaSession();
    resetAnalytics();
    navigate("/");
  };

  const signOut = () => {
    clearBetaSession();
    resetAnalytics();
    navigate("/");
  };

  return (
    <section className="ap">
      <header className="ap-head">
        <span className="ap-avatar" style={{ background: color }} aria-hidden="true">
          {initials}
        </span>
        <div className="ap-ident">
          <h1>{name || "Your account"}</h1>
          <p>
            {email || phone}
            {provider ? ` · signed up with ${provider}` : ""}
          </p>
        </div>
      </header>

      {err ? <p className="ap-err">{err}</p> : null}

      <div className="ap-block">
        <h2>You</h2>
        <Field
          label="Name"
          value={name}
          max={80}
          placeholder="No name yet"
          onSave={(v) => patch({ name: v })}
        />
        <div className="ap-field">
          <span className="ap-label">Avatar</span>
          <div className="ap-swatches" role="group" aria-label="Avatar colour">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`ap-swatch${c === color ? " on" : ""}`}
                style={{ background: c }}
                aria-label={`Use ${c}`}
                aria-pressed={c === color}
                onClick={() => patch({ avatarColor: c })}
              />
            ))}
          </div>
        </div>
        {email ? (
          <div className="ap-field">
            <span className="ap-label">Email</span>
            <div className="ap-value">
              <span>{email}</span>
            </div>
          </div>
        ) : null}
        {phone ? (
          <div className="ap-field">
            <span className="ap-label">Phone</span>
            <div className="ap-value">
              <span>{phone}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="ap-block">
        <h2>What yom knows</h2>
        <p className="ap-note">
          These came from onboarding. Change them whenever they stop being true — the
          advice follows them.
        </p>
        <Field
          label="Sounds most like you"
          value={profile?.trait || ""}
          max={60}
          placeholder="Not set"
          onSave={(v) => patch({ trait: v })}
        />
        <Field
          label="Before you buy"
          value={profile?.preBuy || ""}
          max={60}
          placeholder="Not set"
          onSave={(v) => patch({ preBuy: v })}
        />
        <Field
          label="Headline"
          value={profile?.headline || ""}
          max={160}
          multiline
          placeholder="Not set"
          onSave={(v) => patch({ headline: v })}
        />
      </div>

      <div className="ap-block ap-danger">
        <h2>Account</h2>
        <div className="ap-actions">
          <button type="button" className="ap-btn ap-btn-quiet" onClick={signOut}>
            Sign out
          </button>
          {!confirming ? (
            <button type="button" className="ap-btn ap-btn-danger" onClick={() => setConfirming(true)}>
              Delete account
            </button>
          ) : null}
        </div>

        {confirming ? (
          <div className="ap-confirm">
            <p>
              This deletes your account, your closet, your saved pieces and everything
              yom has learned about you. It cannot be undone.
            </p>
            <label htmlFor="ap-confirm-input">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="ap-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
            <div className="ap-edit-row">
              <button
                type="button"
                className="ap-btn ap-btn-danger"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={doDelete}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
              <button
                type="button"
                className="ap-btn ap-btn-quiet"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
