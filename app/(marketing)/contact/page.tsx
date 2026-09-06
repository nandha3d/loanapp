'use client';

import { useState } from 'react';
import { Phone, Mail, MapPin, Headset, CheckCircle, Arrow } from '../_components/icons';

const CONTACTS = [
  { ic: Phone, v: 'mk-ic--amber', t: 'Call us', d: '+91 98765 43210 · Mon–Sat, 9am–7pm IST' },
  { ic: Mail, v: 'mk-ic--blue', t: 'Email us', d: 'hello@loantrack.in' },
  { ic: Headset, v: 'mk-ic--green', t: 'Support', d: 'support@loantrack.in · for existing customers' },
  { ic: MapPin, v: 'mk-ic--purple', t: 'Office', d: 'India · serving lenders nationwide' },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No backend wired yet — show confirmation. Hook this up to an API route
    // or server action (e.g. POST /api/v1/leads) when ready.
    setSent(true);
  }

  return (
    <>
      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Contact</span>
          <h1 className="mk-h1">Let&apos;s talk lending</h1>
          <p className="mk-lead">
            Request a demo, ask a question, or get help getting started. We usually reply
            within one business day.
          </p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-contact">
            <div>
              <span className="mk-eyebrow">Get in touch</span>
              <h2 className="mk-h2">We&apos;re here to help</h2>
              <p className="mk-lead" style={{ marginTop: 14 }}>
                Whether you run one collection line or a multi-branch NBFC, we&apos;ll show
                you exactly how ZoloFund fits your operation.
              </p>
              <div className="mk-contact__list">
                {CONTACTS.map((c) => (
                  <div className="mk-contact__item" key={c.t}>
                    <span className={`mk-card__ic ${c.v}`}><c.ic /></span>
                    <div><b>{c.t}</b><span>{c.d}</span></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mk-form">
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 12px' }}>
                  <span className="mk-card__ic mk-ic--green" style={{ margin: '0 auto 18px', width: 60, height: 60 }}>
                    <CheckCircle />
                  </span>
                  <h3 className="mk-h3" style={{ fontSize: '1.3rem', marginBottom: 8 }}>Thank you!</h3>
                  <p style={{ color: 'var(--mk-text-soft)' }}>
                    We&apos;ve received your request and will be in touch shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mk-form__row">
                    <div className="mk-field">
                      <label htmlFor="c-name">Full name</label>
                      <input id="c-name" name="name" type="text" placeholder="Your name" required />
                    </div>
                    <div className="mk-field">
                      <label htmlFor="c-company">Company</label>
                      <input id="c-company" name="company" type="text" placeholder="Business name" />
                    </div>
                  </div>
                  <div className="mk-form__row">
                    <div className="mk-field">
                      <label htmlFor="c-email">Email</label>
                      <input id="c-email" name="email" type="email" placeholder="you@company.com" required />
                    </div>
                    <div className="mk-field">
                      <label htmlFor="c-phone">Phone</label>
                      <input id="c-phone" name="phone" type="tel" placeholder="+91 ..." />
                    </div>
                  </div>
                  <div className="mk-field">
                    <label htmlFor="c-type">I am a</label>
                    <select id="c-type" name="type" defaultValue="">
                      <option value="" disabled>Select your business type</option>
                      <option>Micro-lender / Individual financier</option>
                      <option>NBFC</option>
                      <option>Chit-fund company</option>
                      <option>Gold / Auto financier</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="mk-field">
                    <label htmlFor="c-msg">Message</label>
                    <textarea id="c-msg" name="message" placeholder="Tell us a little about your lending business..." />
                  </div>
                  <button type="submit" className="mk-btn mk-btn--primary mk-btn--lg" style={{ width: '100%' }}>
                    Request a Demo <Arrow />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
