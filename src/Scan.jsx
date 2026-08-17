import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { captureAcquisitionFromUrl, getAnonId, getSurface, loadAcquisition, track } from "./lib/analytics.js";
import { recordScanVisit } from "./lib/capture-lead.js";
import { isYomReady, loadJoinEmail } from "./lib/join-store.js";
import { loadBetaSession, yomShare } from "./lib/yom-api.js";
import ShareChannels from "./components/ShareChannels.jsx";
import "./Scan.css";

function compressImage(fileOrBlob, maxEdge = 1280, quality = 0.72) {
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
    ...extra,
  };
}

function loadSavedEmail() {
  return loadJoinEmail();
}

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
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
    if (!allowed) return;
    startCam(facing);
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps -- start once when unlocked

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
    setPhase("preview");
    stopCam();
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      setPhase("preview");
      stopCam();
    } catch {
      setErr("could not open that photo.");
    }
  };

  const resetLive = async () => {
    setPreview(null);
    setResult(null);
    setDecision(null);
    setErr("");
    setPhase("live");
    await startCam();
  };

  const runCheck = async () => {
    if (!preview) return;
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
          image: preview,
          input_method: mode,
          surface: getSurface(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(data.error || "scan failed — try better light.");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("result");
      const props = productProps(data.product, {
        input_method: mode,
        surface: getSurface(),
        verdict: data.verdict?.title || "",
        confidence: data.product?.confidence,
      });
      track("product_check_completed", props);
      track("product_identified", props);
      track("yom_verdict_viewed", {
        ...props,
        verdict: data.verdict?.title || "",
        kind: data.verdict?.kind,
      });
      const acq = loadAcquisition();
      const sheetThumb = await thumbForSheet(preview);
      yomShare({
        action: "save_check",
        anon_id: getAnonId(),
        email: emailSaved ? email : undefined,
        product: data.product,
        verdict: data.verdict,
        input_method: mode,
        surface: getSurface(),
        source: acq.source,
        campaign: acq.campaign,
        image: sheetThumb || undefined,
      });
    } catch {
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
    setShareBusy(true);
    const acq = loadAcquisition();
    const session = loadBetaSession();
    const sheetThumb = preview ? await thumbForSheet(preview) : "";
    const res = await yomShare({
      action: "create",
      sender_anon_id: getAnonId(),
      sender_email: emailSaved ? email : undefined,
      sender_user_id: session?.user?.id || session?.profile?.id,
      product: result.product,
      verdict: result.verdict,
      decision: decision || undefined,
      source: acq.source,
      campaign: acq.campaign,
      image: sheetThumb || undefined,
    });
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
    if (sheetThumb) {
      try {
        const map = JSON.parse(sessionStorage.getItem("yom_share_images") || "{}");
        map[res.share_id] = sheetThumb;
        sessionStorage.setItem("yom_share_images", JSON.stringify(map));
      } catch {
        /* ignore */
      }
    }
    const url = `${window.location.origin}/s/${res.share_id}`;
    setShareUrl(url);
    // Native sheet after await often fails on iOS (lost tap gesture).
    // Channel buttons below keep Messages / WhatsApp / copy reliable.
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

  return (
    <div className="scan-page">
      <header className="scan-top">
        <Link to="/" className="scan-brand">
          yom
        </Link>
        <p className="scan-sub">point at a piece. get a read.</p>
      </header>

      <div className="scan-modes" role="tablist" aria-label="scan mode">
        <button type="button" className={mode === "photo" ? "on" : ""} onClick={() => setMode("photo")}>
          piece
        </button>
        <button type="button" className={mode === "tag" ? "on" : ""} onClick={() => setMode("tag")}>
          price tag
        </button>
      </div>

      <div className="scan-stage">
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
        {(phase === "preview" || phase === "checking" || phase === "result" || phase === "error") && preview && (
          <img className="scan-preview" src={preview} alt="" />
        )}
        {phase === "checking" && (
          <div className="scan-overlay">
            <p>looking into this…</p>
          </div>
        )}
      </div>

      {err && <p className="scan-err">{err}</p>}

      {phase === "result" && result && (
        <section className="scan-verdict" aria-live="polite">
          <p className="scan-meta">
            {[result.product.brand, result.product.name].filter(Boolean).join(" · ")}
            {result.product.price != null ? ` · $${result.product.price}` : ""}
          </p>
          <h2>{result.verdict.title}</h2>
          <p className="scan-body">{result.verdict.body}</p>
          {result.verdict.resolve && <p className="scan-resolve">{result.verdict.resolve}</p>}
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
          {emailSaved && (
            <p className="scan-done">
              saved as {email}
            </p>
          )}
          <div className="scan-share-row">
            <button type="button" className="scan-shutter" onClick={shareWithFriends} disabled={shareBusy}>
              {shareBusy ? "making link…" : shareUrl ? "new link →" : "ask friends →"}
            </button>
            <Link
              className="scan-secondary"
              to="/join?home=1"
              style={{ padding: "0.75rem 1rem", textDecoration: "none" }}
            >
              my yom
            </Link>
          </div>
          {shareUrl && (
            <ShareChannels
              url={shareUrl}
              product={result.product}
              verdict={result.verdict}
              shareId={shareUrl.split("/").pop()}
              surface={getSurface()}
              label="send via messages, whatsapp, or copy"
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
        {phase === "preview" && (
          <>
            <button type="button" className="scan-shutter" onClick={runCheck}>
              check with yom
            </button>
            <button type="button" className="scan-secondary" onClick={resetLive}>
              retake
            </button>
          </>
        )}
        {(phase === "result" || phase === "error") && (
          <button type="button" className="scan-shutter" onClick={resetLive}>
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

      <p className="scan-a2hs">on iphone: share → add to home screen. yom stays in your pocket.</p>
    </div>
  );
}
