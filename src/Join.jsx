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

/**
 * Cohort 1 funnel: open link → email → create my yom → camera (/scan)
 * Already joined + ?home=1 → your yom home (from scan “my yom”)
 */
export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = window.location.search || "";
  const wantHome = params.get("home") === "1";

  const [step, setStep] = useState(() => {
    if (isYomReady()) return "home";
    if (loadJoinEmail()) return "create";
    return "email";
  });
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState(() => loadJoinProfile().name || "");
  const [trait, setTrait] = useState(() => loadJoinProfile().trait || "");
  const [err, setErr] = useState("");
  const profile = loadJoinProfile();
  const traitLabel = TRAITS.find((t) => t.id === (trait || profile.trait))?.label;
  const last = step === "home" ? loadLastCheck() : null;

  useEffect(() => {
    const acq = captureAcquisitionFromUrl(search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    track("landing_viewed", { path: "/join" });
    if (acq.qr) track("qr_scanned", { path: "/join" });
    startLeadFlush();
    recordScanVisit({ email: loadJoinEmail() || undefined, path: "/join", metadata: { funnel: "join" } });

    // After create, QR/revisit → camera (or ?next= share unlock). “my yom” uses ?home=1.
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

  const safeNext = () => {
    const next = params.get("next");
    if (next && /^\/s\/[0-9a-f-]{36}$/i.test(next)) return next;
    return null;
  };

  const qs = (extra = {}) => {
    const q = new URLSearchParams(search);
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const submitEmail = (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setErr("need a real email.");
      return;
    }
    setErr("");
    saveJoinEmail(email);
    track("signup_started", { channel: "join", path: "/join" });
    track("signup_completed", { channel: "join" });
    setStep("create");
    queueLead({
      email: email.trim(),
      name: name || undefined,
      channel: "join",
      path: "/join",
    });
  };

  const createYom = () => {
    if (!name.trim()) {
      setErr("what should yom call you?");
      return;
    }
    if (!trait) {
      setErr("pick the one that feels most you.");
      return;
    }
    setErr("");
    track("yom_creation_started", { path: "/join", onboarding_version: ONBOARDING_VERSION });
    track("onboarding_answered", { step: "join_trait", trait, onboarding_version: ONBOARDING_VERSION });

    const savedEmail = (loadJoinEmail() || email).trim().toLowerCase();
    saveJoinProfile({ name: name.trim(), trait, email: savedEmail });
    queueLead({
      email: savedEmail,
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
          email: savedEmail,
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
    navigate(safeNext() || `/scan${qs({ from: "join" })}`);
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
          {step === "home" && "your profile"}
        </p>
      </header>

      {step !== "home" && (
        <div className="join-steps" aria-hidden="true">
          <span className={step === "email" ? "on" : "done"}>email</span>
          <span className={step === "create" ? "on" : ""}>create</span>
          <span>scan</span>
        </div>
      )}

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
              autoFocus
            />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
            <button type="submit" className="scan-shutter">
              continue →
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

          <button type="button" className="scan-shutter" style={{ marginTop: "1rem", width: "100%" }} onClick={createYom}>
            create my yom →
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

      {step === "home" && (
        <section className="share-card join-profile">
          <h1>{(profile.name || name || "you").split(" ")[0]}’s yom</h1>
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
          <button
            type="button"
            className="scan-secondary"
            style={{ marginTop: "0.5rem", width: "100%" }}
            onClick={() => navigate(`/survey${qs({ next: "/scan", email: loadJoinEmail() })}`)}
          >
            deepen your profile
          </button>
        </section>
      )}
    </div>
  );
}
