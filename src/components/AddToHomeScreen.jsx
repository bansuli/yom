import { useEffect, useState } from "react";
import { getAccountKey } from "../lib/account.js";
import "../Pipeline.css";

const DISMISSED_KEY = "yom_a2hs_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

/**
 * iOS keeps a home screen web app's storage in its own container, so adding yom
 * after building a lineup in safari would open an empty app. Safari saves the
 * url that is showing when she taps Add to Home Screen, so put her account key
 * in the fragment first and the installed app adopts her yom on first launch.
 */
function armTransferKey() {
  try {
    const key = getAccountKey();
    if (!key) return;
    const url = `${window.location.pathname}${window.location.search}#key=${encodeURIComponent(key)}`;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore */
  }
}

function disarmTransferKey() {
  try {
    if (!window.location.hash.startsWith("#key=")) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  } catch {
    /* ignore */
  }
}

/** Offered after she has something worth keeping, never on a cold landing. */
export default function AddToHomeScreen({ when = false }) {
  const [show, setShow] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    if (!when || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setShow(true);
  }, [when]);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => () => disarmTransferKey(), []);

  if (!show) return null;

  const dismiss = () => {
    disarmTransferKey();
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const add = async () => {
    armTransferKey();
    // Chrome and Android can install for real; iOS has no api, so she is walked
    // through it while the key sits in the url.
    if (prompt) {
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      setPrompt(null);
      if (choice?.outcome === "accepted") {
        dismiss();
        return;
      }
      disarmTransferKey();
      return;
    }
    setHowTo(true);
  };

  return (
    <div className="yom-a2hs">
      <div className="yom-a2hs-copy">
        <b>keep yom on your home screen</b>
        <p>
          {howTo
            ? isIos()
              ? "tap the share button below, then “add to home screen”. your lineup comes with you."
              : "open your browser menu, then “install app” or “add to home screen”."
            : "one tap to your lineup all week — and it stops safari from clearing it."}
        </p>
      </div>
      {!howTo && (
        <button type="button" className="yom-a2hs-add" onClick={add}>
          add
        </button>
      )}
      <button type="button" className="yom-a2hs-x" onClick={dismiss} aria-label="not now">
        ×
      </button>
    </div>
  );
}
