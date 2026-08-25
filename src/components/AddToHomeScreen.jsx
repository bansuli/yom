import { useEffect, useState } from "react";
import {
  A2HS_DISMISSED_KEY,
  addByHandText,
  armTransferKey,
  disarmTransferKey,
  hasAdded,
  isStandalone,
  markAdded,
} from "../lib/a2hs.js";
import { isNativeApp } from "../lib/native.js";
import "../Pipeline.css";

/**
 * The nudge for anyone who joined before /join started asking. Offered after
 * she has something worth keeping, never on a cold landing.
 */
export default function AddToHomeScreen({ when = false }) {
  const [show, setShow] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    if (!when || isStandalone() || hasAdded() || isNativeApp()) return;
    try {
      if (localStorage.getItem(A2HS_DISMISSED_KEY) === "1") return;
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
      localStorage.setItem(A2HS_DISMISSED_KEY, "1");
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
        markAdded();
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
        <p>{howTo ? addByHandText() : "one tap to your lineup all week — and it stops safari from clearing it."}</p>
      </div>
      {howTo ? (
        <button
          type="button"
          className="yom-a2hs-add"
          onClick={() => {
            markAdded();
            dismiss();
          }}
        >
          done
        </button>
      ) : (
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
