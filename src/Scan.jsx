import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import YomNav from "./components/YomNav.jsx";
import AddToHomeScreen from "./components/AddToHomeScreen.jsx";
import { captureAcquisitionFromUrl, getAnonId, getSurface, loadAcquisition, track } from "./lib/analytics.js";
import { flushLeadQueue } from "./lib/lead-queue.js";
import { recordScanVisit } from "./lib/capture-lead.js";
import { isYomReady, loadJoinEmail, loadJoinProfile, loadLastCheck, saveJoinProfile, saveLastCheck, unlockIfTest } from "./lib/join-store.js";
import { appendScanHistory, formatScanHistoryForPrompt } from "./lib/scan-history.js";
import { loadBetaSession, yomLinkPreview, yomShare } from "./lib/yom-api.js";
import { canNativeShare, newShareId, openSystemShare } from "./lib/share-out.js";
import { enrichScanTake } from "./lib/scan-details.js";
import { claimGoogleGrant, loadGoogleState } from "./lib/google-session.js";
import { LINEUP_DAYS, LINEUP_PIECES, guessDayForRound, pieceLabel, pieceSlotFor, wearLabel } from "./lib/contexts.js";
import { addLookToLineup, loadLooks, lookFromScan, syncPipeline, upsertLook } from "./lib/pipeline-store.js";
import { thumbFrom as thumbForSheet } from "./lib/image.js";
import { cleanProductUrl, guessListingImage, noteFromProductUrl } from "./lib/product-link.js";
import { reportError } from "./lib/report-error.js";
import { capRunningTrainerVerdict, emptyClothingVerdict, isNonClothingScan } from "./lib/scan-score.js";
import "./Scan.css";
import "./Pipeline.css";

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
  if (!data || typeof data !== "object") return enrichScanTake(data);
  const product = data.product || {};
  const rawVerdict = data.verdict || {};
  if (isNonClothingScan(product, rawVerdict)) {
    return enrichScanTake({ ...data, verdict: emptyClothingVerdict(), similar: [] });
  }
  const verdict = capRunningTrainerVerdict(product, rawVerdict);
  const similar = similarPieces(data);
  const blob = `${verdict.title || ""} ${verdict.body || ""}`;
  const generic = GENERIC_TAKE.test(blob) || /option$/i.test(String(verdict.title || "").trim());
  if (!generic) return enrichScanTake({ ...data, verdict });
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
  return enrichScanTake({
    ...data,
    verdict: capRunningTrainerVerdict(product, { ...verdict, ...next }),
  });
}

function scanFailMessage(res, data) {
  reportError({
    kind: "scan_failed",
    message: data?.error || `scan failed (${res.status})`,
    status: res.status,
    path: "/scan",
  });
  if (data?.error) return data.error;
  if (res.status === 413) return "photo is too heavy — crop closer and try again.";
  if (res.status === 503) return "yom’s brain is warming up — try again in a moment.";
  if (res.status === 404 || res.status === 405) return "couldn’t reach yom — check your connection.";
  if (res.status === 504 || res.status === 502) return "couldn’t read that — try again.";
  return "couldn’t read that — try a clearer photo, another link, or a shorter description.";
}

function asHttpLink(raw) {
  return cleanProductUrl(raw);
}

function loadSavedEmail() {
  return loadJoinEmail();
}

