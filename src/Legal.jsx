import { Link } from 'react-router-dom'
import './Legal.css'

const UPDATED = 'August 30, 2026'
const CONTACT = 'support@youryom.com'

function Shell({ title, children }) {
  return (
    <div className="legal-page">
      <div className="legal-bg" />
      <Link to="/" className="legal-back">&larr; yom</Link>
      <div className="legal-wrap">
        <header className="legal-head">
          <p className="legal-eyebrow">yom</p>
          <h1>{title}</h1>
          <p className="legal-updated">last updated {UPDATED}</p>
        </header>
        <div className="legal-body">{children}</div>
        <footer className="legal-foot">
          <p>
            questions about any of this — <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
          <p className="legal-links">
            <Link to="/privacy">privacy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms">terms</Link>
            <span aria-hidden="true">·</span>
            <Link to="/">home</Link>
          </p>
        </footer>
      </div>
    </div>
  )
}

export function Privacy() {
  return (
    <Shell title="privacy policy">
      <p className="legal-lead">
        yom helps you decide what to buy. To do that it has to remember things about you.
        This is the full list of what it keeps, who else sees it, and how to get rid of it.
      </p>

      <section>
        <h2>what we collect</h2>

        <h3>when you make an account</h3>
        <p>
          Your email address or phone number, and a name. If you sign in with Google we
          receive your name, email address and profile picture from Google — nothing else.
          Passwords are handled by our authentication provider and we never see them.
        </p>

        <h3>what you tell yom about yourself</h3>
        <p>
          The answers you give during onboarding: how you shop, what you regret buying,
          what you own, your sizes, and the brands you like. This is the point of yom —
          it is what makes the advice yours rather than generic.
        </p>

        <h3>what you do in yom</h3>
        <p>
          Items you scan, save, keep or return, the verdicts yom gave you, looks you build
          and anything you share with a friend, along with their votes.
        </p>

        <h3>photos you scan</h3>
        <p>
          When you scan a piece, the photo is sent to our AI providers to be read.
          <strong> We do not keep the photo.</strong> What we store is what was read from it —
          the product, brand, price and the verdict.
        </p>

        <h3>Google Calendar and Gmail — only if you connect them</h3>
        <p>
          This is off by default and separate from signing in. Signing in with Google asks
          only for your name and email. If you separately choose to connect Calendar and
          Gmail, yom reads:
        </p>
        <ul>
          <li>upcoming calendar events — title, description, location and times — so it knows about the trip or wedding you are shopping for</li>
          <li>shopping-related email — subject, sender and preview line — to spot orders, shipping, returns and sizing</li>
        </ul>
        <p>
          yom does not read the full body of your emails, does not send email on your behalf,
          and does not change anything in your calendar. You can disconnect at any time from
          your profile, which deletes what was pulled in.
        </p>

        <h3>how you use the site</h3>
        <p>
          Page views, clicks and session recordings through our analytics provider, plus how
          you found us (referrer and campaign tags). Recordings mask what you type — passwords,
          email fields and uploaded photos are blocked from capture.
        </p>
      </section>

      <section>
        <h2>who else sees it</h2>
        <p>
          We do not sell your data and we do not share it for advertising. We use these
          companies to run yom, and they only handle your data to provide their service to us:
        </p>
        <ul className="legal-table">
          <li><span>Supabase</span> database, accounts and sign-in</li>
          <li><span>Vercel</span> hosting</li>
          <li><span>OpenAI, Anthropic</span> reading the photos you scan and writing the advice</li>
          <li><span>PostHog</span> product analytics</li>
          <li><span>Resend</span> sending you email</li>
          <li><span>Twilio</span> sending sign-in codes by text</li>
          <li><span>Google</span> sign-in, and Calendar and Gmail if you connect them</li>
        </ul>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          yom&rsquo;s use of information received from Google APIs follows the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Specifically, data from Google Calendar
          and Gmail is used only to give you shopping advice inside yom. It is never sold,
          never used for advertising, never used to train general AI models, and is not read
          by anyone at yom except where you have asked us for support or where the law
          requires it.
        </p>
      </section>

      <section>
        <h2>deleting it</h2>
        <p>
          There is a delete button in your profile. It removes your account and the data
          attached to it. You can also email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and
          ask, and we will do it.
        </p>
        <p>
          You can ask us what we hold about you, ask us to correct it, or ask for a copy.
          Same address.
        </p>
      </section>

      <section>
        <h2>how long we keep it</h2>
        <p>
          For as long as you have an account. Delete the account and it goes, other than
          anything we are required to keep for legal or accounting reasons. Analytics events
          are kept in aggregate and are not tied to you once your account is gone.
        </p>
      </section>

      <section>
        <h2>children</h2>
        <p>yom is not for people under 16, and we do not knowingly collect their data.</p>
      </section>

      <section>
        <h2>changes</h2>
        <p>
          If this policy changes in a way that matters, we will tell you by email before it
          takes effect. The date at the top always reflects the current version.
        </p>
      </section>
    </Shell>
  )
}

