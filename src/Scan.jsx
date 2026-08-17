import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { captureAcquisitionFromUrl, getAnonId, getSurface, loadAcquisition, track } from "./lib/analytics.js";
import { flushLeadQueue } from "./lib/lead-queue.js";
import { recordScanVisit } from "./lib/capture-lead.js";
import { isYomReady, loadJoinEmail, loadJoinProfile, saveLastCheck } from "./lib/join-store.js";
import { loadBetaSession, yomShare } from "./lib/yom-api.js";
import { canNativeShare, newShareId, openSystemShare } from "./lib/share-out.js";
import ShareChannels from "./components/ShareChannels.jsx";
import "./Scan.css";

function compressImage(fileOrBlob, maxEdge = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Product PNGs often have transparent "light" backgrounds; JPEG has no alpha
      // and would otherwise flatten to black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read image"));
    };
    img.src = url;
  });
}

/** Smaller JPEG for Google Sheet / Drive (keeps webhook under size limits). */
function thumbForSheet(dataUrl, maxEdge = 720, quality = 0.55) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve("");
      return;
    }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

function productProps(product, extra = {}) {
  return {
    product_id: product?.sku || product?.name || "",
    brand: product?.brand || "",
    sku: product?.sku || "",
    price: product?.price ?? 0,
    category: product?.category || "",
    retailer: product?.retailer || "in_store",
    identified: Boolean(product?.identified),
    ...extra,
  };
}

function similarPieces(result) {
  const list = result?.similar || result?.product?.similar || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === "string" ? { name: item, why: null } : item))
    .filter((item) => item?.name);
}

const GENERIC_TAKE =
  /versatile|weigh it against|style needs|budget and style|great option|timeless|must-have|without brand|without price|summer option|wardrobe staple|worth considering|could work|strong match|very you|good for your style|consider your|depends on your|a great addition|elevate your/i;

function scrubTake(data) {
  if (!data || typeof data !== "object") return data;
  const product = data.product || {};
  const verdict = data.verdict || {};
  const similar = similarPieces(data);
  const blob = `${verdict.title || ""} ${verdict.body || ""}`;
  const generic = GENERIC_TAKE.test(blob) || /option$/i.test(String(verdict.title || "").trim());
  if (!generic) return data;
  const label = [product.brand, product.name || product.guess].filter(Boolean).join(" ") || "this piece";
  const cousins = similar.map((s) => s.name).filter(Boolean).slice(0, 3);
  const next = product.brand
    ? {
        title: label,
        body: cousins.length
          ? `if it's not this exact style, it's close to ${cousins.join(", ")}.`
          : "named from what we can see. scan the tag to lock the style.",
        resolve: "scan the tag if you want the exact sku.",
        decision_hint: verdict.decision_hint || "save",
        kind: verdict.kind || "neutral",
        stamp: "id",
        quiet: false,
      }
    : {
        title: `looks like ${label}`,
        body: cousins.length
          ? `no brand readable on this shot. closest: ${cousins.join(", ")}. scan the hangtag or insole.`
          : "no brand readable on this shot. scan the hangtag or insole — that's the read.",
        resolve: "scan the price tag next.",
        decision_hint: "save",
        kind: "neutral",
        stamp: "id",
        quiet: false,
      };
  return { ...data, verdict: next };
}

function scanFailMessage(res, data) {
  if (data?.error) return data.error;
  if (res.status === 413) return "photo is too heavy — crop closer and try again.";
  if (res.status === 503) return "yom’s brain is warming up — try again in a moment.";
  if (res.status === 404 || res.status === 405) return "couldn’t reach yom — check your connection.";
  if (res.status === 504 || res.status === 502) return "couldn’t read that photo — try again.";
  return "couldn’t read that photo — try a clearer shot of the piece.";
}

function loadSavedEmail() {
  return loadJoinEmail();
}

