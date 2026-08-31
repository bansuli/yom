import { Link } from 'react-router-dom'
import './Legal.css'

const UPDATED = 'August 30, 2026'
const CONTACT = 'support@youryom.com'
// Swap to "Yom, Inc." once the Delaware incorporation completes.
const ENTITY = 'Yom'

function Shell({ title, subtitle, children }) {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">
        &larr; Back to Yom
      </Link>
      <div className="legal-wrap">
        <header className="legal-head">
          <p className="legal-eyebrow">Yom</p>
          <h1>{title}</h1>
          <p className="legal-updated">Last Revised: {UPDATED}</p>
          <p className="legal-intro">{subtitle}</p>
        </header>
        <div className="legal-body">{children}</div>
        <footer className="legal-foot">
          <p>
            Questions about this document may be directed to{' '}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
          <p className="legal-links">
            <Link to="/privacy">Privacy Policy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms">Terms of Service</Link>
            <span aria-hidden="true">·</span>
            <Link to="/">Home</Link>
          </p>
        </footer>
      </div>
    </div>
  )
}

export function Privacy() {
  return (
    <Shell
      title="Privacy Policy"
      subtitle={`This Privacy Policy describes how ${ENTITY} (“Yom”, “we”, “us”, or “our”) collects, uses, shares, and protects the personal information of users (“you”) of youryom.com, the Yom mobile application, and the Yom browser extension (together, the “Services”). By using the Services you consent to the practices described in this Policy.`}
    >
      <section>
        <h2><span className="num">1.</span> Information We Collect</h2>

        <h3>1.1 Information You Provide to Us</h3>
        <p>
          <strong>Account information.</strong> When you create an account we collect your email
          address or mobile telephone number, and a display name. If you register using Google, we
          receive your name, email address, and profile image from Google. Passwords are processed
          and stored by our authentication provider; Yom does not receive or retain them.
        </p>
        <p>
          <strong>Profile information.</strong> During onboarding and thereafter you may provide
          information about your shopping habits, purchase regrets, garment sizes, preferred
          brands, and the contents of your wardrobe. This information is the basis on which the
          Services generate recommendations specific to you.
        </p>

        <h3>1.2 Information Generated Through Your Use of the Services</h3>
        <p>
          We record items you scan, save, retain, or return; the recommendations issued to you;
          collections you assemble; and items you share with others, together with any responses
          those recipients submit.
        </p>

        <h3>1.3 Images You Submit</h3>
        <p>
          When you submit a photograph of a garment for analysis, that image is transmitted to our
          artificial intelligence providers for the sole purpose of identifying the item.{' '}
          <strong>Yom does not retain the photograph.</strong> We retain only the attributes
          derived from it, such as the product, brand, price, and the resulting recommendation.
        </p>

        <h3>1.4 Google Calendar and Gmail Data (Optional)</h3>
        <p>
          This integration is disabled by default and is distinct from registration. Signing in
          with Google requests only your name and email address. If you separately elect to connect
          Google Calendar and Gmail, Yom accesses:
        </p>
        <ul>
          <li>
            Calendar events, including title, description, location, and scheduled times, in order
            to identify occasions relevant to a purchase.
          </li>
          <li>
            Commerce-related email metadata, including subject line, sender, and preview text, in
            order to identify orders, shipments, returns, and sizing information.
          </li>
        </ul>
        <p>
          Yom does not access the full body of your email messages, does not send messages on your
          behalf, and does not create or modify calendar entries. You may disconnect this
          integration at any time from your profile, which deletes the data previously retrieved.
        </p>

        <h3>1.5 Information Collected Automatically</h3>
        <p>
          We collect page views, interaction events, session recordings, device and browser
          characteristics, and referral and campaign parameters describing how you arrived at the
          Services. Session recordings are configured to mask user input; password fields, email
          fields, and uploaded images are excluded from capture.
        </p>
      </section>

      <section>
        <h2><span className="num">2.</span> How We Use Information</h2>
        <p>We use the information described above to:</p>
        <ul>
          <li>Operate, maintain, and secure the Services;</li>
          <li>Generate purchase recommendations specific to you;</li>
          <li>Maintain a record of your wardrobe and purchase history;</li>
          <li>Communicate with you regarding your account and the Services;</li>
          <li>Analyze usage in order to improve the Services; and</li>
          <li>Comply with legal obligations and enforce our Terms of Service.</li>
        </ul>
      </section>

      <section>
        <h2><span className="num">3.</span> How We Share Information</h2>

        <h3>3.1 Service Providers</h3>
        <p>
          We do not sell personal information, and we do not disclose personal information for
          advertising purposes. We engage the following providers to operate the Services. Each
          processes personal information only as necessary to supply its service to us and is bound
          by contractual confidentiality obligations.
        </p>
        <ul className="legal-table">
          <li><span>Supabase</span> Database, authentication, and account storage</li>
          <li><span>Vercel</span> Application hosting and delivery</li>
          <li><span>OpenAI; Anthropic</span> Image analysis and recommendation generation</li>
          <li><span>PostHog</span> Product analytics and session analysis</li>
          <li><span>Resend</span> Transactional email delivery</li>
          <li><span>Twilio</span> Delivery of one-time authentication codes by SMS</li>
          <li><span>Google</span> Authentication, and Calendar and Gmail where connected</li>
        </ul>

        <h3>3.2 Legal Disclosure</h3>
        <p>
          We may disclose information where we believe in good faith that disclosure is required by
          law, regulation, legal process, or governmental request, or is necessary to protect the
          rights, property, or safety of Yom, our users, or the public.
        </p>

        <h3>3.3 Business Transfers</h3>
        <p>
          If Yom is involved in a merger, acquisition, financing, reorganization, or sale of assets,
          information may be transferred as part of that transaction. We will provide notice before
          personal information becomes subject to a materially different privacy policy.
        </p>
      </section>

      <section>
        <h2><span className="num">4.</span> Google API Services User Data Policy</h2>
        <p>
          Yom&rsquo;s use and transfer of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically, data obtained from Google Calendar
          and Gmail is used solely to provide and improve user-facing features within the Services.
          Such data is not sold, is not used for advertising, is not used to train generalized
          artificial intelligence models, and is not accessed by human personnel except with your
          explicit consent in the course of support, where necessary for security purposes, or where
          required by law.
        </p>
      </section>

      <section>
        <h2><span className="num">5.</span> Data Retention</h2>
        <p>
          We retain personal information for as long as your account remains active. Following
          deletion of your account, we delete the associated personal information, except where
          retention is required for legal, accounting, or legitimate security purposes. Analytics
          data is retained in aggregate form and is no longer associated with you once your account
          is deleted.
        </p>
      </section>

      <section>
        <h2><span className="num">6.</span> Your Rights and Choices</h2>

        <h3>6.1 Access, Correction, and Deletion</h3>
        <p>
          You may delete your account and its associated data at any time from your profile. You may
          also request access to, correction of, a portable copy of, or deletion of your personal
          information by contacting <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We will respond
          within the period required by applicable law.
        </p>

        <h3>6.2 California Residents</h3>
        <p>
          If you are a California resident, the California Consumer Privacy Act, as amended, affords
          you the right to know what personal information we collect, the right to request deletion
          or correction, and the right to be free from discrimination for exercising those rights.
          Yom does not sell or share personal information as those terms are defined by that
          statute. Requests may be submitted to the address above.
        </p>

        <h3>6.3 Communications</h3>
        <p>
          You may opt out of non-essential email at any time using the unsubscribe link in any such
          message. Messages concerning your account, security, and these policies are not
          promotional and cannot be declined while your account remains open.
        </p>
      </section>

      <section>
        <h2><span className="num">7.</span> Security</h2>
        <p>
          We employ technical and organizational measures intended to protect personal information,
          including encryption in transit, access controls, and restricted administrative access. No
          method of transmission or storage is entirely secure, and we cannot guarantee absolute
          security.
        </p>
      </section>

      <section>
        <h2><span className="num">8.</span> International Users</h2>
        <p>
          The Services are operated from the United States, and personal information is processed
          and stored there. If you access the Services from outside the United States, you
          understand that your information will be transferred to, and processed in, the United
          States, where data protection law may differ from that of your jurisdiction.
        </p>
      </section>

      <section>
        <h2><span className="num">9.</span> Children</h2>
        <p>
          The Services are not directed to individuals under the age of sixteen, and we do not
          knowingly collect personal information from them. If we learn that we have collected such
          information, we will delete it. A parent or guardian who believes we hold information
          about a child may contact us at the address below.
        </p>
      </section>

      <section>
        <h2><span className="num">10.</span> Changes to This Policy</h2>
        <p>
          We may amend this Policy from time to time. Where an amendment materially affects your
          rights, we will provide notice by email before it takes effect. The date at the head of
          this document reflects the current version.
        </p>
      </section>

      <section>
        <h2><span className="num">11.</span> Contact</h2>
        <p>
          Questions, requests, and complaints regarding this Policy may be directed to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>
    </Shell>
  )
}

