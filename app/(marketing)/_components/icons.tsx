/* Inline SVG icon set for the marketing site. Stroke-based, inherit currentColor.
   No external icon dependency so the public site stays self-contained. */
import type { SVGProps } from 'react';

type I = SVGProps<SVGSVGElement>;
const base = (p: I) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p,
});

export const Coins = (p: I) => (
  <svg {...base(p)}><ellipse cx="8" cy="6" rx="6" ry="3" /><path d="M2 6v6c0 1.66 2.69 3 6 3s6-1.34 6-3V6" /><path d="M2 12v6c0 1.66 2.69 3 6 3 1.5 0 2.87-.28 3.9-.74" /><circle cx="17" cy="15" r="5" /><path d="M17 13v4M15 15h4" /></svg>
);
export const MapPin = (p: I) => (
  <svg {...base(p)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
export const Car = (p: I) => (
  <svg {...base(p)}><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><path d="M5 11h14" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /></svg>
);
export const Gem = (p: I) => (
  <svg {...base(p)}><path d="M6 3h12l4 6-10 12L2 9Z" /><path d="M2 9h20M9 3 7 9l5 12M15 3l2 6-5 12" /></svg>
);
export const Users = (p: I) => (
  <svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
export const Shield = (p: I) => (
  <svg {...base(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const Chart = (p: I) => (
  <svg {...base(p)}><path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 5-6" /></svg>
);
export const Wallet = (p: I) => (
  <svg {...base(p)}><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M16 12h.01" /></svg>
);
export const Book = (p: I) => (
  <svg {...base(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
);
export const Bell = (p: I) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);
export const Phone = (p: I) => (
  <svg {...base(p)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
);
export const Mail = (p: I) => (
  <svg {...base(p)}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
);
export const Globe = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>
);
export const Smartphone = (p: I) => (
  <svg {...base(p)}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
);
export const Check = (p: I) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const CheckCircle = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
);
export const Arrow = (p: I) => (
  <svg {...base(p)}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);
export const Menu = (p: I) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const Close = (p: I) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const Lock = (p: I) => (
  <svg {...base(p)}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
export const Zap = (p: I) => (
  <svg {...base(p)}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg>
);
export const Layers = (p: I) => (
  <svg {...base(p)}><path d="m12 2 10 5-10 5L2 7l10-5Z" /><path d="m2 12 10 5 10-5M2 17l10 5 10-5" /></svg>
);
export const Doc = (p: I) => (
  <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
);
export const Heart = (p: I) => (
  <svg {...base(p)}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
);
export const Target = (p: I) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
export const Building = (p: I) => (
  <svg {...base(p)}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" /></svg>
);
export const Headset = (p: I) => (
  <svg {...base(p)}><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /><path d="M21 14v3a4 4 0 0 1-4 4h-5" /></svg>
);
export const Twitter = (p: I) => (
  <svg {...base(p)}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2Z" /></svg>
);
export const LinkedIn = (p: I) => (
  <svg {...base(p)}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
);
