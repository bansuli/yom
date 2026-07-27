import { Glasses, PinkBag, Necklace } from '../Stickers'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'

export default function Contact() {
  return (
    <section className="contact page-screen">
      <BrowserChrome path="yom.studio/contact" />
      <TiltedNav />
      <PageHeader />

      <div className="contact-body">
        <Glasses className="fit contact-glasses bob" />
        <PinkBag className="fit contact-bag float-med" />
        <Necklace className="fit contact-necklace" />

        <h1 className="page-title">
          <span className="tilt-down">say</span>
          <span className="tilt-up">hello</span>
        </h1>

        <dl className="contact-list">
          <div className="contact-row">
            <dt>email</dt>
            <dd>
              <a href="mailto:hello@yom.studio">hello@yom.studio</a>
            </dd>
          </div>
          <div className="contact-row">
            <dt>studio</dt>
            <dd>visits by appointment</dd>
          </div>
          <div className="contact-row">
            <dt>ig</dt>
            <dd>@yom.studio</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
