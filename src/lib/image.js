/**
 * Canvas downscaling shared by the share cards, the sheet thumbs, and the
 * lineup sync. A full scan preview is ~1400px at q0.82, which base64s well past
 * what we send to the server; these thumbs come in around 40-90kb.
 */

/** Small jpeg copy of a data url or remote image. Resolves "" when it can't. */
export function thumbFrom(src, maxEdge = 720, quality = 0.55) {
  return new Promise((resolve) => {
    const s = String(src || "");
    if (!s || typeof document === "undefined") {
      resolve("");
      return;
    }
    const isRemote = /^https?:\/\//i.test(s);
    if (!s.startsWith("data:image/") && !isRemote) {
      resolve("");
      return;
    }
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    if (isRemote) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        // Product PNGs often have transparent "light" backgrounds; JPEG has no
        // alpha and would otherwise flatten to black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        // Tainted canvas on a cross-origin image: the url itself still renders.
        resolve(isRemote ? s : "");
      }
    };
    img.onerror = () => resolve(isRemote ? s : "");
    img.src = s;
  });
}
