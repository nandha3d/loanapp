import Link from 'next/link';
import { Arrow } from './icons';

export default function CtaBand({
  title = 'Ready to modernise your lending business?',
  text = 'Join lenders who run collection, loans, and accounts from one platform. Start free — no card required.',
  primary = { href: '/contact', label: 'Request a Demo' },
  secondary = { href: '/pricing', label: 'View Pricing' },
}: {
  title?: string;
  text?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="mk-section mk-section--tight">
      <div className="mk-container">
        <div className="mk-cta">
          <h2 className="mk-h2">{title}</h2>
          <p className="mk-lead">{text}</p>
          <div className="mk-cta__actions">
            <Link href={primary.href} className="mk-btn mk-btn--primary mk-btn--lg">
              {primary.label} <Arrow />
            </Link>
            <Link href={secondary.href} className="mk-btn mk-btn--light mk-btn--lg">
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
