/**
 * What yom writes to everyone at once.
 *
 * Kept here rather than typed into a form: an email to every girl who joined is
 * the least reversible thing this codebase does, so the words live in the repo
 * where they can be read, reviewed and diffed before anyone sends them.
 *
 * Each girl's link carries her own account key, the same way the restore mail
 * does — it goes only to the address already on that account, and it means
 * tapping it opens her lineup rather than a login she cannot complete.
 */

function appBase() {
  return (process.env.APP_BASE_URL || "https://youryom.com").replace(/\/$/, "");
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0].toLowerCase();
}

/** Her own way in when we know her key, the front door when we do not. */
export function linkFor(person) {
  const key = String(person?.account_key || "").trim();
  // Without a key it still opens the app rather than the signup page: on her own
  // phone her yom is already there, and being asked to join again is insulting.
  return key ? `${appBase()}/looks#key=${encodeURIComponent(key)}` : `${appBase()}/looks`;
}

function shell(body, link, cta) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:520px">
${body}
<p style="margin:22px 0"><a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${cta}</a></p>
<p style="color:#6a6a6a;font-size:13px;margin-top:26px">this link is just for you — it opens your lineup. don't forward it.</p>
</div>`;
}

const CAMPAIGNS = {
  /** Orientation is tonight and unity day 1 is tomorrow — the one moment yom is for. */
  orientation_night: (person) => {
    const hi = firstName(person?.name) ? `hi ${firstName(person.name)},` : "hi,";
    const link = linkFor(person);
    const cta = "open my yom →";
    return {
      // Her own question, not ours. "recruitment starts tonight" is an
      // announcement; this is the thing she is already wondering about.
      subject: "what are you wearing tomorrow?",
      text: `${hi}

i'm ban, one of the founders of yom.

orientation's tonight, and unity day 1 is tomorrow at 5:30.

if you're still deciding what to wear, show yom the options — it tells you which one works for the round, and the one thing it'd change. takes a minute.

${cta}
${link}

you can send a whole outfit now, not just one piece: a photo of the top, one of the bottoms, one of the shoes, and it reads them together.

if anything's broken or annoying, hit reply and tell me — i read these.

good luck tonight.

ban + mal`,
      html: shell(
        `<p>${hi}</p>
<p>i'm ban, one of the founders of yom.</p>
<p>orientation's tonight, and <b>unity day 1 is tomorrow at 5:30</b>.</p>
<p>if you're still deciding what to wear, show yom the options — it tells you which one works for the round, and the one thing it'd change. takes a minute.</p>`,
        link,
        cta
      ),
      footer: `<p>you can send a whole outfit now, not just one piece: a photo of the top, one of the bottoms, one of the shoes, and it reads them together.</p>
<p>if anything's broken or annoying, hit reply and tell me — i read these.</p>
<p>good luck tonight.<br>ban + mal</p>`,
    };
  },
};

export function campaignIds() {
  return Object.keys(CAMPAIGNS);
}

export function renderCampaign(id, person) {
  const build = CAMPAIGNS[id];
  if (!build) return null;
  const mail = build(person);
  // The sign-off sits below the button, which is where the eye lands last.
  return {
    subject: mail.subject,
    text: mail.text,
    html: mail.html.replace("</div>", `${mail.footer || ""}</div>`),
  };
}
