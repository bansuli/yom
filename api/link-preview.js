import { json, preflight, readJson } from "../lib/http.js";
import { fetchImageAsDataUrl, fetchLinkPreview } from "../lib/link-preview.js";

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  const body = readJson(req);
  const preview = await fetchLinkPreview(body.url || body.link);
  if (!preview.ok) {
    json(res, 400, preview);
    return;
  }
  const image = preview.image ? await fetchImageAsDataUrl(preview.image) : "";
  json(res, 200, { ...preview, image: image || preview.image || "" });
}
