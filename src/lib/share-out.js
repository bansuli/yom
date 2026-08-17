/**
 * Outbound share helpers — iMessage / SMS, WhatsApp, native sheet, clipboard.
 */

export function shareMessage({ product, verdict, url } = {}) {
  const piece = [product?.brand, product?.name].filter(Boolean).join(" ") || "this piece";
  const take = verdict?.title ? ` — ${verdict.title}` : "";
  return `help me decide on ${piece}${take}\n${url || ""}`.trim();
}

export function newShareId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function smsShareHref(text) {
  // iOS wants sms:&body= ; Android accepts sms:?body=
  const body = encodeURIComponent(text);
  const isiOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  return isiOS ? `sms:&body=${body}` : `sms:?body=${body}`;
}

export function whatsappShareHref(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function nativeShare({ title = "yom", text, url, files } = {}) {
  if (!canNativeShare()) return { ok: false, reason: "unsupported" };
  try {
    const payload = { title: title || "yom" };
    if (text) payload.text = text;
    if (url) payload.url = url;
    if (Array.isArray(files) && files.length && navigator.canShare?.({ files })) {
      payload.files = files;
    }
    await navigator.share(payload);
    return { ok: true };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, reason: "cancelled" };
    // Retry without files if the sheet rejected the image
    if (files?.length && url) {
      try {
        await navigator.share({ title: title || "yom", text, url });
        return { ok: true };
      } catch (e2) {
        if (e2?.name === "AbortError") return { ok: false, reason: "cancelled" };
        return { ok: false, reason: e2?.message || "failed" };
      }
    }
    return { ok: false, reason: e?.message || "failed" };
  }
}

/** Open the system share sheet in the same tap. Must not await network first. */
export async function openSystemShare({ product, verdict, url } = {}) {
  const text = shareMessage({ product, verdict });
  return nativeShare({
    title: "yom",
    text,
    url,
  });
}

export async function copyShareLink(url) {
  if (!url) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = url;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
