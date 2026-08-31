import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AVATAR_COLORS, defaultAvatarColor } from "../../lib/avatar.js";
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
  email: "email",
};

/** An attribute with an inline editor behind an Edit link. */
function Attr({ label, value, placeholder, multiline, max, onSave }) {
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
    <div className="ap-attr">
      <div className="ap-attr-top">
        <span className="ap-attr-label">{label}</span>
        {!editing ? (
          <button type="button" className="ap-link" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="ap-edit">
          {multiline ? (
            <textarea value={draft} maxLength={max} rows={3} onChange={(e) => setDraft(e.target.value)} autoFocus />
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
          <div className="ap-row">
            <button type="button" className="ap-btn" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="ap-btn ap-btn-quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={`ap-attr-value${value ? "" : " ap-empty"}`}>{value || placeholder}</p>
      )}
    </div>
  );
}

export default function AccountPanel() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => loadBetaSession());
  const [err, setErr] = useState("");
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Show the account as it is now, not as it was when the session was stored.
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
  const first = String(name || "").trim().split(/\s+/)[0] || "your";
  const provider = PROVIDER_LABEL[profile?.provider] || "";

  const closet = profile?.purchases || [];
  const saved = profile?.saved || [];
  const outcomes = profile?.outcomes || [];
  const sizes = profile?.sizes || [];
  const style = profile?.style || [];

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
    <div className="ap">
      {/* ── Hero ── */}
      <div className="ap-hero">
        <span className="ap-face" style={{ background: color }} aria-hidden="true" />
        <button type="button" className="ap-chip" onClick={() => setPicking((v) => !v)}>
          {picking ? "Done" : "Change colour"}
        </button>
        {picking ? (
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
        ) : null}
        <h1 className="ap-title">{first}&rsquo;s yom</h1>
        <p className="ap-sub">
          {email || phone}
          {provider ? ` · joined with ${provider}` : ""}
        </p>
      </div>

      {err ? <p className="ap-err">{err}</p> : null}

      {/* ── Style DNA ── */}
      <section className="ap-section ap-split">
        <div className="ap-head-col">
          <h2>Your style DNA</h2>
          <p className="ap-lede">
            yom learns from what you scan, what you keep and what you send back, and
            tunes its advice to you. This is what it has so far.
          </p>
        </div>
        <div>
        <div className="ap-you">
          <span className="ap-you-eyebrow">You are</span>
          <p className="ap-you-name">{profile?.headline || profile?.trait || "Still working it out"}</p>
          <p className="ap-you-body">
            {profile?.read ||
              profile?.memory ||
              "Take yom on a few more trips and this fills itself in."}
          </p>
        </div>

        <div className="ap-grid">
          <Attr
            label="Sounds most like you"
            value={profile?.trait || ""}
            placeholder="Not set yet"
            max={60}
            onSave={(v) => patch({ trait: v })}
          />
          <Attr
            label="Before you buy"
            value={profile?.preBuy || ""}
            placeholder="Not set yet"
            max={60}
            onSave={(v) => patch({ preBuy: v })}
          />
          <Attr
            label="Headline"
            value={profile?.headline || ""}
            placeholder="Not set yet"
            max={160}
            multiline
            onSave={(v) => patch({ headline: v })}
          />
          <Attr
            label="Name"
            value={name}
            placeholder="No name yet"
            max={80}
            onSave={(v) => patch({ name: v })}
          />
        </div>
        </div>
      </section>

      {/* ── Numbers ── */}
      <section className="ap-section ap-split">
        <div className="ap-head-col">
          <h2>Your closet</h2>
        </div>
        <div>
        <div className="ap-stats">
          <div className="ap-stat">
            <strong>{closet.length}</strong>
            <span>{closet.length === 1 ? "piece" : "pieces"}</span>
          </div>
          <div className="ap-stat">
            <strong>{saved.length}</strong>
            <span>saved</span>
          </div>
          <div className="ap-stat">
            <strong>{outcomes.length}</strong>
            <span>{outcomes.length === 1 ? "decision" : "decisions"}</span>
          </div>
        </div>
        {closet.length === 0 && saved.length === 0 ? (
          <p className="ap-lede">Nothing in here yet. Scan a piece and it starts filling up.</p>
        ) : null}
        </div>
      </section>

      {(sizes.length > 0 || style.length > 0) && (
        <section className="ap-section ap-split">
          <div className="ap-head-col">
            <h2>Fit and taste</h2>
          </div>
          <div>
          {sizes.length > 0 ? (
            <div className="ap-tags">
              {sizes.map((s) => (
                <span key={s.label} className="ap-tag">
                  {s.label} <strong>{s.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
          {style.length > 0 ? (
            <div className="ap-tags">
              {style.map((s) => (
                <span key={String(s)} className="ap-tag">
                  {String(s)}
                </span>
              ))}
            </div>
          ) : null}
          </div>
        </section>
      )}

      {/* ── Account ── */}
      <section className="ap-section ap-split ap-danger">
        <div className="ap-head-col">
          <h2>Account</h2>
        </div>
        <div>
        <div className="ap-row">
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
              This deletes your account, your closet, your saved pieces and everything yom
              has learned about you. It cannot be undone.
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
            <div className="ap-row">
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
    </div>
  );
}
