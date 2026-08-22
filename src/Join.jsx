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
  markYomReady,
  saveJoinEmail,
  saveJoinProfile,
  seedTestYom,
} from "./lib/join-store.js";
import { BERKELEY_FPR_CONTEXT_ID, getContextById } from "./lib/contexts.js";
import "./Scan.css";
import "./Share.css";
import "./Pipeline.css";

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = window.location.search || "";
  const fresh = params.get("fresh") === "1";

  const [step, setStep] = useState(() => {
    if (fresh) return "create";
    if (isYomReady()) return "land";
    return "create";
  });
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState(() => loadJoinProfile().name || "");
  const [err, setErr] = useState("");

  useEffect(() => {
    const acq = captureAcquisitionFromUrl(search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    track("landing_viewed", { path: "/join" });
    if (acq.qr) track("qr_scanned", { path: "/join" });
    startLeadFlush();
    recordScanVisit({ email: loadJoinEmail() || undefined, path: "/join", metadata: { funnel: "join" } });

    if (params.get("test") === "1") {
      seedTestYom();
      const dest = params.get("to") || "/looks";
      if (dest.startsWith("/")) navigate(dest, { replace: true });
      return;
    }

    if (isYomReady() && !fresh) {
      const next = params.get("next");
      if (next && /^\/s\/[0-9a-f-]{36}$/i.test(next)) {
        navigate(next, { replace: true });
      } else if (params.get("home") === "1") {
        navigate(`/looks${search}`, { replace: true });
      }
    }
  }, [params, navigate, search, fresh]);

  const qs = (extra = {}) => {
    const q = new URLSearchParams(search);
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  const persistYom = (savedName, savedEmail) => {
    const context = getContextById(BERKELEY_FPR_CONTEXT_ID);
    saveJoinEmail(savedEmail);
    saveJoinProfile({
      name: savedName,
      trait: loadJoinProfile().trait || "",
      email: savedEmail,
      context: context.id,
      contextOther: "",
      round: loadJoinProfile().round || "",
    });
    saveAcquisition({
      shopping_context: context.id,
      source: context.source,
      campaign: context.campaign,
    });
    track("context_selected", { shopping_context: context.id });
    track("signup_started", { channel: "join", path: "/join" });
    track("signup_completed", { channel: "join" });
    track("yom_creation_started", { path: "/join", onboarding_version: ONBOARDING_VERSION });
    queueLead({
      email: savedEmail,
      name: savedName,
      channel: "join_create",
      path: "/join",
      metadata: { anon_id: getAnonId(), shopping_context: context.id },
    });
    try {
      localStorage.setItem(
        "yom-survey",
        JSON.stringify({
          name: savedName,
          email: savedEmail,
          trait: "",
          context: context.id,
          contextOther: "",
          round: "",
          savedAt: Date.now(),
          onboarding_version: ONBOARDING_VERSION,
        })
      );
    } catch {
      /* ignore */
    }
    markYomReady();
    track("yom_created", { onboarding_version: ONBOARDING_VERSION, channel: "join" });
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
    persistYom(name.trim(), email.trim().toLowerCase());
    const next = params.get("next");
    const shareNext = next && /^\/s\/[0-9a-f-]{36}$/i.test(next) ? next : null;
    if (shareNext) {
      navigate(shareNext);
      return;
    }
    setStep("land");
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  };

  const showOutfit = () => {
    if (!isYomReady()) {
      setStep("create");
      return;
    }
    navigate(`/scan${qs({ from: "land" })}`);
  };

  const noOutfitYet = () => {
    if (!isYomReady()) {
      setStep("create");
      return;
    }
    navigate(`/looks${qs({ from: "land" })}`);
  };

  return (
    <div className="pnm-page is-flush">
      <header className="pnm-hero-head">
        <Link to="/" className="pnm-brand">
          yom
        </Link>
        <p className="pnm-kicker">create your yom</p>
      </header>

      {err && <p className="scan-err">{err}</p>}

      {step === "land" && (
        <>
          <h1 className="pnm-title">let’s plan recruitment.</h1>
          <p className="pnm-sub">here’s how yom helps you.</p>
          <div className="pnm-steps">
            <article className="pnm-step">
              <span className="pnm-num">01</span>
              <div>
                <h2>show yom what you’re thinking</h2>
                <p>take a photo, upload one, or paste a link.</p>
              </div>
            </article>
            <article className="pnm-step">
              <span className="pnm-num">02</span>
              <div>
                <h2>get your second opinion</h2>
                <p>yom tells you if it works, which round it’s best for, and what you should change.</p>
              </div>
            </article>
            <article className="pnm-step">
              <span className="pnm-num">03</span>
              <div>
                <h2>build your lineup</h2>
                <p>save your looks for each round and see what other girls going through Berkeley recruitment are planning.</p>
              </div>
            </article>
          </div>
          <button type="button" className="pnm-cta" onClick={showOutfit}>
            show yom an outfit →
          </button>
          <button type="button" className="pnm-ghost" onClick={noOutfitYet}>
            i don’t have an outfit yet →
          </button>
        </>
      )}

      {step === "create" && (
        <form onSubmit={createYom}>
          <h1 className="pnm-title">create your yom.</h1>
          <p className="pnm-sub pnm-lede">
            your second opinion on what to wear for <em>recruitment.</em>
          </p>
          <label className="pnm-field" htmlFor="join-name">
            your name
          </label>
          <input
            id="join-name"
            className="pnm-input"
            placeholder="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            autoFocus
            required
          />
          <label className="pnm-field" htmlFor="join-email">
            email
          </label>
          <input
            id="join-email"
            type="email"
            className="pnm-input yom-mask"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
          <button type="submit" className="pnm-cta" style={{ marginTop: "1.1rem" }}>
            plan my outfits →
          </button>
        </form>
      )}
    </div>
  );
}