export function Terms() {
  return (
    <Shell title="terms of service">
      <p className="legal-lead">
        The short version: yom gives you shopping advice. It is advice, not a guarantee, and
        the money you spend is your decision.
      </p>

      <section>
        <h2>what yom is</h2>
        <p>
          yom reads a product, weighs it against what it knows about you, and tells you
          whether it thinks the piece is worth buying. It also keeps a record of your closet
          and what you have bought, kept and returned.
        </p>
        <p>
          yom is not a shop. We do not sell you clothes, take your payment, or ship anything.
          When you buy, you buy from the retailer on their terms.
        </p>
      </section>

      <section>
        <h2>the advice is advice</h2>
        <p>
          yom reads product pages, reviews and sizing information, and is sometimes wrong. It
          can misread a photo, miss that a brand runs small, or be working from a review that
          was itself wrong. Check anything that matters — especially fit, materials, price and
          delivery dates — with the retailer before buying.
        </p>
        <p>
          We are not responsible for what you buy, what it costs, whether it fits, or whether
          it arrives on time.
        </p>
      </section>

      <section>
        <h2>your account</h2>
        <ul>
          <li>You need to be 16 or older.</li>
          <li>Give us a real email address or phone number, and keep your access to it.</li>
          <li>The account is yours — do not share it.</li>
          <li>Tell us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if someone else gets into it.</li>
        </ul>
      </section>

      <section>
        <h2>what you put in</h2>
        <p>
          Your photos and answers stay yours. You give us permission to use them to run yom
          for you — to read a piece, build your profile, and show you your own closet. That
          permission ends when you delete the content or your account.
        </p>
        <p>Do not upload anything you do not have the right to upload.</p>
      </section>

      <section>
        <h2>what not to do</h2>
        <ul>
          <li>Scrape yom, or use it to build a competing product.</li>
          <li>Break it on purpose, or try to reach other people&rsquo;s accounts.</li>
          <li>Automate it at a volume that costs us real money.</li>
          <li>Use it for anything illegal.</li>
        </ul>
        <p>We can close accounts that do these things.</p>
      </section>

      <section>
        <h2>it is early</h2>
        <p>
          yom is a young product. Features change, some go away, and it will occasionally be
          down. It is provided as it is, without warranties. To the extent the law allows,
          our liability to you is limited to what you have paid us — which, at the moment,
          is nothing.
        </p>
      </section>

      <section>
        <h2>ending it</h2>
        <p>
          You can delete your account whenever you like, from your profile or by emailing us.
          We can close an account that breaks these terms, and we will tell you why unless we
          are not allowed to.
        </p>
      </section>

      <section>
        <h2>changes</h2>
        <p>
          We will tell you by email before any change that meaningfully affects you. Carrying
          on using yom after that means you accept the new version.
        </p>
      </section>

      <section>
        <h2>law</h2>
        <p>
          These terms are governed by the laws of the State of California, United States.
        </p>
      </section>
    </Shell>
  )
}
