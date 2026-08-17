/**
 * Outbound share helpers — iMessage / SMS, WhatsApp, native sheet, clipboard.
 */

export function shareMessage({ product, verdict, url } = {}) {
  const piece = [product?.brand, product?.name].filter(Boolean).join(" ") || "this piece";
  const take = verdict?.title ? ` — ${verdict.title}` : "";
  return `help me decide on ${piece}${take}\n${url || ""}`.trim();
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

export async function nativeShare({ title = "yom", text, url } = {}) {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    // Prefer text+url; some iOS versions choke if fields are empty
    const payload = { title };
    if (text) payload.text = text;
    if (url) payload.url = url;
    await navigator.share(payload);
    return { ok: true };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, reason: "cancelled" };
    return { ok: false, reason: e?.message || "failed" };
  }
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
