import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { captureLead } from "./lib/capture-lead.js";
import { recordScanVisit } from "./lib/capture-lead.js";
import {
  ONBOARDING_VERSION,
  captureAcquisitionFromUrl,
  getAnonId,
  saveAcquisition,
  track,
} from "./lib/analytics.js";
import { isYomReady, loadJoinEmail, markYomReady, saveJoinEmail } from "./lib/join-store.js";
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

/**
 * Cohort 1 funnel: open link → email → create my yom → camera (/scan)
 */
export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = window.location.search || "";

  const [step, setStep] = useState(() => {
    if (isYomReady()) return "done";
    if (loadJoinEmail()) return "create";
    return "email";
  });
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState("");
  const [trait, setTrait] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const acq = captureAcquisitionFromUrl(search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    track("landing_viewed", { path: "/join" });
    if (acq.qr) track("qr_scanned", { path: "/join" });
    recordScanVisit({ email: loadJoinEmail() || undefined, path: "/join", metadata: { funnel: "join" } });

    if (isYomReady()) {
      navigate(`/scan${search}`, { replace: true });
    }
  }, [params, navigate, search]);

  const qs = (extra = {}) => {
    const q = new URLSearchParams(search);
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setErr("need a real email.");
      return;
    }
    setBusy(true);
    setErr("");
    track("signup_started", { channel: "join", path: "/join" });
    const res = await captureLead({
      email: email.trim(),
      name: name || undefined,
      channel: "join",
      path: "/join",
    });
    setBusy(false);
    if (!res.ok && !res.fallback) {
      setErr(res.error || "could not save — try again.");
      return;
    }
    saveJoinEmail(email);
    track("signup_completed", { channel: "join", allowlisted: res.allowlisted });
    setStep("create");
  };

  const createYom = async () => {
    if (!name.trim()) {
      setErr("what should yom call you?");
      return;
    }
    if (!trait) {
      setErr("pick the one that feels most you.");
      return;
    }
    setBusy(true);
    setErr("");
    track("yom_creation_started", { path: "/join", onboarding_version: ONBOARDING_VERSION });
    track("onboarding_answered", { step: "join_trait", trait, onboarding_version: ONBOARDING_VERSION });

    await captureLead({
      email: loadJoinEmail() || email,
      name: name.trim(),
      channel: "join_create",
      path: "/join",
      metadata: { trait, anon_id: getAnonId() },
    });

    try {
      localStorage.setItem(
        "yom-survey",
        JSON.stringify({
          name: name.trim(),
          email: (loadJoinEmail() || email).trim().toLowerCase(),
          trait,
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
    setBusy(false);
    navigate(`/scan${qs({ from: "join" })}`);
  };

  return (
    <div className="share-page join-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">
          {step === "email" && "step 1 · your email"}
          {step === "create" && "step 2 · create your yom"}
          {step === "done" && "you’re in"}
        </p>
      </header>

      <div className="join-steps" aria-hidden="true">
        <span className={step === "email" ? "on" : "done"}>email</span>
        <span className={step === "create" ? "on" : step === "done" ? "done" : ""}>create</span>
        <span>scan</span>
      </div>

      {err && <p className="scan-err">{err}</p>}

      {step === "email" && (
        <section className="share-card">
          <h1>first — your email.</h1>
          <p className="scan-body">so we can save what you check and build your yom.</p>
          <form className="scan-email-form" onSubmit={submitEmail} style={{ marginTop: "1rem", flexDirection: "column" }}>
            <input
              type="email"
              className="scan-email-input yom-mask"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={busy}
              autoFocus
            />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
            <button type="submit" className="scan-shutter" disabled={busy}>
              {busy ? "saving…" : "continue →"}
            </button>
          </form>
        </section>
      )}

      {step === "create" && (
        <section className="share-card">
          <h1>create your yom.</h1>
          <p className="scan-body">two quick things — then the camera unlocks.</p>

          <label className="join-label">your name</label>
          <input
            className="scan-email-input"
            placeholder="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <p className="join-label" style={{ marginTop: "1rem" }}>
            which is most you?
          </p>
          <div className="join-traits">
            {TRAITS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={trait === t.id ? "on" : ""}
                onClick={() => setTrait(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button type="button" className="scan-shutter" style={{ marginTop: "1rem", width: "100%" }} onClick={createYom} disabled={busy}>
            {busy ? "creating…" : "create my yom →"}
          </button>

          <button
            type="button"
            className="scan-secondary"
            style={{ marginTop: "0.5rem", width: "100%" }}
            onClick={() => navigate(`/survey${qs({ next: "/scan", email: loadJoinEmail() || email })}`)}
          >
            take the longer quiz instead
          </button>
        </section>
      )}
    </div>
  );
}