export function Terms() {
  return (
    <Shell
      title="Terms of Service"
      subtitle={`These Terms of Service (the “Terms”) constitute a binding agreement between you and ${ENTITY} (“Yom”, “we”, “us”, or “our”) governing your access to and use of youryom.com, the Yom mobile application, and the Yom browser extension (together, the “Services”). By accessing or using the Services, you agree to these Terms. If you do not agree, do not use the Services.`}
    >
      <section>
        <h2><span className="num">1.</span> The Services</h2>
        <p>
          Yom analyzes retail products, evaluates them against information you have provided about
          yourself, and issues a recommendation as to whether a given item is a suitable purchase.
          The Services also maintain a record of your wardrobe and of items you have purchased,
          retained, or returned.
        </p>
        <p>
          Yom is not a retailer. We do not sell merchandise, process payment for merchandise, or
          fulfill orders. Any purchase you make is a transaction between you and the relevant
          retailer, governed by that retailer&rsquo;s own terms.
        </p>
      </section>

      <section>
        <h2><span className="num">2.</span> Eligibility</h2>
        <p>
          You must be at least sixteen years of age to use the Services. By using the Services, you
          represent that you meet this requirement and that you are not barred from doing so under
          applicable law.
        </p>
      </section>

      <section>
        <h2><span className="num">3.</span> Accounts</h2>
        <p>
          You agree to provide accurate registration information and to maintain access to the email
          address or telephone number associated with your account. You are responsible for
          activity occurring under your account and for maintaining the confidentiality of your
          credentials. You must notify us promptly at{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> upon becoming aware of unauthorized access.
        </p>
      </section>

      <section>
        <h2><span className="num">4.</span> Nature of Recommendations</h2>
        <p>
          Recommendations issued by the Services are informational and do not constitute a
          guarantee, warranty, or professional advice of any kind. They are generated in part by
          automated systems that interpret product listings, published reviews, and sizing
          information, all of which may be incomplete, outdated, or incorrect.
        </p>
        <p>
          <strong>
            You are solely responsible for your purchasing decisions.
          </strong>{' '}
          You should independently verify any material fact — including fit, dimensions, materials,
          price, availability, and delivery timing — with the retailer before completing a purchase.
          Yom accepts no liability for the cost, suitability, condition, or timely delivery of goods
          purchased from a third party.
        </p>
      </section>

      <section>
        <h2><span className="num">5.</span> User Content</h2>
        <p>
          You retain all ownership rights in the photographs, descriptions, and other material you
          submit to the Services (&ldquo;User Content&rdquo;). You grant Yom a non-exclusive,
          worldwide, royalty-free license to host, store, reproduce, and process User Content solely
          to the extent necessary to operate the Services for you. This license terminates when you
          delete the relevant User Content or your account, subject to reasonable retention periods
          in routine backups.
        </p>
        <p>
          You represent that you hold the rights necessary to submit any User Content and that it
          does not infringe the rights of any third party.
        </p>
      </section>

      <section>
        <h2><span className="num">6.</span> Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Access the Services by automated means, or scrape, index, or harvest content, except as
            expressly permitted in writing;
          </li>
          <li>
            Use the Services, or data obtained from them, to develop a competing product or service;
          </li>
          <li>
            Attempt to gain unauthorized access to any account, system, or data, or to probe, scan,
            or test the vulnerability of our infrastructure;
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the Services, including by
            imposing an unreasonable load;
          </li>
          <li>Reverse engineer or decompile any part of the Services; or</li>
          <li>Use the Services for any unlawful purpose or in violation of these Terms.</li>
        </ul>
        <p>
          We may suspend or terminate accounts that engage in the foregoing.
        </p>
      </section>

      <section>
        <h2><span className="num">7.</span> Intellectual Property</h2>
        <p>
          The Services, including all software, text, design, and the Yom name and marks, are owned
          by Yom and protected by intellectual property law. Except for the limited right to use the
          Services in accordance with these Terms, no rights are granted to you.
        </p>
      </section>

      <section>
        <h2><span className="num">8.</span> Third-Party Services</h2>
        <p>
          The Services link to and interoperate with third-party websites and services, including
          retailers and, at your election, Google. We do not control and are not responsible for
          the content, policies, or practices of any third party. Your use of a third-party service
          is governed by that party&rsquo;s terms.
        </p>
      </section>

      <section>
        <h2><span className="num">9.</span> Disclaimer of Warranties</h2>
        <p>
          The Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
          To the fullest extent permitted by law, Yom disclaims all warranties, express or implied,
          including the implied warranties of merchantability, fitness for a particular purpose,
          title, and non-infringement. We do not warrant that the Services will be uninterrupted,
          error-free, or that any recommendation will prove accurate.
        </p>
      </section>

      <section>
        <h2><span className="num">10.</span> Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Yom will not be liable for any indirect,
          incidental, special, consequential, exemplary, or punitive damages, or for any loss of
          profits, revenue, data, or goodwill, arising out of or relating to your use of the
          Services. Our aggregate liability arising out of or relating to these Terms or the
          Services will not exceed the greater of one hundred United States dollars (US $100) or the
          amount you paid us in the twelve months preceding the event giving rise to the claim.
        </p>
        <p>
          Some jurisdictions do not permit the exclusion of certain warranties or the limitation of
          certain damages. Where that is the case, the foregoing applies only to the extent
          permitted, and you may have additional rights.
        </p>
      </section>

      <section>
        <h2><span className="num">11.</span> Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Yom and its officers, directors, employees, and
          agents from any claim, liability, damage, loss, or expense, including reasonable legal
          fees, arising out of your use of the Services, your User Content, or your breach of these
          Terms.
        </p>
      </section>

      <section>
        <h2><span className="num">12.</span> Term and Termination</h2>
        <p>
          You may terminate these Terms at any time by deleting your account. We may suspend or
          terminate your access if you breach these Terms, if required by law, or if continued
          provision of the Services to you would create liability or risk for Yom. Where permitted,
          we will provide notice and a statement of the reason. Sections 5, 7, and 9 through 13
          survive termination.
        </p>
      </section>

      <section>
        <h2><span className="num">13.</span> Governing Law and Disputes</h2>
        <p>
          These Terms are governed by the laws of the State of Delaware, United States, without
          regard to its conflict of law rules. The state and federal courts located in Delaware will
          have exclusive jurisdiction over any dispute arising out of or relating to these Terms,
          and you consent to their jurisdiction and venue. Nothing in this section deprives you of
          the protection of mandatory consumer protection law in your place of residence.
        </p>
      </section>

      <section>
        <h2><span className="num">14.</span> Changes to These Terms</h2>
        <p>
          We may amend these Terms. Where an amendment materially affects your rights, we will
          provide notice by email before it takes effect. Continued use of the Services following
          the effective date constitutes acceptance of the amended Terms.
        </p>
      </section>

      <section>
        <h2><span className="num">15.</span> General</h2>
        <p>
          These Terms, together with the Privacy Policy, constitute the entire agreement between you
          and Yom concerning the Services. If any provision is held unenforceable, the remaining
          provisions remain in effect. Our failure to enforce a provision is not a waiver of it. You
          may not assign these Terms without our written consent; we may assign them in connection
          with a merger, acquisition, or sale of assets.
        </p>
      </section>

      <section>
        <h2><span className="num">16.</span> Contact</h2>
        <p>
          Questions regarding these Terms may be directed to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>
    </Shell>
  )
}
