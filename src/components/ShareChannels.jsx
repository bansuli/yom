import { useState } from "react";
import {
  copyShareLink,
  nativeShare,
  shareMessage,
  smsShareHref,
  whatsappShareHref,
} from "../lib/share-out.js";
import { track } from "../lib/analytics.js";

/**
 * Channel buttons for iMessage/SMS, WhatsApp, copy, and native share sheet.
 * Call only after `url` exists (user gesture is preserved on each button).
 */
export default function ShareChannels({
  url,
  product,
  verdict,
  shareId,
  surface = "web",
  label = "send via",
}) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const text = shareMessage({ product, verdict, url });
  const smsHref = smsShareHref(text);
  const waHref = whatsappShareHref(text);
  const canNative = typeof navigator !== "undefined" && Boolean(navigator.share);

  const ping = (channel) => {
    track("share_channel_clicked", {
      channel,
      share_id: shareId || "",
      surface,
    });
  };

  const onCopy = async () => {
    ping("copy");
    const ok = await copyShareLink(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const onMore = async () => {
    ping("native");
    const res = await nativeShare({
      title: "yom",
      text: shareMessage({ product, verdict }),
      url,
    });
    if (!res.ok && res.reason !== "cancelled") {
      await onCopy();
    }
  };

  return (
    <div className="share-channels">
      <p className="share-channels-label">{label}</p>
      <div className="share-channels-row">
        <a className="share-channel" href={smsHref} onClick={() => ping("sms")}>
          messages
        </a>
        <a
          className="share-channel"
          href={waHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => ping("whatsapp")}
        >
          whatsapp
        </a>
        <button type="button" className="share-channel" onClick={onCopy}>
          {copied ? "copied" : "copy link"}
        </button>
        {canNative && (
          <button type="button" className="share-channel" onClick={onMore}>
            more apps
          </button>
        )}
      </div>
    </div>
  );
}
