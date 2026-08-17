import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { queueLead, startLeadFlush } from "./lib/lead-queue.js";
import { recordScanVisit } from "./lib/capture-lead.js";
import {
  ONBOARDING_VERSION,
  captureAcquisitionFromUrl,
  getAnonId,
  saveAcquisition,
  track,
} from "./lib/analytics.js";
import {
  isYomReady,
  loadJoinEmail,
  loadJoinProfile,
  loadLastCheck,
  markYomReady,
  saveJoinEmail,
  saveJoinProfile,
} from "./lib/join-store.js";
import "./Scan.css";
import "./Share.css";

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

const TRAITS = [
  { id: "impulse", label: "i buy things i never wear" },
  { id: "nothing", label: "i always think i have nothing to wear" },
  { id: "panic", label: "i panic before trips & events" },
  { id: "decide", label: "i spend forever deciding what to buy" },
];

function firstNameOf(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)[0];
}

/**
 * Cohort 1: enter → create yom (name + email) → scan → ask friends
 */
export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = window.location.search || "";
  const wantHome = params.get("home") === "1";

  const [step, setStep] = useState(() => (isYomReady() ? "home" : "create"));
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState(() => loadJoinProfile().name || "");
  const [err, setErr] = useState("");
  const profile = loadJoinProfile();
  const traitLabel = TRAITS.find((t) => t.id === profile.trait)?.label;
  const last = step === "home" ? loadLastCheck() : null;

  useEffect(() => {
    const acq = captureAcquisitionFromUrl(search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    track("landing_viewed", { path: "/join" });
    if (acq.qr) track("qr_scanned", { path: "/join" });
    startLeadFlush();
    recordScanVisit({ email: loadJoinEmail() || undefined, path: "/join", metadata: { funnel: "join" } });

    if (isYomReady() && !wantHome) {
      const next = params.get("next");
      if (next && /^\/s\/[0-9a-f-]{36}$/i.test(next)) {
        navigate(next, { replace: true });
      } else {
        navigate(`/scan${search}`, { replace: true });
      }
    } else if (isYomReady() && wantHome) {
      setStep("home");
    }
  }, [params, navigate, search, wantHome]);

  const qs = (extra = {}) => {
    const q = new URLSearchParams(search);
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const createYom = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("what should yom call you?");
      return;
    }
    if (!isValidEmail(email)) {
      setErr("need a real email.");
      return;
    }
    setErr("");
    const savedEmail = email.trim().toLowerCase();
    const savedName = name.trim();
    saveJoinEmail(savedEmail);
    saveJoinProfile({ name: savedName, trait: profile.trait || "", email: savedEmail });
    track("signup_started", { channel: "join", path: "/join" });
    track("signup_completed", { channel: "join" });
    track("yom_creation_started", { path: "/join", onboarding_version: ONBOARDING_VERSION });
    queueLead({
      email: savedEmail,
      name: savedName,
      channel: "join_create",
      path: "/join",
      metadata: { anon_id: getAnonId() },
    });
    try {
      localStorage.setItem(
        "yom-survey",
        JSON.stringify({
          name: savedName,
          email: savedEmail,
          trait: profile.trait || "",
          preBuy: "",
          read: "",
          headline: "",
          closet: [],
          savedAt: Date.now(),
          onboarding_version: ONBOARDING_VERSION,
        })
      );
    } catch {
      /* ignore */
    }

    markYomReady();
    track("yom_created", { onboarding_version: ONBOARDING_VERSION, channel: "join" });
    const next = params.get("next");
    const shareNext = next && /^\/s\/[0-9a-f-]{36}$/i.test(next) ? next : null;
    navigate(shareNext || `/scan${qs({ from: "join" })}`);
  };

  return (
    <div className="share-page join-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">{step === "home" ? "your profile" : "create your yom"}</p>
      </header>

      {err && <p className="scan-err">{err}</p>}

      {step === "create" && (
        <section className="share-card">
          <h1>create your yom.</h1>
          <p className="scan-body">name + email — then the camera.</p>
          <form className="scan-email-form" onSubmit={createYom} style={{ marginTop: "1rem", flexDirection: "column" }}>
            <label className="join-label" htmlFor="join-name">
              your name
            </label>
            <input
              id="join-name"
              className="scan-email-input"
              placeholder="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              autoFocus
              required
            />
            <label className="join-label" htmlFor="join-email">
              email
            </label>
            <input
              id="join-email"
              type="email"
              className="scan-email-input yom-mask"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
            <button type="submit" className="scan-shutter" style={{ marginTop: "0.35rem", width: "100%" }}>
              create my yom →
            </button>
          </form>
        </section>
      )}

      {step === "home" && (
        <section className="share-card join-profile">
          <h1>{(firstNameOf(profile.name || name) || "you")}’s yom</h1>
          {traitLabel && <p className="join-profile-tag">{traitLabel}</p>}
          {last?.verdict?.title && (
            <div className="join-last">
              {last.preview && (
                <div className="join-last-photo">
                  <img src={last.preview} alt="" />
                </div>
              )}
              <div>
                <p className="scan-meta">
                  last scan
                  {last.product?.name
                    ? ` · ${[last.product.brand, last.product.name].filter(Boolean).join(" ")}`
                    : ""}
                </p>
                <p className="join-last-title">{last.verdict.title}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            className="scan-shutter"
            style={{ marginTop: "1.1rem", width: "100%" }}
            onClick={() => navigate(`/scan${qs({ from: "home" })}`)}
          >
            open camera →
          </button>
        </section>
      )}
    </div>
  );
}
