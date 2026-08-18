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
import {
  BERKELEY_FPR_CONTEXT_ID,
  getContextById,
  initialShoppingContext,
  isBerkeleyRecruitmentContext,
  isOtherContext,
  RECRUITMENT_ROUNDS,
  SHOPPING_CONTEXTS,
} from "./lib/contexts.js";
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
  const fresh = params.get("fresh") === "1";

  const [step, setStep] = useState(() => {
    if (fresh) return "create";
    if (isYomReady()) return "home";
    return "create";
  });
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState(() => loadJoinProfile().name || "");
  const [contextId, setContextId] = useState(() => initialShoppingContext(search));
  const [contextOther, setContextOther] = useState(() => loadJoinProfile().contextOther || "");
  const [roundId, setRoundId] = useState(() => {
    const profile = loadJoinProfile();
    return isBerkeleyRecruitmentContext(profile.context) ? profile.round || "" : "";
  });
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

    if (isYomReady() && !wantHome && !fresh) {
      const next = params.get("next");
      if (next && /^\/s\/[0-9a-f-]{36}$/i.test(next)) {
        navigate(next, { replace: true });
      } else {
        navigate(`/scan${search}`, { replace: true });
      }
    } else if (isYomReady() && wantHome) {
      setStep("home");
    } else if (fresh) {
      setStep("create");
    }
  }, [params, navigate, search, wantHome, fresh]);

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
    if (!contextId) {
      setErr("what are you shopping for?");
      return;
    }
    if (isOtherContext(contextId) && !contextOther.trim()) {
      setErr("tell us what you're shopping for.");
      return;
    }
    setErr("");
    const savedEmail = email.trim().toLowerCase();
    const savedName = name.trim();
    const savedContextOther = isOtherContext(contextId) ? contextOther.trim() : "";
    const resolvedContextId = contextId || "general_shopping";
    const context = getContextById(resolvedContextId);
    const rushRound = isBerkeleyRecruitmentContext(context.id) ? roundId : "";
    saveJoinEmail(savedEmail);
    saveJoinProfile({
      name: savedName,
      trait: profile.trait || "",
      email: savedEmail,
      context: context.id,
      contextOther: savedContextOther,
      round: rushRound,
    });
    const acqPatch = {
      shopping_context: context.id,
      recruitment_round: rushRound || null,
      ...(savedContextOther ? { shopping_context_label: savedContextOther } : {}),
    };
    if (isBerkeleyRecruitmentContext(context.id)) {
      acqPatch.source = context.source;
      acqPatch.campaign = context.campaign;
    }
    saveAcquisition(acqPatch);
    track("context_selected", {
      shopping_context: context.id,
      ...(savedContextOther ? { shopping_context_label: savedContextOther } : {}),
      ...(rushRound ? { recruitment_round: rushRound } : {}),
    });
    track("signup_started", { channel: "join", path: "/join" });
    track("signup_completed", { channel: "join" });
    track("yom_creation_started", { path: "/join", onboarding_version: ONBOARDING_VERSION });
    queueLead({
      email: savedEmail,
      name: savedName,
      channel: "join_create",
      path: "/join",
      metadata: {
        anon_id: getAnonId(),
        shopping_context: context.id,
        ...(savedContextOther ? { shopping_context_label: savedContextOther } : {}),
        ...(rushRound ? { recruitment_round: rushRound } : {}),
      },
    });
    try {
      localStorage.setItem(
        "yom-survey",
        JSON.stringify({
          name: savedName,
          email: savedEmail,
          trait: profile.trait || "",
          context: context.id,
          contextOther: savedContextOther,
          round: rushRound,
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
          <p className="scan-body">it gets to know you and gives you a second opinion on everything you buy.</p>
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
            <label className="join-label" htmlFor="join-context">
              what are you shopping for right now?
            </label>
            <select
              id="join-context"
              className="scan-email-input"
              value={contextId}
              onChange={(e) => {
                const next = e.target.value;
                setContextId(next);
                if (!isBerkeleyRecruitmentContext(next)) setRoundId("");
                if (!isOtherContext(next)) setContextOther("");
              }}
            >
              <option value="">select one</option>
              {SHOPPING_CONTEXTS.map((ctx) => (
                <option key={ctx.id} value={ctx.id}>
                  {ctx.label}
                </option>
              ))}
            </select>
            {isOtherContext(contextId) && (
              <>
                <label className="join-label" htmlFor="join-context-other">
                  what is it?
                </label>
                <input
                  id="join-context-other"
                  className="scan-email-input"
                  placeholder="e.g. wedding guest, internship wardrobe"
                  value={contextOther}
                  onChange={(e) => setContextOther(e.target.value)}
                  required
                />
              </>
            )}
            {isBerkeleyRecruitmentContext(contextId) && (
              <>
                <label className="join-label" htmlFor="join-round">
                  which round are you planning first?
                </label>
                <select
                  id="join-round"
                  className="scan-email-input"
                  value={roundId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRoundId(next);
                    if (next) {
                      track("round_selected", {
                        shopping_context: BERKELEY_FPR_CONTEXT_ID,
                        recruitment_round: next,
                      });
                    }
                  }}
                >
                  <option value="">select a round (optional)</option>
                  {RECRUITMENT_ROUNDS.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.label}
                    </option>
                  ))}
                </select>
              </>
            )}
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
          {isBerkeleyRecruitmentContext(profile.context) && (
            <p className="join-profile-tag">
              uc berkeley sorority recruitment{profile.round ? ` · ${profile.round.replaceAll("_", " ")}` : ""}
            </p>
          )}
          {isOtherContext(profile.context) && profile.contextOther && (
            <p className="join-profile-tag">{profile.contextOther}</p>
          )}
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
