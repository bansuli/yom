/**
 * Transactional email through Resend. The only sender yom has, so everything
 * here degrades quietly: with no key configured the caller is told it is not
 * configured rather than getting a thrown error into a user's face.
 */

const API = "https://api.resend.com/emails";
const BATCH_API = "https://api.resend.com/emails/batch";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function sender() {
  return process.env.EMAIL_FROM || "yom <hi@youryom.com>";
}

export async function sendEmail({ to, subject, html, text, replyTo } = {}) {
  if (!emailConfigured()) return { ok: false, skipped: true, error: "email is not configured" };
  const address = String(to || "").trim().toLowerCase();
  if (!address) return { ok: false, error: "need an email address" };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [address],
        subject: String(subject || "yom"),
        html: html || undefined,
        text: text || undefined,
        reply_to: replyTo || process.env.EMAIL_REPLY_TO || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.warn("resend", res.status, data?.message || "");
      return { ok: false, status: res.status, error: data?.message || "could not send" };
    }
    return { ok: true, id: data?.id || "" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Many emails in one call. Sending them one at a time would take longer than a
 * serverless function is allowed to run, and would half-finish a campaign —
 * which is worse than not starting one. Resend takes up to 100 per batch.
 */
export async function sendEmailBatch(messages = []) {
  if (!emailConfigured()) return { ok: false, skipped: true, error: "email is not configured" };
  const list = (Array.isArray(messages) ? messages : []).filter((m) => m && m.to);
  if (!list.length) return { ok: false, error: "nothing to send" };
  if (list.length > 100) return { ok: false, error: "batches are 100 at a time" };

  try {
    const res = await fetch(BATCH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        list.map((m) => ({
          from: sender(),
          to: [String(m.to).trim().toLowerCase()],
          subject: String(m.subject || "yom"),
          html: m.html || undefined,
          text: m.text || undefined,
          reply_to: m.replyTo || process.env.EMAIL_REPLY_TO || undefined,
        }))
      ),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: data?.message || "could not send" };
    return { ok: true, sent: list.length, ids: (data?.data || []).map((row) => row.id).filter(Boolean) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