export default function Scan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const camFileRef = useRef(null);
  const checkGen = useRef(0);
  const [mode, setMode] = useState(() => {
    const m = params.get("mode");
    return m === "tag" || m === "link" || m === "text" ? m : "photo";
  });
  const [phase, setPhase] = useState("think");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [decision, setDecision] = useState(null);
  const [email, setEmail] = useState(() => loadSavedEmail());
  const [emailSaved, setEmailSaved] = useState(() => Boolean(loadSavedEmail()));
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [friendVotes, setFriendVotes] = useState([]);
  const [allowed, setAllowed] = useState(
    () => unlockIfTest() || isYomReady() || Boolean(loadBetaSession()?.access_token)
  );
  const [facing, setFacing] = useState("environment"); // environment = rear, user = front
  const [googleEvents, setGoogleEvents] = useState([]);
  const [occasion, setOccasion] = useState(() => loadJoinProfile().occasion || "");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState(12);
  const [closetSaved, setClosetSaved] = useState(false);
  const [pickDay, setPickDay] = useState(() => params.get("day") || "");
  const [pickSlot, setPickSlot] = useState("");
  const [lookId, setLookId] = useState("");

  useEffect(() => {
    if (!result) return;
    const guessed = guessDayForRound(result.verdict?.round);
    setPickDay((prev) => prev || guessed?.id || "");
    setPickSlot((prev) => prev || pieceSlotFor({ product: result.product, title: result.product?.name, note }));
  }, [result, note]);

  useEffect(() => {
    const search = window.location.search || "";
    captureAcquisitionFromUrl(search);
    // Pipeline: link → email → create yom → camera
    if (!unlockIfTest(search) && !loadBetaSession()?.access_token) {
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
    const params = new URLSearchParams(search);
    const grant = params.get("grant");
    const startMode = params.get("mode");
    if (startMode === "photo") setPhase("live");
    if (startMode === "upload") {
      window.setTimeout(() => fileRef.current?.click(), 80);
    }
    if (startMode === "link" || startMode === "text") setMode(startMode);
    (async () => {
      if (grant) await claimGoogleGrant(grant);
      const g = await loadGoogleState();
      setGoogleEvents(g.events || []);
    })();
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
    if (phase !== "checking") {
      setProgress(12);
      return;
    }
    setProgress(16);
    const ticks = [24, 36, 48, 58, 68, 76, 84];
    let i = 0;
    const timer = window.setInterval(() => {
      setProgress(ticks[Math.min(i, ticks.length - 1)]);
      i += 1;
    }, 700);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!allowed || phase !== "live") return;
    startCam(facing);
  }, [allowed, phase]); // eslint-disable-line react-hooks/exhaustive-deps -- recapture when returning to camera

  const activeShareId = shareUrl ? shareUrl.split("/").pop() : "";

  const persistShareId = (id) => {
    try {
      sessionStorage.setItem("yom_active_share_id", id);
    } catch {
      /* ignore */
    }
    const last = loadLastCheck();
    if (last) saveLastCheck({ ...last, share_id: id });
  };

  useEffect(() => {
    if (phase !== "result") return;
    if (shareUrl) return;
    try {
      const stored = sessionStorage.getItem("yom_active_share_id");
      const id =
        stored && /^[0-9a-f-]{36}$/i.test(stored)
          ? stored
          : loadLastCheck()?.share_id && /^[0-9a-f-]{36}$/i.test(loadLastCheck().share_id)
            ? loadLastCheck().share_id
            : "";
      if (id) setShareUrl(`${window.location.origin}/s/${id}`);
    } catch {
      /* ignore */
    }
  }, [phase, shareUrl]);

  useEffect(() => {
    if (!activeShareId || !/^[0-9a-f-]{36}$/i.test(activeShareId)) return;
    let cancelled = false;
    const loadVotes = async () => {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(activeShareId)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.ok) {
          setFriendVotes(Array.isArray(data.votes) ? data.votes : []);
        }
      } catch {
        /* ignore */
      }
    };
    loadVotes();
    const timer = window.setInterval(loadVotes, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeShareId]);

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
    setFriendVotes([]);
    setClosetSaved(false);
    setLookId("");
    setPickSlot("");
    setLink("");
    setNote("");
    try {
      sessionStorage.removeItem("yom_active_share_id");
    } catch {
      /* ignore */
    }
    setPhase("think");
  };

  const startScan = async (nextMode) => {
    setMode(nextMode);
    if (nextMode === "photo") {
      setPhase("live");
      return;
    }
    setPhase("think");
  };

  const runCheck = async (image, extra = {}) => {
    const shot = image || preview;
    const nextLink = asHttpLink(extra.link ?? link);
    const nextNote = String(extra.note ?? note ?? "").trim() || (nextLink ? noteFromProductUrl(nextLink) : "");
    const nextMode = extra.input_method || mode;
    let listingImage = !shot && nextLink ? guessListingImage(nextLink) : "";
    if (!shot && !nextLink && !nextNote) return;
    const gen = ++checkGen.current;
    const previewJob =
      !shot && nextLink && !listingImage
        ? Promise.race([
            yomLinkPreview(nextLink)
              .then((pre) => {
                const img = String(pre?.image || "");
                if (!img || /akamai-logo/i.test(img)) return "";
                return /^(https?:\/\/|data:image\/)/i.test(img) ? img : "";
              })
              .catch(() => ""),
            new Promise((resolve) => setTimeout(() => resolve(""), 5000)),
          ])
        : null;
    if (shot || listingImage) setPreview(shot || listingImage);
    setPhase("checking");
    setErr("");
    setResult(null);
    setDecision(null);
    setClosetSaved(false);
    track("product_check_started", {
      input_method: nextMode,
      surface: getSurface(),
      retailer: nextLink ? "web" : "in_store",
    });
    recordScanVisit({
      email: emailSaved ? email : undefined,
      increment_check: true,
    });

    const session = loadBetaSession();
    const joinProfile = loadJoinProfile();
    const acq = loadAcquisition();
    if (previewJob) {
      listingImage = listingImage || (await previewJob);
      if (gen !== checkGen.current) return;
      if (listingImage) setPreview(listingImage);
    }
    let data = {};
    try {
      const res = await fetch("/api/yom-scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          image: shot || listingImage || undefined,
          link: nextLink || undefined,
          note: nextNote || undefined,
          input_method: nextMode,
          surface: getSurface(),
          campaign: acq.campaign,
          source: acq.source,
          shopping_context: joinProfile.context || acq.shopping_context || "berkeley_fpr_2026",
          recruitment_round: joinProfile.round || acq.recruitment_round || pickDay || "",
          shopping_context_label: joinProfile.contextOther || "",
          shopper_name: joinProfile.name || "",
          trait: joinProfile.trait || "",
          scan_memory: formatScanHistoryForPrompt(),
          occasion: occasion || joinProfile.occasion || "",
          occasion_label: occasion || joinProfile.occasion || joinProfile.contextOther || "",
        }),
      });
      data = await res.json().catch(() => ({}));
      if (gen !== checkGen.current) return;
      if (!res.ok || !data.ok) {
        setErr(scanFailMessage(res, data));
        setPhase("error");
        return;
      }
    } catch (e) {
      if (gen !== checkGen.current) return;
      console.warn("yom-scan request", e);
      setErr("couldn’t reach yom — check your connection and try again.");
      setPhase("error");
      return;
    }

    const cleaned = scrubTake(data);
    const shown =
      shot ||
      listingImage ||
      (/^(https?:\/\/|data:image\/)/.test(String(data.image || "")) ? data.image : "") ||
      preview;
    if (shown) setPreview(shown);
    setProgress(100);
    setResult(cleaned);
    setPhase("result");
    try {
      const sheetThumb = shown ? await thumbForSheet(shown) : "";
      saveLastCheck({
        product: cleaned.product,
        verdict: cleaned.verdict,
        similar: cleaned.similar || cleaned.product?.similar,
        preview: sheetThumb || shown,
        mode: nextMode,
        reviews: cleaned.reviews || cleaned.verdict?.reviews || null,
      });
      appendScanHistory({
        product: cleaned.product,
        verdict: cleaned.verdict,
        round: cleaned.verdict?.round || joinProfile.round || acq.recruitment_round || "",
      });
      if (!cleaned.verdict?.quiet) {
        const savedLook = upsertLook(
          lookFromScan({
            preview: sheetThumb || shown,
            sourceUrl: nextLink || data.source_url || "",
            inputMethod: nextMode,
            product: cleaned.product,
            verdict: cleaned.verdict,
            note: nextNote,
            reviews: cleaned.reviews || cleaned.verdict?.reviews || null,
          })
        );
        setLookId(savedLook.id);
      }
      const props = productProps(cleaned.product, {
        input_method: nextMode,
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
      const shareAcq = loadAcquisition();
      yomShare({
        action: "save_check",
        anon_id: getAnonId(),
        email: loadSavedEmail() || undefined,
        product: cleaned.product,
        verdict: cleaned.verdict,
        input_method: mode,
        surface: getSurface(),
        source: shareAcq.source,
        campaign: shareAcq.campaign,
        image: sheetThumb || undefined,
      });
    } catch (e) {
      console.warn("yom-scan save", e);
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
    const joinProfile = loadJoinProfile();
    const savedEmail = loadSavedEmail();
    const shareId = shareUrl ? shareUrl.split("/").pop() : undefined;
    appendScanHistory({
      product: result.product,
      verdict: result.verdict,
      decision: action,
      round: joinProfile.round || acq.recruitment_round || "",
    });
    yomShare({
      action: "save_check",
      anon_id: getAnonId(),
      email: savedEmail || undefined,
      product: result.product,
      verdict: result.verdict,
      decision: action,
      input_method: mode,
      surface: getSurface(),
      source: acq.source,
      campaign: acq.campaign,
      share_id: shareId && /^[0-9a-f-]{36}$/i.test(shareId) ? shareId : undefined,
    });
  };

  const shareWithFriends = async () => {
    if (!result?.product || shareBusy) return;
    track("share_clicked", { surface: getSurface() });

    const existingId = shareUrl ? shareUrl.split("/").pop() : "";
    const id = /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : newShareId();
    const url = `${window.location.origin}/s/${id}`;
    setShareUrl(url);
    persistShareId(id);

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
    const senderName = (loadJoinProfile().name || "").trim();
    const senderFirst = senderName.split(/\s+/)[0] || "";
    const create = async () => {
      const thumb = preview ? await thumbForSheet(preview) : "";
      return yomShare({
        action: "create",
        id,
        sender_anon_id: getAnonId(),
        sender_email: emailSaved ? email : undefined,
        sender_user_id: session?.user?.id || session?.profile?.id,
        preview_note: senderFirst || undefined,
        image: thumb || undefined,
        product: {
          ...result.product,
          sender_name: senderFirst || undefined,
          share_thumb: thumb && thumb.length < 220_000 ? thumb : undefined,
        },
        verdict: result.verdict,
        decision: decision || undefined,
        source: acq.source,
        campaign: acq.campaign,
      });
    };

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
        name: senderName,
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

  const addToCloset = async () => {
    if (!result || closetSaved || !pickDay) return;
    const existing = lookId ? { id: lookId } : null;
    // Made here, while the full photo is still in hand: a camera shot can be too
    // large to keep in localStorage at all, and this is the copy that travels to
    // the server and to her other devices.
    const thumb = preview ? await thumbForSheet(preview) : "";
    const look = lookFromScan({
      preview,
      sourceUrl: link || result.source_url || "",
      inputMethod: mode,
      product: result.product,
      verdict: result.verdict,
      note,
      reviews: result.reviews || result.verdict?.reviews || null,
    });
    addLookToLineup(
      { ...look, id: existing?.id || look.id, thumb, inCloset: true, slot: pickSlot || look.slot },
      pickDay,
      pickSlot || look.slot
    );
    setClosetSaved(true);
    decide("save");
    syncPipeline();
    navigate("/lineup");
  };

  if (!allowed) {
    return (
      <div className="pnm-page is-flush">
        <header>
          <Link to="/" className="pnm-brand">
            yom
          </Link>
          <p className="pnm-kicker">one sec…</p>
        </header>
      </div>
    );
  }

  const product = result?.product || {};
  const verdict = result?.verdict || {};
  const outfitPieces = Array.isArray(result?.pieces) ? result.pieces.filter((p) => p?.feedback) : [];
  const isOutfit = result?.scan_mode === "outfit" && outfitPieces.length >= 2;
  const cousins = similarPieces(result);
  const landed = phase === "result" && result;
  const wearRound =
    LINEUP_DAYS.find((d) => d.id === pickDay)?.wear || wearLabel(verdict.round) || "recruitment";
  const score = verdict.score != null ? Number(verdict.score).toFixed(1) : "—";
  const why = verdict.why_it_works || verdict.body || "";
  const change = verdict.change || verdict.resolve || "";
  const berkeley =
    verdict.berkeley ||
    verdict.spotting ||
    (cousins.length ? cousins.map((item) => item.name).join(" · ") : "");
  const peopleTalk =
    result?.reviews?.summary || result?.reviews?.highlights?.length
      ? result.reviews
      : verdict.reviews?.summary || verdict.reviews?.highlights?.length
        ? verdict.reviews
        : null;

  const noClothes = Boolean(verdict.quiet) || isNonClothingScan(product, verdict);

  if (phase === "checking") {
    return (
      <div className="pnm-page is-flush">
        <header className="pnm-brand-row">
          <button type="button" className="pnm-back" onClick={() => resetLive()}>
            ← back
          </button>
          <Link to="/looks" className="pnm-brand">
            yom
          </Link>
        </header>
        <div className="pnm-looking">
          <h1>taking a look...</h1>
          <p className="pnm-sub">checking reviews, fit, and the look.</p>
          <div className="pnm-progress" aria-label="progress">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (landed && noClothes) {
    return (
      <div className="pnm-page is-flush">
        <header className="pnm-brand-row">
          <button type="button" className="pnm-back" onClick={() => resetLive()}>
            ← back
          </button>
          <Link to="/looks" className="pnm-brand">
            yom
          </Link>
        </header>
        <h1 className="pnm-title pnm-wear">
          no clothing
          <em>detected.</em>
        </h1>
        <div className="pnm-result-body">
          <div className="pnm-shot">
            {preview ? (
              <img src={preview} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="pnm-thumb empty" />
            )}
          </div>
          <div className="pnm-result-copy">
            <p className="pnm-sub" style={{ margin: 0 }}>
              {verdict.body || "yom needs a photo, link, or description of something you’d actually wear."}
            </p>
          </div>
        </div>
        <button type="button" className="pnm-cta pnm-result-cta" onClick={() => resetLive()}>
          try another →
        </button>
      </div>
    );
  }

  if (landed) {
    return (
      <div className="pnm-page is-flush">
        <header className="pnm-brand-row">
          <button type="button" className="pnm-back" onClick={() => resetLive()}>
            ← back
          </button>
          <Link to="/looks" className="pnm-brand">
            yom
          </Link>
        </header>
        <h1 className="pnm-title pnm-wear">
          {isOutfit ? "the full look for" : "i’d wear this for"}
          <em>{wearRound}.</em>
        </h1>
        <div className="pnm-result-body">
          <div className="pnm-shot">
            {preview ? (
              <img src={preview} alt={product.name || "the look"} referrerPolicy="no-referrer" />
            ) : (
              <div className="pnm-thumb empty" />
            )}
          </div>
          <div className="pnm-result-copy">
            <div className="pnm-score">
              {score}
              <span>/10</span>
            </div>
            <article className="pnm-block">
              <h3>why it works</h3>
              <p>{why || verdict.title}</p>
            </article>
            {peopleTalk ? (
              <article className="pnm-block pnm-reviews">
                <h3>what people say</h3>
                {peopleTalk.summary ? <p>{peopleTalk.summary}</p> : null}
                {peopleTalk.fit_note ? <p className="pnm-review-fit">{peopleTalk.fit_note}</p> : null}
                {Array.isArray(peopleTalk.highlights) && peopleTalk.highlights.length ? (
                  <ul className="pnm-review-quotes">
                    {peopleTalk.highlights.slice(0, 3).map((hit, i) => (
                      <li key={`${hit.channel}-${i}`}>
                        <em>{hit.channel}</em>
                        {hit.url ? (
                          <a href={hit.url} target="_blank" rel="noreferrer">
                            {hit.text}
                          </a>
                        ) : (
                          <span>{hit.text}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {Array.isArray(peopleTalk.channels) && peopleTalk.channels.length ? (
                  <p className="pnm-review-channels">{peopleTalk.channels.join(" · ")}</p>
                ) : null}
              </article>
            ) : null}
            {isOutfit ? (
              <article className="pnm-block pnm-piece-breakdown">
                <h3>piece by piece</h3>
                <ul className="pnm-piece-notes">
                  {outfitPieces.map((piece) => (
                    <li key={`${piece.slot}-${piece.name}`}>
                      <strong>{pieceLabel(piece.slot)}</strong>
                      <span>{piece.name}</span>
                      <p>{piece.feedback}</p>
                      {piece.note ? <p className="pnm-piece-tweak">{piece.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
            <article className="pnm-block">
              <h3>one thing i’d change</h3>
              <p>{change || "swap the shoes for something you’ll actually be comfortable walking and standing in."}</p>
            </article>
            <article className="pnm-block">
              <h3>for berkeley specifically</h3>
              <p>{berkeley || "it’s looking warm that day, so you probably won’t need another layer."}</p>
            </article>
          </div>
        </div>
        {err && <p className="scan-err">{err}</p>}
        <div className="pnm-park">
          <p className="pnm-field">which day?</p>
          <div className="pnm-chips">
            {LINEUP_DAYS.map((day) => (
              <button
                key={day.id}
                type="button"
                className={`pnm-chip${pickDay === day.id ? " on" : ""}`}
                onClick={() => setPickDay(day.id)}
              >
                {day.chip}
              </button>
            ))}
          </div>
          {!pickDay && String(verdict.round || "").startsWith("unity") ? (
            <p className="pnm-sub">unity 1 and 2 are different nights — pick one.</p>
          ) : null}
          <p className="pnm-field">this piece is a</p>
          <div className="pnm-chips">
            {LINEUP_PIECES.map((piece) => (
              <button
                key={piece.id}
                type="button"
                className={`pnm-chip${pickSlot === piece.id ? " on" : ""}`}
                onClick={() => setPickSlot(piece.id)}
              >
                {piece.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="pnm-cta pnm-result-cta" disabled={!pickDay} onClick={addToCloset}>
          {closetSaved ? "added →" : "add to lineup →"}
        </button>
        <button type="button" className="pnm-ghost" onClick={() => resetLive()}>
          nah, keep looking
        </button>
      </div>
    );
  }

  // The think step is the home tab now, so it keeps the nav and loses the back
  // button — there is nothing behind it unless she came from a day.
  const isHome = phase === "think" && !pickDay;

  return (
    <div className={`pnm-page${isHome ? " is-app" : " is-flush"}`}>
      <header className="pnm-brand-row">
        {isHome ? (
          <span />
        ) : (
          <button
            type="button"
            className="pnm-back"
            onClick={() => (phase === "think" ? navigate("/lineup") : resetLive())}
          >
            ← back
          </button>
        )}
        {/* /looks redirects here, so the logo remounts this page on a fresh
            think step rather than doing nothing on the route it is already on. */}
        <Link to="/looks" className="pnm-brand">
          yom
        </Link>
      </header>

      {phase === "think" && (
        <>
          <h1 className="pnm-title pnm-think">
            show me what
            <br />
            you’re thinking.
          </h1>
          <p className="pnm-sub">an outfit, a single piece, anything.</p>
          <button type="button" className="pnm-choice" onClick={() => startScan("photo")}>
            <span>
              <strong>take a photo</strong>
              <span>use your camera</span>
            </span>
            <span className="pnm-choice-arrow">→</span>
          </button>
          <button type="button" className="pnm-choice" onClick={() => fileRef.current?.click()}>
            <span>
              <strong>upload a photo</strong>
              <span>from your camera roll</span>
            </span>
            <span className="pnm-choice-arrow">→</span>
          </button>
          <button
            type="button"
            className="pnm-choice"
            onClick={() => {
              setMode("link");
            }}
          >
            <span>
              <strong>paste a link</strong>
              <span>from any store</span>
            </span>
            <span className="pnm-choice-arrow">→</span>
          </button>
          {mode === "link" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runCheck(null, { link, input_method: "link" });
              }}
            >
              <input
                className="pnm-input"
                placeholder="https://"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                inputMode="url"
                autoFocus
              />
              <button type="submit" className="pnm-cta" style={{ marginTop: "0.65rem" }}>
                look at this link →
              </button>
            </form>
          )}
          <p className="pnm-or">or</p>
          <p className="pnm-tell">or just tell yom about it</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              runCheck(null, { note, input_method: "text" });
            }}
          >
            <input
              className="pnm-input"
              placeholder="i have a white mini dress..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </form>
          {isHome && <AddToHomeScreen when={loadLooks().length > 0} />}
        </>
      )}

      {phase === "live" && (
        <>
          <div className={`scan-stage${mode === "tag" ? " is-tag" : ""}`}>
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
          </div>
          <footer className="scan-actions">
            <button type="button" className="scan-shutter" onClick={snapFromVideo}>
              capture
            </button>
            <button type="button" className="scan-secondary" onClick={() => fileRef.current?.click()}>
              upload
            </button>
          </footer>
        </>
      )}

      {phase === "error" && (
        <>
          {preview && (
            <div className="pnm-shot">
              <img src={preview} alt="" referrerPolicy="no-referrer" />
            </div>
          )}
          {err && <p className="scan-err">{err}</p>}
          <button type="button" className="pnm-cta" onClick={() => runCheck(preview, { link, note })}>
            try again
          </button>
          <button type="button" className="pnm-ghost" onClick={() => resetLive()}>
            start over
          </button>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="scan-file" onChange={onFile} />
      <input
        ref={camFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="scan-file"
        onChange={onFile}
      />

      {isHome && <YomNav active="y" />}
    </div>
  );
}
