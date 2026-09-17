import { buildMetadata } from '../_components/seo';

// The contact page itself is a Client Component (it has form state), so its
// SEO metadata lives here in a server-side layout for this route segment.
export const metadata = buildMetadata({
  title: 'Contact & Request a Demo — Loan Tracking Software',
  description:
    'Request a demo of ZoloFund loan tracking software or get in touch with our team. See how GPS collection, multi-module lending and accounting fit your business.',
  path: '/contact',
  keywords: ['loan software demo', 'loan management software demo', 'loan tracking software contact'],
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
