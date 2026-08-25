import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { queueLead, startLeadFlush } from "./lib/lead-queue.js";
import { yomRestore } from "./lib/yom-api.js";
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
import { addByHandText, armTransferKey, disarmTransferKey, hasAdded, markAdded } from "./lib/a2hs.js";
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

  const [step, setStep] = useState(() => (fresh ? "create" : "land"));
  const [afterJoin, setAfterJoin] = useState("");
  const [email, setEmail] = useState(() => loadJoinEmail());
  const [name, setName] = useState(() => loadJoinProfile().name || "");
  const [err, setErr] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState("");
  // Step four. Her yom lives in this browser, so this is the step that decides
  // whether she still has it on wednesday — she does not get past it.
  const [added, setAdded] = useState(() => hasAdded());
  const [howTo, setHowTo] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      markAdded();
      setAdded(true);
      track("home_screen_added", { how: "prompt" });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => () => disarmTransferKey(), []);

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
    if (added && afterJoin === "lineup") {
      navigate(`/lineup${qs({ from: "land" })}`);
      return;
    }
    if (added && afterJoin === "scan") {
      navigate(`/scan${qs({ from: "land" })}`);
      return;
    }
    setStep("land");
    try {
      window.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  };

  // A new phone has none of her looks, and her old browser held the only key.
  // Mail it to the address already on the account — the one place we know is hers.
  const restore = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!isValidEmail(email)) {
      setErr("type the email you joined with first.");
      return;
    }
    setErr("");
    setRestoring(true);
    const res = await yomRestore(email.trim().toLowerCase());
    setRestoring(false);
    setRestored(
      res?.ok
        ? "check your email — tap the link on this phone and you’re in."
        : res?.status === 503 || /set up/i.test(res?.error || "")
          ? "email login isn’t on yet. your yom is still on the phone you made it on — open it there and everything’s where you left it."
          : "couldn’t send that right now — try again in a minute."
    );
  };

  // The key rides in the url while she installs: safari saves the address that
  // is showing, and the installed app opens holding her account.
  const addToHome = async () => {
    armTransferKey();
    track("home_screen_offered", { path: "/join" });
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      if (choice?.outcome === "accepted") {
        markAdded();
        setAdded(true);
        track("home_screen_added", { how: "prompt" });
        return;
      }
      disarmTransferKey();
      return;
    }
    setHowTo(true);
  };

  const confirmAdded = () => {
    markAdded();
    setAdded(true);
    disarmTransferKey();
    track("home_screen_added", { how: "by_hand" });
  };

  const goFromLand = (dest) => {
    if (!isYomReady()) {
      setAfterJoin(dest);
      setErr("");
      setStep("create");
      try {
        window.scrollTo(0, 0);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!added) return;
    // "i don't have an outfit yet" used to mean /looks, which is the scanner
    // now — so both buttons landed on the same page. Someone with nothing yet
    // wants the week laid out, not a camera.
    navigate(dest === "lineup" ? `/lineup${qs({ from: "land" })}` : `/scan${qs({ from: "land" })}`);
  };

  return (
    <div className="pnm-page is-flush">
      <header className="pnm-hero-head">
        <Link to="/" className="pnm-brand">
          yom
        </Link>
        <p className="pnm-kicker">
          {step === "login" ? "welcome back" : step === "land" ? "berkeley recruitment" : "create your yom"}
        </p>
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
            <article className={`pnm-step${added ? " is-done" : ""}`}>
              <span className="pnm-num">04</span>
              <div>
                <h2>{added ? "yom is on your home screen" : "put yom on your home screen"}</h2>
                <p>
                  {added
                    ? "open it from there and your lineup is always one tap away."
                    : howTo
                      ? addByHandText()
                      : "your yom lives on this phone. this is what keeps it — and gets you back in one tap all week."}
                </p>
                {added ? null : howTo ? (
                  <button type="button" className="pnm-step-do" onClick={confirmAdded}>
                    i added it →
                  </button>
                ) : (
                  <button type="button" className="pnm-step-do" onClick={addToHome}>
                    add yom →
                  </button>
                )}
              </div>
            </article>
          </div>
          <button
            type="button"
            className="pnm-cta"
            disabled={isYomReady() && !added}
            onClick={() => goFromLand("scan")}
          >
            show yom an outfit →
          </button>
          <button
            type="button"
            className="pnm-ghost"
            disabled={isYomReady() && !added}
            onClick={() => goFromLand("lineup")}
          >
            i don’t have an outfit yet →
          </button>
          {isYomReady() && !added ? (
            <p className="pnm-gate">add yom to your home screen first — step 04.</p>
          ) : null}
          {isYomReady() ? null : (
            <button
              type="button"
              className="pnm-ghost"
              onClick={() => {
                setErr("");
                setRestored("");
                setStep("login");
              }}
            >
              already have a yom? log in →
            </button>
          )}
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
          <button
            type="button"
            className="pnm-ghost"
            onClick={() => {
              setErr("");
              setRestored("");
              setStep("login");
            }}
          >
            already have a yom? log in →
          </button>
          {fresh ? null : (
            <button
              type="button"
              className="pnm-ghost"
              onClick={() => {
                setErr("");
                setStep("land");
              }}
            >
              ← back
            </button>
          )}
        </form>
      )}

      {step === "login" && (
        <form onSubmit={restore}>
          <h1 className="pnm-title">log in.</h1>
          <p className="pnm-sub pnm-lede">
            your looks, your rounds, your <em>lineup.</em>
          </p>
          <label className="pnm-field" htmlFor="login-email">
            email
          </label>
          <input
            id="login-email"
            type="email"
            className="pnm-input yom-mask"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
          {restored && <p className="pnm-sub pnm-moved">{restored}</p>}
          <button type="submit" className="pnm-cta" disabled={restoring} style={{ marginTop: "1.1rem" }}>
            {restoring ? "one sec…" : "log in →"}
          </button>
          <button
            type="button"
            className="pnm-ghost"
            onClick={() => {
              setErr("");
              setRestored("");
              setStep("create");
            }}
          >
            ← back
          </button>
        </form>
      )}
    </div>
  );
}
