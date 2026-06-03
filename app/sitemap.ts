import type { MetadataRoute } from 'next';
import { siteConfig } from './(marketing)/_components/seo';

/**
 * XML sitemap for the public marketing site, served at /sitemap.xml.
 * Only public, indexable pages are listed — authenticated app routes are
 * intentionally excluded (see robots.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/home', priority: 1.0, freq: 'weekly' },
    { path: '/products', priority: 0.9, freq: 'weekly' },
    { path: '/solutions', priority: 0.9, freq: 'weekly' },
    { path: '/pricing', priority: 0.8, freq: 'weekly' },
    { path: '/about-us', priority: 0.6, freq: 'monthly' },
    { path: '/contact', priority: 0.7, freq: 'monthly' },
  ];

  return pages.map((p) => ({
    url: `${siteConfig.url}${p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
