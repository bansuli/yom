import { useEffect, useRef, useState } from "react";
import { AVATAR_COLORS } from "../../lib/avatar.js";
import { thumbFrom } from "../lib/image.js";
import "./AvatarPicker.css";

const MAX_EDGE = 512;
const QUALITY = 0.82;

/**
 * Take a photo, choose one, or go back to a colour.
 *
 * Photos are downscaled in the browser before they are sent — a phone camera
 * shot is several megabytes and none of that survives being drawn at 156px.
 */
export default function AvatarPicker({ current, onPhoto, onColor, onClear, onClose, busy }) {
  const [mode, setMode] = useState("choose");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      // No camera API — fall back to the file input, which on a phone offers
      // the camera anyway.
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      // The element only exists once the mode has rendered.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError("Couldn't reach the camera. Choose a photo instead.");
      setMode("choose");
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video) return;
    const edge = Math.min(video.videoWidth, video.videoHeight);
    if (!edge) return;
    // Square crop from the centre, which is what a round avatar shows anyway.
    const canvas = document.createElement("canvas");
    canvas.width = MAX_EDGE;
    canvas.height = MAX_EDGE;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      video,
      (video.videoWidth - edge) / 2,
      (video.videoHeight - edge) / 2,
      edge,
      edge,
      0,
      0,
      MAX_EDGE,
      MAX_EDGE
    );
    stopCamera();
    setMode("choose");
    onPhoto(canvas.toDataURL("image/jpeg", QUALITY));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (!/^image\//.test(file.type)) {
      setError("That isn't an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const small = await thumbFrom(String(reader.result), MAX_EDGE, QUALITY);
      if (!small) {
        setError("Couldn't read that image.");
        return;
      }
      onPhoto(small);
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="avp">
      {mode === "camera" ? (
        <div className="avp-camera">
          <video ref={videoRef} playsInline muted className="avp-video" />
          <div className="avp-row">
            <button type="button" className="ap-btn" onClick={shoot} disabled={busy}>
              Take it
            </button>
            <button
              type="button"
              className="ap-btn ap-btn-quiet"
              onClick={() => {
                stopCamera();
                setMode("choose");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="avp-row">
            <button type="button" className="ap-btn" onClick={startCamera} disabled={busy}>
              Take a photo
            </button>
            <button
              type="button"
              className="ap-btn ap-btn-quiet"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              Upload a photo
            </button>
            {current ? (
              <button type="button" className="ap-btn ap-btn-quiet" onClick={onClear} disabled={busy}>
                Remove photo
              </button>
            ) : null}
          </div>

          <p className="avp-or">or pick a colour</p>
          <div className="avp-swatches" role="group" aria-label="Avatar colour">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="avp-swatch"
                style={{ background: c }}
                aria-label={`Use ${c}`}
                disabled={busy}
                onClick={() => onColor(c)}
              />
            ))}
          </div>
        </>
      )}

      {error ? <p className="avp-err">{error}</p> : null}
      {busy ? <p className="avp-busy">Saving…</p> : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="avp-file"
        onChange={onFile}
      />

      <button type="button" className="ap-link avp-done" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