function IosShareIcon() {
  return (
    <svg
      className="scan-a2hs-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 15.5V3.8M8.2 7.2 12 3.5l3.8 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11.5v7.2A2.3 2.3 0 0 0 7.3 21h9.4A2.3 2.3 0 0 0 19 18.7v-7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const checkGen = useRef(0);
  const [mode, setMode] = useState("photo");
  const [phase, setPhase] = useState("live");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [decision, setDecision] = useState(null);
  const [email, setEmail] = useState(() => loadSavedEmail());
  const [emailSaved, setEmailSaved] = useState(() => Boolean(loadSavedEmail()));
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [allowed, setAllowed] = useState(() => isYomReady() || Boolean(loadBetaSession()?.access_token));
  const [facing, setFacing] = useState("environment"); // environment = rear, user = front

  useEffect(() => {
    const search = window.location.search || "";
    captureAcquisitionFromUrl(search);
    // Pipeline: link → email → create yom → camera
    if (!isYomReady() && !loadBetaSession()?.access_token) {
      navigate(`/join${search}`, { replace: true });
      return;
    }
    setAllowed(true);
    track("shopping_session_started", { mode: "scan", purpose: "in_store" });
    recordScanVisit({
      email: loadSavedEmail() || undefined,
      metadata: { entry: true },
    });
    void flushLeadQueue();
    return () => {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    };
  }, [navigate]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  const startCam = useCallback(
    async (face = facing) => {
      setErr("");
      try {
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: face },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamReady(true);
      } catch {
        setCamReady(false);
        setErr("camera blocked — use the upload button instead.");
      }
    },
    [facing]
  );

  useEffect(() => {
    if (!allowed || phase !== "live") return;
    startCam(facing);
  }, [allowed, phase]); // eslint-disable-line react-hooks/exhaustive-deps -- recapture when returning to camera

  const flipCam = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setErr("");
    await startCam(next);
    track("camera_flipped", { facing: next, surface: getSurface() });
  };

  const snapFromVideo = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setErr("camera not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    // Match mirrored front-camera preview so the saved shot matches what they saw
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return;
    const dataUrl = await compressImage(blob);
    setPreview(dataUrl);
    stopCam();
    await runCheck(dataUrl);
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      stopCam();
      await runCheck(dataUrl);
    } catch {
      setErr("could not open that photo.");
    }
  };

  const resetLive = async () => {
    checkGen.current += 1;
    setPreview(null);
    setResult(null);
    setDecision(null);
    setErr("");
    setShareUrl("");
    setPhase("live");
  };

  const startScan = async (nextMode) => {
    setMode(nextMode);
    if (phase === "live") return;
    await resetLive();
  };

  const runCheck = async (image) => {
    const shot = image || preview;
    if (!shot) return;
    const gen = ++checkGen.current;
    setPreview(shot);
    setPhase("checking");
    setErr("");
    setResult(null);
    setDecision(null);
    track("product_check_started", {
      input_method: mode,
      surface: getSurface(),
      retailer: "in_store",
    });
    recordScanVisit({
      email: emailSaved ? email : undefined,
      increment_check: true,
    });

    const session = loadBetaSession();
    try {
      const res = await fetch("/api/yom-scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          image: shot,
          input_method: mode,
          surface: getSurface(),
          campaign: loadAcquisition().campaign,
          source: loadAcquisition().source,
          trait: loadJoinProfile().trait || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (gen !== checkGen.current) return;
      if (!res.ok || !data.ok) {
        setErr(scanFailMessage(res, data));
        setPhase("error");
        return;
      }
      const cleaned = scrubTake(data);
      setResult(cleaned);
      setPhase("result");
      const sheetThumb = await thumbForSheet(shot);
      saveLastCheck({
        product: cleaned.product,
        verdict: cleaned.verdict,
        similar: cleaned.similar || cleaned.product?.similar,
        preview: sheetThumb || shot,
        mode,
      });
      const props = productProps(cleaned.product, {
        input_method: mode,
        surface: getSurface(),
        verdict: cleaned.verdict?.title || "",
        confidence: cleaned.product?.confidence,
      });
      track("product_check_completed", props);
      track("product_identified", props);
      track("yom_verdict_viewed", {
        ...props,
        verdict: cleaned.verdict?.title || "",
        kind: cleaned.verdict?.kind,
      });
      const acq = loadAcquisition();
      yomShare({
        action: "save_check",
        anon_id: getAnonId(),
        email: emailSaved ? email : undefined,
        product: cleaned.product,
        verdict: cleaned.verdict,
        input_method: mode,
        surface: getSurface(),
        source: acq.source,
        campaign: acq.campaign,
        image: sheetThumb || undefined,
      });
    } catch {
      if (gen !== checkGen.current) return;
      setErr("network hiccup — try again.");
      setPhase("error");
    }
  };

  const decide = (action) => {
    if (!result?.product || decision) return;
    setDecision(action);
    track(
      "user_decision_recorded",
      productProps(result.product, {
        input_method: mode,
        decision: action,
        surface: getSurface(),
      })
    );
    if (action === "buy") {
      track("purchase_recorded", productProps(result.product, { decision: action, input_method: mode }));
    }
    const acq = loadAcquisition();
    yomShare({
      action: "save_check",
      anon_id: getAnonId(),
      email: emailSaved ? email : undefined,
      product: result.product,
      verdict: result.verdict,
      decision: action,
      input_method: mode,
      surface: getSurface(),
      source: acq.source,
      campaign: acq.campaign,
    });
  };

  const shareWithFriends = async () => {
    if (!result?.product || shareBusy) return;
    track("share_clicked", { surface: getSurface() });

    const existingId = shareUrl ? shareUrl.split("/").pop() : "";
    const id = /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : newShareId();
    const url = `${window.location.origin}/s/${id}`;
    setShareUrl(url);

    if (preview) {
      try {
        const map = JSON.parse(sessionStorage.getItem("yom_share_images") || "{}");
        map[id] = preview.length <= 900_000 ? preview : "";
        sessionStorage.setItem("yom_share_images", JSON.stringify(map));
      } catch {
        /* ignore */
      }
    }

    const acq = loadAcquisition();
    const session = loadBetaSession();
    const create = () =>
      yomShare({
        action: "create",
        id,
        sender_anon_id: getAnonId(),
        sender_email: emailSaved ? email : undefined,
        sender_user_id: session?.user?.id || session?.profile?.id,
        product: result.product,
        verdict: result.verdict,
        decision: decision || undefined,
        source: acq.source,
        campaign: acq.campaign,
      });

    if (canNativeShare()) {
      create().then((res) => {
        if (res?.ok && res.share_id) {
          track("share_created", {
            share_id: res.share_id,
            sender_user_id: session?.user?.id,
            surface: getSurface(),
          });
        }
      });
      const sheet = await openSystemShare({
        product: result.product,
        verdict: result.verdict,
        url,
        imageDataUrl: preview,
      });
      if (sheet.ok) {
        track("share_channel_clicked", { channel: "native", share_id: id, surface: getSurface() });
      }
      return;
    }

    setShareBusy(true);
    const res = await create();
    setShareBusy(false);
    if (!res.ok || !res.share_id) {
      setErr(res.error || "couldn’t create a share link.");
      return;
    }
    track("share_created", {
      share_id: res.share_id,
      sender_user_id: session?.user?.id,
      surface: getSurface(),
    });
  };

  if (!allowed) {
    return (
      <div className="scan-page">
        <header className="scan-top">
          <Link to="/" className="scan-brand">
            yom
          </Link>
          <p className="scan-sub">one sec…</p>
        </header>
      </div>
    );
  }

  const product = result?.product || {};
  const verdict = result?.verdict || {};
  const cousins = similarPieces(result);
  const landed = phase === "result" && result;

  return (
    <div className={`scan-page${landed ? " is-landed" : ""}`}>
      <header className="scan-top">
        <Link
          to={loadBetaSession()?.access_token ? "/beta" : "/join?home=1"}
          className="scan-profile-link"
        >
          my yom
        </Link>
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">
          {landed
            ? "your read"
            : phase === "live"
              ? mode === "tag"
                ? "point at the price tag."
                : "point at the piece."
              : "scan a piece or a price tag."}
        </p>
      </header>

      {!landed && (
      <div
        className={`scan-modes${phase === "error" ? " is-restart" : ""}`}
        role="tablist"
        aria-label="what you’re scanning"
      >
        <button
          type="button"
          className={mode === "photo" ? "on" : ""}
          aria-pressed={mode === "photo"}
          aria-label="scan a piece"
          onClick={() => startScan("photo")}
        >
          piece
        </button>
        <button
          type="button"
          className={mode === "tag" ? "on" : ""}
          aria-pressed={mode === "tag"}
          aria-label="scan a price tag"
          onClick={() => startScan("tag")}
        >
          price tag
        </button>
      </div>
      )}

      {!landed && (
        <div className={`scan-stage${mode === "tag" ? " is-tag" : ""}`}>
          {phase === "live" && (
            <>
              <video
                ref={videoRef}
                className={`scan-video${facing === "user" ? " is-front" : ""}`}
                playsInline
                muted
                autoPlay
              />
              {!camReady && <div className="scan-fallback">waiting on camera…</div>}
              <div className="scan-frame" aria-hidden="true" />
              <button type="button" className="scan-flip" onClick={flipCam} aria-label="Flip camera">
                flip
              </button>
            </>
          )}
          {(phase === "checking" || phase === "error") && preview && (
            <img className="scan-preview" src={preview} alt="" />
          )}
          {phase === "checking" && (
            <div className="scan-overlay">
              <p>looking into this…</p>
            </div>
          )}
        </div>
      )}

      {err && <p className="scan-err">{err}</p>}

      {landed && (
        <section className="scan-landing" aria-live="polite">
          {preview && (
            <div className="scan-landing-photo">
              <img src={preview} alt={product.name || "scanned piece"} />
            </div>
          )}
          <p className="scan-meta">
            {[product.brand, product.name].filter(Boolean).join(" · ") || "this piece"}
            {product.price != null ? ` · $${product.price}` : ""}
            {!product.identified && product.name && product.name !== "this piece" ? " · best guess" : ""}
          </p>
          {product.guess &&
            product.guess.toLowerCase() !== String(product.name || "").toLowerCase() && (
              <p className="scan-guess">looks like {product.guess}</p>
            )}
          <h2>{verdict.title || "checked"}</h2>
          {verdict.body && <p className="scan-body">{verdict.body}</p>}
          {verdict.resolve && <p className="scan-resolve">{verdict.resolve}</p>}
          {cousins.length > 0 && !verdict.quiet && (
            <p className="scan-similar-inline">
              or {cousins.map((item) => item.name).join(" · ")}
            </p>
          )}
          <p className="scan-ask">would you get it?</p>
          <div className="scan-decisions">
            {["buy", "skip", "save"].map((action) => (
              <button
                key={action}
                type="button"
                className={decision === action ? "picked" : ""}
                disabled={Boolean(decision)}
                onClick={() => decide(action)}
              >
                {action}
              </button>
            ))}
          </div>
          {decision && <p className="scan-done">logged · {decision}</p>}
          <button
            type="button"
            className="scan-shutter scan-ask-friends"
            onClick={shareWithFriends}
            disabled={shareBusy}
          >
            {shareBusy ? "making link…" : "ask friends"}
          </button>
          {shareUrl && (
            <ShareChannels
              url={shareUrl}
              product={product}
              verdict={verdict}
              shareId={shareUrl.split("/").pop()}
              surface={getSurface()}
              label="or send via"
            />
          )}
        </section>
      )}

      <footer className="scan-actions">
        {phase === "live" && (
          <>
            <button type="button" className="scan-shutter" onClick={snapFromVideo}>
              capture
            </button>
            <button type="button" className="scan-secondary" onClick={() => fileRef.current?.click()}>
              upload
            </button>
          </>
        )}
        {phase === "error" && (
          <>
            <button type="button" className="scan-shutter" onClick={() => runCheck(preview)}>
              try again
            </button>
            <button type="button" className="scan-secondary" onClick={() => startScan(mode)}>
              retake
            </button>
          </>
        )}
        {landed && (
          <button type="button" className="scan-secondary" onClick={() => startScan(mode)}>
            scan another
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="scan-file"
          onChange={onFile}
        />
      </footer>

      {!landed && (
      <p className="scan-a2hs">
        on iphone:{" "}
        <span className="scan-a2hs-share" aria-label="share">
          <IosShareIcon />
          share
        </span>{" "}
        → add to home screen. yom stays in your pocket.
      </p>
      )}
    </div>
  );
}
