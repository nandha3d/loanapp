import type { MetadataRoute } from 'next';
import { siteConfig } from './(marketing)/_components/seo';

/**
 * robots.txt served at /robots.txt. Allows crawlers to index the public
 * marketing pages while keeping authenticated app areas out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/portal',
          '/login',
          '/register',
          '/borrower',
          '/affiliate',
          '/dashboard',
          '/customers',
          '/loans',
          '/collection',
          '/wallet',
          '/accounting',
          '/settings',
          '/subscription',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
